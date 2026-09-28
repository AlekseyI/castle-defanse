import { UPGRADE_EFFECT_TYPES, UPGRADE_TARGET_EFFECT_TYPES } from '../upgrades/types';
import { DEFAULT_ABILITIES } from './defaultAbilities';
import type {
  AbilityDefinition,
  AbilityEffect,
  AbilityEffectType,
  AbilityImage,
  AbilityTarget,
  AbilityTargetType,
  AbilityVisualEffect,
} from './types';

const STORAGE_KEY = 'game.abilities.v9';
const TARGET_TYPE_DEFAULTS_MIGRATION_KEY = 'game.abilities.targetTypeDefaults.v1';
const ABILITY_KEYS = new Set(['id', 'name', 'description', 'effects', 'allowedUpgradeParameters', 'visualEffect', 'color', 'image']);
const IMAGE_KEYS = new Set(['name', 'src']);
const TARGET_KEYS = new Set(['type', 'count', 'areaHeightPercent']);
const DAMAGE_EFFECT_KEYS = new Set(['type', 'amount', 'damageSourceId', 'criticalChancePercent', 'criticalMultiplier', 'target']);
const PERIODIC_DAMAGE_EFFECT_KEYS = new Set(['type', 'chancePercent', 'amount', 'duration', 'criticalChancePercent', 'criticalMultiplier', 'visualColor', 'target']);
const SLOW_EFFECT_KEYS = new Set(['type', 'slowPercent', 'duration', 'target']);
const HEAL_EFFECT_KEYS = new Set(['type', 'amount', 'target']);
const EFFECT_TYPES: AbilityEffectType[] = ['damage', 'periodic-damage', 'slow', 'heal'];
const VISUAL_EFFECTS: AbilityVisualEffect[] = ['none', 'fire', 'ice', 'lightning', 'heal'];
const TARGET_TYPES: AbilityTargetType[] = ['nearest-enemies', 'random-enemies', 'area-enemies', 'all-enemies', 'castle'];
const UPGRADE_PARAMETER_TYPES = new Set<string>(UPGRADE_EFFECT_TYPES);
const TARGET_TYPE_UPGRADE_PARAMETERS = new Set<string>(UPGRADE_TARGET_EFFECT_TYPES);

const EFFECT_TARGETS: Record<AbilityEffectType, AbilityTargetType[]> = {
  damage: ['nearest-enemies', 'random-enemies', 'area-enemies', 'all-enemies', 'castle'],
  'periodic-damage': ['nearest-enemies', 'random-enemies', 'area-enemies', 'all-enemies'],
  slow: ['nearest-enemies', 'random-enemies', 'area-enemies', 'all-enemies'],
  heal: ['castle'],
};

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
  if (!isTarget(effect.target)) return false;
  if (!EFFECT_TARGETS[effect.type as AbilityEffectType].includes(effect.target.type)) return false;

  if (effect.type === 'damage') {
    return hasOnlyKeys(effect, DAMAGE_EFFECT_KEYS) &&
      typeof effect.amount === 'number' &&
      typeof effect.damageSourceId === 'string' &&
      typeof effect.criticalChancePercent === 'number' &&
      typeof effect.criticalMultiplier === 'number';
  }
  if (effect.type === 'periodic-damage') {
    return hasOnlyKeys(effect, PERIODIC_DAMAGE_EFFECT_KEYS) &&
      typeof effect.chancePercent === 'number' &&
      typeof effect.amount === 'number' &&
      typeof effect.duration === 'number' &&
      typeof effect.criticalChancePercent === 'number' &&
      typeof effect.criticalMultiplier === 'number' &&
      typeof effect.visualColor === 'string';
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
    Array.isArray(ability.allowedUpgradeParameters) &&
    ability.allowedUpgradeParameters.every((parameter) => typeof parameter === 'string' && UPGRADE_PARAMETER_TYPES.has(parameter)) &&
    new Set(ability.allowedUpgradeParameters).size === ability.allowedUpgradeParameters.length &&
    typeof ability.visualEffect === 'string' &&
    VISUAL_EFFECTS.includes(ability.visualEffect as AbilityVisualEffect) &&
    typeof ability.color === 'string' &&
    (ability.image === undefined || isImage(ability.image))
  );
}

function cloneEffect(effect: AbilityEffect): AbilityEffect {
  return { ...effect, target: { ...effect.target } };
}


function withoutTargetTypeUpgradeParameters(ability: AbilityDefinition): AbilityDefinition {
  return {
    ...ability,
    allowedUpgradeParameters: ability.allowedUpgradeParameters.filter((parameter) => (
      !TARGET_TYPE_UPGRADE_PARAMETERS.has(parameter)
    )),
  };
}

function completeTargetTypeDefaultsMigration(): void {
  window.localStorage.setItem(TARGET_TYPE_DEFAULTS_MIGRATION_KEY, '1');
}

function cloneDefaults(): AbilityDefinition[] {
  return DEFAULT_ABILITIES.map((ability) => ({
    ...ability,
    effects: ability.effects.map(cloneEffect),
    allowedUpgradeParameters: [...ability.allowedUpgradeParameters],
    image: ability.image ? { ...ability.image } : undefined,
  }));
}

export function loadAbilities(): AbilityDefinition[] {
  if (typeof window === 'undefined') return cloneDefaults();

  const migrationCompleted = window.localStorage.getItem(TARGET_TYPE_DEFAULTS_MIGRATION_KEY) === '1';
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    completeTargetTypeDefaultsMigration();
    return cloneDefaults();
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isAbilityDefinition)) {
      completeTargetTypeDefaultsMigration();
      return cloneDefaults();
    }
    if (migrationCompleted) return parsed;

    const migrated = parsed.map(withoutTargetTypeUpgradeParameters);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    completeTargetTypeDefaultsMigration();
    return migrated;
  } catch {
    completeTargetTypeDefaultsMigration();
    return cloneDefaults();
  }
}

export function persistAbilities(abilities: AbilityDefinition[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(abilities));
  completeTargetTypeDefaultsMigration();
}
