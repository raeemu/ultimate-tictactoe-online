import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MatchStatus, Prisma } from '@prisma/client';
import {
  applyMove,
  GameRuleError,
  MoveInput,
  UltimateGameState,
} from '../../game';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

const matchSnapshotSelect = {
  id: true,
  status: true,
  playerXId: true,
  playerOId: true,
  currentTurn: true,
  activeBoard: true,
  boardState: true,
  macroboardState: true,
  winnerId: true,
  abandonedById: true,
  finishedAt: true,
  updatedAt: true,
} satisfies Prisma.MatchSelect;

const RATING_DELTA = 25;
const MOVE_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;
const MOVE_PROCESSING_TTL_MS = 10000;
const LEADERBOARD_CACHE_KEY = 'leaderboard:rating:top';

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

    if (!this.isParticipant(match.playerXId, match.playerOId, userId)) {
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

    if (!this.isParticipant(match.playerXId, match.playerOId, userId)) {
      throw new ForbiddenException('User is not a participant of this match');
    }

    if (
      match.status === MatchStatus.ABANDONED ||
      match.status === MatchStatus.FINISHED
    ) {
      return this.getMatchSnapshotForUser(matchId, userId);
    }

    return this.prisma.$transaction(async (tx) => {
      const winnerId = this.resolveOpponentId(
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
      await tx.$queryRaw`SELECT id FROM "Match" WHERE id = ${matchId} FOR UPDATE`;

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
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "Match" WHERE id = ${matchId} FOR UPDATE`;

          const match = await tx.match.findUnique({
            where: { id: matchId },
            select: {
              id: true,
              status: true,
              playerXId: true,
              playerOId: true,
              currentTurn: true,
              activeBoard: true,
              boardState: true,
              macroboardState: true,
              winnerId: true,
              moves: {
                orderBy: { moveNumber: 'desc' },
                take: 1,
                select: { moveNumber: true },
              },
            },
          });

          if (!match) {
            throw new NotFoundException('Match not found');
          }

          if (match.status !== MatchStatus.ACTIVE) {
            throw new BadRequestException('Match is not active');
          }

          const playerSymbol = this.resolvePlayerSymbol(
            match.playerXId,
            match.playerOId,
            userId,
          );
          if (!playerSymbol) {
            throw new ForbiddenException(
              'User is not a participant of this match',
            );
          }

          const currentState: UltimateGameState = {
            cells: match.boardState as UltimateGameState['cells'],
            miniBoards:
              match.macroboardState as UltimateGameState['miniBoards'],
            activeBoard: match.activeBoard,
            currentTurn: match.currentTurn,
            status: 'ONGOING',
            winner:
              match.winnerId === match.playerXId
                ? 'X'
                : match.winnerId === match.playerOId
                  ? 'O'
                  : null,
            moveCount: match.moves[0]?.moveNumber ?? 0,
          };

          let nextState: UltimateGameState;
          try {
            nextState = applyMove(currentState, move, playerSymbol);
          } catch (error) {
            if (error instanceof GameRuleError) {
              throw new BadRequestException(error.message);
            }

            throw error;
          }

          const moveNumber = (match.moves[0]?.moveNumber ?? 0) + 1;
          const { globalRow, globalCol } = this.toGlobalCoordinates(
            move.localBoard,
            move.localCell,
          );

          const winnerId =
            nextState.winner === 'X'
              ? match.playerXId
              : nextState.winner === 'O'
                ? match.playerOId
                : null;

          const updatedMatch = await tx.match.update({
            where: { id: match.id },
            data: {
              status:
                nextState.status === 'FINISHED'
                  ? MatchStatus.FINISHED
                  : MatchStatus.ACTIVE,
              currentTurn: nextState.currentTurn,
              activeBoard: nextState.activeBoard,
              boardState: nextState.cells,
              macroboardState: nextState.miniBoards,
              winnerId,
              finishedAt: nextState.status === 'FINISHED' ? new Date() : null,
            },
            select: matchSnapshotSelect,
          });

          const createdMove = await tx.move.create({
            data: {
              matchId: match.id,
              userId,
              moveNumber,
              localBoard: move.localBoard,
              localCell: move.localCell,
              globalRow,
              globalCol,
              symbol: playerSymbol,
            },
            select: {
              id: true,
              matchId: true,
              userId: true,
              moveNumber: true,
              localBoard: true,
              localCell: true,
              globalRow: true,
              globalCol: true,
              symbol: true,
              createdAt: true,
            },
          });

          if (nextState.status === 'FINISHED' && winnerId) {
            const loserId =
              winnerId === match.playerXId ? match.playerOId : match.playerXId;
            if (loserId) {
              await this.applyRatingDelta(tx, winnerId, loserId);
            }
          }

          if (nextState.status === 'FINISHED') {
            await this.redis.del(LEADERBOARD_CACHE_KEY);
          }

          return {
            match: updatedMatch,
            move: createdMove,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2034') {
          throw new ConflictException('Move conflict, retry request');
        }

        if (error.code === 'P2002') {
          throw new ConflictException('Duplicate move conflict, retry request');
        }
      }

      throw error;
    }
  }

  private isParticipant(
    playerXId: string,
    playerOId: string | null,
    userId: string,
  ): boolean {
    return playerXId === userId || playerOId === userId;
  }

  private resolveOpponentId(
    playerXId: string,
    playerOId: string | null,
    userId: string,
  ): string | null {
    if (playerXId === userId) {
      return playerOId;
    }

    if (playerOId === userId) {
      return playerXId;
    }

    return null;
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

  private moveIdempotencyKey(
    matchId: string,
    userId: string,
    clientMoveId: string,
  ) {
    return `move:idempotency:${matchId}:${userId}:${clientMoveId}`;
  }

  private resolvePlayerSymbol(
    playerXId: string,
    playerOId: string | null,
    userId: string,
  ): 'X' | 'O' | null {
    if (playerXId === userId) {
      return 'X';
    }

    if (playerOId === userId) {
      return 'O';
    }

    return null;
  }

  private toGlobalCoordinates(localBoard: number, localCell: number) {
    const boardRow = Math.floor(localBoard / 3);
    const boardCol = localBoard % 3;
    const cellRow = Math.floor(localCell / 3);
    const cellCol = localCell % 3;

    return {
      globalRow: boardRow * 3 + cellRow,
      globalCol: boardCol * 3 + cellCol,
    };
  }
}
