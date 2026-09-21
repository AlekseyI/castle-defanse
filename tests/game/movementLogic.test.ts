import { describe, expect, it } from 'vitest';
import { getEnemySpeedScale } from '../../src/game/movementLogic';

describe('getEnemySpeedScale', () => {
  it('keeps the configured enemy speed on non-compact layouts', () => {
    expect(getEnemySpeedScale(120, false)).toBe(1);
  });

  it('reduces enemy speed when a compact layout shortens the path', () => {
    expect(getEnemySpeedScale(150, true)).toBe(0.5);
  });

  it('does not reduce compact enemy speed below the minimum scale', () => {
    expect(getEnemySpeedScale(30, true)).toBe(0.35);
  });

  it('keeps a visible speed difference on tall mobile screens', () => {
    expect(getEnemySpeedScale(282, true)).toBe(0.65);
  });

  it('caps compact enemy speed even when the path is long', () => {
    expect(getEnemySpeedScale(360, true)).toBe(0.65);
  });
});
