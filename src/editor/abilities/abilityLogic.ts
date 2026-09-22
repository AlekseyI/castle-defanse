import type { DamageSource } from '../damageSources/types';
import type {
  AbilityDefinition,
  AbilityEffect,
  AbilityEffectType,
  AbilityTarget,
  AbilityTargetType,
} from './types';

export interface AbilityValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

const ABILITY_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const COUNT_TARGETS = new Set<AbilityTargetType>(['nearest-enemies', 'random-enemies']);
const ALL_TARGETS: AbilityTargetType[] = ['nearest-enemies', 'random-enemies', 'area-enemies', 'all-enemies', 'castle'];
const DEFAULT_AOE_HEIGHT_PERCENT = 50;
const DEFAULT_COLOR = '#64748b';

const EFFECT_TARGETS: Record<AbilityEffectType, AbilityTargetType[]> = {
  damage: ['nearest-enemies', 'random-enemies', 'area-enemies', 'all-enemies', 'castle'],
  slow: ['nearest-enemies', 'random-enemies', 'area-enemies', 'all-enemies'],
  heal: ['castle'],
};

export function getAllowedTargets(effectTypes: AbilityEffectType[]): AbilityTargetType[] {
  const uniqueTypes = [...new Set(effectTypes)];
  if (uniqueTypes.length === 0) return ALL_TARGETS;

  return ALL_TARGETS.filter((target) => uniqueTypes.every((type) => EFFECT_TARGETS[type].includes(target)));
}

function defaultEffect(type: AbilityEffectType, damageSources: DamageSource[]): AbilityEffect {
  if (type === 'damage') {
    return { type, amount: 0, damageSourceId: damageSources[0]?.id ?? '' };
  }
  if (type === 'slow') {
    return { type, slowPercent: 0, duration: 0 };
  }
  return { type, amount: 0 };
}

function defaultTarget(effectTypes: AbilityEffectType[]): AbilityTarget {
  const allowedTargets = getAllowedTargets(effectTypes);
  if (allowedTargets.includes('castle') && effectTypes.includes('heal')) return { type: 'castle' };
  if (allowedTargets.includes('all-enemies') && effectTypes.includes('slow')) return { type: 'all-enemies' };
  if (allowedTargets.includes('nearest-enemies')) return { type: 'nearest-enemies', count: 1 };
  if (allowedTargets.includes('area-enemies')) return { type: 'area-enemies', areaHeightPercent: DEFAULT_AOE_HEIGHT_PERCENT };
  return { type: allowedTargets[0] ?? 'nearest-enemies' };
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

export function createEmptyAbility(damageSources: DamageSource[]): AbilityDefinition {
  const effects: AbilityEffect[] = [defaultEffect('damage', damageSources)];
  return {
    id: '',
    name: '',
    effects,
    color: DEFAULT_COLOR,
    target: defaultTarget(effects.map((effect) => effect.type)),
  };
}

export function changeAbilityEffectTypes(
  ability: AbilityDefinition,
  effectTypes: AbilityEffectType[],
  damageSources: DamageSource[],
): AbilityDefinition {
  const uniqueTypes = [...new Set(effectTypes)];
  const effects = uniqueTypes.map((type) => (
    ability.effects.find((effect) => effect.type === type) ?? defaultEffect(type, damageSources)
  ));
  const allowedTargets = getAllowedTargets(uniqueTypes);
  const target = allowedTargets.includes(ability.target.type)
    ? { ...ability.target }
    : defaultTarget(uniqueTypes);

  return { ...ability, effects, target };
}

export function changeAbilityTarget(ability: AbilityDefinition, type: AbilityTargetType): AbilityDefinition {
  return {
    ...ability,
    target: targetForType(type, ability.target),
  };
}

function normalizeEffect(effect: AbilityEffect): AbilityEffect {
  if (effect.type === 'damage') {
    return {
      type: 'damage',
      amount: effect.amount ?? 0,
      damageSourceId: effect.damageSourceId?.trim() ?? '',
    };
  }
  if (effect.type === 'slow') {
    return {
      type: 'slow',
      slowPercent: effect.slowPercent ?? 0,
      duration: effect.duration ?? 0,
    };
  }
  return { type: 'heal', amount: effect.amount ?? 0 };
}

export function normalizeAbility(ability: AbilityDefinition): AbilityDefinition {
  const effects: AbilityEffect[] = [];
  for (const effect of ability.effects) {
    if (!effects.some((item) => item.type === effect.type)) effects.push(normalizeEffect(effect));
  }

  let target: AbilityTarget = { type: ability.target.type };
  if (COUNT_TARGETS.has(ability.target.type)) {
    target = { type: ability.target.type, count: ability.target.count ?? 1 };
  } else if (ability.target.type === 'area-enemies') {
    target = {
      type: ability.target.type,
      areaHeightPercent: ability.target.areaHeightPercent ?? DEFAULT_AOE_HEIGHT_PERCENT,
    };
  }

  return {
    id: ability.id.trim().toLowerCase(),
    name: ability.name.trim(),
    description: ability.description?.trim() || undefined,
    effects,
    color: ability.color.trim().toLowerCase(),
    image: ability.image?.src
      ? { name: ability.image.name.trim(), src: ability.image.src }
      : undefined,
    target,
  };
}

export function validateAbility(
  ability: AbilityDefinition,
  abilities: AbilityDefinition[],
  damageSources: DamageSource[],
  editingId?: string,
): AbilityValidationResult {
  const normalized = normalizeAbility(ability);
  const errors: Record<string, string> = {};
  const effectTypes = normalized.effects.map((effect) => effect.type);
  const allowedTargets = getAllowedTargets(effectTypes);

  if (!normalized.id) {
    errors.id = 'Укажите ID.';
  } else if (!ABILITY_ID_PATTERN.test(normalized.id)) {
    errors.id = 'ID может содержать только a-z, 0-9, _ и -.';
  } else if (abilities.some((item) => item.id === normalized.id && item.id !== editingId)) {
    errors.id = 'Способность с таким ID уже существует.';
  }

  if (!normalized.name) errors.name = 'Укажите название.';
  if (!HEX_COLOR_PATTERN.test(normalized.color)) errors.color = 'Укажите цвет в формате #RRGGBB.';

  if (normalized.effects.length === 0) {
    errors.effects = 'Выберите хотя бы один тип эффекта.';
  } else if (allowedTargets.length === 0) {
    errors.effects = 'У выбранных эффектов нет общей доступной цели.';
  }

  if (normalized.effects.length > 0 && !allowedTargets.includes(normalized.target.type)) {
    errors.target = 'Этот тип цели недоступен для выбранных эффектов.';
  }

  if (COUNT_TARGETS.has(normalized.target.type)) {
    const count = normalized.target.count;
    if (!Number.isInteger(count) || (count ?? 0) < 1) {
      errors.targetCount = 'Количество целей должно быть целым числом от 1.';
    }
  }

  if (normalized.target.type === 'area-enemies') {
    const heightPercent = normalized.target.areaHeightPercent;
    if (!Number.isFinite(heightPercent) || (heightPercent ?? 0) < 1 || (heightPercent ?? 101) > 100) {
      errors.areaHeightPercent = 'Высота области должна быть от 1 до 100%.';
    }
  }

  for (const effect of normalized.effects) {
    if (effect.type === 'damage') {
      if (!Number.isFinite(effect.amount) || effect.amount < 0) {
        errors.damageAmount = 'Урон должен быть числом от 0.';
      }
      if (!damageSources.some((source) => source.id === effect.damageSourceId)) {
        errors.damageSourceId = 'Выберите существующий источник урона.';
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
