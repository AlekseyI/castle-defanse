export type AbilityEffectType = 'damage' | 'slow' | 'heal';

export type AbilityTargetType = 'nearest-enemies' | 'random-enemies' | 'area-enemies' | 'all-enemies' | 'castle';

export interface AbilityTarget {
  type: AbilityTargetType;
  count?: number;
  areaHeightPercent?: number;
}

export interface DamageAbilityEffect {
  type: 'damage';
  amount: number;
  damageSourceId: string;
}

export interface SlowAbilityEffect {
  type: 'slow';
  slowPercent: number;
  duration: number;
}

export interface HealAbilityEffect {
  type: 'heal';
  amount: number;
}

export type AbilityEffect = DamageAbilityEffect | SlowAbilityEffect | HealAbilityEffect;

export interface AbilityImage {
  name: string;
  src: string;
}

export interface AbilityDefinition {
  id: string;
  name: string;
  description?: string;
  effects: AbilityEffect[];
  color: string;
  image?: AbilityImage;
  target: AbilityTarget;
}
