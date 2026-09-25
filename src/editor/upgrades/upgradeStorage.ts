import { DEFAULT_UPGRADES } from './defaultUpgrades';
import type {
  UpgradeAddEffectType,
  UpgradeCardDefinition,
  UpgradeCardImage,
  UpgradeEffect,
  UpgradeEffectType,
  UpgradeModifierEffectType,
  UpgradeRarity,
  UpgradeTargetEffectType,
} from './types';

const STORAGE_KEY = 'game.upgrades.v3';
const CARD_KEYS = new Set(['id', 'name', 'description', 'rarity', 'weight', 'effects', 'color', 'image']);
const EFFECT_KEYS = new Set(['type', 'abilityId', 'value']);
const IMAGE_KEYS = new Set(['name', 'src']);
const TARGET_KEYS = new Set(['type', 'count', 'areaHeightPercent']);
const ADD_DAMAGE_KEYS = new Set(['amount', 'damageSourceId', 'criticalChancePercent', 'criticalMultiplier', 'target']);
const ADD_PERIODIC_KEYS = new Set(['chancePercent', 'amount', 'duration', 'criticalChancePercent', 'criticalMultiplier', 'visualColor', 'target']);
const ADD_SLOW_KEYS = new Set(['slowPercent', 'duration', 'target']);
const ADD_HEAL_KEYS = new Set(['amount', 'target']);

const MODIFIER_EFFECT_TYPES = new Set<UpgradeModifierEffectType>([
  'ability-damage-percent',
  'ability-damage-flat',
  'ability-damage-target-type',
  'ability-damage-target-count',
  'ability-damage-area-height',
  'ability-damage-source',
  'ability-damage-critical-chance',
  'ability-damage-critical-multiplier',
  'ability-periodic-damage-percent',
  'ability-periodic-damage-flat',
  'ability-periodic-target-type',
  'ability-periodic-target-count',
  'ability-periodic-area-height',
  'ability-periodic-chance',
  'ability-periodic-critical-chance',
  'ability-periodic-critical-multiplier',
  'ability-periodic-duration-percent',
  'ability-periodic-duration-flat',
  'ability-periodic-visual-color',
  'ability-slow-percent',
  'ability-slow-target-type',
  'ability-slow-target-count',
  'ability-slow-area-height',
  'ability-slow-duration-percent',
  'ability-slow-duration-flat',
  'ability-heal-percent',
  'ability-heal-flat',
]);
const ADD_EFFECT_TYPES = new Set<UpgradeAddEffectType>([
  'ability-add-damage',
  'ability-add-periodic-damage',
  'ability-add-slow',
  'ability-add-heal',
]);
const EFFECT_TYPES = new Set<UpgradeEffectType>([...MODIFIER_EFFECT_TYPES, ...ADD_EFFECT_TYPES]);
const TARGET_VALUE_TYPES = new Set<UpgradeTargetEffectType>([
  'ability-damage-target-type',
  'ability-periodic-target-type',
  'ability-slow-target-type',
]);
const STRING_VALUE_TYPES = new Set<UpgradeModifierEffectType>([
  'ability-damage-source',
  'ability-periodic-visual-color',
]);
const DAMAGE_TARGET_TYPES = new Set(['nearest-enemies', 'random-enemies', 'area-enemies', 'all-enemies', 'castle']);
const ENEMY_TARGET_TYPES = new Set(['nearest-enemies', 'random-enemies', 'area-enemies', 'all-enemies']);
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const RARITIES = new Set<UpgradeRarity>(['common', 'rare', 'epic', 'legendary']);

function hasOnlyKeys(value: Record<string, unknown>, keys: Set<string>): boolean {
  return Object.keys(value).every((key) => keys.has(key));
}

function isImage(value: unknown): value is UpgradeCardImage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const image = value as Record<string, unknown>;
  return hasOnlyKeys(image, IMAGE_KEYS) && typeof image.name === 'string' && typeof image.src === 'string';
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isTarget(value: unknown, allowedTypes: Set<string>): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const target = value as Record<string, unknown>;
  if (
    !hasOnlyKeys(target, TARGET_KEYS) ||
    typeof target.type !== 'string' || !allowedTypes.has(target.type) ||
    !isFiniteNonNegative(target.count) || !Number.isInteger(target.count) ||
    !isFiniteNonNegative(target.areaHeightPercent) || target.areaHeightPercent > 100
  ) return false;

  if ((target.type === 'nearest-enemies' || target.type === 'random-enemies') && target.count < 1) return false;
  if (target.type === 'area-enemies' && target.areaHeightPercent < 1) return false;
  return true;
}

function isAddedEffectValue(type: UpgradeAddEffectType, value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;

  if (type === 'ability-add-damage') {
    return (
      hasOnlyKeys(data, ADD_DAMAGE_KEYS) &&
      isFiniteNonNegative(data.amount) &&
      typeof data.damageSourceId === 'string' &&
      isFiniteNonNegative(data.criticalChancePercent) && data.criticalChancePercent <= 100 &&
      isFiniteNonNegative(data.criticalMultiplier) && (data.criticalMultiplier === 0 || data.criticalMultiplier >= 1) &&
      isTarget(data.target, DAMAGE_TARGET_TYPES)
    );
  }

  if (type === 'ability-add-periodic-damage') {
    return (
      hasOnlyKeys(data, ADD_PERIODIC_KEYS) &&
      isFiniteNonNegative(data.chancePercent) && data.chancePercent <= 100 &&
      isFiniteNonNegative(data.amount) &&
      isFiniteNonNegative(data.duration) &&
      isFiniteNonNegative(data.criticalChancePercent) && data.criticalChancePercent <= 100 &&
      isFiniteNonNegative(data.criticalMultiplier) && (data.criticalMultiplier === 0 || data.criticalMultiplier >= 1) &&
      typeof data.visualColor === 'string' && HEX_COLOR_PATTERN.test(data.visualColor) &&
      isTarget(data.target, ENEMY_TARGET_TYPES)
    );
  }

  if (type === 'ability-add-slow') {
    return (
      hasOnlyKeys(data, ADD_SLOW_KEYS) &&
      isFiniteNonNegative(data.slowPercent) && data.slowPercent <= 100 &&
      isFiniteNonNegative(data.duration) &&
      isTarget(data.target, ENEMY_TARGET_TYPES)
    );
  }

  return (
    hasOnlyKeys(data, ADD_HEAL_KEYS) &&
    isFiniteNonNegative(data.amount) &&
    isTarget(data.target, new Set(['castle']))
  );
}

function isModifierEffect(type: UpgradeModifierEffectType, value: unknown): boolean {
  if (TARGET_VALUE_TYPES.has(type as UpgradeTargetEffectType)) {
    const allowed = type === 'ability-damage-target-type' ? DAMAGE_TARGET_TYPES : ENEMY_TARGET_TYPES;
    return isTarget(value, allowed);
  }

  if (STRING_VALUE_TYPES.has(type)) {
    if (typeof value !== 'string' || value.trim().length === 0) return false;
    if (type === 'ability-periodic-visual-color') return HEX_COLOR_PATTERN.test(value);
    return true;
  }

  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value !== 0 &&
    (!type.endsWith('-target-count') || Number.isInteger(value))
  );
}

function isEffect(value: unknown): value is UpgradeEffect {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const effect = value as Record<string, unknown>;
  if (!hasOnlyKeys(effect, EFFECT_KEYS) || typeof effect.type !== 'string') return false;

  const type = effect.type as UpgradeEffectType;
  if (!EFFECT_TYPES.has(type) || typeof effect.abilityId !== 'string') return false;

  if (ADD_EFFECT_TYPES.has(type as UpgradeAddEffectType)) {
    return isAddedEffectValue(type as UpgradeAddEffectType, effect.value);
  }

  return isModifierEffect(type as UpgradeModifierEffectType, effect.value);
}

function isCard(value: unknown): value is UpgradeCardDefinition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const card = value as Record<string, unknown>;
  return (
    hasOnlyKeys(card, CARD_KEYS) &&
    typeof card.id === 'string' &&
    typeof card.name === 'string' &&
    typeof card.description === 'string' &&
    typeof card.rarity === 'string' && RARITIES.has(card.rarity as UpgradeRarity) &&
    typeof card.weight === 'number' && Number.isFinite(card.weight) && card.weight > 0 &&
    Array.isArray(card.effects) && card.effects.length > 0 && card.effects.every(isEffect) &&
    (card.color === undefined || typeof card.color === 'string') &&
    (card.image === undefined || isImage(card.image))
  );
}

function cloneDefaults(): UpgradeCardDefinition[] {
  return DEFAULT_UPGRADES.map((card) => ({
    ...card,
    effects: card.effects.map((effect) => ({
      ...effect,
      value: typeof effect.value === 'object'
        ? ('target' in effect.value
          ? { ...effect.value, target: { ...effect.value.target } }
          : { ...effect.value })
        : effect.value,
    } as UpgradeEffect)),
    image: card.image ? { ...card.image } : undefined,
  }));
}

export function loadUpgrades(): UpgradeCardDefinition[] {
  if (typeof window === 'undefined') return cloneDefaults();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return cloneDefaults();

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isCard)) return cloneDefaults();
    return parsed;
  } catch {
    return cloneDefaults();
  }
}

export function persistUpgrades(cards: UpgradeCardDefinition[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}
