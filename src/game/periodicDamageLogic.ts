import type { PeriodicDamageAbilityEffect } from '../editor/abilities/types';
import { resolveDamageHit, type DamageHit } from './damageLogic';

export const PERIODIC_DAMAGE_INTERVAL = 1;
const TIME_EPSILON = 1e-9;

export interface ActivePeriodicDamage<T> {
  target: T;
  effect: PeriodicDamageAbilityEffect;
  remaining: number;
  untilNextTick: number;
}

export function shouldApplyPeriodicDamage(chancePercent: number, randomValue = Math.random()): boolean {
  const chance = Math.max(0, Math.min(100, chancePercent));
  if (chance <= 0) return false;
  if (chance >= 100) return true;
  return randomValue < chance / 100;
}

export function resolvePeriodicDamageTick(
  effect: PeriodicDamageAbilityEffect,
  randomValue = Math.random(),
): DamageHit {
  return resolveDamageHit(
    effect.amount,
    effect.criticalChancePercent,
    effect.criticalMultiplier,
    randomValue,
  );
}

export function createActivePeriodicDamage<T>(
  target: T,
  effect: PeriodicDamageAbilityEffect,
): ActivePeriodicDamage<T> {
  const remaining = Math.max(0, effect.duration);
  return {
    target,
    effect,
    remaining,
    untilNextTick: Math.min(PERIODIC_DAMAGE_INTERVAL, remaining),
  };
}

export function advancePeriodicDamage<T>(active: ActivePeriodicDamage<T>, dt: number): number {
  if (active.remaining <= 0) return 0;

  const safeDt = Math.max(0, dt);
  let elapsed = Math.min(active.remaining, safeDt);
  active.remaining = Math.max(0, active.remaining - safeDt);
  if (active.remaining < TIME_EPSILON) active.remaining = 0;
  let ticks = 0;

  while (elapsed > 0 && active.untilNextTick <= elapsed + TIME_EPSILON) {
    elapsed = Math.max(0, elapsed - active.untilNextTick);
    ticks += 1;
    active.untilNextTick = PERIODIC_DAMAGE_INTERVAL;
  }

  active.untilNextTick = Math.max(0, active.untilNextTick - elapsed);
  if (active.untilNextTick < TIME_EPSILON) active.untilNextTick = 0;
  return ticks;
}
