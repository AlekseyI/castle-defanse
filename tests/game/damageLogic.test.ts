import { describe, expect, it } from 'vitest';
import { formatDamagePopup, resolveDamageHit } from '../../src/game/damageLogic';

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
    expect(formatDamagePopup(12.25, false, 1)).toBe('-12.3');
    expect(formatDamagePopup(60, true, 1.5)).toBe('КРИТ! -60 ×1.5');
  });
});
