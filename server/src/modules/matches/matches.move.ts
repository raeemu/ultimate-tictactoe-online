import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import {
  buildGameState,
  LEADERBOARD_CACHE_KEY,
  matchSnapshotSelect,
  resolvePlayerSymbol,
  resolveWinnerId,
  toGlobalCoordinates,
} from './matches.helpers';

type MoveDependencies = {
  applyRatingDelta: (
    tx: Prisma.TransactionClient,
    winnerId: string,
    loserId: string,
  ) => Promise<void>;
  lockMatchForUpdate: (
    tx: Prisma.TransactionClient,
    matchId: string,
  ) => Promise<void>;
  prisma: PrismaService;
  redis: {
    del(key: string): Promise<unknown>;
  };
};

export async function createMoveOnce(
  deps: MoveDependencies,
  matchId: string,
  userId: string,
  move: MoveInput,
) {
  try {
    return await deps.prisma.$transaction(
      (tx) => createMoveInTransaction(deps, tx, matchId, userId, move),
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

async function createMoveInTransaction(
  deps: MoveDependencies,
  tx: Prisma.TransactionClient,
  matchId: string,
  userId: string,
  move: MoveInput,
) {
  await deps.lockMatchForUpdate(tx, matchId);
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

  const playerSymbol = resolvePlayerSymbol(match.playerXId, match.playerOId, userId);
  if (!playerSymbol) {
    throw new ForbiddenException('User is not a participant of this match');
  }

  const nextState = applyMoveSafely(buildGameState(match), move, playerSymbol);
  const moveNumber = (match.moves[0]?.moveNumber ?? 0) + 1;
  const { globalRow, globalCol } = toGlobalCoordinates(
    move.localBoard,
    move.localCell,
  );
  const winnerId = resolveWinnerId(
    nextState.winner,
    match.playerXId,
    match.playerOId,
  );

  const updatedMatch = await updateMatch(tx, match.id, nextState, winnerId);
  const createdMove = await createMoveRecord(
    tx,
    match.id,
    userId,
    move,
    moveNumber,
    { globalCol, globalRow, playerSymbol },
  );

  if (nextState.status === 'FINISHED' && winnerId) {
    const loserId = winnerId === match.playerXId ? match.playerOId : match.playerXId;
    if (loserId) {
      await deps.applyRatingDelta(tx, winnerId, loserId);
    }
  }

  if (nextState.status === 'FINISHED') {
    await deps.redis.del(LEADERBOARD_CACHE_KEY);
  }

  return {
    match: updatedMatch,
    move: createdMove,
  };
}

function applyMoveSafely(
  currentState: UltimateGameState,
  move: MoveInput,
  playerSymbol: 'X' | 'O',
) {
  try {
    return applyMove(currentState, move, playerSymbol);
  } catch (error) {
    if (error instanceof GameRuleError) {
      throw new BadRequestException(error.message);
    }

    throw error;
  }
}

function updateMatch(
  tx: Prisma.TransactionClient,
  matchId: string,
  nextState: UltimateGameState,
  winnerId: string | null,
) {
  return tx.match.update({
    where: { id: matchId },
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
}

function createMoveRecord(
  tx: Prisma.TransactionClient,
  matchId: string,
  userId: string,
  move: MoveInput,
  moveNumber: number,
  data: { globalCol: number; globalRow: number; playerSymbol: 'X' | 'O' },
) {
  return tx.move.create({
    data: {
      matchId,
      userId,
      moveNumber,
      localBoard: move.localBoard,
      localCell: move.localCell,
      globalRow: data.globalRow,
      globalCol: data.globalCol,
      symbol: data.playerSymbol,
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
}
