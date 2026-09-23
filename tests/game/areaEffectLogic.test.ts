import { describe, expect, it } from 'vitest';
import {
  DAMAGE_AREA_DURATION,
  advanceAreaEffect,
  collectNewAreaTargets,
  createActiveAreaEffect,
  getAreaTop,
  getTargetsInArea,
} from '../../src/game/areaEffectLogic';
import type { DamageAbilityEffect, PeriodicDamageAbilityEffect, SlowAbilityEffect } from '../../src/editor/abilities/types';

type Target = { y: number };

const damageEffect: DamageAbilityEffect = {
  type: 'damage',
  amount: 55,
  damageSourceId: 'fire',
  criticalChancePercent: 0,
  criticalMultiplier: 1.5,
  target: { type: 'area-enemies', areaHeightPercent: 50 },
};

const slowEffect: SlowAbilityEffect = {
  type: 'slow',
  slowPercent: 80,
  duration: 4,
  target: { type: 'area-enemies', areaHeightPercent: 50 },
};

const periodicDamageEffect: PeriodicDamageAbilityEffect = {
  type: 'periodic-damage',
  chancePercent: 50,
  amount: 10,
  duration: 3,
  criticalChancePercent: 20,
  criticalMultiplier: 1.5,
  visualColor: '#f97316',
  target: { type: 'area-enemies', areaHeightPercent: 50 },
};

describe('areaEffectLogic', () => {
  it('keeps damage AOE active so a target entering after cast is affected', () => {
    const active = createActiveAreaEffect<Target>(damageEffect);
    const target = { y: 40 };

    expect(collectNewAreaTargets(active, [target], (item) => item.y, 100)).toEqual([]);
    expect(advanceAreaEffect(active, 0.25)).toBe(true);

    target.y = 60;
    expect(collectNewAreaTargets(active, [target], (item) => item.y, 100)).toEqual([target]);
    expect(collectNewAreaTargets(active, [target], (item) => item.y, 100)).toEqual([]);
    expect(active.remaining).toBe(DAMAGE_AREA_DURATION - 0.25);
  });

  it('keeps periodic-damage AOE active long enough to catch an enemy entering the area', () => {
    const active = createActiveAreaEffect<Target>(periodicDamageEffect);
    const target = { y: 20 };

    expect(active.remaining).toBe(DAMAGE_AREA_DURATION);
    expect(collectNewAreaTargets(active, [target], (item) => item.y, 100)).toEqual([]);
    expect(advanceAreaEffect(active, 0.4)).toBe(true);

    target.y = 70;
    expect(collectNewAreaTargets(active, [target], (item) => item.y, 100)).toEqual([target]);
  });

  it('keeps slow AOE active for the configured duration and catches later entrants', () => {
    const active = createActiveAreaEffect<Target>(slowEffect);
    const target = { y: 10 };

    expect(active.remaining).toBe(4);
    expect(collectNewAreaTargets(active, [target], (item) => item.y, 100)).toEqual([]);
    expect(advanceAreaEffect(active, 2)).toBe(true);

    target.y = 75;
    expect(collectNewAreaTargets(active, [target], (item) => item.y, 100)).toEqual([target]);
    expect(advanceAreaEffect(active, 2)).toBe(false);
  });

  it('clamps the AOE height to the supported 1-100 percent range', () => {
    expect(getAreaTop(200, 0)).toBe(198);
    expect(getAreaTop(200, 50)).toBe(100);
    expect(getAreaTop(200, 150)).toBe(0);
    expect(getTargetsInArea(damageEffect.target, [{ y: 99 }, { y: 100 }], (item) => item.y, 200))
      .toEqual([{ y: 100 }]);
  });
});
