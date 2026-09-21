import { BOARD_SIZE, TILE_KINDS } from '../config';
import type { Cell, GridPoint, MatchRun, TileKind } from '../types';

export function areAdjacent(a: GridPoint, b: GridPoint) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

export function swapCells(grid: Cell[][], a: GridPoint, b: GridPoint) {
  const temp = grid[a.row][a.col];
  grid[a.row][a.col] = grid[b.row][b.col];
  grid[b.row][b.col] = temp;
}

export function findMatchRuns(grid: Cell[][]): MatchRun[] {
  const runs: MatchRun[] = [];
  const rowCount = grid.length;
  const colCount = grid[0]?.length ?? 0;

  for (let row = 0; row < rowCount; row += 1) {
    let start = 0;
    for (let col = 1; col <= colCount; col += 1) {
      const previous = grid[row][col - 1];
      const current = col < colCount ? grid[row][col] : null;

      if (current === previous && current !== null) continue;

      const length = col - start;
      if (previous && length >= 3) {
        runs.push({
          kind: previous,
          cells: Array.from({ length }, (_, index) => ({ row, col: start + index })),
        });
      }
      start = col;
    }
  }

  for (let col = 0; col < colCount; col += 1) {
    let start = 0;
    for (let row = 1; row <= rowCount; row += 1) {
      const previous = grid[row - 1]?.[col] ?? null;
      const current = row < rowCount ? grid[row]?.[col] ?? null : null;

      if (current === previous && current !== null) continue;

      const length = row - start;
      if (previous && length >= 3) {
        runs.push({
          kind: previous,
          cells: Array.from({ length }, (_, index) => ({ row: start + index, col })),
        });
      }
      start = row;
    }
  }

  return runs;
}

export function hasPossibleMove(grid: Cell[][]) {
  const rowCount = grid.length;
  const colCount = grid[0]?.length ?? 0;

  for (let row = 0; row < rowCount; row += 1) {
    for (let col = 0; col < colCount; col += 1) {
      const origin = { row, col };
      const candidates = [
        { row, col: col + 1 },
        { row: row + 1, col },
      ].filter((point) => point.row < rowCount && point.col < colCount);

      for (const target of candidates) {
        swapCells(grid, origin, target);
        const found = findMatchRuns(grid).length > 0;
        swapCells(grid, origin, target);
        if (found) return true;
      }
    }
  }

  return false;
}

export function collapseAndRefill(grid: Cell[][], random: () => number = Math.random) {
  const rowCount = grid.length;
  const colCount = grid[0]?.length ?? 0;
  const fallDistances = Array.from(
    { length: rowCount },
    () => Array.from({ length: colCount }, () => 0),
  );

  for (let col = 0; col < colCount; col += 1) {
    const values: Array<{ kind: TileKind; sourceRow: number }> = [];

    for (let row = rowCount - 1; row >= 0; row -= 1) {
      const value = grid[row][col];
      if (value) values.push({ kind: value, sourceRow: row });
    }

    const refillCount = rowCount - values.length;

    for (let row = rowCount - 1, i = 0; row >= 0; row -= 1, i += 1) {
      const existing = values[i];

      if (existing) {
        grid[row][col] = existing.kind;
        fallDistances[row][col] = row - existing.sourceRow;
      } else {
        grid[row][col] = randomKind(random);
        fallDistances[row][col] = refillCount;
      }
    }
  }

  return fallDistances;
}

export function generatePlayableGrid(random: () => number = Math.random): Cell[][] {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const candidate: Cell[][] = Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => null),
    );

    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        const blocked = new Set<TileKind>();

        if (col >= 2 && candidate[row][col - 1] === candidate[row][col - 2]) {
          const value = candidate[row][col - 1];
          if (value) blocked.add(value);
        }

        if (row >= 2 && candidate[row - 1][col] === candidate[row - 2][col]) {
          const value = candidate[row - 1][col];
          if (value) blocked.add(value);
        }

        const choices = TILE_KINDS.filter((kind) => !blocked.has(kind));
        candidate[row][col] = choices[Math.floor(random() * choices.length)];
      }
    }

    if (hasPossibleMove(candidate)) return candidate;
  }

  throw new Error('Could not generate a playable board');
}

function randomKind(random: () => number) {
  return TILE_KINDS[Math.floor(random() * TILE_KINDS.length)];
}
