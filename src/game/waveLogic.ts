export type WaveStep = 'spawn-enemy' | 'wait-enemies' | 'spawn-boss' | 'wave-complete';

interface WaveProgress {
  spawnedEnemies: number;
  enemyCount: number;
  activeEnemies: number;
  bossSpawned: boolean;
}

export function getWaveStep({
  spawnedEnemies,
  enemyCount,
  activeEnemies,
  bossSpawned,
}: WaveProgress): WaveStep {
  if (spawnedEnemies < enemyCount) return 'spawn-enemy';
  if (activeEnemies > 0) return 'wait-enemies';
  if (!bossSpawned) return 'spawn-boss';
  return 'wave-complete';
}
