import type { MapDefinition } from './types';

export const DEFAULT_MAPS: MapDefinition[] = [
  {
    id: 'draft_map',
    name: 'Черновик карты',
    background: {
      color: '#0b1020',
      fit: 'cover',
    },
    waves: [
      {
        id: 'wave_1',
        blocks: [
          {
            id: 'wave_1_block_1',
            unitId: 'wave_1_enemy',
            count: 7,
            spawnEvery: 1.35,
            startWhen: 'after-spawn',
          },
          {
            id: 'wave_1_block_2',
            unitId: 'wave_1_boss',
            count: 1,
            spawnEvery: 0,
            startWhen: 'field-clear',
          },
        ],
      },
      {
        id: 'wave_2',
        blocks: [
          {
            id: 'wave_2_block_1',
            unitId: 'wave_2_enemy',
            count: 9,
            spawnEvery: 1.15,
            startWhen: 'after-spawn',
          },
          {
            id: 'wave_2_block_2',
            unitId: 'wave_2_boss',
            count: 1,
            spawnEvery: 0,
            startWhen: 'field-clear',
          },
        ],
      },
      {
        id: 'wave_3',
        blocks: [
          {
            id: 'wave_3_block_1',
            unitId: 'wave_3_enemy',
            count: 11,
            spawnEvery: 0.95,
            startWhen: 'after-spawn',
          },
          {
            id: 'wave_3_block_2',
            unitId: 'wave_3_boss',
            count: 1,
            spawnEvery: 0,
            startWhen: 'field-clear',
          },
        ],
      },
    ],
    endless: {
      enabled: false,
      repeatLastWaves: 1,
      hpGrowthPercent: 10,
      damageGrowthPercent: 5,
      speedGrowthPercent: 2,
      countGrowth: 2,
      spawnIntervalReductionPercent: 3,
      minSpawnInterval: 0.25,
    },
  },
];
