export interface UnitImage {
  name: string;
  src: string;
}

export const UNIT_ANIMATION_TYPES = ['move', 'attack', 'death'] as const;
export type UnitAnimationType = (typeof UNIT_ANIMATION_TYPES)[number];

export interface UnitAnimationFrame {
  id: string;
  name: string;
  src: string;
}

export type UnitAnimations = Record<UnitAnimationType, UnitAnimationFrame[]>;

export type DamageProtection = Record<string, number>;

export const UNIT_TRAITS = [
  'boss',
  'healthy',
  'armored',
  'strong',
  'fast',
  'generous',
  'ranged',
] as const;

export type UnitTrait = (typeof UNIT_TRAITS)[number];

export interface UnitTraitMultipliers {
  hp?: number;
  protection?: number;
  damage?: number;
  speed?: number;
  coins?: number;
}

export interface UnitDefinition {
  id: string;
  name: string;
  hp: number;
  speed: number;
  damage: number;
  damageSourceId: string;
  coinsOnDeath: number;
  attackStartPathPercent?: number;
  traits: UnitTrait[];
  traitMultipliers?: UnitTraitMultipliers;
  damageProtection?: DamageProtection;
  /** Image used only by editor UI/list previews. */
  image?: UnitImage;
  animationSpeed: number;
  animations: UnitAnimations;
  /** Stable internal reference used by game waves. It is not editable in the unit editor. */
  gameKey?: string;
}
