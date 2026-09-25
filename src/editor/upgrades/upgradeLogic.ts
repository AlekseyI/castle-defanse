import { getAllowedTargets } from '../abilities/abilityLogic';
import type { AbilityDefinition, AbilityEffectType, AbilityTargetType } from '../abilities/types';
import type { DamageSource } from '../damageSources/types';
import type {
  UpgradeAddEffectType,
  UpgradeAddEffectValue,
  UpgradeAddedDamageValue,
  UpgradeAddedHealValue,
  UpgradeAddedPeriodicDamageValue,
  UpgradeAddedSlowValue,
  UpgradeAddedTarget,
  UpgradeCardDefinition,
  UpgradeEffect,
  UpgradeEffectType,
  UpgradeEffectValue,
  UpgradeRarity,
  UpgradeTargetEffectType,
  UpgradeTargetValue,
} from './types';

export interface UpgradeValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export type UpgradeEffectValueKind = 'number' | 'target-type' | 'damage-source' | 'color' | 'add-effect';

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
  { type: 'ability-add-damage', label: 'Добавить основной урон', abilityEffectType: 'damage', valueKind: 'add-effect' },
  { type: 'ability-damage-percent', label: 'Основной урон, %', abilityEffectType: 'damage', valueKind: 'number' },
  { type: 'ability-damage-flat', label: 'Основной урон, значение', abilityEffectType: 'damage', valueKind: 'number' },
  { type: 'ability-damage-target-type', label: 'Тип цели основного урона', abilityEffectType: 'damage', valueKind: 'target-type' },
  { type: 'ability-damage-target-count', label: 'Дополнительные цели основного урона', abilityEffectType: 'damage', valueKind: 'number' },
  { type: 'ability-damage-area-height', label: 'Высота области основного урона, %', abilityEffectType: 'damage', valueKind: 'number' },
  { type: 'ability-damage-source', label: 'Источник основного урона', abilityEffectType: 'damage', valueKind: 'damage-source' },
  { type: 'ability-damage-critical-chance', label: 'Шанс крита основного урона, %', abilityEffectType: 'damage', valueKind: 'number' },
  { type: 'ability-damage-critical-multiplier', label: 'Прирост множителя крита основного урона', abilityEffectType: 'damage', valueKind: 'number' },
  { type: 'ability-add-periodic-damage', label: 'Добавить периодический урон', abilityEffectType: 'periodic-damage', valueKind: 'add-effect' },
  { type: 'ability-periodic-damage-percent', label: 'Периодический урон, %', abilityEffectType: 'periodic-damage', valueKind: 'number' },
  { type: 'ability-periodic-damage-flat', label: 'Периодический урон, значение', abilityEffectType: 'periodic-damage', valueKind: 'number' },
  { type: 'ability-periodic-target-type', label: 'Тип цели периодического урона', abilityEffectType: 'periodic-damage', valueKind: 'target-type' },
  { type: 'ability-periodic-target-count', label: 'Дополнительные цели периодического урона', abilityEffectType: 'periodic-damage', valueKind: 'number' },
  { type: 'ability-periodic-area-height', label: 'Высота области периодического урона, %', abilityEffectType: 'periodic-damage', valueKind: 'number' },
  { type: 'ability-periodic-chance', label: 'Шанс периодического урона, %', abilityEffectType: 'periodic-damage', valueKind: 'number' },
  { type: 'ability-periodic-critical-chance', label: 'Шанс крита периодического урона, %', abilityEffectType: 'periodic-damage', valueKind: 'number' },
  { type: 'ability-periodic-critical-multiplier', label: 'Прирост множителя крита периодического урона', abilityEffectType: 'periodic-damage', valueKind: 'number' },
  { type: 'ability-periodic-duration-percent', label: 'Длительность периодического урона, %', abilityEffectType: 'periodic-damage', valueKind: 'number' },
  { type: 'ability-periodic-duration-flat', label: 'Длительность периодического урона, сек.', abilityEffectType: 'periodic-damage', valueKind: 'number' },
  { type: 'ability-periodic-visual-color', label: 'Цвет периодического эффекта', abilityEffectType: 'periodic-damage', valueKind: 'color' },
  { type: 'ability-add-slow', label: 'Добавить замедление', abilityEffectType: 'slow', valueKind: 'add-effect' },
  { type: 'ability-slow-percent', label: 'Сила замедления, %', abilityEffectType: 'slow', valueKind: 'number' },
  { type: 'ability-slow-target-type', label: 'Тип цели замедления', abilityEffectType: 'slow', valueKind: 'target-type' },
  { type: 'ability-slow-target-count', label: 'Дополнительные цели замедления', abilityEffectType: 'slow', valueKind: 'number' },
  { type: 'ability-slow-area-height', label: 'Высота области замедления, %', abilityEffectType: 'slow', valueKind: 'number' },
  { type: 'ability-slow-duration-percent', label: 'Длительность замедления, %', abilityEffectType: 'slow', valueKind: 'number' },
  { type: 'ability-slow-duration-flat', label: 'Длительность замедления, сек.', abilityEffectType: 'slow', valueKind: 'number' },
  { type: 'ability-add-heal', label: 'Добавить лечение', abilityEffectType: 'heal', valueKind: 'add-effect' },
  { type: 'ability-heal-percent', label: 'Лечение способности, %', abilityEffectType: 'heal', valueKind: 'number' },
  { type: 'ability-heal-flat', label: 'Лечение способности, значение', abilityEffectType: 'heal', valueKind: 'number' },
];

export function getUpgradeEffectOption(type: UpgradeEffectType): UpgradeEffectOption | undefined {
  return UPGRADE_EFFECT_OPTIONS.find((option) => option.type === type);
}

function getAbilityEffect(ability: AbilityDefinition | undefined, type: AbilityEffectType) {
  return ability?.effects.find((effect) => effect.type === type);
}

export function getCompatibleUpgradeEffectTypes(ability?: AbilityDefinition): UpgradeEffectType[] {
  if (!ability) return [];
  return UPGRADE_EFFECT_OPTIONS.map((option) => option.type);
}

export function isUpgradeEffectCompatible(effect: UpgradeEffect, ability?: AbilityDefinition): boolean {
  return Boolean(ability && getUpgradeEffectOption(effect.type));
}

const TARGET_EFFECT_TYPES = new Set<UpgradeTargetEffectType>([
  'ability-damage-target-type',
  'ability-periodic-target-type',
  'ability-slow-target-type',
]);

function isTargetEffectType(type: UpgradeEffectType): type is UpgradeTargetEffectType {
  return TARGET_EFFECT_TYPES.has(type as UpgradeTargetEffectType);
}

function createAddedTarget(type: AbilityEffectType): UpgradeAddedTarget {
  return {
    type: type === 'heal' ? 'castle' : (type === 'slow' ? 'all-enemies' : 'nearest-enemies'),
    count: type === 'damage' || type === 'periodic-damage' ? 1 : 0,
    areaHeightPercent: 0,
  };
}

function abilityTargetToUpgradeTarget(target: { type: AbilityTargetType; count?: number; areaHeightPercent?: number }): UpgradeTargetValue {
  return {
    type: target.type,
    count: target.type === 'nearest-enemies' || target.type === 'random-enemies' ? (target.count ?? 1) : 0,
    areaHeightPercent: target.type === 'area-enemies' ? (target.areaHeightPercent ?? 50) : 0,
  };
}

export function createDefaultAddedEffectValue(type: UpgradeAddEffectType): UpgradeAddEffectValue {
  if (type === 'ability-add-damage') {
    return {
      amount: 0,
      damageSourceId: '',
      criticalChancePercent: 0,
      criticalMultiplier: 0,
      target: createAddedTarget('damage'),
    };
  }

  if (type === 'ability-add-periodic-damage') {
    return {
      chancePercent: 0,
      amount: 0,
      duration: 0,
      criticalChancePercent: 0,
      criticalMultiplier: 0,
      visualColor: '#000000',
      target: createAddedTarget('periodic-damage'),
    };
  }

  if (type === 'ability-add-slow') {
    return {
      slowPercent: 0,
      duration: 0,
      target: createAddedTarget('slow'),
    };
  }

  return {
    amount: 0,
    target: createAddedTarget('heal'),
  };
}

export function getDefaultUpgradeEffectValue(
  type: UpgradeEffectType,
  ability?: AbilityDefinition,
): UpgradeEffectValue {
  const option = getUpgradeEffectOption(type);
  if (!option) return 10;

  if (option.valueKind === 'add-effect') {
    return createDefaultAddedEffectValue(type as UpgradeAddEffectType);
  }

  const abilityEffect = getAbilityEffect(ability, option.abilityEffectType);

  if (option.valueKind === 'target-type') {
    if (abilityEffect) return abilityTargetToUpgradeTarget(abilityEffect.target);
    return abilityTargetToUpgradeTarget(createAddedTarget(option.abilityEffectType));
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

function cloneAddedTarget(target: UpgradeAddedTarget): UpgradeAddedTarget {
  return { ...target };
}

function cloneEffectValue(value: UpgradeEffectValue): UpgradeEffectValue {
  if (typeof value !== 'object') return value;
  if ('target' in value) return { ...value, target: cloneAddedTarget(value.target) } as UpgradeAddEffectValue;
  return { ...value } as UpgradeTargetValue;
}

function cloneEffect(effect: UpgradeEffect): UpgradeEffect {
  return { ...effect, value: cloneEffectValue(effect.value) } as UpgradeEffect;
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
  const type = getCompatibleUpgradeEffectTypes(ability)[0] ?? 'ability-add-damage';

  return {
    id: '',
    name: '',
    description: '',
    rarity: 'common',
    weight: 100,
    effects: [{ type, abilityId: ability?.id ?? '', value: getDefaultUpgradeEffectValue(type, ability) } as UpgradeEffect],
    color: '#64748b',
  };
}

export function createEmptyUpgradeEffect(abilities: AbilityDefinition[] = []): UpgradeEffect {
  const ability = abilities[0];
  const type = getCompatibleUpgradeEffectTypes(ability)[0] ?? 'ability-add-damage';
  return {
    type,
    abilityId: ability?.id ?? '',
    value: getDefaultUpgradeEffectValue(type, ability),
  } as UpgradeEffect;
}

export function normalizeAddedTarget(target: UpgradeAddedTarget): UpgradeAddedTarget {
  const usesCount = target.type === 'nearest-enemies' || target.type === 'random-enemies';
  const usesAreaHeight = target.type === 'area-enemies';

  return {
    type: target.type,
    count: usesCount ? (target.count ?? 0) : 0,
    areaHeightPercent: usesAreaHeight ? (target.areaHeightPercent ?? 0) : 0,
  };
}

export function changeUpgradeTargetType(
  target: UpgradeTargetValue,
  type: AbilityTargetType,
): UpgradeTargetValue {
  return normalizeAddedTarget({
    ...target,
    type,
    count: type === 'nearest-enemies' || type === 'random-enemies'
      ? (target.count > 0 ? target.count : 1)
      : 0,
    areaHeightPercent: type === 'area-enemies'
      ? (target.areaHeightPercent > 0 ? target.areaHeightPercent : 50)
      : 0,
  });
}

export function changeAddedTargetType(
  value: UpgradeAddEffectValue,
  type: AbilityTargetType,
): UpgradeAddEffectValue {
  return {
    ...value,
    target: changeUpgradeTargetType(value.target, type),
  } as UpgradeAddEffectValue;
}

function normalizeEffectValue(effect: UpgradeEffect): UpgradeEffectValue {
  if (typeof effect.value === 'string') return effect.value.trim().toLowerCase();
  if (typeof effect.value === 'number') return effect.value;
  if (isTargetEffectType(effect.type)) return normalizeAddedTarget(effect.value as UpgradeTargetValue);

  const value = effect.value as UpgradeAddEffectValue;
  if (effect.type === 'ability-add-damage') {
    const added = value as UpgradeAddedDamageValue;
    return {
      ...added,
      amount: added.amount ?? 0,
      damageSourceId: added.damageSourceId?.trim().toLowerCase() ?? '',
      criticalChancePercent: added.criticalChancePercent ?? 0,
      criticalMultiplier: added.criticalMultiplier ?? 0,
      target: normalizeAddedTarget(added.target),
    };
  }
  if (effect.type === 'ability-add-periodic-damage') {
    const added = value as UpgradeAddedPeriodicDamageValue;
    return {
      ...added,
      chancePercent: added.chancePercent ?? 0,
      amount: added.amount ?? 0,
      duration: added.duration ?? 0,
      criticalChancePercent: added.criticalChancePercent ?? 0,
      criticalMultiplier: added.criticalMultiplier ?? 0,
      visualColor: added.visualColor?.trim().toLowerCase() ?? '',
      target: normalizeAddedTarget(added.target),
    };
  }
  if (effect.type === 'ability-add-slow') {
    const added = value as UpgradeAddedSlowValue;
    return {
      ...added,
      slowPercent: added.slowPercent ?? 0,
      duration: added.duration ?? 0,
      target: normalizeAddedTarget(added.target),
    };
  }
  const added = value as UpgradeAddedHealValue;
  return {
    ...added,
    amount: added.amount ?? 0,
    target: normalizeAddedTarget(added.target),
  };
}

export function normalizeUpgradeCard(card: UpgradeCardDefinition): UpgradeCardDefinition {
  const normalized: UpgradeCardDefinition = {
    id: card.id.trim().toLowerCase(),
    name: card.name.trim(),
    description: card.description.trim(),
    rarity: card.rarity,
    weight: card.weight,
    effects: card.effects.map((effect) => ({
      ...effect,
      abilityId: effect.abilityId.trim().toLowerCase(),
      value: normalizeEffectValue(effect),
    } as UpgradeEffect)),
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

function finiteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function validateAddedTarget(
  target: UpgradeAddedTarget,
  effectType: AbilityEffectType,
): string | undefined {
  if (!getAllowedTargets(effectType).includes(target.type)) {
    return 'Выберите допустимый тип цели.';
  }
  if (target.type === 'nearest-enemies' || target.type === 'random-enemies') {
    if (!Number.isInteger(target.count) || target.count < 1) {
      return 'Количество целей должно быть целым числом от 1.';
    }
  }
  if (target.type === 'area-enemies') {
    if (!Number.isFinite(target.areaHeightPercent) || target.areaHeightPercent < 1 || target.areaHeightPercent > 100) {
      return 'Высота области должна быть от 1 до 100%.';
    }
  }
  return undefined;
}

function validateAddedEffectValue(
  effect: UpgradeEffect,
  option: UpgradeEffectOption,
  damageSources: DamageSource[],
): string | undefined {
  if (typeof effect.value !== 'object' || !effect.value || Array.isArray(effect.value)) {
    return 'Укажите параметры добавляемого эффекта.';
  }

  const addedValue = effect.value as UpgradeAddEffectValue;
  const targetError = validateAddedTarget(addedValue.target, option.abilityEffectType);
  if (targetError) return targetError;

  if (effect.type === 'ability-add-damage') {
    const value = effect.value as UpgradeAddedDamageValue;
    if (!finiteNonNegative(value.amount)) return 'Урон должен быть числом от 0.';
    if (!finiteNonNegative(value.criticalChancePercent) || value.criticalChancePercent > 100) {
      return 'Шанс крит. урона должен быть от 0 до 100%.';
    }
    if (!finiteNonNegative(value.criticalMultiplier) || (value.criticalMultiplier > 0 && value.criticalMultiplier < 1)) {
      return 'Множитель крит. урона должен быть 0 или числом от 1.';
    }
    if (value.criticalChancePercent > 0 && value.criticalMultiplier === 0) {
      return 'При шансе крит. урона выше 0 укажите множитель от 1.';
    }
    if (value.damageSourceId && damageSources.length > 0 && !damageSources.some((source) => source.id === value.damageSourceId)) {
      return 'Выберите существующий источник урона или оставьте поле пустым.';
    }
    return undefined;
  }

  if (effect.type === 'ability-add-periodic-damage') {
    const value = effect.value as UpgradeAddedPeriodicDamageValue;
    if (!finiteNonNegative(value.chancePercent) || value.chancePercent > 100) {
      return 'Шанс периодического урона должен быть от 0 до 100%.';
    }
    if (!finiteNonNegative(value.amount)) return 'Периодический урон должен быть числом от 0.';
    if (!finiteNonNegative(value.duration)) return 'Длительность должна быть числом от 0.';
    if (!finiteNonNegative(value.criticalChancePercent) || value.criticalChancePercent > 100) {
      return 'Шанс крит. урона должен быть от 0 до 100%.';
    }
    if (!finiteNonNegative(value.criticalMultiplier) || (value.criticalMultiplier > 0 && value.criticalMultiplier < 1)) {
      return 'Множитель крит. урона должен быть 0 или числом от 1.';
    }
    if (value.criticalChancePercent > 0 && value.criticalMultiplier === 0) {
      return 'При шансе крит. урона выше 0 укажите множитель от 1.';
    }
    return undefined;
  }

  if (effect.type === 'ability-add-slow') {
    const value = effect.value as UpgradeAddedSlowValue;
    if (!finiteNonNegative(value.slowPercent) || value.slowPercent > 100) {
      return 'Сила замедления должна быть от 0 до 100%.';
    }
    if (!finiteNonNegative(value.duration)) return 'Длительность должна быть числом от 0.';
    return undefined;
  }

  if (effect.type === 'ability-add-heal') {
    const value = effect.value as UpgradeAddedHealValue;
    if (!finiteNonNegative(value.amount)) return 'Лечение должно быть числом от 0.';
    return undefined;
  }

  return 'Выберите корректный добавляемый эффект.';
}

function validateEffectValue(
  effect: UpgradeEffect,
  option: UpgradeEffectOption,
  damageSources: DamageSource[],
): string | undefined {
  if (option.valueKind === 'add-effect') {
    return validateAddedEffectValue(effect, option, damageSources);
  }

  if (option.valueKind === 'number') {
    if (typeof effect.value !== 'number' || !Number.isFinite(effect.value) || effect.value === 0) {
      return 'Значение эффекта должно быть числом, отличным от 0.';
    }
    if (effect.type.endsWith('-target-count') && !Number.isInteger(effect.value)) {
      return 'Количество дополнительных целей должно быть целым числом.';
    }
    return undefined;
  }

  if (option.valueKind === 'target-type') {
    if (typeof effect.value !== 'object' || !effect.value || Array.isArray(effect.value) || 'target' in effect.value) {
      return 'Укажите тип цели и его параметры.';
    }
    return validateAddedTarget(effect.value as UpgradeTargetValue, option.abilityEffectType);
  }

  if (typeof effect.value !== 'string' || !effect.value) {
    return 'Укажите значение.';
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

    if (effect.type === 'ability-add-periodic-damage' && typeof effect.value === 'object') {
      if (!HEX_COLOR_PATTERN.test(effect.value.visualColor)) {
        errors[`${key}.visualColor`] = 'Укажите цвет эффекта в формате #RRGGBB.';
      }
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
