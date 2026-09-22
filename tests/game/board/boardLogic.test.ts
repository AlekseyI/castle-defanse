import { describe, expect, it } from 'vitest';
import type { Cell } from '../../../src/game/types';
import {
  areAdjacent,
  collapseAndRefill,
  findMatchRuns,
  generatePlayableGrid,
  hasPossibleMove,
  swapCells,
} from '../../../src/game/board/boardLogic';

const TILE_KINDS = ['fire', 'ice', 'lightning', 'shield'];

describe('boardLogic', () => {
  it('detects horizontal and vertical match runs', () => {
    const grid: Cell[][] = [
      ['fire', 'fire', 'fire', 'ice'],
      ['ice', 'shield', 'lightning', 'ice'],
      ['shield', 'lightning', 'shield', 'ice'],
      ['lightning', 'shield', 'ice', 'fire'],
    ];

    expect(findMatchRuns(grid)).toEqual([
      {
        kind: 'fire',
        cells: [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
          { row: 0, col: 2 },
        ],
      },
      {
        kind: 'ice',
        cells: [
          { row: 0, col: 3 },
          { row: 1, col: 3 },
          { row: 2, col: 3 },
        ],
      },
    ]);
  });

  it('recognizes adjacency and swaps cells without changing other cells', () => {
    const grid: Cell[][] = [
      ['fire', 'ice'],
      ['shield', 'lightning'],
    ];

    expect(areAdjacent({ row: 0, col: 0 }, { row: 0, col: 1 })).toBe(true);
    expect(areAdjacent({ row: 0, col: 0 }, { row: 1, col: 1 })).toBe(false);

    swapCells(grid, { row: 0, col: 0 }, { row: 0, col: 1 });
    expect(grid).toEqual([
      ['ice', 'fire'],
      ['shield', 'lightning'],
    ]);
  });

  it('detects whether at least one swap can create a match', () => {
    const playable: Cell[][] = [
      ['fire', 'ice', 'fire'],
      ['shield', 'fire', 'lightning'],
      ['ice', 'shield', 'lightning'],
    ];
    const blocked: Cell[][] = [
      ['fire', 'ice'],
      ['shield', 'lightning'],
    ];

    expect(findMatchRuns(playable)).toHaveLength(0);
    expect(hasPossibleMove(playable)).toBe(true);
    expect(hasPossibleMove(blocked)).toBe(false);
  });

  it('collapses existing tiles downward and refills empty cells', () => {
    const grid: Cell[][] = [
      [null, 'ice'],
      ['fire', null],
      [null, 'shield'],
    ];

    const fallDistances = collapseAndRefill(grid, TILE_KINDS, () => 0);

    expect(grid).toEqual([
      ['fire', 'fire'],
      ['fire', 'ice'],
      ['fire', 'shield'],
    ]);
    expect(fallDistances).toEqual([
      [2, 1],
      [2, 1],
      [1, 0],
    ]);
  });


  it('generates cells from the configured ability ids', () => {
    const kinds = ['fire', 'ice', 'lightning', 'shield', 'meteor'];
    const grid = generatePlayableGrid(kinds);

    expect(grid.flat().every((cell) => cell !== null && kinds.includes(cell))).toBe(true);
  });

  it('returns an empty board when there are not enough abilities for match-3', () => {
    const grid = generatePlayableGrid(['fire', 'ice']);
    expect(grid.flat().every((cell) => cell === null)).toBe(true);
  });

  it('generates boards with no initial matches and at least one possible move', () => {
    for (let i = 0; i < 100; i += 1) {
      const grid = generatePlayableGrid(TILE_KINDS);
      expect(findMatchRuns(grid)).toHaveLength(0);
      expect(hasPossibleMove(grid)).toBe(true);
    }
  });
});
