import type { AbilityDefinition, AbilityTarget } from '../../editor/abilities/types';
import type { UpgradeCardDefinition, UpgradeEffect } from '../../editor/upgrades/types';

export interface EffectRuntimeModifier {
  amountPercent: number;
  amountFlat: number;
  durationPercent: number;
  durationFlat: number;
  targetCountBonus: number;
  criticalChanceBonus: number;
  slowPercentBonus: number;
}

export interface AbilityRuntimeModifier {
  damage: EffectRuntimeModifier;
  periodicDamage: EffectRuntimeModifier;
  slow: EffectRuntimeModifier;
  heal: EffectRuntimeModifier;
}

export type AbilityRuntimeModifiers = Record<string, AbilityRuntimeModifier>;

function emptyEffectModifier(): EffectRuntimeModifier {
  return {
    amountPercent: 0,
    amountFlat: 0,
    durationPercent: 0,
    durationFlat: 0,
    targetCountBonus: 0,
    criticalChanceBonus: 0,
    slowPercentBonus: 0,
  };
}

export function createEmptyAbilityRuntimeModifier(): AbilityRuntimeModifier {
  return {
    damage: emptyEffectModifier(),
    periodicDamage: emptyEffectModifier(),
    slow: emptyEffectModifier(),
    heal: emptyEffectModifier(),
  };
}

function ensureAbilityModifier(
  modifiers: AbilityRuntimeModifiers,
  abilityId: string,
): AbilityRuntimeModifier {
  if (!modifiers[abilityId]) modifiers[abilityId] = createEmptyAbilityRuntimeModifier();
  return modifiers[abilityId];
}

export function addUpgradeEffectToModifiers(
  modifiers: AbilityRuntimeModifiers,
  effect: UpgradeEffect,
  multiplier = 1,
): void {
  const ability = ensureAbilityModifier(modifiers, effect.abilityId);
  const value = effect.value * multiplier;

  switch (effect.type) {
    case 'ability-damage-percent':
      ability.damage.amountPercent += value;
      break;
    case 'ability-damage-flat':
      ability.damage.amountFlat += value;
      break;
    case 'ability-damage-target-count':
      ability.damage.targetCountBonus += value;
      break;
    case 'ability-damage-critical-chance':
      ability.damage.criticalChanceBonus += value;
      break;
    case 'ability-periodic-damage-percent':
      ability.periodicDamage.amountPercent += value;
      break;
    case 'ability-periodic-damage-flat':
      ability.periodicDamage.amountFlat += value;
      break;
    case 'ability-periodic-target-count':
      ability.periodicDamage.targetCountBonus += value;
      break;
    case 'ability-periodic-critical-chance':
      ability.periodicDamage.criticalChanceBonus += value;
      break;
    case 'ability-periodic-duration-percent':
      ability.periodicDamage.durationPercent += value;
      break;
    case 'ability-periodic-duration-flat':
      ability.periodicDamage.durationFlat += value;
      break;
    case 'ability-slow-percent':
      ability.slow.slowPercentBonus += value;
      break;
    case 'ability-slow-target-count':
      ability.slow.targetCountBonus += value;
      break;
    case 'ability-slow-duration-percent':
      ability.slow.durationPercent += value;
      break;
    case 'ability-slow-duration-flat':
      ability.slow.durationFlat += value;
      break;
    case 'ability-heal-percent':
      ability.heal.amountPercent += value;
      break;
    case 'ability-heal-flat':
      ability.heal.amountFlat += value;
      break;
  }
}

export function buildAbilityRuntimeModifiers(
  cards: UpgradeCardDefinition[],
  counts: Record<string, number>,
): AbilityRuntimeModifiers {
  const modifiers: AbilityRuntimeModifiers = {};

  for (const card of cards) {
    const count = counts[card.id] ?? 0;
    if (count <= 0) continue;
    for (const effect of card.effects) addUpgradeEffectToModifiers(modifiers, effect, count);
  }

  return modifiers;
}

function applyAmount(base: number, modifier: EffectRuntimeModifier): number {
  return Math.max(0, base * (1 + modifier.amountPercent / 100) + modifier.amountFlat);
}

function applyDuration(base: number, modifier: EffectRuntimeModifier): number {
  return Math.max(0, base * (1 + modifier.durationPercent / 100) + modifier.durationFlat);
}

function applyTargetCount(target: AbilityTarget, bonus: number): AbilityTarget {
  if (target.type !== 'nearest-enemies' && target.type !== 'random-enemies') return { ...target };
  return {
    ...target,
    count: Math.max(1, Math.floor((target.count ?? 1) + bonus)),
  };
}

export function applyAbilityRuntimeModifier(
  ability: AbilityDefinition,
  modifier?: AbilityRuntimeModifier,
): AbilityDefinition {
  if (!modifier) return ability;

  return {
    ...ability,
    effects: ability.effects.map((effect) => {
      if (effect.type === 'damage') {
        return {
          ...effect,
          amount: applyAmount(effect.amount, modifier.damage),
          criticalChancePercent: Math.min(100, Math.max(0, effect.criticalChancePercent + modifier.damage.criticalChanceBonus)),
          target: applyTargetCount(effect.target, modifier.damage.targetCountBonus),
        };
      }

      if (effect.type === 'periodic-damage') {
        return {
          ...effect,
          amount: applyAmount(effect.amount, modifier.periodicDamage),
          duration: applyDuration(effect.duration, modifier.periodicDamage),
          criticalChancePercent: Math.min(100, Math.max(0, effect.criticalChancePercent + modifier.periodicDamage.criticalChanceBonus)),
          target: applyTargetCount(effect.target, modifier.periodicDamage.targetCountBonus),
        };
      }

      if (effect.type === 'slow') {
        return {
          ...effect,
          slowPercent: Math.min(100, Math.max(0, effect.slowPercent + modifier.slow.slowPercentBonus)),
          duration: applyDuration(effect.duration, modifier.slow),
          target: applyTargetCount(effect.target, modifier.slow.targetCountBonus),
        };
      }

      return {
        ...effect,
        amount: applyAmount(effect.amount, modifier.heal),
        target: { ...effect.target },
      };
    }),
  };
}
