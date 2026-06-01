import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MatchStatus, Prisma } from '@prisma/client';
import { MoveInput } from '../../game';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import {
  isParticipant,
  LEADERBOARD_CACHE_KEY,
  MATCH_ACCEPT_TTL_SECONDS,
  matchSnapshotSelect,
  MOVE_IDEMPOTENCY_TTL_SECONDS,
  MOVE_PROCESSING_TTL_MS,
  RATING_DELTA,
  resolveOpponentId,
} from './matches.helpers';
import { createMoveOnce } from './matches.move';

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async getMatchSnapshotForUser(matchId: string, userId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: matchSnapshotSelect,
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    if (!isParticipant(match.playerXId, match.playerOId, userId)) {
      throw new ForbiddenException('User is not a participant of this match');
    }

    return match;
  }

  async abandonMatch(matchId: string, userId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        status: true,
        playerXId: true,
        playerOId: true,
        abandonedById: true,
      },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    if (!isParticipant(match.playerXId, match.playerOId, userId)) {
      throw new ForbiddenException('User is not a participant of this match');
    }

    if (
      match.status === MatchStatus.ABANDONED ||
      match.status === MatchStatus.FINISHED
    ) {
      return this.getMatchSnapshotForUser(matchId, userId);
    }

    if (match.status === MatchStatus.WAITING) {
      return this.prisma.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.ABANDONED,
          abandonedById: userId,
          finishedAt: new Date(),
        },
        select: matchSnapshotSelect,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const winnerId = resolveOpponentId(
        match.playerXId,
        match.playerOId,
        userId,
      );
      const updatedMatch = await tx.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.ABANDONED,
          winnerId,
          abandonedById: userId,
          finishedAt: new Date(),
        },
        select: matchSnapshotSelect,
      });

      if (winnerId) {
        await this.applyRatingDelta(tx, winnerId, userId);
      }

      return updatedMatch;
    });
  }

  async acceptMatch(matchId: string, userId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        status: true,
        playerXId: true,
        playerOId: true,
      },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    if (!isParticipant(match.playerXId, match.playerOId, userId)) {
      throw new ForbiddenException('User is not a participant of this match');
    }

    if (match.status === MatchStatus.ACTIVE) {
      return this.getMatchSnapshotForUser(matchId, userId);
    }

    if (match.status !== MatchStatus.WAITING) {
      throw new BadRequestException('Match cannot be accepted');
    }

    const acceptedKey = this.matchAcceptedKey(matchId);
    await this.redis.sadd(acceptedKey, userId);
    await this.redis.expire(acceptedKey, MATCH_ACCEPT_TTL_SECONDS);

    const acceptedCount = await this.redis.scard(acceptedKey);
    if (acceptedCount < 2) {
      return this.getMatchSnapshotWithAcceptedPlayers(matchId, userId);
    }

    const updatedMatch = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.ACTIVE,
        startedAt: new Date(),
      },
      select: matchSnapshotSelect,
    });
    await this.redis.del(acceptedKey);

    return updatedMatch;
  }

  private async getMatchSnapshotWithAcceptedPlayers(
    matchId: string,
    userId: string,
  ) {
    const snapshot = await this.getMatchSnapshotForUser(matchId, userId);
    return {
      ...snapshot,
      acceptedPlayerIds: await this.redis.smembers(this.matchAcceptedKey(matchId)),
    };
  }

  async createMove(
    matchId: string,
    userId: string,
    move: MoveInput & { clientMoveId?: string },
  ) {
    if (move.clientMoveId) {
      return this.createMoveIdempotently(matchId, userId, {
        ...move,
        clientMoveId: move.clientMoveId,
      });
    }

    return this.createMoveOnce(matchId, userId, move);
  }

  async timeoutCurrentTurn(matchId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockMatchForUpdate(tx, matchId);

      const match = await tx.match.findUnique({
        where: { id: matchId },
        select: {
          id: true,
          status: true,
          playerXId: true,
          playerOId: true,
          currentTurn: true,
        },
      });

      if (!match) {
        return null;
      }

      if (match.status !== MatchStatus.ACTIVE) {
        return tx.match.findUnique({
          where: { id: matchId },
          select: matchSnapshotSelect,
        });
      }

      return tx.match.update({
        where: { id: matchId },
        data: {
          currentTurn: match.currentTurn === 'X' ? 'O' : 'X',
        },
        select: matchSnapshotSelect,
      });
    });
  }

  private async createMoveIdempotently(
    matchId: string,
    userId: string,
    move: MoveInput & { clientMoveId: string },
  ) {
    const key = this.moveIdempotencyKey(matchId, userId, move.clientMoveId);
    const cached = await this.redis.get(key);
    if (cached && cached !== 'PROCESSING') {
      return JSON.parse(cached) as Awaited<
        ReturnType<typeof this.createMoveOnce>
      >;
    }

    const acquired = await this.redis.set(
      key,
      'PROCESSING',
      'PX',
      MOVE_PROCESSING_TTL_MS,
      'NX',
    );

    if (acquired !== 'OK') {
      return this.waitForIdempotentMove(key);
    }

    try {
      const result = await this.createMoveOnce(matchId, userId, move);
      await this.redis.set(
        key,
        JSON.stringify(result),
        'EX',
        MOVE_IDEMPOTENCY_TTL_SECONDS,
      );
      return result;
    } catch (error) {
      await this.redis.del(key);
      throw error;
    }
  }

  private async waitForIdempotentMove(key: string) {
    const deadline = Date.now() + MOVE_PROCESSING_TTL_MS;

    while (Date.now() < deadline) {
      const cached = await this.redis.get(key);
      if (cached && cached !== 'PROCESSING') {
        return JSON.parse(cached) as Awaited<
          ReturnType<typeof this.createMoveOnce>
        >;
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    throw new ConflictException('Move is still being processed');
  }

  private async createMoveOnce(
    matchId: string,
    userId: string,
    move: MoveInput,
  ) {
    return createMoveOnce(
      {
        applyRatingDelta: this.applyRatingDelta.bind(this),
        lockMatchForUpdate: this.lockMatchForUpdate.bind(this),
        prisma: this.prisma,
        redis: this.redis,
      },
      matchId,
      userId,
      move,
    );
  }

  private async applyRatingDelta(
    tx: Prisma.TransactionClient,
    winnerId: string,
    loserId: string,
  ) {
    await tx.user.update({
      where: { id: winnerId },
      data: {
        rating: {
          increment: RATING_DELTA,
        },
      },
    });

    await tx.user.update({
      where: { id: loserId },
      data: {
        rating: {
          decrement: RATING_DELTA,
        },
      },
    });

    await this.redis.del(LEADERBOARD_CACHE_KEY);
  }

  private get redis() {
    return this.redisService.client;
  }

  private async lockMatchForUpdate(
    tx: Prisma.TransactionClient,
    matchId: string,
  ) {
    const lockQuery = Prisma.sql`
      SELECT id FROM "Match" WHERE id = ${matchId} FOR UPDATE
    `;
    await tx.$queryRaw(lockQuery);
  }

  private moveIdempotencyKey(
    matchId: string,
    userId: string,
    clientMoveId: string,
  ) {
    return `move:idempotency:${matchId}:${userId}:${clientMoveId}`;
  }

  private matchAcceptedKey(matchId: string) {
    return `match:accepted:${matchId}`;
  }

}
