export interface UnitImage {
  name: string;
  src: string;
}

export type DamageProtection = Record<string, number>;

export const UNIT_TRAITS = [
  'boss',
  'healthy',
  'armored',
  'strong',
  'fast',
  'generous',
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
  coinsOnDeath: number;
  traits: UnitTrait[];
  traitMultipliers?: UnitTraitMultipliers;
  damageProtection?: DamageProtection;
  image?: UnitImage;
  /** Stable internal reference used by game waves. It is not editable in the unit editor. */
  gameKey?: string;
}
