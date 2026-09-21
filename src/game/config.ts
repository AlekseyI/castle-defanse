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

export const WAVES = [
  {
    count: 7,
    spawnEvery: 1.35,
    hp: 55,
    speed: 38,
    damage: 10,
    boss: { hp: 260, speed: 28, damage: 24 },
  },
  {
    count: 9,
    spawnEvery: 1.15,
    hp: 70,
    speed: 43,
    damage: 11,
    boss: { hp: 380, speed: 31, damage: 28 },
  },
  {
    count: 11,
    spawnEvery: 0.95,
    hp: 90,
    speed: 48,
    damage: 12,
    boss: { hp: 520, speed: 34, damage: 34 },
  },
];
