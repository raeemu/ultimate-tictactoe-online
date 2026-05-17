import {
  GameRuleError,
  applyMove,
  createInitialState,
  resolveMacroWinner,
  resolveMiniBoardWinner,
} from './engine';
import { UltimateGameState } from './types';

function withCells(
  state: UltimateGameState,
  localBoard: number,
  values: Array<'X' | 'O' | null>,
): UltimateGameState {
  const next = { ...state, cells: [...state.cells] };
  const start = localBoard * 9;

  for (let i = 0; i < 9; i += 1) {
    next.cells[start + i] = values[i] ?? null;
  }

  return next;
}

describe('game-core engine', () => {
  it('creates initial state', () => {
    const state = createInitialState();

    expect(state.cells).toHaveLength(81);
    expect(state.miniBoards).toEqual(Array(9).fill('OPEN'));
    expect(state.activeBoard).toBeNull();
    expect(state.currentTurn).toBe('X');
    expect(state.status).toBe('ONGOING');
    expect(state.winner).toBeNull();
    expect(state.moveCount).toBe(0);
  });

  it('applies first valid move and sets active board', () => {
    const state = createInitialState();
    const next = applyMove(state, { localBoard: 0, localCell: 4 }, 'X');

    expect(next.cells[4]).toBe('X');
    expect(next.currentTurn).toBe('O');
    expect(next.activeBoard).toBe(4);
    expect(next.moveCount).toBe(1);
    expect(next.status).toBe('ONGOING');
  });

  it('rejects move by wrong player', () => {
    const state = createInitialState();

    expect(() => applyMove(state, { localBoard: 0, localCell: 0 }, 'O')).toThrow(
      GameRuleError,
    );
  });

  it('rejects move outside active board', () => {
    const state = createInitialState();
    const afterX = applyMove(state, { localBoard: 0, localCell: 3 }, 'X');

    expect(() =>
      applyMove(afterX, { localBoard: 1, localCell: 0 }, 'O'),
    ).toThrow(GameRuleError);
  });

  it('rejects move to occupied cell', () => {
    let state = createInitialState();
    state = {
      ...state,
      activeBoard: 2,
      moveCount: 1,
      cells: [...state.cells],
    };
    state.cells[18] = 'O';

    expect(() =>
      applyMove(state, { localBoard: 2, localCell: 0 }, 'X'),
    ).toThrow(GameRuleError);
  });

  it('allows any open board when target mini-board is closed', () => {
    let state = createInitialState();
    state = applyMove(state, { localBoard: 0, localCell: 1 }, 'X');

    const board1Draw: Array<'X' | 'O'> = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
    state = withCells(state, 1, board1Draw);
    state = {
      ...state,
      miniBoards: state.miniBoards.map((value, idx) => (idx === 1 ? 'DRAW' : value)),
      activeBoard: null,
    };

    const afterO = applyMove(state, { localBoard: 4, localCell: 0 }, 'O');
    expect(afterO.activeBoard).toBe(0);
  });

  it('resolves mini-board winner correctly', () => {
    let state = createInitialState();
    state = withCells(state, 2, ['X', 'X', 'X', null, null, null, null, null, null]);

    expect(resolveMiniBoardWinner(state.cells, 2)).toBe('X');
  });

  it('resolves macro winner correctly', () => {
    const miniBoards = ['X', 'X', 'X', 'OPEN', 'DRAW', 'OPEN', 'O', 'OPEN', 'DRAW'] as const;
    expect(resolveMacroWinner([...miniBoards])).toBe('X');
  });
});
