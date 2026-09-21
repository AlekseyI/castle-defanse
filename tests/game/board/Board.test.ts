import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Board, type BoardSnapshot } from '../../../src/game/board/Board';
import { findMatchRuns, swapCells } from '../../../src/game/board/boardLogic';
import type { Cell, GridPoint } from '../../../src/game/types';

function findSwap(grid: Cell[][], createsMatch: boolean): [GridPoint, GridPoint] {
  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < grid[row].length; col += 1) {
      const from = { row, col };
      const candidates = [
        { row, col: col + 1 },
        { row: row + 1, col },
      ].filter((point) => point.row < grid.length && point.col < grid[row].length);

      for (const to of candidates) {
        const copy = grid.map((values) => [...values]);
        swapCells(copy, from, to);
        if ((findMatchRuns(copy).length > 0) === createsMatch) return [from, to];
      }
    }
  }

  throw new Error(`Could not find a ${createsMatch ? 'matching' : 'non-matching'} swap`);
}


let randomSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  let seed = 123456789;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  });
});

afterEach(() => {
  randomSpy.mockRestore();
});

describe('Board', () => {
  it('animates and restores a swap that does not create a match', async () => {
    const board = new Board({ onCharge: vi.fn(), wait: async () => undefined });
    const initial = board.getSnapshot().grid.map((row) => [...row]);
    const [from, to] = findSwap(initial, false);
    const snapshots: BoardSnapshot[] = [];
    const unsubscribe = board.subscribe(() => snapshots.push(board.getSnapshot()));

    await board.tap(from);
    expect(board.getSnapshot().selected).toEqual(from);

    await board.tap(to);

    expect(snapshots.some((snapshot) =>
      snapshot.rollbackSwap?.from.row === from.row
      && snapshot.rollbackSwap?.from.col === from.col
      && snapshot.rollbackSwap?.to.row === to.row
      && snapshot.rollbackSwap?.to.col === to.col
      && snapshot.locked
    )).toBe(true);
    expect(board.getSnapshot().rollbackSwap).toBeNull();
    expect(board.getSnapshot().locked).toBe(false);
    expect(board.getSnapshot().grid).toEqual(initial);

    unsubscribe();
    board.destroy();
  });

  it('supports swapping adjacent cells directly for swipe interactions', async () => {
    const onCharge = vi.fn();
    const board = new Board({ onCharge, wait: async () => undefined });
    const [from, to] = findSwap(board.getSnapshot().grid, true);

    await board.swap(from, to);

    expect(onCharge).toHaveBeenCalled();
    expect(board.getSnapshot().selected).toBeNull();
    expect(board.getSnapshot().locked).toBe(false);

    board.destroy();
  });

  it('awards charges when a swap creates a match', async () => {
    const onCharge = vi.fn();
    const board = new Board({ onCharge, wait: async () => undefined });
    const [from, to] = findSwap(board.getSnapshot().grid, true);

    await board.tap(from);
    await board.tap(to);

    expect(onCharge).toHaveBeenCalled();
    expect(board.getSnapshot().locked).toBe(false);

    board.destroy();
  });
});
