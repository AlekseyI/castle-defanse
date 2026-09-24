import type { MapUpgradeSettings, WaveUpgradeReward } from '../../editor/maps/types';

export type EnemyExitReason = 'killed' | 'reached-base';

export interface EffectiveUpgradeReward {
  enabled: boolean;
  cardCount: number;
}

export function resolveWaveUpgradeReward(
  mapSettings: MapUpgradeSettings,
  waveReward: WaveUpgradeReward,
): EffectiveUpgradeReward {
  if (waveReward.override) {
    return {
      enabled: waveReward.enabled,
      cardCount: waveReward.cardCount,
    };
  }

  return {
    enabled: mapSettings.enabled,
    cardCount: mapSettings.cardCount,
  };
}

export function earnsBossUpgradeReward(
  isBoss: boolean,
  rewardOnBossKill: boolean,
  reason: EnemyExitReason,
): boolean {
  return isBoss && rewardOnBossKill && reason === 'killed';
}

export function shouldShowUpgradeReward(
  hasNextWave: boolean,
  bossRewardEarned: boolean,
  waveRewardEnabled: boolean,
): boolean {
  return hasNextWave && (bossRewardEarned || waveRewardEnabled);
}
