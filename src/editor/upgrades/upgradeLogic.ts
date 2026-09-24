import { getAllowedTargets } from '../abilities/abilityLogic';
import type { AbilityDefinition, AbilityEffectType, AbilityTargetType } from '../abilities/types';
import type { DamageSource } from '../damageSources/types';
import type {
  UpgradeCardDefinition,
  UpgradeEffect,
  UpgradeEffectType,
  UpgradeEffectValue,
  UpgradeRarity,
} from './types';

export interface UpgradeValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export type UpgradeEffectValueKind = 'number' | 'target-type' | 'damage-source' | 'color';

export interface UpgradeEffectOption {
  type: UpgradeEffectType;
  label: string;
  abilityEffectType: AbilityEffectType;
  valueKind: UpgradeEffectValueKind;
}

const UPGRADE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const RARITIES = new Set<UpgradeRarity>(['common', 'rare', 'epic', 'legendary']);

export const UPGRADE_EFFECT_OPTIONS: UpgradeEffectOption[] = [
  { type: 'ability-damage-percent', label: 'Основной урон, %', abilityEffectType: 'damage', valueKind: 'number' },
  { type: 'ability-damage-flat', label: 'Основной урон, значение', abilityEffectType: 'damage', valueKind: 'number' },
  { type: 'ability-damage-target-type', label: 'Тип цели основного урона', abilityEffectType: 'damage', valueKind: 'target-type' },
  { type: 'ability-damage-target-count', label: 'Дополнительные цели основного урона', abilityEffectType: 'damage', valueKind: 'number' },
  { type: 'ability-damage-area-height', label: 'Высота области основного урона, процентные пункты', abilityEffectType: 'damage', valueKind: 'number' },
  { type: 'ability-damage-source', label: 'Источник основного урона', abilityEffectType: 'damage', valueKind: 'damage-source' },
  { type: 'ability-damage-critical-chance', label: 'Шанс крита основного урона, процентные пункты', abilityEffectType: 'damage', valueKind: 'number' },
  { type: 'ability-damage-critical-multiplier', label: 'Прирост множителя крита основного урона', abilityEffectType: 'damage', valueKind: 'number' },
  { type: 'ability-periodic-damage-percent', label: 'Периодический урон, %', abilityEffectType: 'periodic-damage', valueKind: 'number' },
  { type: 'ability-periodic-damage-flat', label: 'Периодический урон, значение', abilityEffectType: 'periodic-damage', valueKind: 'number' },
  { type: 'ability-periodic-target-type', label: 'Тип цели периодического урона', abilityEffectType: 'periodic-damage', valueKind: 'target-type' },
  { type: 'ability-periodic-target-count', label: 'Дополнительные цели периодического урона', abilityEffectType: 'periodic-damage', valueKind: 'number' },
  { type: 'ability-periodic-area-height', label: 'Высота области периодического урона, процентные пункты', abilityEffectType: 'periodic-damage', valueKind: 'number' },
  { type: 'ability-periodic-chance', label: 'Шанс периодического урона, процентные пункты', abilityEffectType: 'periodic-damage', valueKind: 'number' },
  { type: 'ability-periodic-critical-chance', label: 'Шанс крита периодического урона, процентные пункты', abilityEffectType: 'periodic-damage', valueKind: 'number' },
  { type: 'ability-periodic-critical-multiplier', label: 'Прирост множителя крита периодического урона', abilityEffectType: 'periodic-damage', valueKind: 'number' },
  { type: 'ability-periodic-duration-percent', label: 'Длительность периодического урона, %', abilityEffectType: 'periodic-damage', valueKind: 'number' },
  { type: 'ability-periodic-duration-flat', label: 'Длительность периодического урона, сек.', abilityEffectType: 'periodic-damage', valueKind: 'number' },
  { type: 'ability-periodic-visual-color', label: 'Цвет периодического эффекта', abilityEffectType: 'periodic-damage', valueKind: 'color' },
  { type: 'ability-slow-percent', label: 'Сила замедления, процентные пункты', abilityEffectType: 'slow', valueKind: 'number' },
  { type: 'ability-slow-target-type', label: 'Тип цели замедления', abilityEffectType: 'slow', valueKind: 'target-type' },
  { type: 'ability-slow-target-count', label: 'Дополнительные цели замедления', abilityEffectType: 'slow', valueKind: 'number' },
  { type: 'ability-slow-area-height', label: 'Высота области замедления, процентные пункты', abilityEffectType: 'slow', valueKind: 'number' },
  { type: 'ability-slow-duration-percent', label: 'Длительность замедления, %', abilityEffectType: 'slow', valueKind: 'number' },
  { type: 'ability-slow-duration-flat', label: 'Длительность замедления, сек.', abilityEffectType: 'slow', valueKind: 'number' },
  { type: 'ability-heal-percent', label: 'Лечение способности, %', abilityEffectType: 'heal', valueKind: 'number' },
  { type: 'ability-heal-flat', label: 'Лечение способности, значение', abilityEffectType: 'heal', valueKind: 'number' },
];

export function getUpgradeEffectOption(type: UpgradeEffectType): UpgradeEffectOption | undefined {
  return UPGRADE_EFFECT_OPTIONS.find((option) => option.type === type);
}

export function getCompatibleUpgradeEffectTypes(ability?: AbilityDefinition): UpgradeEffectType[] {
  if (!ability) return [];
  return UPGRADE_EFFECT_OPTIONS.map((option) => option.type);
}

export function isUpgradeEffectCompatible(effect: UpgradeEffect, ability?: AbilityDefinition): boolean {
  return Boolean(ability && getUpgradeEffectOption(effect.type));
}

function getAbilityEffect(ability: AbilityDefinition | undefined, type: AbilityEffectType) {
  return ability?.effects.find((effect) => effect.type === type);
}

export function getDefaultUpgradeEffectValue(
  type: UpgradeEffectType,
  ability?: AbilityDefinition,
): UpgradeEffectValue {
  const option = getUpgradeEffectOption(type);
  if (!option) return 10;

  const abilityEffect = getAbilityEffect(ability, option.abilityEffectType);

  if (option.valueKind === 'target-type') {
    if (abilityEffect) return abilityEffect.target.type;
    if (option.abilityEffectType === 'heal') return 'castle';
    if (option.abilityEffectType === 'slow') return 'all-enemies';
    return 'nearest-enemies';
  }

  if (option.valueKind === 'damage-source') {
    return abilityEffect?.type === 'damage' ? abilityEffect.damageSourceId : '';
  }

  if (option.valueKind === 'color') {
    return abilityEffect?.type === 'periodic-damage'
      ? abilityEffect.visualColor
      : (ability?.color ?? '#64748b');
  }

  if (type.endsWith('-target-count')) return 1;
  if (type.endsWith('-critical-multiplier')) return 0.5;
  if (type.endsWith('-duration-flat')) return 1;
  return 10;
}

function cloneEffect(effect: UpgradeEffect): UpgradeEffect {
  return { ...effect };
}

export function cloneUpgradeCard(card: UpgradeCardDefinition): UpgradeCardDefinition {
  return {
    ...card,
    effects: card.effects.map(cloneEffect),
    image: card.image ? { ...card.image } : undefined,
  };
}

export function createEmptyUpgradeCard(abilities: AbilityDefinition[] = []): UpgradeCardDefinition {
  const ability = abilities[0];
  const type = getCompatibleUpgradeEffectTypes(ability)[0] ?? 'ability-damage-percent';

  return {
    id: '',
    name: '',
    description: '',
    rarity: 'common',
    weight: 100,
    maxCount: 1,
    effects: [{ type, abilityId: ability?.id ?? '', value: getDefaultUpgradeEffectValue(type, ability) }],
    color: '#64748b',
  };
}

export function createEmptyUpgradeEffect(abilities: AbilityDefinition[] = []): UpgradeEffect {
  const ability = abilities[0];
  const type = getCompatibleUpgradeEffectTypes(ability)[0] ?? 'ability-damage-percent';
  return {
    type,
    abilityId: ability?.id ?? '',
    value: getDefaultUpgradeEffectValue(type, ability),
  };
}

export function normalizeUpgradeCard(card: UpgradeCardDefinition): UpgradeCardDefinition {
  const normalized: UpgradeCardDefinition = {
    id: card.id.trim().toLowerCase(),
    name: card.name.trim(),
    description: card.description.trim(),
    rarity: card.rarity,
    weight: card.weight,
    maxCount: card.maxCount,
    effects: card.effects.map((effect) => ({
      ...effect,
      abilityId: effect.abilityId.trim().toLowerCase(),
      value: typeof effect.value === 'string' ? effect.value.trim().toLowerCase() : effect.value,
    })),
  };

  if (card.color?.trim()) normalized.color = card.color.trim().toLowerCase();
  if (card.image?.src) {
    normalized.image = {
      name: card.image.name.trim(),
      src: card.image.src,
    };
  }

  return normalized;
}

function validateEffectValue(
  effect: UpgradeEffect,
  option: UpgradeEffectOption,
  damageSources: DamageSource[],
): string | undefined {
  if (option.valueKind === 'number') {
    if (typeof effect.value !== 'number' || !Number.isFinite(effect.value) || effect.value === 0) {
      return 'Значение эффекта должно быть числом, отличным от 0.';
    }
    if (effect.type.endsWith('-target-count') && !Number.isInteger(effect.value)) {
      return 'Количество дополнительных целей должно быть целым числом.';
    }
    return undefined;
  }

  if (typeof effect.value !== 'string' || !effect.value) {
    return 'Укажите значение.';
  }

  if (option.valueKind === 'target-type') {
    if (!getAllowedTargets(option.abilityEffectType).includes(effect.value as AbilityTargetType)) {
      return 'Выберите допустимый тип цели.';
    }
    return undefined;
  }

  if (option.valueKind === 'damage-source') {
    if (damageSources.length > 0 && !damageSources.some((source) => source.id === effect.value)) {
      return 'Выберите существующий источник урона.';
    }
    return undefined;
  }

  if (!HEX_COLOR_PATTERN.test(effect.value)) {
    return 'Укажите цвет в формате #RRGGBB.';
  }

  return undefined;
}

export function validateUpgradeCard(
  card: UpgradeCardDefinition,
  cards: UpgradeCardDefinition[],
  abilities: AbilityDefinition[],
  editingId?: string,
  damageSources: DamageSource[] = [],
): UpgradeValidationResult {
  const normalized = normalizeUpgradeCard(card);
  const errors: Record<string, string> = {};
  const abilitiesById = new Map(abilities.map((ability) => [ability.id, ability]));

  if (!normalized.id) {
    errors.id = 'Укажите ID.';
  } else if (!UPGRADE_ID_PATTERN.test(normalized.id)) {
    errors.id = 'ID может содержать только a-z, 0-9, _ и -.';
  } else if (cards.some((item) => item.id === normalized.id && item.id !== editingId)) {
    errors.id = 'Карточка с таким ID уже существует.';
  }

  if (!normalized.name) errors.name = 'Укажите название.';
  if (!RARITIES.has(normalized.rarity)) errors.rarity = 'Выберите корректную редкость.';
  if (!Number.isFinite(normalized.weight) || normalized.weight <= 0) {
    errors.weight = 'Вес должен быть числом больше 0.';
  }
  if (!Number.isInteger(normalized.maxCount) || normalized.maxCount < 1) {
    errors.maxCount = 'Максимальное количество должно быть целым числом от 1.';
  }
  if (normalized.color && !HEX_COLOR_PATTERN.test(normalized.color)) {
    errors.color = 'Укажите цвет в формате #RRGGBB.';
  }
  if (normalized.effects.length === 0) {
    errors.effects = 'Добавьте хотя бы один эффект.';
  }

  normalized.effects.forEach((effect, index) => {
    const key = `effect.${index}`;
    const ability = abilitiesById.get(effect.abilityId);
    const option = getUpgradeEffectOption(effect.type);

    if (!ability) {
      errors[`${key}.abilityId`] = 'Выберите существующую способность.';
      return;
    }
    if (!option || !isUpgradeEffectCompatible(effect, ability)) {
      errors[`${key}.type`] = 'Выберите корректный параметр улучшения.';
      return;
    }

    const valueError = validateEffectValue(effect, option, damageSources);
    if (valueError) errors[`${key}.value`] = valueError;
  });

  return { valid: Object.keys(errors).length === 0, errors };
}

export function saveUpgradeCard(
  cards: UpgradeCardDefinition[],
  card: UpgradeCardDefinition,
  editingId?: string,
): UpgradeCardDefinition[] {
  const normalized = normalizeUpgradeCard(card);
  if (!editingId) return [...cards, normalized];
  return cards.map((item) => (item.id === editingId ? normalized : item));
}

export function deleteUpgradeCard(cards: UpgradeCardDefinition[], id: string): UpgradeCardDefinition[] {
  return cards.filter((card) => card.id !== id);
}
