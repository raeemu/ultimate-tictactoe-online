import { Injectable } from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createInitialState } from '../../game';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from './redis.service';

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
  private readonly queueMembersKey = 'matchmaking:queue:members';
  private readonly lockKey = 'matchmaking:lock';
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

    return {
      status: (await this.isQueued(userId))
        ? ('SEARCHING' as const)
        : ('NOT_IN_QUEUE' as const),
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

      const waitingOpponent = await this.dequeueOpponent(userId);

      if (!waitingOpponent) {
        await this.enqueueUser(userId);

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
    return this.redis.llen(this.queueKey);
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

  private async dequeueOpponent(userId: string): Promise<string | null> {
    while (await this.redis.llen(this.queueKey)) {
      const opponentId = await this.redis.lpop(this.queueKey);
      if (!opponentId) {
        return null;
      }

      const wasQueued = await this.redis.srem(this.queueMembersKey, opponentId);
      if (wasQueued && opponentId !== userId) {
        return opponentId;
      }
    }

    return null;
  }

  private async enqueueUser(userId: string) {
    const added = await this.redis.sadd(this.queueMembersKey, userId);

    if (added) {
      await this.redis.rpush(this.queueKey, userId);
    }
  }

  private async isQueued(userId: string) {
    return (await this.redis.sismember(this.queueMembersKey, userId)) === 1;
  }

  private async removeFromQueue(userId: string) {
    const removed = await this.redis.srem(this.queueMembersKey, userId);
    await this.redis.lrem(this.queueKey, 0, userId);

    return removed > 0;
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
