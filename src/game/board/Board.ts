import { BOARD_SIZE } from '../config';
import type { Cell, GridPoint, MatchRun, TileKind } from '../types';
import {
  areAdjacent,
  collapseAndRefill,
  findMatchRuns,
  generatePlayableGrid,
  hasPossibleMove,
  swapCells,
} from './boardLogic';

export const BOARD_FALL_ANIMATION_MS = 240;
export const BOARD_SWAP_ANIMATION_MS = 150;

export interface BoardSnapshot {
  grid: Cell[][];
  selected: GridPoint | null;
  locked: boolean;
  fallDistances: number[][] | null;
  fallRevision: number;
  rollbackSwap: { from: GridPoint; to: GridPoint } | null;
}

interface BoardOptions {
  tileKinds: TileKind[];
  onCharge: (kind: TileKind, amount: number) => void;
  onAutoShuffle?: () => void;
  wait?: (ms: number) => Promise<void>;
}

export class Board {
  private grid: Cell[][] = [];
  private selected: GridPoint | null = null;
  private locked = false;
  private operationId = 0;
  private fallDistances: number[][] | null = null;
  private fallRevision = 0;
  private rollbackSwap: { from: GridPoint; to: GridPoint } | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly tileKinds: TileKind[];
  private readonly onCharge: BoardOptions['onCharge'];
  private readonly onAutoShuffle?: BoardOptions['onAutoShuffle'];
  private readonly wait: (ms: number) => Promise<void>;
  private snapshot: BoardSnapshot = {
    grid: [],
    selected: null,
    locked: false,
    fallDistances: null,
    fallRevision: 0,
    rollbackSwap: null,
  };

  constructor(options: BoardOptions) {
    this.tileKinds = [...options.tileKinds];
    this.onCharge = options.onCharge;
    this.onAutoShuffle = options.onAutoShuffle;
    this.wait = options.wait ?? ((ms) => new Promise<void>((resolve) => window.setTimeout(resolve, ms)));
    this.reset();
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = () => this.snapshot;

  reset() {
    this.operationId += 1;
    this.selected = null;
    this.locked = false;
    this.fallDistances = null;
    this.rollbackSwap = null;
    this.grid = generatePlayableGrid(this.tileKinds);
    this.emit();
  }

  async tap(point: GridPoint) {
    if (this.locked || !this.isInside(point)) return;

    if (!this.selected) {
      this.selected = point;
      this.emit();
      return;
    }

    if (this.selected.row === point.row && this.selected.col === point.col) {
      this.selected = null;
      this.emit();
      return;
    }

    if (!areAdjacent(this.selected, point)) {
      this.selected = point;
      this.emit();
      return;
    }

    const from = this.selected;
    await this.swap(from, point);
  }

  async swap(from: GridPoint, to: GridPoint) {
    if (this.locked || !this.isInside(from) || !this.isInside(to) || !areAdjacent(from, to)) return;

    const operationId = ++this.operationId;
    this.selected = null;
    this.locked = true;
    this.fallDistances = null;
    this.rollbackSwap = null;
    swapCells(this.grid, from, to);
    this.emit();

    let runs = findMatchRuns(this.grid);
    if (runs.length === 0) {
      await this.wait(120);
      if (operationId !== this.operationId) return;

      this.rollbackSwap = { from: { ...from }, to: { ...to } };
      this.emit();

      await this.wait(BOARD_SWAP_ANIMATION_MS);
      if (operationId !== this.operationId) return;

      swapCells(this.grid, from, to);
      this.rollbackSwap = null;
      this.locked = false;
      this.fallDistances = null;
      this.emit();
      return;
    }

    while (runs.length > 0) {
      this.awardCharges(runs);
      await this.wait(110);
      if (operationId !== this.operationId) return;

      this.clearMatchedCells(runs);
      this.fallDistances = collapseAndRefill(this.grid, this.tileKinds);
      this.fallRevision += 1;
      this.emit();

      await this.wait(BOARD_FALL_ANIMATION_MS);
      if (operationId !== this.operationId) return;
      runs = findMatchRuns(this.grid);
    }

    if (!hasPossibleMove(this.grid)) {
      this.grid = generatePlayableGrid(this.tileKinds);
      this.onAutoShuffle?.();
    }

    this.locked = false;
    this.fallDistances = null;
    this.emit();
  }

  destroy() {
    this.operationId += 1;
    this.locked = true;
    this.listeners.clear();
  }

  private emit() {
    this.snapshot = {
      grid: this.grid.map((row) => [...row]),
      selected: this.selected ? { ...this.selected } : null,
      locked: this.locked,
      fallDistances: this.fallDistances
        ? this.fallDistances.map((row) => [...row])
        : null,
      fallRevision: this.fallRevision,
      rollbackSwap: this.rollbackSwap
        ? { from: { ...this.rollbackSwap.from }, to: { ...this.rollbackSwap.to } }
        : null,
    };

    for (const listener of this.listeners) listener();
  }

  private isInside(point: GridPoint) {
    return point.row >= 0 && point.row < BOARD_SIZE && point.col >= 0 && point.col < BOARD_SIZE;
  }

  private awardCharges(runs: MatchRun[]) {
    for (const run of runs) {
      this.onCharge(run.kind, Math.max(1, run.cells.length - 2));
    }
  }

  private clearMatchedCells(runs: MatchRun[]) {
    const keys = new Set<string>();

    for (const run of runs) {
      for (const cell of run.cells) keys.add(`${cell.row}:${cell.col}`);
    }

    for (const key of keys) {
      const [row, col] = key.split(':').map(Number);
      this.grid[row][col] = null;
    }
  }
}
