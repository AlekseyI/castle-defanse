import { describe, expect, it } from 'vitest';
import { advanceCastleAttack, formatDamagePopup, resolveDamageHit } from '../../src/game/damageLogic';

describe('damageLogic', () => {
  it('applies the configured non-integer critical multiplier when the roll succeeds', () => {
    expect(resolveDamageHit(40, 25, 1.5, 0.1)).toEqual({
      amount: 60,
      critical: true,
      criticalMultiplier: 1.5,
    });
  });

  it('keeps normal damage when the critical roll fails', () => {
    expect(resolveDamageHit(40, 25, 2, 0.5)).toEqual({
      amount: 40,
      critical: false,
      criticalMultiplier: 1,
    });
  });

  it('formats normal and critical floating damage labels', () => {
    expect(formatDamagePopup(12.25, false, 1)).toBe('12.3');
    expect(formatDamagePopup(60, true, 1.5)).toBe('60 ×1.5');
  });
  it('starts castle attacks after one second and continues once per second', () => {
    let state = advanceCastleAttack(1, 0.4);
    expect(state).toEqual({ attacks: 0, nextAttackIn: 0.6 });

    state = advanceCastleAttack(state.nextAttackIn, 0.6);
    expect(state).toEqual({ attacks: 1, nextAttackIn: 1 });

    state = advanceCastleAttack(state.nextAttackIn, 2.2);
    expect(state.attacks).toBe(2);
    expect(state.nextAttackIn).toBeCloseTo(0.8);
  });

  it('slows castle attack speed by the same multiplier as movement', () => {
    let state = advanceCastleAttack(1, 1, 1, 0.5);
    expect(state).toEqual({ attacks: 0, nextAttackIn: 0.5 });

    state = advanceCastleAttack(state.nextAttackIn, 1, 1, 0.5);
    expect(state).toEqual({ attacks: 1, nextAttackIn: 1 });
  });

});
