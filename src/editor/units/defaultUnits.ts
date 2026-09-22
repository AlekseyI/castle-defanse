import type { UnitDefinition } from './types';

export const DEFAULT_UNITS: UnitDefinition[] = [
  {
    id: 'wave_1_enemy',
    gameKey: 'wave_1_enemy',
    name: 'Враг волны 1',
    hp: 55,
    speed: 38,
    damage: 10,
  },
  {
    id: 'wave_1_boss',
    gameKey: 'wave_1_boss',
    name: 'Босс волны 1',
    hp: 260,
    speed: 28,
    damage: 24,
  },
  {
    id: 'wave_2_enemy',
    gameKey: 'wave_2_enemy',
    name: 'Враг волны 2',
    hp: 70,
    speed: 43,
    damage: 11,
  },
  {
    id: 'wave_2_boss',
    gameKey: 'wave_2_boss',
    name: 'Босс волны 2',
    hp: 380,
    speed: 31,
    damage: 28,
  },
  {
    id: 'wave_3_enemy',
    gameKey: 'wave_3_enemy',
    name: 'Враг волны 3',
    hp: 90,
    speed: 48,
    damage: 12,
  },
  {
    id: 'wave_3_boss',
    gameKey: 'wave_3_boss',
    name: 'Босс волны 3',
    hp: 520,
    speed: 34,
    damage: 34,
  },
];
