import { describe, expect, it } from 'vitest';
import {
  damageSourceColorToNumber,
  getRangedProjectileDuration,
  getRangedProjectilePoint,
} from '../../src/game/rangedProjectileLogic';

describe('rangedProjectileLogic', () => {
  it('uses the configured damage source hex color', () => {
    expect(damageSourceColorToNumber('#e9573f')).toBe(0xe9573f);
    expect(damageSourceColorToNumber('#4BA3FF')).toBe(0x4ba3ff);
  });

  it('falls back to a neutral projectile color for a missing or malformed source color', () => {
    expect(damageSourceColorToNumber()).toBe(0xcbd5e1);
    expect(damageSourceColorToNumber('red')).toBe(0xcbd5e1);
  });

  it('keeps projectile flight duration inside the visual timing bounds', () => {
    expect(getRangedProjectileDuration({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0.18);
    expect(getRangedProjectileDuration({ x: 0, y: 0 }, { x: 1000, y: 0 })).toBe(0.42);
  });

  it('starts and ends exactly at the requested points while bending the flight path', () => {
    const start = { x: 20, y: 40 };
    const end = { x: 120, y: 220 };

    expect(getRangedProjectilePoint(start, end, 0)).toEqual(start);
    expect(getRangedProjectilePoint(start, end, 1)).toEqual(end);

    const middle = getRangedProjectilePoint(start, end, 0.5);
    expect(middle).not.toEqual({ x: 70, y: 130 });
  });
});
