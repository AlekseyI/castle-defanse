import { describe, expect, it } from 'vitest';
import { getWaveStep } from '../../src/game/waveLogic';

describe('waveLogic', () => {
  it('spawns regular enemies until the configured wave count is reached', () => {
    expect(
      getWaveStep({ spawnedEnemies: 3, enemyCount: 7, activeEnemies: 0, bossSpawned: false }),
    ).toBe('spawn-enemy');
  });

  it('waits for regular enemies to leave the battlefield before spawning the boss', () => {
    expect(
      getWaveStep({ spawnedEnemies: 7, enemyCount: 7, activeEnemies: 2, bossSpawned: false }),
    ).toBe('wait-enemies');
  });

  it('spawns one boss after all regular enemies are gone', () => {
    expect(
      getWaveStep({ spawnedEnemies: 7, enemyCount: 7, activeEnemies: 0, bossSpawned: false }),
    ).toBe('spawn-boss');
  });

  it('completes the wave only after the spawned boss is gone', () => {
    expect(
      getWaveStep({ spawnedEnemies: 7, enemyCount: 7, activeEnemies: 1, bossSpawned: true }),
    ).toBe('wait-enemies');
    expect(
      getWaveStep({ spawnedEnemies: 7, enemyCount: 7, activeEnemies: 0, bossSpawned: true }),
    ).toBe('wave-complete');
  });
});
