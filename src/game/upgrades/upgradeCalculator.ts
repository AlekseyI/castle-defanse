import type {
  AbilityDefinition,
  AbilityEffect,
  AbilityEffectType,
  AbilityTarget,
  AbilityTargetType,
} from '../../editor/abilities/types';
import type { UpgradeCardDefinition, UpgradeEffect, UpgradeTargetValue } from '../../editor/upgrades/types';

const DEFAULT_AOE_HEIGHT_PERCENT = 50;

export interface EffectRuntimeModifier {
  active: boolean;
  amountPercent: number;
  amountFlat: number;
  durationPercent: number;
  durationFlat: number;
  targetOverride?: AbilityTarget;
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
  addedEffects: AbilityEffect[];
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
    addedEffects: [],
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

function upgradeTargetToAbilityTarget(target: UpgradeTargetValue): AbilityTarget {
  if (target.type === 'nearest-enemies' || target.type === 'random-enemies') {
    return { type: target.type, count: target.count };
  }
  if (target.type === 'area-enemies') {
    return { type: target.type, areaHeightPercent: target.areaHeightPercent };
  }
  return { type: target.type };
}

function addedTargetToAbilityTarget(target: UpgradeTargetValue): AbilityTarget {
  return upgradeTargetToAbilityTarget(target);
}

function createAddedAbilityEffect(effect: UpgradeEffect): AbilityEffect | undefined {
  if (effect.type === 'ability-add-damage') {
    return {
      type: 'damage',
      amount: effect.value.amount,
      damageSourceId: effect.value.damageSourceId,
      criticalChancePercent: effect.value.criticalChancePercent,
      criticalMultiplier: effect.value.criticalMultiplier,
      target: addedTargetToAbilityTarget(effect.value.target),
    };
  }
  if (effect.type === 'ability-add-periodic-damage') {
    return {
      type: 'periodic-damage',
      chancePercent: effect.value.chancePercent,
      amount: effect.value.amount,
      duration: effect.value.duration,
      criticalChancePercent: effect.value.criticalChancePercent,
      criticalMultiplier: effect.value.criticalMultiplier,
      visualColor: effect.value.visualColor,
      target: addedTargetToAbilityTarget(effect.value.target),
    };
  }
  if (effect.type === 'ability-add-slow') {
    return {
      type: 'slow',
      slowPercent: effect.value.slowPercent,
      duration: effect.value.duration,
      target: addedTargetToAbilityTarget(effect.value.target),
    };
  }
  if (effect.type === 'ability-add-heal') {
    return {
      type: 'heal',
      amount: effect.value.amount,
      target: addedTargetToAbilityTarget(effect.value.target),
    };
  }
  return undefined;
}

function numericUpgradeValue(effect: UpgradeEffect, multiplier: number): number {
  return typeof effect.value === 'number' ? effect.value * multiplier : 0;
}

function assignTargetOverride(modifier: EffectRuntimeModifier, value: UpgradeTargetValue): void {
  modifier.targetOverride = upgradeTargetToAbilityTarget(value);
}

export function addUpgradeEffectToModifiers(
  modifiers: AbilityRuntimeModifiers,
  effect: UpgradeEffect,
  multiplier = 1,
): void {
  const ability = ensureAbilityModifier(modifiers, effect.abilityId);
  const addedEffect = createAddedAbilityEffect(effect);
  if (addedEffect) {
    const copies = Math.max(0, Math.floor(multiplier));
    for (let index = 0; index < copies; index += 1) {
      ability.addedEffects.push({
        ...addedEffect,
        target: { ...addedEffect.target },
      } as AbilityEffect);
    }
    return;
  }

  const value = numericUpgradeValue(effect, multiplier);

  switch (effect.type) {
    case 'ability-damage-percent':
      activate(ability.damage).amountPercent += value;
      break;
    case 'ability-damage-flat':
      activate(ability.damage).amountFlat += value;
      break;
    case 'ability-damage-target-type':
      assignTargetOverride(activate(ability.damage), effect.value);
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
      assignTargetOverride(activate(ability.periodicDamage), effect.value);
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
      assignTargetOverride(activate(ability.slow), effect.value);
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

function applyCriticalMultiplier(base: number, bonus: number): number {
  if (base === 0 && bonus === 0) return 0;
  return Math.max(1, base + bonus);
}

function resolveTargetType(target: AbilityTarget, modifier: EffectRuntimeModifier): AbilityTargetType {
  if (modifier.targetOverride) return modifier.targetOverride.type;
  if (modifier.areaHeightPercentBonus > 0) return 'area-enemies';
  if (modifier.targetCountBonus > 0 && target.type !== 'nearest-enemies' && target.type !== 'random-enemies') {
    return 'nearest-enemies';
  }
  return target.type;
}

function applyTarget(target: AbilityTarget, modifier: EffectRuntimeModifier): AbilityTarget {
  const configuredTarget = modifier.targetOverride ?? target;
  const type = resolveTargetType(configuredTarget, modifier);

  if (type === 'nearest-enemies' || type === 'random-enemies') {
    const baseCount = configuredTarget.type === type ? (configuredTarget.count ?? 1) : 1;
    return {
      type,
      count: Math.max(0, Math.floor(baseCount + modifier.targetCountBonus)),
    };
  }

  if (type === 'area-enemies') {
    const baseHeight = configuredTarget.type === 'area-enemies'
      ? (configuredTarget.areaHeightPercent ?? DEFAULT_AOE_HEIGHT_PERCENT)
      : DEFAULT_AOE_HEIGHT_PERCENT;
    return {
      type,
      areaHeightPercent: Math.min(100, Math.max(0, baseHeight + modifier.areaHeightPercentBonus)),
    };
  }

  return { type };
}

function createRuntimeEffectScaffold(
  type: AbilityEffectType,
  ability: AbilityDefinition,
  modifier: EffectRuntimeModifier,
): AbilityEffect {
  const defaultEnemyTarget: AbilityTarget = type === 'slow'
    ? { type: 'all-enemies' }
    : { type: 'nearest-enemies', count: 1 };
  const target = modifier.targetOverride ? { ...modifier.targetOverride } : defaultEnemyTarget;

  if (type === 'damage') {
    return {
      type,
      amount: 0,
      damageSourceId: '',
      criticalChancePercent: 0,
      criticalMultiplier: 0,
      target,
    };
  }

  if (type === 'periodic-damage') {
    return {
      type,
      chancePercent: 0,
      amount: 0,
      duration: 0,
      criticalChancePercent: 0,
      criticalMultiplier: 0,
      visualColor: ability.color,
      target,
    };
  }

  if (type === 'slow') {
    return {
      type,
      slowPercent: 0,
      duration: 0,
      target,
    };
  }

  return {
    type: 'heal',
    amount: 0,
    target: { type: 'castle' },
  };
}

function appendMissingModifiedEffects(
  effects: AbilityEffect[],
  ability: AbilityDefinition,
  modifier: AbilityRuntimeModifier,
): AbilityEffect[] {
  const next = [...effects];
  const entries: Array<[AbilityEffectType, EffectRuntimeModifier]> = [
    ['damage', modifier.damage],
    ['periodic-damage', modifier.periodicDamage],
    ['slow', modifier.slow],
    ['heal', modifier.heal],
  ];

  for (const [type, effectModifier] of entries) {
    if (effectModifier.active && !next.some((effect) => effect.type === type)) {
      next.push(createRuntimeEffectScaffold(type, ability, effectModifier));
    }
  }

  return next;
}

export function applyAbilityRuntimeModifier(
  ability: AbilityDefinition,
  modifier?: AbilityRuntimeModifier,
): AbilityDefinition {
  if (!modifier) return ability;

  const sourceEffects = appendMissingModifiedEffects([
    ...ability.effects,
    ...modifier.addedEffects.map((effect) => ({ ...effect, target: { ...effect.target } } as AbilityEffect)),
  ], ability, modifier);

  const effects = sourceEffects.map((effect) => {
    if (effect.type === 'damage') {
      return {
        ...effect,
        amount: applyAmount(effect.amount, modifier.damage),
        damageSourceId: modifier.damage.damageSourceId ?? effect.damageSourceId,
        criticalChancePercent: Math.min(100, Math.max(0, effect.criticalChancePercent + modifier.damage.criticalChanceBonus)),
        criticalMultiplier: applyCriticalMultiplier(effect.criticalMultiplier, modifier.damage.criticalMultiplierBonus),
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
        criticalMultiplier: applyCriticalMultiplier(effect.criticalMultiplier, modifier.periodicDamage.criticalMultiplierBonus),
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

  return { ...ability, effects };
}
