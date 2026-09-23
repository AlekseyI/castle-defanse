const REFERENCE_COMPACT_PATH = 300;
const MIN_COMPACT_SPEED_SCALE = 0.35;
const MAX_COMPACT_SPEED_SCALE = 0.65;
const SPAWN_GAP = 4;

export function getEnemySpeedScale(pathLength: number, compact: boolean): number {
  if (!compact) return 1;

  const normalizedPath = Math.max(0, pathLength);
  const pathScale = normalizedPath / REFERENCE_COMPACT_PATH;
  return Math.max(MIN_COMPACT_SPEED_SCALE, Math.min(MAX_COMPACT_SPEED_SCALE, pathScale));
}

export function getEnemySpawnY(visualBottomExtent: number): number {
  return -Math.max(0, visualBottomExtent) - SPAWN_GAP;
}
