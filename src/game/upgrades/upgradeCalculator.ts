import type {
  AbilityDefinition,
  AbilityEffect,
  AbilityTarget,
  AbilityTargetType,
} from '../../editor/abilities/types';
import type { UpgradeCardDefinition, UpgradeEffect } from '../../editor/upgrades/types';

const DEFAULT_CRITICAL_MULTIPLIER = 1.5;
const DEFAULT_AOE_HEIGHT_PERCENT = 50;

export interface EffectRuntimeModifier {
  active: boolean;
  amountPercent: number;
  amountFlat: number;
  durationPercent: number;
  durationFlat: number;
  targetType?: AbilityTargetType;
  targetCountBonus: number;
  areaHeightPercentBonus: number;
  damageSourceId?: string;
  criticalChanceBonus: number;
  criticalMultiplierBonus: number;
  chancePercentBonus: number;
  slowPercentBonus: number;
  visualColor?: string;
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
    active: false,
    amountPercent: 0,
    amountFlat: 0,
    durationPercent: 0,
    durationFlat: 0,
    targetCountBonus: 0,
    areaHeightPercentBonus: 0,
    criticalChanceBonus: 0,
    criticalMultiplierBonus: 0,
    chancePercentBonus: 0,
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

function activate(modifier: EffectRuntimeModifier): EffectRuntimeModifier {
  modifier.active = true;
  return modifier;
}

function numericUpgradeValue(effect: UpgradeEffect, multiplier: number): number {
  return typeof effect.value === 'number' ? effect.value * multiplier : 0;
}

export function addUpgradeEffectToModifiers(
  modifiers: AbilityRuntimeModifiers,
  effect: UpgradeEffect,
  multiplier = 1,
): void {
  const ability = ensureAbilityModifier(modifiers, effect.abilityId);
  const value = numericUpgradeValue(effect, multiplier);

  switch (effect.type) {
    case 'ability-damage-percent':
      activate(ability.damage).amountPercent += value;
      break;
    case 'ability-damage-flat':
      activate(ability.damage).amountFlat += value;
      break;
    case 'ability-damage-target-type':
      if (typeof effect.value === 'string') activate(ability.damage).targetType = effect.value as AbilityTargetType;
      break;
    case 'ability-damage-target-count':
      activate(ability.damage).targetCountBonus += value;
      break;
    case 'ability-damage-area-height':
      activate(ability.damage).areaHeightPercentBonus += value;
      break;
    case 'ability-damage-source':
      if (typeof effect.value === 'string') activate(ability.damage).damageSourceId = effect.value;
      break;
    case 'ability-damage-critical-chance':
      activate(ability.damage).criticalChanceBonus += value;
      break;
    case 'ability-damage-critical-multiplier':
      activate(ability.damage).criticalMultiplierBonus += value;
      break;
    case 'ability-periodic-damage-percent':
      activate(ability.periodicDamage).amountPercent += value;
      break;
    case 'ability-periodic-damage-flat':
      activate(ability.periodicDamage).amountFlat += value;
      break;
    case 'ability-periodic-target-type':
      if (typeof effect.value === 'string') activate(ability.periodicDamage).targetType = effect.value as AbilityTargetType;
      break;
    case 'ability-periodic-target-count':
      activate(ability.periodicDamage).targetCountBonus += value;
      break;
    case 'ability-periodic-area-height':
      activate(ability.periodicDamage).areaHeightPercentBonus += value;
      break;
    case 'ability-periodic-chance':
      activate(ability.periodicDamage).chancePercentBonus += value;
      break;
    case 'ability-periodic-critical-chance':
      activate(ability.periodicDamage).criticalChanceBonus += value;
      break;
    case 'ability-periodic-critical-multiplier':
      activate(ability.periodicDamage).criticalMultiplierBonus += value;
      break;
    case 'ability-periodic-duration-percent':
      activate(ability.periodicDamage).durationPercent += value;
      break;
    case 'ability-periodic-duration-flat':
      activate(ability.periodicDamage).durationFlat += value;
      break;
    case 'ability-periodic-visual-color':
      if (typeof effect.value === 'string') activate(ability.periodicDamage).visualColor = effect.value;
      break;
    case 'ability-slow-percent':
      activate(ability.slow).slowPercentBonus += value;
      break;
    case 'ability-slow-target-type':
      if (typeof effect.value === 'string') activate(ability.slow).targetType = effect.value as AbilityTargetType;
      break;
    case 'ability-slow-target-count':
      activate(ability.slow).targetCountBonus += value;
      break;
    case 'ability-slow-area-height':
      activate(ability.slow).areaHeightPercentBonus += value;
      break;
    case 'ability-slow-duration-percent':
      activate(ability.slow).durationPercent += value;
      break;
    case 'ability-slow-duration-flat':
      activate(ability.slow).durationFlat += value;
      break;
    case 'ability-heal-percent':
      activate(ability.heal).amountPercent += value;
      break;
    case 'ability-heal-flat':
      activate(ability.heal).amountFlat += value;
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

function resolveTargetType(target: AbilityTarget, modifier: EffectRuntimeModifier): AbilityTargetType {
  if (modifier.targetType) return modifier.targetType;
  if (modifier.areaHeightPercentBonus > 0) return 'area-enemies';
  if (modifier.targetCountBonus > 0 && target.type !== 'nearest-enemies' && target.type !== 'random-enemies') {
    return 'nearest-enemies';
  }
  return target.type;
}

function applyTarget(target: AbilityTarget, modifier: EffectRuntimeModifier): AbilityTarget {
  const type = resolveTargetType(target, modifier);

  if (type === 'nearest-enemies' || type === 'random-enemies') {
    const baseCount = target.type === type ? (target.count ?? 1) : 1;
    return {
      type,
      count: Math.max(1, Math.floor(baseCount + modifier.targetCountBonus)),
    };
  }

  if (type === 'area-enemies') {
    const baseHeight = target.type === 'area-enemies'
      ? (target.areaHeightPercent ?? DEFAULT_AOE_HEIGHT_PERCENT)
      : DEFAULT_AOE_HEIGHT_PERCENT;
    return {
      type,
      areaHeightPercent: Math.min(100, Math.max(1, baseHeight + modifier.areaHeightPercentBonus)),
    };
  }

  return { type };
}

function createMissingTarget(
  defaultTarget: AbilityTarget,
  modifier: EffectRuntimeModifier,
): AbilityTarget {
  return applyTarget(defaultTarget, modifier);
}

function createMissingEffect(
  ability: AbilityDefinition,
  type: AbilityEffect['type'],
  modifier: EffectRuntimeModifier,
): AbilityEffect {
  if (type === 'damage') {
    return {
      type,
      amount: applyAmount(0, modifier),
      damageSourceId: modifier.damageSourceId ?? ability.id,
      criticalChancePercent: Math.min(100, Math.max(0, modifier.criticalChanceBonus)),
      criticalMultiplier: Math.max(1, DEFAULT_CRITICAL_MULTIPLIER + modifier.criticalMultiplierBonus),
      target: createMissingTarget({ type: 'nearest-enemies', count: 1 }, modifier),
    };
  }

  if (type === 'periodic-damage') {
    const baseDuration = modifier.durationFlat > 0 ? 0 : 1;
    return {
      type,
      chancePercent: modifier.chancePercentBonus > 0
        ? Math.min(100, modifier.chancePercentBonus)
        : 100,
      amount: applyAmount(0, modifier),
      duration: applyDuration(baseDuration, modifier),
      criticalChancePercent: Math.min(100, Math.max(0, modifier.criticalChanceBonus)),
      criticalMultiplier: Math.max(1, DEFAULT_CRITICAL_MULTIPLIER + modifier.criticalMultiplierBonus),
      visualColor: modifier.visualColor ?? ability.color,
      target: createMissingTarget({ type: 'nearest-enemies', count: 1 }, modifier),
    };
  }

  if (type === 'slow') {
    const baseDuration = modifier.durationFlat > 0 ? 0 : 1;
    return {
      type,
      slowPercent: Math.min(100, Math.max(0, modifier.slowPercentBonus)),
      duration: applyDuration(baseDuration, modifier),
      target: createMissingTarget({ type: 'all-enemies' }, modifier),
    };
  }

  return {
    type: 'heal',
    amount: applyAmount(0, modifier),
    target: { type: 'castle' },
  };
}

export function applyAbilityRuntimeModifier(
  ability: AbilityDefinition,
  modifier?: AbilityRuntimeModifier,
): AbilityDefinition {
  if (!modifier) return ability;

  const seen = new Set<AbilityEffect['type']>();
  const effects = ability.effects.map((effect) => {
    seen.add(effect.type);

    if (effect.type === 'damage') {
      return {
        ...effect,
        amount: applyAmount(effect.amount, modifier.damage),
        damageSourceId: modifier.damage.damageSourceId ?? effect.damageSourceId,
        criticalChancePercent: Math.min(100, Math.max(0, effect.criticalChancePercent + modifier.damage.criticalChanceBonus)),
        criticalMultiplier: Math.max(1, effect.criticalMultiplier + modifier.damage.criticalMultiplierBonus),
        target: applyTarget(effect.target, modifier.damage),
      };
    }

    if (effect.type === 'periodic-damage') {
      return {
        ...effect,
        chancePercent: Math.min(100, Math.max(0, effect.chancePercent + modifier.periodicDamage.chancePercentBonus)),
        amount: applyAmount(effect.amount, modifier.periodicDamage),
        duration: applyDuration(effect.duration, modifier.periodicDamage),
        criticalChancePercent: Math.min(100, Math.max(0, effect.criticalChancePercent + modifier.periodicDamage.criticalChanceBonus)),
        criticalMultiplier: Math.max(1, effect.criticalMultiplier + modifier.periodicDamage.criticalMultiplierBonus),
        visualColor: modifier.periodicDamage.visualColor ?? effect.visualColor,
        target: applyTarget(effect.target, modifier.periodicDamage),
      };
    }

    if (effect.type === 'slow') {
      return {
        ...effect,
        slowPercent: Math.min(100, Math.max(0, effect.slowPercent + modifier.slow.slowPercentBonus)),
        duration: applyDuration(effect.duration, modifier.slow),
        target: applyTarget(effect.target, modifier.slow),
      };
    }

    return {
      ...effect,
      amount: applyAmount(effect.amount, modifier.heal),
      target: { ...effect.target },
    };
  });

  if (modifier.damage.active && !seen.has('damage')) {
    effects.push(createMissingEffect(ability, 'damage', modifier.damage));
  }
  if (modifier.periodicDamage.active && !seen.has('periodic-damage')) {
    effects.push(createMissingEffect(ability, 'periodic-damage', modifier.periodicDamage));
  }
  if (modifier.slow.active && !seen.has('slow')) {
    effects.push(createMissingEffect(ability, 'slow', modifier.slow));
  }
  if (modifier.heal.active && !seen.has('heal')) {
    effects.push(createMissingEffect(ability, 'heal', modifier.heal));
  }

  return { ...ability, effects };
}
