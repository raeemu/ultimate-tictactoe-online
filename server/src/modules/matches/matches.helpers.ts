import { Prisma } from '@prisma/client';
import { UltimateGameState } from '../../game';

export const matchSnapshotSelect = {
  id: true,
  status: true,
  playerXId: true,
  playerOId: true,
  playerX: {
    select: {
      id: true,
      username: true,
    },
  },
  playerO: {
    select: {
      id: true,
      username: true,
    },
  },
  currentTurn: true,
  activeBoard: true,
  boardState: true,
  macroboardState: true,
  winnerId: true,
  abandonedById: true,
  finishedAt: true,
  updatedAt: true,
} satisfies Prisma.MatchSelect;

export const RATING_DELTA = 25;
export const MOVE_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;
export const MOVE_PROCESSING_TTL_MS = 10000;
export const LEADERBOARD_CACHE_KEY = 'leaderboard:rating:top';
export const MATCH_ACCEPT_TTL_SECONDS = 10 * 60;

export function isParticipant(
  playerXId: string,
  playerOId: string | null,
  userId: string,
): boolean {
  return playerXId === userId || playerOId === userId;
}

export function resolveOpponentId(
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

export function resolvePlayerSymbol(
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

export function toGlobalCoordinates(localBoard: number, localCell: number) {
  const boardRow = Math.floor(localBoard / 3);
  const boardCol = localBoard % 3;
  const cellRow = Math.floor(localCell / 3);
  const cellCol = localCell % 3;

  return {
    globalRow: boardRow * 3 + cellRow,
    globalCol: boardCol * 3 + cellCol,
  };
}

export function buildGameState(match: {
  activeBoard: number | null;
  boardState: unknown;
  currentTurn: 'X' | 'O';
  macroboardState: unknown;
  moves: { moveNumber: number }[];
  playerOId: string | null;
  playerXId: string;
  winnerId: string | null;
}): UltimateGameState {
  return {
    cells: match.boardState as UltimateGameState['cells'],
    miniBoards: match.macroboardState as UltimateGameState['miniBoards'],
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
}

export function resolveWinnerId(
  winner: UltimateGameState['winner'],
  playerXId: string,
  playerOId: string | null,
) {
  if (winner === 'X') {
    return playerXId;
  }

  if (winner === 'O') {
    return playerOId;
  }

  return null;
}
