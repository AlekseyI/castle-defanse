import { describe, expect, it } from 'vitest';
import {
  PERIODIC_DAMAGE_INTERVAL,
  advancePeriodicDamage,
  createActivePeriodicDamage,
  resolvePeriodicDamageTick,
  shouldApplyPeriodicDamage,
} from '../../src/game/periodicDamageLogic';
import type { PeriodicDamageAbilityEffect } from '../../src/editor/abilities/types';

const effect: PeriodicDamageAbilityEffect = {
  type: 'periodic-damage',
  chancePercent: 50,
  amount: 12,
  duration: 3,
  criticalChancePercent: 25,
  criticalMultiplier: 1.5,
  visualColor: '#f97316',
  target: { type: 'all-enemies' },
};

describe('periodicDamageLogic', () => {
  it('applies chance independently from damage ticking', () => {
    expect(shouldApplyPeriodicDamage(0, 0)).toBe(false);
    expect(shouldApplyPeriodicDamage(50, 0.49)).toBe(true);
    expect(shouldApplyPeriodicDamage(50, 0.5)).toBe(false);
    expect(shouldApplyPeriodicDamage(100, 0.999)).toBe(true);
  });

  it('rolls critical damage independently for each periodic tick', () => {
    expect(resolvePeriodicDamageTick(effect, 0.1)).toEqual({
      amount: 18,
      critical: true,
      criticalMultiplier: 1.5,
    });
    expect(resolvePeriodicDamageTick(effect, 0.5)).toEqual({
      amount: 12,
      critical: false,
      criticalMultiplier: 1,
    });
  });

  it('keeps the final tick when short durations are split across frame updates', () => {
    const target = { id: 'enemy' };
    const active = createActivePeriodicDamage(target, { ...effect, duration: 0.5 });

    expect(advancePeriodicDamage(active, 0.49)).toBe(0);
    expect(advancePeriodicDamage(active, 0.01)).toBe(1);
    expect(active.remaining).toBe(0);
  });

  it('deals one tick per second for the configured duration', () => {
    const target = { id: 'enemy' };
    const active = createActivePeriodicDamage(target, effect);

    expect(active.untilNextTick).toBe(PERIODIC_DAMAGE_INTERVAL);
    expect(advancePeriodicDamage(active, 0.5)).toBe(0);
    expect(advancePeriodicDamage(active, 0.5)).toBe(1);
    expect(advancePeriodicDamage(active, 1)).toBe(1);
    expect(advancePeriodicDamage(active, 1)).toBe(1);
    expect(active.remaining).toBe(0);
    expect(advancePeriodicDamage(active, 1)).toBe(0);
  });

  it('produces one final tick for durations shorter than one second', () => {
    const active = createActivePeriodicDamage({ id: 'enemy' }, { ...effect, duration: 0.4 });

    expect(advancePeriodicDamage(active, 0.2)).toBe(0);
    expect(advancePeriodicDamage(active, 0.2)).toBe(1);
    expect(active.remaining).toBe(0);
  });

  it('handles a large frame delta without losing ticks', () => {
    const active = createActivePeriodicDamage({ id: 'enemy' }, effect);

    expect(advancePeriodicDamage(active, 3)).toBe(3);
    expect(active.remaining).toBe(0);
  });
});
