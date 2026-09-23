import type { DamageSource } from '../damageSources/types';
import type {
  AbilityDefinition,
  AbilityEffect,
  AbilityEffectType,
  AbilityTarget,
  AbilityTargetType,
  AbilityVisualEffect,
} from './types';

export interface AbilityValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

const ABILITY_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const COUNT_TARGETS = new Set<AbilityTargetType>(['nearest-enemies', 'random-enemies']);
const DEFAULT_AOE_HEIGHT_PERCENT = 50;
const DEFAULT_COLOR = '#64748b';
const DEFAULT_CRITICAL_MULTIPLIER = 1.5;
const VISUAL_EFFECTS = new Set<AbilityVisualEffect>(['none', 'fire', 'ice', 'lightning', 'heal']);

const EFFECT_TARGETS: Record<AbilityEffectType, AbilityTargetType[]> = {
  damage: ['nearest-enemies', 'random-enemies', 'area-enemies', 'all-enemies', 'castle'],
  'periodic-damage': ['nearest-enemies', 'random-enemies', 'area-enemies', 'all-enemies'],
  slow: ['nearest-enemies', 'random-enemies', 'area-enemies', 'all-enemies'],
  heal: ['castle'],
};

export function getAllowedTargets(effectType: AbilityEffectType): AbilityTargetType[] {
  return [...EFFECT_TARGETS[effectType]];
}

function defaultTarget(type: AbilityEffectType): AbilityTarget {
  if (type === 'heal') return { type: 'castle' };
  if (type === 'slow') return { type: 'all-enemies' };
  return { type: 'nearest-enemies', count: 1 };
}

function targetForType(type: AbilityTargetType, previous: AbilityTarget): AbilityTarget {
  if (COUNT_TARGETS.has(type)) {
    return { type, count: previous.count ?? 1 };
  }
  if (type === 'area-enemies') {
    return { type, areaHeightPercent: previous.areaHeightPercent ?? DEFAULT_AOE_HEIGHT_PERCENT };
  }
  return { type };
}

function normalizeTarget(target: AbilityTarget): AbilityTarget {
  if (COUNT_TARGETS.has(target.type)) {
    return { type: target.type, count: target.count ?? 1 };
  }
  if (target.type === 'area-enemies') {
    return {
      type: target.type,
      areaHeightPercent: target.areaHeightPercent ?? DEFAULT_AOE_HEIGHT_PERCENT,
    };
  }
  return { type: target.type };
}

function defaultEffect(
  type: AbilityEffectType,
  damageSources: DamageSource[],
  effectColor = DEFAULT_COLOR,
): AbilityEffect {
  if (type === 'damage') {
    return {
      type,
      amount: 0,
      damageSourceId: damageSources[0]?.id ?? '',
      criticalChancePercent: 0,
      criticalMultiplier: DEFAULT_CRITICAL_MULTIPLIER,
      target: defaultTarget(type),
    };
  }
  if (type === 'periodic-damage') {
    return {
      type,
      chancePercent: 100,
      amount: 0,
      duration: 1,
      criticalChancePercent: 0,
      criticalMultiplier: DEFAULT_CRITICAL_MULTIPLIER,
      visualColor: effectColor,
      target: defaultTarget(type),
    };
  }
  if (type === 'slow') {
    return {
      type,
      slowPercent: 0,
      duration: 0,
      target: defaultTarget(type),
    };
  }
  return { type, amount: 0, target: defaultTarget(type) };
}

export function createEmptyAbility(damageSources: DamageSource[]): AbilityDefinition {
  return {
    id: '',
    name: '',
    effects: [defaultEffect('damage', damageSources)],
    visualEffect: 'none',
    color: DEFAULT_COLOR,
  };
}

export function changeAbilityEffectTypes(
  ability: AbilityDefinition,
  effectTypes: AbilityEffectType[],
  damageSources: DamageSource[],
): AbilityDefinition {
  const uniqueTypes = [...new Set(effectTypes)];
  const effects = uniqueTypes.map((type) => (
    ability.effects.find((effect) => effect.type === type) ?? defaultEffect(type, damageSources, ability.color)
  ));

  return { ...ability, effects };
}

export function changeAbilityEffectTarget(
  ability: AbilityDefinition,
  effectType: AbilityEffectType,
  targetType: AbilityTargetType,
): AbilityDefinition {
  return {
    ...ability,
    effects: ability.effects.map((effect) => (
      effect.type === effectType
        ? { ...effect, target: targetForType(targetType, effect.target) }
        : effect
    )),
  };
}

function normalizeEffect(effect: AbilityEffect): AbilityEffect {
  if (effect.type === 'damage') {
    return {
      type: 'damage',
      amount: effect.amount ?? 0,
      damageSourceId: effect.damageSourceId?.trim() ?? '',
      criticalChancePercent: effect.criticalChancePercent ?? 0,
      criticalMultiplier: effect.criticalMultiplier ?? DEFAULT_CRITICAL_MULTIPLIER,
      target: normalizeTarget(effect.target),
    };
  }
  if (effect.type === 'periodic-damage') {
    return {
      type: 'periodic-damage',
      chancePercent: effect.chancePercent ?? 0,
      amount: effect.amount ?? 0,
      duration: effect.duration ?? 0,
      criticalChancePercent: effect.criticalChancePercent ?? 0,
      criticalMultiplier: effect.criticalMultiplier ?? DEFAULT_CRITICAL_MULTIPLIER,
      visualColor: effect.visualColor?.trim().toLowerCase() ?? '',
      target: normalizeTarget(effect.target),
    };
  }
  if (effect.type === 'slow') {
    return {
      type: 'slow',
      slowPercent: effect.slowPercent ?? 0,
      duration: effect.duration ?? 0,
      target: normalizeTarget(effect.target),
    };
  }
  return {
    type: 'heal',
    amount: effect.amount ?? 0,
    target: normalizeTarget(effect.target),
  };
}

export function normalizeAbility(ability: AbilityDefinition): AbilityDefinition {
  const effects: AbilityEffect[] = [];
  for (const effect of ability.effects) {
    if (!effects.some((item) => item.type === effect.type)) effects.push(normalizeEffect(effect));
  }

  return {
    id: ability.id.trim().toLowerCase(),
    name: ability.name.trim(),
    description: ability.description?.trim() || undefined,
    effects,
    visualEffect: ability.visualEffect,
    color: ability.color.trim().toLowerCase(),
    image: ability.image?.src
      ? { name: ability.image.name.trim(), src: ability.image.src }
      : undefined,
  };
}

function validateTarget(
  effectType: AbilityEffectType,
  target: AbilityTarget,
  errors: Record<string, string>,
) {
  const prefix = effectType;
  const allowedTargets = getAllowedTargets(effectType);

  if (!allowedTargets.includes(target.type)) {
    errors[`${prefix}Target`] = 'Этот тип цели недоступен для эффекта.';
    return;
  }

  if (COUNT_TARGETS.has(target.type)) {
    const count = target.count;
    if (!Number.isInteger(count) || (count ?? 0) < 1) {
      errors[`${prefix}TargetCount`] = 'Количество целей должно быть целым числом от 1.';
    }
  }

  if (target.type === 'area-enemies') {
    const heightPercent = target.areaHeightPercent;
    if (!Number.isFinite(heightPercent) || (heightPercent ?? 0) < 1 || (heightPercent ?? 101) > 100) {
      errors[`${prefix}AreaHeightPercent`] = 'Высота области должна быть от 1 до 100%.';
    }
  }
}

export function validateAbility(
  ability: AbilityDefinition,
  abilities: AbilityDefinition[],
  damageSources: DamageSource[],
  editingId?: string,
): AbilityValidationResult {
  const normalized = normalizeAbility(ability);
  const errors: Record<string, string> = {};

  if (!normalized.id) {
    errors.id = 'Укажите ID.';
  } else if (!ABILITY_ID_PATTERN.test(normalized.id)) {
    errors.id = 'ID может содержать только a-z, 0-9, _ и -.';
  } else if (abilities.some((item) => item.id === normalized.id && item.id !== editingId)) {
    errors.id = 'Способность с таким ID уже существует.';
  }

  if (!normalized.name) errors.name = 'Укажите название.';
  if (!HEX_COLOR_PATTERN.test(normalized.color)) errors.color = 'Укажите цвет в формате #RRGGBB.';
  if (!VISUAL_EFFECTS.has(normalized.visualEffect)) errors.visualEffect = 'Выберите визуальный эффект.';
  if (normalized.effects.length === 0) errors.effects = 'Выберите хотя бы один тип эффекта.';

  for (const effect of normalized.effects) {
    validateTarget(effect.type, effect.target, errors);

    if (effect.type === 'damage') {
      if (!Number.isFinite(effect.amount) || effect.amount < 0) {
        errors.damageAmount = 'Урон должен быть числом от 0.';
      }
      if (!damageSources.some((source) => source.id === effect.damageSourceId)) {
        errors.damageSourceId = 'Выберите существующий источник урона.';
      }
      if (!Number.isFinite(effect.criticalChancePercent) || effect.criticalChancePercent < 0 || effect.criticalChancePercent > 100) {
        errors.damageCriticalChancePercent = 'Шанс крит. урона должен быть от 0 до 100%.';
      }
      if (!Number.isFinite(effect.criticalMultiplier) || effect.criticalMultiplier < 1) {
        errors.damageCriticalMultiplier = 'Множитель крит. урона должен быть числом от 1.';
      }
    } else if (effect.type === 'periodic-damage') {
      if (!Number.isFinite(effect.chancePercent) || effect.chancePercent < 0 || effect.chancePercent > 100) {
        errors.periodicDamageChancePercent = 'Шанс должен быть от 0 до 100%.';
      }
      if (!Number.isFinite(effect.amount) || effect.amount < 0) {
        errors.periodicDamageAmount = 'Урон должен быть числом от 0.';
      }
      if (!Number.isFinite(effect.duration) || effect.duration <= 0) {
        errors.periodicDamageDuration = 'Длительность должна быть числом больше 0.';
      }
      if (!Number.isFinite(effect.criticalChancePercent) || effect.criticalChancePercent < 0 || effect.criticalChancePercent > 100) {
        errors.periodicDamageCriticalChancePercent = 'Шанс крит. урона должен быть от 0 до 100%.';
      }
      if (!Number.isFinite(effect.criticalMultiplier) || effect.criticalMultiplier < 1) {
        errors.periodicDamageCriticalMultiplier = 'Множитель крит. урона должен быть числом от 1.';
      }
      if (!HEX_COLOR_PATTERN.test(effect.visualColor)) {
        errors.periodicDamageVisualColor = 'Укажите цвет эффекта в формате #RRGGBB.';
      }
    } else if (effect.type === 'slow') {
      if (!Number.isFinite(effect.slowPercent) || effect.slowPercent < 0 || effect.slowPercent > 100) {
        errors.slowPercent = 'Замедление должно быть от 0 до 100%.';
      }
      if (!Number.isFinite(effect.duration) || effect.duration < 0) {
        errors.duration = 'Длительность должна быть числом от 0.';
      }
    } else if (!Number.isFinite(effect.amount) || effect.amount < 0) {
      errors.healAmount = 'Лечение должно быть числом от 0.';
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function saveAbility(
  abilities: AbilityDefinition[],
  ability: AbilityDefinition,
  editingId?: string,
): AbilityDefinition[] {
  const normalized = normalizeAbility(ability);
  if (!editingId) return [...abilities, normalized];
  return abilities.map((item) => (item.id === editingId ? normalized : item));
}

export function deleteAbility(abilities: AbilityDefinition[], id: string): AbilityDefinition[] {
  return abilities.filter((ability) => ability.id !== id);
}
