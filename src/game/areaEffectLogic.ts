import type { AbilityTarget, DamageAbilityEffect, PeriodicDamageAbilityEffect, SlowAbilityEffect } from '../editor/abilities/types';

export type AreaAbilityEffect = DamageAbilityEffect | PeriodicDamageAbilityEffect | SlowAbilityEffect;

export interface ActiveAreaEffect<T> {
  effect: AreaAbilityEffect;
  remaining: number;
  affectedTargets: Set<T>;
}

export const DAMAGE_AREA_DURATION = 1;

export function createActiveAreaEffect<T>(effect: AreaAbilityEffect): ActiveAreaEffect<T> {
  return {
    effect,
    remaining: effect.type === 'slow' ? Math.max(0, effect.duration) : DAMAGE_AREA_DURATION,
    affectedTargets: new Set<T>(),
  };
}

export function getAreaTop(battleHeight: number, heightPercent: number): number {
  const clampedHeightPercent = Math.max(1, Math.min(100, heightPercent));
  return battleHeight * (1 - clampedHeightPercent / 100);
}

export function getTargetsInArea<T>(
  target: AbilityTarget,
  targets: readonly T[],
  getY: (item: T) => number,
  battleHeight: number,
): T[] {
  const areaTop = getAreaTop(battleHeight, target.areaHeightPercent ?? 50);
  return targets.filter((item) => getY(item) >= areaTop);
}

export function collectNewAreaTargets<T>(
  activeEffect: ActiveAreaEffect<T>,
  targets: readonly T[],
  getY: (target: T) => number,
  battleHeight: number,
): T[] {
  const newTargets = getTargetsInArea(activeEffect.effect.target, targets, getY, battleHeight)
    .filter((target) => !activeEffect.affectedTargets.has(target));

  for (const target of newTargets) activeEffect.affectedTargets.add(target);
  return newTargets;
}

export function advanceAreaEffect<T>(activeEffect: ActiveAreaEffect<T>, dt: number): boolean {
  activeEffect.remaining = Math.max(0, activeEffect.remaining - Math.max(0, dt));
  return activeEffect.remaining > 0;
}
