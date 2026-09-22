import { DEFAULT_ABILITIES } from './defaultAbilities';
import type {
  AbilityDefinition,
  AbilityEffect,
  AbilityEffectType,
  AbilityImage,
  AbilityTarget,
  AbilityTargetType,
} from './types';

const STORAGE_KEY = 'game.abilities.v4';
const ABILITY_KEYS = new Set(['id', 'name', 'description', 'effects', 'color', 'image', 'target']);
const IMAGE_KEYS = new Set(['name', 'src']);
const TARGET_KEYS = new Set(['type', 'count', 'areaHeightPercent']);
const DAMAGE_EFFECT_KEYS = new Set(['type', 'amount', 'damageSourceId']);
const SLOW_EFFECT_KEYS = new Set(['type', 'slowPercent', 'duration']);
const HEAL_EFFECT_KEYS = new Set(['type', 'amount']);
const EFFECT_TYPES: AbilityEffectType[] = ['damage', 'slow', 'heal'];
const TARGET_TYPES: AbilityTargetType[] = ['nearest-enemies', 'random-enemies', 'area-enemies', 'all-enemies', 'castle'];

function hasOnlyKeys(value: Record<string, unknown>, keys: Set<string>): boolean {
  return Object.keys(value).every((key) => keys.has(key));
}

function isImage(value: unknown): value is AbilityImage {
  if (!value || typeof value !== 'object') return false;
  const image = value as Record<string, unknown>;
  return hasOnlyKeys(image, IMAGE_KEYS) && typeof image.name === 'string' && typeof image.src === 'string';
}

function isTarget(value: unknown): value is AbilityTarget {
  if (!value || typeof value !== 'object') return false;
  const target = value as Record<string, unknown>;
  if (!hasOnlyKeys(target, TARGET_KEYS)) return false;
  if (typeof target.type !== 'string' || !TARGET_TYPES.includes(target.type as AbilityTargetType)) return false;

  if (target.type === 'nearest-enemies' || target.type === 'random-enemies') {
    return typeof target.count === 'number' && target.areaHeightPercent === undefined;
  }

  if (target.type === 'area-enemies') {
    return typeof target.areaHeightPercent === 'number' && target.count === undefined;
  }

  return target.count === undefined && target.areaHeightPercent === undefined;
}

function isEffect(value: unknown): value is AbilityEffect {
  if (!value || typeof value !== 'object') return false;
  const effect = value as Record<string, unknown>;
  if (typeof effect.type !== 'string' || !EFFECT_TYPES.includes(effect.type as AbilityEffectType)) return false;

  if (effect.type === 'damage') {
    return hasOnlyKeys(effect, DAMAGE_EFFECT_KEYS) &&
      typeof effect.amount === 'number' &&
      typeof effect.damageSourceId === 'string';
  }
  if (effect.type === 'slow') {
    return hasOnlyKeys(effect, SLOW_EFFECT_KEYS) &&
      typeof effect.slowPercent === 'number' &&
      typeof effect.duration === 'number';
  }
  return hasOnlyKeys(effect, HEAL_EFFECT_KEYS) && typeof effect.amount === 'number';
}

function isAbilityDefinition(value: unknown): value is AbilityDefinition {
  if (!value || typeof value !== 'object') return false;
  const ability = value as Record<string, unknown>;
  if (!hasOnlyKeys(ability, ABILITY_KEYS)) return false;
  if (!Array.isArray(ability.effects) || ability.effects.length === 0 || !ability.effects.every(isEffect)) return false;

  const effectTypes = ability.effects.map((effect) => effect.type);
  if (new Set(effectTypes).size !== effectTypes.length) return false;

  return (
    typeof ability.id === 'string' &&
    typeof ability.name === 'string' &&
    (ability.description === undefined || typeof ability.description === 'string') &&
    typeof ability.color === 'string' &&
    (ability.image === undefined || isImage(ability.image)) &&
    isTarget(ability.target)
  );
}

function cloneEffect(effect: AbilityEffect): AbilityEffect {
  return { ...effect };
}

function cloneDefaults(): AbilityDefinition[] {
  return DEFAULT_ABILITIES.map((ability) => ({
    ...ability,
    effects: ability.effects.map(cloneEffect),
    image: ability.image ? { ...ability.image } : undefined,
    target: { ...ability.target },
  }));
}

export function loadAbilities(): AbilityDefinition[] {
  if (typeof window === 'undefined') return cloneDefaults();

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return cloneDefaults();

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isAbilityDefinition)) return cloneDefaults();
    return parsed;
  } catch {
    return cloneDefaults();
  }
}

export function persistAbilities(abilities: AbilityDefinition[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(abilities));
}
