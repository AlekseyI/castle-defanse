import type { TileKind } from './types';

export const BOARD_SIZE = 6;
export const MAX_CHARGES = 5;

export const TILE_KINDS: TileKind[] = ['fire', 'ice', 'lightning', 'shield'];

export const TILE_META: Record<TileKind, { color: number; glyph: string; label: string }> = {
  fire: { color: 0xe9573f, glyph: '🔥', label: 'Огонь' },
  ice: { color: 0x4ba3ff, glyph: '❄', label: 'Лёд' },
  lightning: { color: 0xf7c948, glyph: '⚡', label: 'Молния' },
  shield: { color: 0x58c985, glyph: '✚', label: 'Щит' },
};

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
