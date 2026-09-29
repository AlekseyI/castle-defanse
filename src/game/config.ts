export const BOARD_SIZE = 6;
export const MOBILE_BOARD_ROWS = 4;
export const MOBILE_BOARD_SHORT_SIDE_MAX = 600;
export const MAX_CHARGES = 5;

export interface BoardDimensions {
  rows: number;
  columns: number;
}

export function getBoardDimensions(viewportWidth: number, viewportHeight: number): BoardDimensions {
  const shortSide = Math.min(Math.max(0, viewportWidth), Math.max(0, viewportHeight));

  return {
    rows: shortSide <= MOBILE_BOARD_SHORT_SIDE_MAX ? MOBILE_BOARD_ROWS : BOARD_SIZE,
    columns: BOARD_SIZE,
  };
}

export interface WaveDefinition {
  count: number;
  spawnEvery: number;
  unitId: string;
  bossUnitId: string;
}

export const WAVES: WaveDefinition[] = [
  {
    count: 7,
    spawnEvery: 1.35,
    unitId: 'wave_1_enemy',
    bossUnitId: 'wave_1_boss',
  },
  {
    count: 9,
    spawnEvery: 1.15,
    unitId: 'wave_2_enemy',
    bossUnitId: 'wave_2_boss',
  },
  {
    count: 11,
    spawnEvery: 0.95,
    unitId: 'wave_3_enemy',
    bossUnitId: 'wave_3_boss',
  },
];
