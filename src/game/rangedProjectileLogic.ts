export interface ProjectilePoint {
  x: number;
  y: number;
}

const DEFAULT_PROJECTILE_COLOR = 0xcbd5e1;
const MIN_PROJECTILE_DURATION = 0.18;
const MAX_PROJECTILE_DURATION = 0.42;
const PROJECTILE_SPEED = 720;

export function damageSourceColorToNumber(color?: string): number {
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) return DEFAULT_PROJECTILE_COLOR;
  return Number.parseInt(color.slice(1), 16);
}

export function getRangedProjectileDuration(start: ProjectilePoint, end: ProjectilePoint): number {
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  return Math.max(MIN_PROJECTILE_DURATION, Math.min(MAX_PROJECTILE_DURATION, distance / PROJECTILE_SPEED));
}

export function getRangedProjectilePoint(
  start: ProjectilePoint,
  end: ProjectilePoint,
  progress: number,
): ProjectilePoint {
  const t = Math.max(0, Math.min(1, progress));
  if (t === 0) return { ...start };
  if (t === 1) return { ...end };

  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance <= Number.EPSILON) return { ...end };

  const perpendicularX = -deltaY / distance;
  const perpendicularY = deltaX / distance;
  const bendDirection = start.x <= end.x ? -1 : 1;
  const bend = Math.min(34, Math.max(12, distance * 0.12)) * Math.sin(Math.PI * t) * bendDirection;

  return {
    x: start.x + deltaX * t + perpendicularX * bend,
    y: start.y + deltaY * t + perpendicularY * bend,
  };
}
