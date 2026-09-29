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

export const UPGRADE_TARGET_EFFECT_TYPES: readonly UpgradeTargetEffectType[] = [
  'ability-damage-target-type',
  'ability-periodic-target-type',
  'ability-slow-target-type',
];

export type UpgradeAddEffectType =
  | 'ability-add-damage'
  | 'ability-add-periodic-damage'
  | 'ability-add-slow'
  | 'ability-add-heal';

export type UpgradeEffectType = UpgradeModifierEffectType | UpgradeAddEffectType;

export const UPGRADE_EFFECT_TYPES: readonly UpgradeEffectType[] = [
  'ability-damage-percent',
  'ability-damage-flat',
  'ability-damage-target-type',
  'ability-damage-target-count',
  'ability-damage-area-height',
  'ability-damage-source',
  'ability-damage-critical-chance',
  'ability-damage-critical-multiplier',
  'ability-periodic-damage-percent',
  'ability-periodic-damage-flat',
  'ability-periodic-target-type',
  'ability-periodic-target-count',
  'ability-periodic-area-height',
  'ability-periodic-chance',
  'ability-periodic-critical-chance',
  'ability-periodic-critical-multiplier',
  'ability-periodic-duration-percent',
  'ability-periodic-duration-flat',
  'ability-periodic-visual-color',
  'ability-slow-percent',
  'ability-slow-target-type',
  'ability-slow-target-count',
  'ability-slow-area-height',
  'ability-slow-duration-percent',
  'ability-slow-duration-flat',
  'ability-heal-percent',
  'ability-heal-flat',
  'ability-add-damage',
  'ability-add-periodic-damage',
  'ability-add-slow',
  'ability-add-heal',
];

export const UPGRADE_CARD_EFFECT_TYPES: readonly UpgradeEffectType[] = UPGRADE_EFFECT_TYPES.filter(
  (type) => !UPGRADE_TARGET_EFFECT_TYPES.includes(type as UpgradeTargetEffectType),
);

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
  receiveKey?: string;
  name: string;
  description: string;
  rarity: UpgradeRarity;
  weight: number;
  effects: UpgradeEffect[];
  color?: string;
  image?: UpgradeCardImage;
}

export interface UpgradeNumberRange {
  min: number;
  max: number;
  step: number;
}

export type UpgradeRarityRanges = Record<UpgradeRarity, UpgradeNumberRange>;

interface UpgradeGenerationRuleBase {
  enabled: boolean;
  weight: number;
}

export interface UpgradeNumberGenerationRule extends UpgradeGenerationRuleBase {
  kind: 'number';
  ranges: UpgradeRarityRanges;
}

export interface UpgradeOptionGenerationRule extends UpgradeGenerationRuleBase {
  kind: 'option';
  values: string[];
}

export interface UpgradeAddedEffectGenerationSettings {
  amount?: UpgradeRarityRanges;
  chancePercent?: UpgradeRarityRanges;
  duration?: UpgradeRarityRanges;
  criticalChancePercent?: UpgradeRarityRanges;
  criticalMultiplier?: UpgradeRarityRanges;
  slowPercent?: UpgradeRarityRanges;
  targetCount?: UpgradeRarityRanges;
  areaHeightPercent?: UpgradeRarityRanges;
  damageSourceIds?: string[];
  visualColors?: string[];
  targetTypes: AbilityTargetType[];
}

export interface UpgradeAddEffectGenerationRule extends UpgradeGenerationRuleBase {
  kind: 'add-effect';
  settings: UpgradeAddedEffectGenerationSettings;
}

export type UpgradeParameterGenerationRule =
  | UpgradeNumberGenerationRule
  | UpgradeOptionGenerationRule
  | UpgradeAddEffectGenerationRule;

export interface UpgradeGenerationConfig {
  enabled: boolean;
  previewCardCount: number;
  minParametersPerCard: number;
  maxParametersPerCard: number;
  allowDuplicateParameters: boolean;
  allowSameAbility: boolean;
  rarityWeights: Record<UpgradeRarity, number>;
  parameters: Record<UpgradeEffectType, UpgradeParameterGenerationRule>;
}
