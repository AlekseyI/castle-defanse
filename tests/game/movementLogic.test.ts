import { describe, expect, it } from 'vitest';
import { getEnemyAttackY, getEnemySpawnY, getEnemySpeedScale } from '../../src/game/movementLogic';

describe('getEnemySpeedScale', () => {
  it('keeps the configured enemy speed on the reference path length', () => {
    expect(getEnemySpeedScale(300)).toBe(1);
  });

  it('scales enemy speed proportionally to a shorter path', () => {
    expect(getEnemySpeedScale(150)).toBe(0.5);
  });

  it('scales enemy speed proportionally to a longer path', () => {
    expect(getEnemySpeedScale(450)).toBe(1.5);
  });

  it('keeps travel time equal for the same configured speed on different path lengths', () => {
    const configuredSpeed = 60;
    const shortPath = 150;
    const longPath = 450;

    const shortTravelTime = shortPath / (configuredSpeed * getEnemySpeedScale(shortPath));
    const longTravelTime = longPath / (configuredSpeed * getEnemySpeedScale(longPath));

    expect(shortTravelTime).toBeCloseTo(longTravelTime);
  });
});

describe('getEnemySpawnY', () => {
  it('places the whole enemy visual, including the hp bar, above the visible top edge', () => {
    const normalVisualBottomExtent = 24 + 6;
    const bossVisualBottomExtent = 37 + 6;

    expect(getEnemySpawnY(normalVisualBottomExtent) + normalVisualBottomExtent).toBeLessThan(0);
    expect(getEnemySpawnY(bossVisualBottomExtent) + bossVisualBottomExtent).toBeLessThan(0);
  });
});

describe('getEnemyAttackY', () => {
  it('places ranged attack point at the configured percentage of the path', () => {
    expect(getEnemyAttackY(-20, 280, 60)).toBe(160);
    expect(getEnemyAttackY(-20, 280, 100)).toBe(280);
    expect(getEnemyAttackY(-20, 280, 0)).toBe(-20);
  });
});
