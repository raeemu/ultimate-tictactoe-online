import {
  CellState,
  CellValue,
  GameWinner,
  MiniBoardState,
  MoveInput,
  UltimateGameState,
} from './types';

const WIN_LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export class GameRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameRuleError';
  }
}

export function createInitialState(): UltimateGameState {
  return {
    cells: Array<CellState>(81).fill(null),
    miniBoards: Array<MiniBoardState>(9).fill('OPEN'),
    activeBoard: null,
    currentTurn: 'X',
    status: 'ONGOING',
    winner: null,
    moveCount: 0,
  };
}

export function applyMove(
  state: UltimateGameState,
  move: MoveInput,
  player: CellValue,
): UltimateGameState {
  validateMoveInput(move);
  validateMove(state, move, player);

  const nextCells = [...state.cells];
  const globalIndex = move.localBoard * 9 + move.localCell;
  nextCells[globalIndex] = player;

  const nextMiniBoards = [...state.miniBoards];
  nextMiniBoards[move.localBoard] = resolveMiniBoardWinner(nextCells, move.localBoard);

  const macroWinner = resolveMacroWinner(nextMiniBoards);
  const nextMoveCount = state.moveCount + 1;
  const isBoardFull = nextMoveCount >= 81;
  const winner: GameWinner = macroWinner ?? (isBoardFull ? 'DRAW' : null);
  const status = winner ? 'FINISHED' : 'ONGOING';

  return {
    cells: nextCells,
    miniBoards: nextMiniBoards,
    activeBoard: status === 'FINISHED' ? null : resolveNextActiveBoard(nextMiniBoards, move.localCell),
    currentTurn: player === 'X' ? 'O' : 'X',
    status,
    winner,
    moveCount: nextMoveCount,
  };
}

export function resolveMiniBoardWinner(
  cells: CellState[],
  localBoard: number,
): MiniBoardState {
  const boardCells = getMiniBoardCells(cells, localBoard);
  const lineWinner = findWinner(boardCells);

  if (lineWinner) {
    return lineWinner;
  }

  return boardCells.some((cell) => cell === null) ? 'OPEN' : 'DRAW';
}

export function resolveMacroWinner(miniBoards: MiniBoardState[]): CellValue | null {
  const values = miniBoards.map((state) => (state === 'X' || state === 'O' ? state : null));
  return findWinner(values);
}

export function resolveNextActiveBoard(
  miniBoards: MiniBoardState[],
  targetBoard: number,
): number | null {
  if (miniBoards[targetBoard] === 'OPEN') {
    return targetBoard;
  }

  const hasOpenBoards = miniBoards.some((state) => state === 'OPEN');
  return hasOpenBoards ? null : null;
}

function validateMove(
  state: UltimateGameState,
  move: MoveInput,
  player: CellValue,
) {
  if (state.status !== 'ONGOING') {
    throw new GameRuleError('Game is already finished');
  }

  if (player !== state.currentTurn) {
    throw new GameRuleError('It is not this player turn');
  }

  if (state.activeBoard !== null && move.localBoard !== state.activeBoard) {
    throw new GameRuleError('Move must be made on active mini-board');
  }

  if (state.miniBoards[move.localBoard] !== 'OPEN') {
    throw new GameRuleError('Mini-board is already closed');
  }

  const globalIndex = move.localBoard * 9 + move.localCell;
  if (state.cells[globalIndex] !== null) {
    throw new GameRuleError('Cell is already occupied');
  }
}

function validateMoveInput(move: MoveInput) {
  if (!isBoardIndex(move.localBoard)) {
    throw new GameRuleError('localBoard must be between 0 and 8');
  }

  if (!isBoardIndex(move.localCell)) {
    throw new GameRuleError('localCell must be between 0 and 8');
  }
}

function isBoardIndex(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 8;
}

function getMiniBoardCells(cells: CellState[], localBoard: number): CellState[] {
  const startIndex = localBoard * 9;
  return cells.slice(startIndex, startIndex + 9);
}

function findWinner(values: Array<CellValue | null>): CellValue | null {
  for (const [a, b, c] of WIN_LINES) {
    const first = values[a];
    if (first && first === values[b] && first === values[c]) {
      return first;
    }
  }

  return null;
}
