export type CellValue = 'X' | 'O';

export type CellState = CellValue | null;

export type MiniBoardState = 'OPEN' | CellValue | 'DRAW';

export type GameStatus = 'ONGOING' | 'FINISHED';

export type GameWinner = CellValue | 'DRAW' | null;

export type MoveInput = {
  localBoard: number;
  localCell: number;
};

export type UltimateGameState = {
  cells: CellState[];
  miniBoards: MiniBoardState[];
  activeBoard: number | null;
  currentTurn: CellValue;
  status: GameStatus;
  winner: GameWinner;
  moveCount: number;
};
