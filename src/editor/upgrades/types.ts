import type { AbilityTargetType } from '../abilities/types';

export type UpgradeRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type UpgradeModifierEffectType =
  | 'ability-damage-percent'
  | 'ability-damage-flat'
  | 'ability-damage-target-type'
  | 'ability-damage-target-count'
  | 'ability-damage-area-height'
  | 'ability-damage-source'
  | 'ability-damage-critical-chance'
  | 'ability-damage-critical-multiplier'
  | 'ability-periodic-damage-percent'
  | 'ability-periodic-damage-flat'
  | 'ability-periodic-target-type'
  | 'ability-periodic-target-count'
  | 'ability-periodic-area-height'
  | 'ability-periodic-chance'
  | 'ability-periodic-critical-chance'
  | 'ability-periodic-critical-multiplier'
  | 'ability-periodic-duration-percent'
  | 'ability-periodic-duration-flat'
  | 'ability-periodic-visual-color'
  | 'ability-slow-percent'
  | 'ability-slow-target-type'
  | 'ability-slow-target-count'
  | 'ability-slow-area-height'
  | 'ability-slow-duration-percent'
  | 'ability-slow-duration-flat'
  | 'ability-heal-percent'
  | 'ability-heal-flat';

export type UpgradeTargetEffectType =
  | 'ability-damage-target-type'
  | 'ability-periodic-target-type'
  | 'ability-slow-target-type';

export type UpgradeAddEffectType =
  | 'ability-add-damage'
  | 'ability-add-periodic-damage'
  | 'ability-add-slow'
  | 'ability-add-heal';

export type UpgradeEffectType = UpgradeModifierEffectType | UpgradeAddEffectType;

export interface UpgradeTargetValue {
  type: AbilityTargetType;
  count: number;
  areaHeightPercent: number;
}

export type UpgradeAddedTarget = UpgradeTargetValue;

export interface UpgradeAddedDamageValue {
  amount: number;
  damageSourceId: string;
  criticalChancePercent: number;
  criticalMultiplier: number;
  target: UpgradeAddedTarget;
}

export interface UpgradeAddedPeriodicDamageValue {
  chancePercent: number;
  amount: number;
  duration: number;
  criticalChancePercent: number;
  criticalMultiplier: number;
  visualColor: string;
  target: UpgradeAddedTarget;
}

export interface UpgradeAddedSlowValue {
  slowPercent: number;
  duration: number;
  target: UpgradeAddedTarget;
}

export interface UpgradeAddedHealValue {
  amount: number;
  target: UpgradeAddedTarget;
}

export type UpgradeAddEffectValue =
  | UpgradeAddedDamageValue
  | UpgradeAddedPeriodicDamageValue
  | UpgradeAddedSlowValue
  | UpgradeAddedHealValue;

export type UpgradeEffectValue = number | string | UpgradeTargetValue | UpgradeAddEffectValue;

interface UpgradeEffectBase {
  abilityId: string;
}

type UpgradeNonTargetModifierEffectType = Exclude<UpgradeModifierEffectType, UpgradeTargetEffectType>;

export type UpgradeEffect =
  | (UpgradeEffectBase & { type: UpgradeNonTargetModifierEffectType; value: number | string })
  | (UpgradeEffectBase & { type: UpgradeTargetEffectType; value: UpgradeTargetValue })
  | (UpgradeEffectBase & { type: 'ability-add-damage'; value: UpgradeAddedDamageValue })
  | (UpgradeEffectBase & { type: 'ability-add-periodic-damage'; value: UpgradeAddedPeriodicDamageValue })
  | (UpgradeEffectBase & { type: 'ability-add-slow'; value: UpgradeAddedSlowValue })
  | (UpgradeEffectBase & { type: 'ability-add-heal'; value: UpgradeAddedHealValue });

export interface UpgradeCardImage {
  name: string;
  src: string;
}

export interface UpgradeCardDefinition {
  id: string;
  name: string;
  description: string;
  rarity: UpgradeRarity;
  weight: number;
  effects: UpgradeEffect[];
  color?: string;
  image?: UpgradeCardImage;
}
