import type {
  EndlessWaveSettings,
  MapDefinition,
  MapWaveDefinition,
  WaveSpawnBlock,
} from '../editor/maps/types';
import { hasTrait } from '../editor/units/unitLogic';
import type { DamageProtection, UnitDefinition } from '../editor/units/types';

export type WaveBlockStep = 'spawn-unit' | 'wait-field-clear' | 'advance-block' | 'wave-complete';

interface WaveBlockProgress {
  spawnedUnits: number;
  blockCount: number;
  activeEnemies: number;
  hasNextBlock: boolean;
  nextStartWhen?: WaveSpawnBlock['startWhen'];
}

export interface RuntimeWave {
  wave: MapWaveDefinition;
  endlessCycle: number;
}

export interface RuntimeSpawnBlock extends WaveSpawnBlock {
  count: number;
  spawnEvery: number;
}

export function getWaveBlockStep({
  spawnedUnits,
  blockCount,
  activeEnemies,
  hasNextBlock,
  nextStartWhen,
}: WaveBlockProgress): WaveBlockStep {
  if (spawnedUnits < blockCount) return 'spawn-unit';

  if (hasNextBlock) {
    if (nextStartWhen === 'field-clear' && activeEnemies > 0) return 'wait-field-clear';
    return 'advance-block';
  }

  return activeEnemies > 0 ? 'wait-field-clear' : 'wave-complete';
}

export function getRuntimeWave(map: MapDefinition, waveIndex: number): RuntimeWave | null {
  if (waveIndex < 0 || map.waves.length === 0) return null;
  if (waveIndex < map.waves.length) return { wave: map.waves[waveIndex], endlessCycle: 0 };
  if (!map.endless.enabled) return null;

  const repeatCount = Math.min(
    map.waves.length,
    Math.max(1, Math.floor(map.endless.repeatLastWaves)),
  );
  const endlessIndex = waveIndex - map.waves.length;
  const repeatedWaveOffset = endlessIndex % repeatCount;
  const repeatedWaveStart = map.waves.length - repeatCount;

  return {
    wave: map.waves[repeatedWaveStart + repeatedWaveOffset],
    endlessCycle: Math.floor(endlessIndex / repeatCount) + 1,
  };
}

export function getRuntimeSpawnBlock(
  block: WaveSpawnBlock,
  endless: EndlessWaveSettings,
  endlessCycle: number,
): RuntimeSpawnBlock {
  if (endlessCycle <= 0) return { ...block };

  const intervalMultiplier = Math.pow(
    Math.max(0, 1 - endless.spawnIntervalReductionPercent / 100),
    endlessCycle,
  );

  const spawnEvery = Math.max(
    endless.minSpawnInterval,
    block.spawnEvery * intervalMultiplier,
  );

  return {
    ...block,
    count: Math.max(1, block.count + endless.countGrowth * endlessCycle),
    spawnEvery: Number(spawnEvery.toFixed(12)),
  };
}

function applyProtectionMultiplier(
  protection: DamageProtection | undefined,
  multiplier: number,
): DamageProtection | undefined {
  if (!protection) return undefined;

  return Object.fromEntries(
    Object.entries(protection).map(([sourceId, value]) => {
      if (value > 0) return [sourceId, Math.min(100, value * multiplier)];
      if (value < 0) return [sourceId, value / multiplier];
      return [sourceId, 0];
    }),
  );
}

export function getRuntimeUnit(
  unit: UnitDefinition,
  endless: EndlessWaveSettings,
  endlessCycle: number,
): UnitDefinition {
  const traitMultipliers = unit.traitMultipliers;
  const runtimeUnit: UnitDefinition = {
    ...unit,
    hp: hasTrait(unit, 'healthy') ? unit.hp * (traitMultipliers?.hp ?? 1) : unit.hp,
    damage: hasTrait(unit, 'strong') ? unit.damage * (traitMultipliers?.damage ?? 1) : unit.damage,
    speed: hasTrait(unit, 'fast') ? unit.speed * (traitMultipliers?.speed ?? 1) : unit.speed,
    coinsOnDeath: hasTrait(unit, 'generous')
      ? Math.round(unit.coinsOnDeath * (traitMultipliers?.coins ?? 1))
      : unit.coinsOnDeath,
    damageProtection: hasTrait(unit, 'armored')
      ? applyProtectionMultiplier(unit.damageProtection, traitMultipliers?.protection ?? 1)
      : unit.damageProtection,
  };

  if (endlessCycle <= 0) return runtimeUnit;

  const hpMultiplier = Math.pow(1 + endless.hpGrowthPercent / 100, endlessCycle);
  const damageMultiplier = Math.pow(1 + endless.damageGrowthPercent / 100, endlessCycle);
  const speedMultiplier = Math.pow(1 + endless.speedGrowthPercent / 100, endlessCycle);

  return {
    ...runtimeUnit,
    hp: runtimeUnit.hp * hpMultiplier,
    damage: runtimeUnit.damage * damageMultiplier,
    speed: runtimeUnit.speed * speedMultiplier,
  };
}
