import { describe, expect, it } from 'vitest';
import {
  earnsBossUpgradeReward,
  resolveWaveUpgradeReward,
  shouldShowUpgradeReward,
} from '../../../src/game/upgrades/upgradeRewardLogic';

describe('upgradeRewardLogic', () => {
  it('uses map settings for a wave until that wave enables its override', () => {
    const mapSettings = { enabled: true, cardCount: 3, rewardOnBossKill: true };

    expect(resolveWaveUpgradeReward(mapSettings, {
      override: false,
      enabled: false,
      cardCount: 7,
    })).toEqual({ enabled: true, cardCount: 3 });

    expect(resolveWaveUpgradeReward(mapSettings, {
      override: true,
      enabled: false,
      cardCount: 7,
    })).toEqual({ enabled: false, cardCount: 7 });
  });

  it('grants boss reward only when map boss rewards are enabled and the boss is killed', () => {
    expect(earnsBossUpgradeReward(true, true, 'killed')).toBe(true);
    expect(earnsBossUpgradeReward(true, true, 'reached-base')).toBe(false);
    expect(earnsBossUpgradeReward(true, false, 'killed')).toBe(false);
    expect(earnsBossUpgradeReward(false, true, 'killed')).toBe(false);
  });

  it('combines boss and wave rewards into one reward decision', () => {
    expect(shouldShowUpgradeReward(true, true, true)).toBe(true);
    expect(shouldShowUpgradeReward(true, true, false)).toBe(true);
    expect(shouldShowUpgradeReward(true, false, true)).toBe(true);
    expect(shouldShowUpgradeReward(true, false, false)).toBe(false);
  });

  it('never shows cards after the final wave of a finite map', () => {
    expect(shouldShowUpgradeReward(false, true, true)).toBe(false);
  });
});
