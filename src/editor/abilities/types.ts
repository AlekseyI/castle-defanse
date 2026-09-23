export type AbilityEffectType = 'damage' | 'periodic-damage' | 'slow' | 'heal';

export type AbilityVisualEffect = 'none' | 'fire' | 'ice' | 'lightning' | 'heal';

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
  criticalChancePercent: number;
  criticalMultiplier: number;
  target: AbilityTarget;
}

export interface PeriodicDamageAbilityEffect {
  type: 'periodic-damage';
  chancePercent: number;
  amount: number;
  duration: number;
  criticalChancePercent: number;
  criticalMultiplier: number;
  visualColor: string;
  target: AbilityTarget;
}

export interface SlowAbilityEffect {
  type: 'slow';
  slowPercent: number;
  duration: number;
  target: AbilityTarget;
}

export interface HealAbilityEffect {
  type: 'heal';
  amount: number;
  target: AbilityTarget;
}

export type AbilityEffect = DamageAbilityEffect | PeriodicDamageAbilityEffect | SlowAbilityEffect | HealAbilityEffect;

export interface AbilityImage {
  name: string;
  src: string;
}

export interface AbilityDefinition {
  id: string;
  name: string;
  description?: string;
  effects: AbilityEffect[];
  visualEffect: AbilityVisualEffect;
  color: string;
  image?: AbilityImage;
}
