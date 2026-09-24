export type UpgradeRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type UpgradeEffectType =
  | 'ability-damage-percent'
  | 'ability-damage-flat'
  | 'ability-damage-target-count'
  | 'ability-damage-critical-chance'
  | 'ability-periodic-damage-percent'
  | 'ability-periodic-damage-flat'
  | 'ability-periodic-target-count'
  | 'ability-periodic-critical-chance'
  | 'ability-periodic-duration-percent'
  | 'ability-periodic-duration-flat'
  | 'ability-slow-percent'
  | 'ability-slow-target-count'
  | 'ability-slow-duration-percent'
  | 'ability-slow-duration-flat'
  | 'ability-heal-percent'
  | 'ability-heal-flat';

export interface UpgradeEffect {
  type: UpgradeEffectType;
  abilityId: string;
  value: number;
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
