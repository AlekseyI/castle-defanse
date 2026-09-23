import type {
  EndlessWaveSettings,
  MapDefinition,
  MapWaveDefinition,
  WaveSpawnBlock,
} from '../editor/maps/types';
import type { UnitDefinition } from '../editor/units/types';

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

export function getRuntimeUnit(
  unit: UnitDefinition,
  endless: EndlessWaveSettings,
  endlessCycle: number,
): UnitDefinition {
  if (endlessCycle <= 0) return unit;

  const hpMultiplier = Math.pow(1 + endless.hpGrowthPercent / 100, endlessCycle);
  const damageMultiplier = Math.pow(1 + endless.damageGrowthPercent / 100, endlessCycle);
  const speedMultiplier = Math.pow(1 + endless.speedGrowthPercent / 100, endlessCycle);

  return {
    ...unit,
    hp: unit.hp * hpMultiplier,
    damage: unit.damage * damageMultiplier,
    speed: unit.speed * speedMultiplier,
  };
}
