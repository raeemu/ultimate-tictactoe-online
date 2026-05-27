import { Injectable } from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createInitialState } from '../../game';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

type MatchmakingMatch = {
  id: string;
  status: MatchStatus;
  playerXId: string;
  playerOId: string | null;
  currentTurn: string;
  activeBoard: number | null;
  createdAt: Date;
  startedAt: Date | null;
};

@Injectable()
export class MatchmakingService {
  private readonly queueKey = 'matchmaking:queue';
  private readonly lockKey = 'matchmaking:lock';
  private readonly ratingWindowStep = 25;
  private readonly ratingWindowStepMs = 3000;
  private readonly pendingMatchTtlSeconds = 30 * 60;
  private readonly lockAcquireTimeoutMs = 5000;
  private readonly lockTtlMs = 15000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async getQueueStatus(userId: string) {
    const pendingMatch = await this.consumePendingMatch(userId);
    if (pendingMatch) {
      return {
        status: 'MATCH_FOUND' as const,
        match: pendingMatch,
      };
    }

    if (await this.isQueued(userId)) {
      return this.joinQueue(userId);
    }

    return {
      status: 'NOT_IN_QUEUE' as const,
    };
  }

  async joinQueue(userId: string) {
    const pendingMatch = await this.consumePendingMatch(userId);
    if (pendingMatch) {
      return {
        status: 'MATCH_FOUND' as const,
        match: pendingMatch,
      };
    }

    return this.withLock(async () => {
      const lockedPendingMatch = await this.consumePendingMatch(userId);
      if (lockedPendingMatch) {
        return {
          status: 'MATCH_FOUND' as const,
          match: lockedPendingMatch,
        };
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { rating: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const waitingOpponent = await this.dequeueOpponent(userId, user.rating);

      if (!waitingOpponent) {
        await this.enqueueUser(userId, user.rating);

        return {
          status: 'SEARCHING' as const,
        };
      }

      const initial = createInitialState();
      const match = await this.prisma.match.create({
        data: {
          status: MatchStatus.ACTIVE,
          playerXId: waitingOpponent,
          playerOId: userId,
          currentTurn: initial.currentTurn,
          activeBoard: initial.activeBoard,
          boardState: initial.cells,
          macroboardState: initial.miniBoards,
          startedAt: new Date(),
        },
        select: {
          id: true,
          status: true,
          playerXId: true,
          playerOId: true,
          currentTurn: true,
          activeBoard: true,
          createdAt: true,
          startedAt: true,
        },
      });

      await this.setPendingMatch(waitingOpponent, match);

      return {
        status: 'MATCH_FOUND' as const,
        match,
      };
    });
  }

  async leaveQueue(userId: string) {
    const removed = await this.removeFromQueue(userId);

    return {
      status: removed ? 'LEFT_QUEUE' : 'NOT_IN_QUEUE',
    };
  }

  async getQueueSize() {
    return this.redis.zcard(this.queueKey);
  }

  private get redis() {
    return this.redisService.client;
  }

  private async consumePendingMatch(
    userId: string,
  ): Promise<MatchmakingMatch | null> {
    const rawMatch = await this.redis.call(
      'GETDEL',
      this.pendingMatchKey(userId),
    );
    if (!rawMatch || typeof rawMatch !== 'string') {
      return null;
    }

    await this.removeFromQueue(userId);
    return this.parsePendingMatch(rawMatch);
  }

  private async dequeueOpponent(
    userId: string,
    rating: number,
  ): Promise<string | null> {
    const ratingWindow = await this.getCurrentRatingWindow(userId);
    const min = rating - ratingWindow;
    const max = rating + ratingWindow;
    const candidates = await this.redis.zrangebyscore(
      this.queueKey,
      min,
      max,
      'LIMIT',
      0,
      10,
    );

    for (const opponentId of candidates) {
      if (opponentId === userId) {
        continue;
      }

      const removed = await this.redis.zrem(this.queueKey, opponentId);
      if (removed > 0) {
        return opponentId;
      }
    }

    return null;
  }

  private async enqueueUser(userId: string, rating: number) {
    const added = await this.redis.zadd(this.queueKey, 'NX', rating, userId);
    if (added) {
      await this.redis.set(this.queueMetaKey(userId), String(Date.now()));
    }
  }

  private async isQueued(userId: string) {
    return (await this.redis.zscore(this.queueKey, userId)) !== null;
  }

  private async removeFromQueue(userId: string) {
    const removed = await this.redis.zrem(this.queueKey, userId);
    if (removed > 0) {
      await this.redis.del(this.queueMetaKey(userId));
    }
    return removed > 0;
  }

  private async getCurrentRatingWindow(userId: string) {
    const queuedAtRaw = await this.redis.get(this.queueMetaKey(userId));
    if (!queuedAtRaw) {
      return 0;
    }

    const elapsedMs = Math.max(Date.now() - Number(queuedAtRaw), 0);
    return (
      Math.floor(elapsedMs / this.ratingWindowStepMs) * this.ratingWindowStep
    );
  }

  private queueMetaKey(userId: string) {
    return `matchmaking:queue:meta:${userId}`;
  }

  private async setPendingMatch(userId: string, match: MatchmakingMatch) {
    await this.redis.set(
      this.pendingMatchKey(userId),
      JSON.stringify(match),
      'EX',
      this.pendingMatchTtlSeconds,
    );
  }

  private pendingMatchKey(userId: string) {
    return `matchmaking:pending:${userId}`;
  }

  private parsePendingMatch(rawMatch: string): MatchmakingMatch {
    const match = JSON.parse(rawMatch) as Omit<
      MatchmakingMatch,
      'createdAt' | 'startedAt'
    > & {
      createdAt: string;
      startedAt: string | null;
    };

    return {
      ...match,
      createdAt: new Date(match.createdAt),
      startedAt: match.startedAt ? new Date(match.startedAt) : null,
    };
  }

  private async withLock<T>(callback: () => Promise<T>): Promise<T> {
    const token = randomUUID();
    const deadline = Date.now() + this.lockAcquireTimeoutMs;

    while (Date.now() < deadline) {
      const locked = await this.redis.set(
        this.lockKey,
        token,
        'PX',
        this.lockTtlMs,
        'NX',
      );

      if (locked === 'OK') {
        try {
          return await callback();
        } finally {
          await this.releaseLock(token);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    throw new Error('Matchmaking queue is busy');
  }

  private async releaseLock(token: string) {
    await this.redis.eval(
      `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      end

      return 0
      `,
      1,
      this.lockKey,
      token,
    );
  }
}
