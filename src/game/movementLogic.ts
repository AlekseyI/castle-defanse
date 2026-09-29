const REFERENCE_ENEMY_PATH_LENGTH = 300;
const SPAWN_GAP = 4;

export function getEnemySpeedScale(pathLength: number): number {
  return Math.max(0, pathLength) / REFERENCE_ENEMY_PATH_LENGTH;
}

export function getEnemySpawnY(visualBottomExtent: number): number {
  return -Math.max(0, visualBottomExtent) - SPAWN_GAP;
}
