export interface UnitImage {
  name: string;
  src: string;
}

export type DamageProtection = Record<string, number>;

export interface UnitDefinition {
  id: string;
  name: string;
  hp: number;
  speed: number;
  damage: number;
  coinsOnDeath: number;
  isBoss: boolean;
  grantsUpgradeOnKill: boolean;
  damageProtection?: DamageProtection;
  image?: UnitImage;
  /** Stable internal reference used by game waves. It is not editable in the unit editor. */
  gameKey?: string;
}
