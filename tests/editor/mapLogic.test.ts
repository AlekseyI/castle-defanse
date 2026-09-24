import { describe, expect, it } from 'vitest';
import {
  clampRepeatLastWaves,
  cloneMap,
  filterUnitsByNameSubstring,
  findFirstUnitByNameSubstring,
  generateWaves,
  moveWaveByIndex,
  normalizeMap,
  saveMap,
  validateMap,
} from '../../src/editor/maps/mapLogic';
import type { MapDefinition } from '../../src/editor/maps/types';

const map: MapDefinition = {
  id: 'forest',
  name: 'Лес',
  background: {
    color: '#0b1020',
    fit: 'cover',
  },
  upgradeSettings: { enabled: false, cardCount: 3, rewardOnBossKill: false },
  waves: [
    {
      id: 'wave_1',
      blocks: [
        {
          id: 'block_1',
          unitId: 'goblin',
          count: 5,
          spawnEvery: 1,
          startWhen: 'after-spawn',
        },
        {
          id: 'block_2',
          unitId: 'boss',
          count: 1,
          spawnEvery: 0,
          startWhen: 'field-clear',
        },
      ],
      upgradeReward: { override: false, enabled: false, cardCount: 3 },
    },
  ],
  endless: {
    enabled: true,
    repeatLastWaves: 1,
    hpGrowthPercent: 10,
    damageGrowthPercent: 5,
    speedGrowthPercent: 2,
    countGrowth: 2,
    spawnIntervalReductionPercent: 3,
    minSpawnInterval: 0.25,
  },
};

describe('mapLogic', () => {
  it('clamps endless repeat count to the number of created waves', () => {
    expect(clampRepeatLastWaves(10, 4)).toBe(4);
    expect(clampRepeatLastWaves(0, 4)).toBe(1);
    expect(clampRepeatLastWaves(3.9, 4)).toBe(3);
  });

  it('ignores an invalid per-wave cardCount while the wave inherits map upgrade settings', () => {
    const result = validateMap(
      {
        ...map,
        waves: [{
          ...map.waves[0],
          upgradeReward: { override: false, enabled: false, cardCount: Number.NaN },
        }],
      },
      [map],
      ['slime'],
      map.id,
    );

    expect(result.errors['wave.wave_1.upgradeReward.cardCount']).toBeUndefined();
  });

  it('normalizes map metadata and background image without changing wave settings', () => {
    expect(normalizeMap({
      ...map,
      id: '  FOREST_MAP  ',
      name: '  Тёмный лес  ',
      background: {
        color: '  #AABBCC  ',
        fit: 'contain',
        image: {
          name: ' forest.png ',
          src: 'data:image/png;base64,forest',
        },
      },
    })).toEqual({
      ...map,
      id: 'forest_map',
      name: 'Тёмный лес',
      background: {
        color: '#aabbcc',
        fit: 'contain',
        image: {
          name: 'forest.png',
          src: 'data:image/png;base64,forest',
        },
      },
    });
  });

  it('validates wave blocks and endless settings against current units', () => {
    const result = validateMap(
      {
        ...map,
        upgradeSettings: { ...map.upgradeSettings, cardCount: 0 },
        waves: [{
          id: 'wave_1',
          blocks: [{
            id: 'block_1',
            unitId: 'missing_unit',
            count: 0,
            spawnEvery: -1,
            startWhen: 'after-spawn',
          }],
          upgradeReward: { override: true, enabled: false, cardCount: 0 },
        }],
        endless: {
          ...map.endless,
          repeatLastWaves: 2,
        },
      },
      [map],
      ['goblin', 'boss'],
      'forest',
    );

    expect(result.valid).toBe(false);
    expect(result.errors.upgradeCardCount).toBeTruthy();
    expect(result.errors['wave.wave_1.block.block_1.unitId']).toBeTruthy();
    expect(result.errors['wave.wave_1.block.block_1.count']).toBeTruthy();
    expect(result.errors['wave.wave_1.block.block_1.spawnEvery']).toBeTruthy();
    expect(result.errors['wave.wave_1.upgradeReward.cardCount']).toBeTruthy();
    expect(result.errors.repeatLastWaves).toBeTruthy();
  });

  it('filters units by a case-insensitive name substring and returns the first match', () => {
    const units = [
      { id: 'skeleton', name: 'Скелет' },
      { id: 'goblin', name: 'Гоблин' },
      { id: 'big_goblin', name: 'Большой Гоблин' },
    ];

    expect(filterUnitsByNameSubstring(units, 'ГОБ')).toEqual([units[1], units[2]]);
    expect(filterUnitsByNameSubstring(units, '   бли  ')).toEqual([units[1], units[2]]);
    expect(findFirstUnitByNameSubstring(units, 'ОбЛ')).toBe(units[1]);
    expect(findFirstUnitByNameSubstring(units, 'нет')).toBeUndefined();
    expect(findFirstUnitByNameSubstring(units, '   ')).toBeUndefined();
  });


  it('generates waves with total and different unit counts inside the requested ranges', () => {
    const waves = generateWaves({
      waveCount: 3,
      minUnitCount: 6,
      maxUnitCount: 6,
      minDifferentUnitCount: 2,
      maxDifferentUnitCount: 2,
      unitIds: ['goblin', 'orc', 'skeleton'],
      bossEveryWaves: 5,
      bossUnitIds: ['boss'],
    }, () => 0);

    expect(waves).toHaveLength(3);
    for (const wave of waves) {
      expect(wave.blocks).toHaveLength(2);
      expect(new Set(wave.blocks.map((block) => block.unitId)).size).toBe(2);
      expect(wave.blocks.reduce((sum, block) => sum + block.count, 0)).toBe(6);
      expect(wave.blocks).toEqual([
        expect.objectContaining({ unitId: 'goblin', count: 3, spawnEvery: 1, startWhen: 'after-spawn' }),
        expect.objectContaining({ unitId: 'orc', count: 3, spawnEvery: 1, startWhen: 'after-spawn' }),
      ]);
    }
  });

  it('adds a boss block at the configured wave interval after regular units', () => {
    const waves = generateWaves({
      waveCount: 5,
      minUnitCount: 4,
      maxUnitCount: 4,
      minDifferentUnitCount: 1,
      maxDifferentUnitCount: 1,
      unitIds: ['goblin', 'orc'],
      bossEveryWaves: 2,
      bossUnitIds: ['boss_a', 'boss_b'],
    }, () => 0);

    expect(waves.map((wave) => wave.blocks.length)).toEqual([1, 2, 1, 2, 1]);
    expect(waves[1].blocks[1]).toEqual(expect.objectContaining({
      unitId: 'boss_a',
      count: 1,
      spawnEvery: 0,
      startWhen: 'field-clear',
    }));
    expect(waves[3].blocks[1]).toEqual(expect.objectContaining({
      unitId: 'boss_a',
      count: 1,
      spawnEvery: 0,
      startWhen: 'field-clear',
    }));
  });

  it('can generate the upper bounds for total and different unit ranges', () => {
    const waves = generateWaves({
      waveCount: 1,
      minUnitCount: 5,
      maxUnitCount: 8,
      minDifferentUnitCount: 1,
      maxDifferentUnitCount: 3,
      unitIds: ['goblin', 'orc', 'skeleton'],
      bossEveryWaves: 10,
      bossUnitIds: ['boss'],
    }, () => 0.999999);

    expect(waves[0].blocks).toHaveLength(3);
    expect(new Set(waves[0].blocks.map((block) => block.unitId)).size).toBe(3);
    expect(waves[0].blocks.reduce((sum, block) => sum + block.count, 0)).toBe(8);
  });

  it('rejects invalid wave generator ranges and missing unit pools', () => {
    const baseOptions = {
      waveCount: 2,
      minUnitCount: 5,
      maxUnitCount: 8,
      minDifferentUnitCount: 1,
      maxDifferentUnitCount: 2,
      unitIds: ['goblin', 'orc'],
      bossEveryWaves: 5,
      bossUnitIds: ['boss'],
    };

    expect(() => generateWaves({ ...baseOptions, waveCount: 0 })).toThrow(RangeError);
    expect(() => generateWaves({ ...baseOptions, maxUnitCount: 3 })).toThrow(RangeError);
    expect(() => generateWaves({ ...baseOptions, maxDifferentUnitCount: 3 })).toThrow(RangeError);
    expect(() => generateWaves({ ...baseOptions, minUnitCount: 1, maxDifferentUnitCount: 2 })).toThrow(RangeError);
    expect(() => generateWaves({ ...baseOptions, bossEveryWaves: 0 })).toThrow(RangeError);
    expect(() => generateWaves({ ...baseOptions, unitIds: [] })).toThrow(RangeError);
    expect(() => generateWaves({ ...baseOptions, bossUnitIds: [] })).toThrow(RangeError);
  });

  it('moves waves up and down by their visible index without mutating the source list', () => {
    const waves = [
      { id: 'wave_1', blocks: [], upgradeReward: { override: false, enabled: false, cardCount: 3 } },
      { id: 'wave_2', blocks: [], upgradeReward: { override: false, enabled: false, cardCount: 3 } },
      { id: 'wave_3', blocks: [], upgradeReward: { override: false, enabled: false, cardCount: 3 } },
    ];

    const movedDown = moveWaveByIndex(waves, 0, 1);
    const movedUp = moveWaveByIndex(movedDown, 2, -1);

    expect(waves.map((wave) => wave.id)).toEqual(['wave_1', 'wave_2', 'wave_3']);
    expect(movedDown.map((wave) => wave.id)).toEqual(['wave_2', 'wave_1', 'wave_3']);
    expect(movedUp.map((wave) => wave.id)).toEqual(['wave_2', 'wave_3', 'wave_1']);
    expect(moveWaveByIndex(waves, 0, -1)).toBe(waves);
    expect(moveWaveByIndex(waves, waves.length - 1, 1)).toBe(waves);
  });

  it('allows mixed sequential blocks and preserves them when saving', () => {
    const validation = validateMap(map, [map], ['goblin', 'boss'], 'forest');
    const saved = saveMap([map], {
      ...map,
      name: 'Лес после правки',
    }, 'forest');

    expect(validation.valid).toBe(true);
    expect(saved[0].name).toBe('Лес после правки');
    expect(saved[0].waves[0].blocks).toEqual(map.waves[0].blocks);
  });

  it('deep-clones background, waves and endless settings for editor drafts', () => {
    const cloned = cloneMap(map);
    cloned.upgradeSettings.cardCount = 9;
    cloned.waves[0].blocks[0].count = 99;
    cloned.endless.hpGrowthPercent = 50;
    cloned.waves[0].upgradeReward.cardCount = 7;

    expect(map.upgradeSettings.cardCount).toBe(3);
    expect(map.waves[0].blocks[0].count).toBe(5);
    expect(map.waves[0].upgradeReward.cardCount).toBe(3);
    expect(map.endless.hpGrowthPercent).toBe(10);
  });
});
