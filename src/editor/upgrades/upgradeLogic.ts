import type { AbilityDefinition, AbilityEffectType, AbilityTargetType } from '../abilities/types';
import type {
  UpgradeCardDefinition,
  UpgradeEffect,
  UpgradeEffectType,
  UpgradeRarity,
} from './types';

export interface UpgradeValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export interface UpgradeEffectOption {
  type: UpgradeEffectType;
  label: string;
  abilityEffectType: AbilityEffectType;
  requiresCountTarget?: boolean;
}

const UPGRADE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const COUNT_TARGETS = new Set<AbilityTargetType>(['nearest-enemies', 'random-enemies']);
const RARITIES = new Set<UpgradeRarity>(['common', 'rare', 'epic', 'legendary']);

export const UPGRADE_EFFECT_OPTIONS: UpgradeEffectOption[] = [
  { type: 'ability-damage-percent', label: 'Основной урон, %', abilityEffectType: 'damage' },
  { type: 'ability-damage-flat', label: 'Основной урон, значение', abilityEffectType: 'damage' },
  { type: 'ability-damage-target-count', label: 'Цели основного урона', abilityEffectType: 'damage', requiresCountTarget: true },
  { type: 'ability-damage-critical-chance', label: 'Шанс крита основного урона, п.п.', abilityEffectType: 'damage' },
  { type: 'ability-periodic-damage-percent', label: 'Периодический урон, %', abilityEffectType: 'periodic-damage' },
  { type: 'ability-periodic-damage-flat', label: 'Периодический урон, значение', abilityEffectType: 'periodic-damage' },
  { type: 'ability-periodic-target-count', label: 'Цели периодического урона', abilityEffectType: 'periodic-damage', requiresCountTarget: true },
  { type: 'ability-periodic-critical-chance', label: 'Шанс крита периодического урона, п.п.', abilityEffectType: 'periodic-damage' },
  { type: 'ability-periodic-duration-percent', label: 'Длительность периодического урона, %', abilityEffectType: 'periodic-damage' },
  { type: 'ability-periodic-duration-flat', label: 'Длительность периодического урона, сек.', abilityEffectType: 'periodic-damage' },
  { type: 'ability-slow-percent', label: 'Сила замедления, п.п.', abilityEffectType: 'slow' },
  { type: 'ability-slow-target-count', label: 'Цели замедления', abilityEffectType: 'slow', requiresCountTarget: true },
  { type: 'ability-slow-duration-percent', label: 'Длительность замедления, %', abilityEffectType: 'slow' },
  { type: 'ability-slow-duration-flat', label: 'Длительность замедления, сек.', abilityEffectType: 'slow' },
  { type: 'ability-heal-percent', label: 'Лечение способности, %', abilityEffectType: 'heal' },
  { type: 'ability-heal-flat', label: 'Лечение способности, значение', abilityEffectType: 'heal' },
];

export function getUpgradeEffectOption(type: UpgradeEffectType): UpgradeEffectOption | undefined {
  return UPGRADE_EFFECT_OPTIONS.find((option) => option.type === type);
}

export function getCompatibleUpgradeEffectTypes(ability?: AbilityDefinition): UpgradeEffectType[] {
  if (!ability) return [];

  return UPGRADE_EFFECT_OPTIONS.filter((option) => ability.effects.some((effect) => (
    effect.type === option.abilityEffectType &&
    (!option.requiresCountTarget || COUNT_TARGETS.has(effect.target.type))
  ))).map((option) => option.type);
}

export function isUpgradeEffectCompatible(effect: UpgradeEffect, ability?: AbilityDefinition): boolean {
  return Boolean(ability && getCompatibleUpgradeEffectTypes(ability).includes(effect.type));
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
    effects: [{ type, abilityId: ability?.id ?? '', value: 10 }],
    color: '#64748b',
  };
}

export function createEmptyUpgradeEffect(abilities: AbilityDefinition[] = []): UpgradeEffect {
  const ability = abilities[0];
  return {
    type: getCompatibleUpgradeEffectTypes(ability)[0] ?? 'ability-damage-percent',
    abilityId: ability?.id ?? '',
    value: 10,
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

export function validateUpgradeCard(
  card: UpgradeCardDefinition,
  cards: UpgradeCardDefinition[],
  abilities: AbilityDefinition[],
  editingId?: string,
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
    if (!ability) {
      errors[`${key}.abilityId`] = 'Выберите существующую способность.';
    } else if (!isUpgradeEffectCompatible(effect, ability)) {
      errors[`${key}.type`] = 'Этот параметр отсутствует у выбранной способности.';
    }
    if (!Number.isFinite(effect.value) || effect.value <= 0) {
      errors[`${key}.value`] = 'Значение улучшения должно быть числом больше 0.';
    } else if (effect.type.endsWith('-target-count') && !Number.isInteger(effect.value)) {
      errors[`${key}.value`] = 'Количество дополнительных целей должно быть целым числом.';
    }
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
