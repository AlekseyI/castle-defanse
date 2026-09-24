export type UpgradeRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type UpgradeEffectType =
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

export type UpgradeEffectValue = number | string;

export interface UpgradeEffect {
  type: UpgradeEffectType;
  abilityId: string;
  value: UpgradeEffectValue;
}

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
  maxCount: number;
  effects: UpgradeEffect[];
  color?: string;
  image?: UpgradeCardImage;
}
