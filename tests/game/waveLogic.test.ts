import { describe, expect, it } from 'vitest';
import type { MapDefinition } from '../../src/editor/maps/types';
import { createEmptyUnitAnimationSounds, createEmptyUnitAnimations } from '../../src/editor/units/unitAnimationLogic';
import type { UnitDefinition } from '../../src/editor/units/types';
import {
  getRuntimeSpawnBlock,
  getRuntimeUnit,
  getRuntimeWave,
  getWaveBlockStep,
} from '../../src/game/waveLogic';

const map: MapDefinition = {
  id: 'arena',
  name: 'Арена',
  background: {
    color: '#0b1020',
    fit: 'cover',
  },
  upgradeSettings: { enabled: false, cardCount: 3, maxCardReceives: 5, rewardOnBossKill: false },
  waves: [
    {
      id: 'wave_1',
      blocks: [
        {
          id: 'wave_1_a',
          unitId: 'goblin',
          count: 5,
          spawnEvery: 1,
          startWhen: 'after-spawn',
        },
        {
          id: 'wave_1_b',
          unitId: 'boss',
          count: 1,
          spawnEvery: 0,
          startWhen: 'field-clear',
        },
      ],
      upgradeReward: { override: false, enabled: false, cardCount: 3 },
    },
    {
      id: 'wave_2',
      blocks: [{
        id: 'wave_2_a',
        unitId: 'orc',
        count: 3,
        spawnEvery: 0.8,
        startWhen: 'after-spawn',
      }],
      upgradeReward: { override: false, enabled: false, cardCount: 3 },
    },
    {
      id: 'wave_3',
      blocks: [{
        id: 'wave_3_a',
        unitId: 'mage',
        count: 2,
        spawnEvery: 0.5,
        startWhen: 'after-spawn',
      }],
      upgradeReward: { override: false, enabled: false, cardCount: 3 },
    },
  ],
  endless: {
    enabled: true,
    repeatLastWaves: 2,
    hpGrowthPercent: 10,
    damageGrowthPercent: 20,
    speedGrowthPercent: 5,
    countGrowth: 2,
    spawnIntervalReductionPercent: 25,
    minSpawnInterval: 0.3,
  },
};

describe('waveLogic', () => {
  it('spawns the current block until its configured count is reached', () => {
    expect(getWaveBlockStep({
      spawnedUnits: 4,
      blockCount: 5,
      activeEnemies: 0,
      hasNextBlock: true,
      nextStartWhen: 'field-clear',
    })).toBe('spawn-unit');
  });

  it('waits for a clear field when the next block requires it', () => {
    expect(getWaveBlockStep({
      spawnedUnits: 5,
      blockCount: 5,
      activeEnemies: 2,
      hasNextBlock: true,
      nextStartWhen: 'field-clear',
    })).toBe('wait-field-clear');

    expect(getWaveBlockStep({
      spawnedUnits: 5,
      blockCount: 5,
      activeEnemies: 0,
      hasNextBlock: true,
      nextStartWhen: 'field-clear',
    })).toBe('advance-block');
  });

  it('advances immediately after spawning when the next block uses after-spawn', () => {
    expect(getWaveBlockStep({
      spawnedUnits: 5,
      blockCount: 5,
      activeEnemies: 4,
      hasNextBlock: true,
      nextStartWhen: 'after-spawn',
    })).toBe('advance-block');
  });

  it('completes a wave only after the final block has spawned and the field is clear', () => {
    expect(getWaveBlockStep({
      spawnedUnits: 1,
      blockCount: 1,
      activeEnemies: 1,
      hasNextBlock: false,
    })).toBe('wait-field-clear');

    expect(getWaveBlockStep({
      spawnedUnits: 1,
      blockCount: 1,
      activeEnemies: 0,
      hasNextBlock: false,
    })).toBe('wave-complete');
  });

  it('uses authored waves first and then repeats the configured tail in endless cycles', () => {
    expect(getRuntimeWave(map, 0)).toMatchObject({ wave: { id: 'wave_1' }, endlessCycle: 0 });
    expect(getRuntimeWave(map, 2)).toMatchObject({ wave: { id: 'wave_3' }, endlessCycle: 0 });
    expect(getRuntimeWave(map, 3)).toMatchObject({ wave: { id: 'wave_2' }, endlessCycle: 1 });
    expect(getRuntimeWave(map, 4)).toMatchObject({ wave: { id: 'wave_3' }, endlessCycle: 1 });
    expect(getRuntimeWave(map, 5)).toMatchObject({ wave: { id: 'wave_2' }, endlessCycle: 2 });
  });

  it('stops after authored waves when endless mode is disabled', () => {
    const finiteMap = {
      ...map,
      endless: { ...map.endless, enabled: false },
    };

    expect(getRuntimeWave(finiteMap, 2)?.wave.id).toBe('wave_3');
    expect(getRuntimeWave(finiteMap, 3)).toBeNull();
  });

  it('applies endless count and interval settings without going below the minimum interval', () => {
    const block = map.waves[1].blocks[0];

    expect(getRuntimeSpawnBlock(block, map.endless, 1)).toMatchObject({
      count: 5,
      spawnEvery: 0.6,
    });
    expect(getRuntimeSpawnBlock(block, map.endless, 5)).toMatchObject({
      count: 13,
      spawnEvery: 0.3,
    });
  });

  it('scales unit hp, damage and speed for each endless cycle', () => {
    const unit: UnitDefinition = {
      id: 'orc',
      name: 'Орк',
      hp: 100,
      damage: 10,
      damageSourceId: 'fire',
      speed: 20,
      coinsOnDeath: 1,
      traits: ['boss'],
      animationSpeed: 1,
      animations: createEmptyUnitAnimations(),
      animationSounds: createEmptyUnitAnimationSounds(),
    };
    const runtime = getRuntimeUnit(unit, map.endless, 2);

    expect(runtime.hp).toBeCloseTo(121);
    expect(runtime.damage).toBeCloseTo(14.4);
    expect(runtime.speed).toBeCloseTo(22.05);
    expect(runtime.traits).toEqual(['boss']);
    expect(unit).toMatchObject({ hp: 100, damage: 10, speed: 20, traits: ['boss'] });
  });

  it('preserves ranged attack settings in runtime units', () => {
    const unit: UnitDefinition = {
      id: 'archer',
      name: 'Лучник',
      hp: 80,
      damage: 12,
      damageSourceId: 'fire',
      speed: 24,
      coinsOnDeath: 2,
      traits: ['ranged'],
      attackStartPathPercent: 60,
      animationSpeed: 1,
      animations: createEmptyUnitAnimations(),
      animationSounds: createEmptyUnitAnimationSounds(),
    };

    const runtime = getRuntimeUnit(unit, map.endless, 1);
    expect(runtime.traits).toEqual(['ranged']);
    expect(runtime.attackStartPathPercent).toBe(60);
  });

  it('applies selected unit trait multipliers before endless scaling', () => {
    const unit: UnitDefinition = {
      id: 'elite',
      name: 'Элитный',
      hp: 100,
      damage: 10,
      damageSourceId: 'fire',
      speed: 20,
      coinsOnDeath: 3,
      traits: ['healthy', 'strong', 'fast', 'generous'],
      animationSpeed: 1,
      animations: createEmptyUnitAnimations(),
      animationSounds: createEmptyUnitAnimationSounds(),
      traitMultipliers: {
        hp: 2,
        damage: 1.5,
        speed: 1.25,
        coins: 1.5,
      },
    };

    const runtime = getRuntimeUnit(unit, map.endless, 1);

    expect(runtime.hp).toBeCloseTo(220);
    expect(runtime.damage).toBeCloseTo(18);
    expect(runtime.speed).toBeCloseTo(26.25);
    expect(runtime.coinsOnDeath).toBe(5);
    expect(unit).toMatchObject({ hp: 100, damage: 10, speed: 20, coinsOnDeath: 3 });
  });

  it('multiplies positive armor, divides negative armor and keeps zero unchanged', () => {
    const unit: UnitDefinition = {
      id: 'tank',
      name: 'Танк',
      hp: 100,
      damage: 10,
      damageSourceId: 'fire',
      speed: 20,
      coinsOnDeath: 1,
      traits: ['armored'],
      animationSpeed: 1,
      animations: createEmptyUnitAnimations(),
      animationSounds: createEmptyUnitAnimationSounds(),
      traitMultipliers: { protection: 2 },
      damageProtection: {
        fire: 40,
        ice: -40,
        lightning: 0,
        poison: 80,
      },
    };

    const runtime = getRuntimeUnit(unit, map.endless, 0);

    expect(runtime.damageProtection).toEqual({
      fire: 80,
      ice: -20,
      lightning: 0,
      poison: 100,
    });
    expect(unit.damageProtection).toEqual({ fire: 40, ice: -40, lightning: 0, poison: 80 });
  });

});
