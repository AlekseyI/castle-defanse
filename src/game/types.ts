export type TileKind = string;

export type SpellCharges = Record<TileKind, number>;

export type Cell = TileKind | null;

export interface GridPoint {
  row: number;
  col: number;
}

export interface MatchRun {
  kind: TileKind;
  cells: GridPoint[];
}
