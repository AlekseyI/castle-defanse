import { DEFAULT_UNITS } from './defaultUnits';
import {
  UNIT_TRAITS,
  type DamageProtection,
  type UnitDefinition,
  type UnitImage,
  type UnitTrait,
  type UnitTraitMultipliers,
} from './types';

const STORAGE_KEY = 'game.units.v8';

function hasOnlyFields(value: Record<string, unknown>, fields: string[]): boolean {
  return Object.keys(value).every((key) => fields.includes(key));
}

function isUnitImage(value: unknown): value is UnitImage {
  if (!value || typeof value !== 'object') return false;
  const image = value as Record<string, unknown>;
  return (
    hasOnlyFields(image, ['name', 'src']) &&
    typeof image.name === 'string' &&
    typeof image.src === 'string'
  );
}

function isDamageProtection(value: unknown): value is DamageProtection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  return Object.entries(value as Record<string, unknown>).every(
    ([sourceId, protection]) =>
      sourceId.length > 0 &&
      typeof protection === 'number' &&
      Number.isFinite(protection) &&
      protection >= -100 &&
      protection <= 100,
  );
}

function isUnitTrait(value: unknown): value is UnitTrait {
  return typeof value === 'string' && (UNIT_TRAITS as readonly string[]).includes(value);
}

function isUnitTraitMultipliers(value: unknown): value is UnitTraitMultipliers {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const multipliers = value as Record<string, unknown>;
  if (!hasOnlyFields(multipliers, ['hp', 'protection', 'damage', 'speed', 'coins'])) return false;

  return Object.values(multipliers).every(
    (multiplier) =>
      typeof multiplier === 'number' &&
      Number.isFinite(multiplier) &&
      multiplier > 0,
  );
}

function isUnit(value: unknown): value is UnitDefinition {
  if (!value || typeof value !== 'object') return false;

  const unit = value as Record<string, unknown>;
  if (!hasOnlyFields(unit, ['id', 'name', 'hp', 'speed', 'damage', 'coinsOnDeath', 'traits', 'traitMultipliers', 'damageProtection', 'image', 'gameKey'])) return false;
  if (typeof unit.id !== 'string' || typeof unit.name !== 'string') return false;
  if (typeof unit.hp !== 'number' || !Number.isFinite(unit.hp)) return false;
  if (typeof unit.speed !== 'number' || !Number.isFinite(unit.speed)) return false;
  if (typeof unit.damage !== 'number' || !Number.isFinite(unit.damage)) return false;
  if (typeof unit.coinsOnDeath !== 'number' || !Number.isFinite(unit.coinsOnDeath) || unit.coinsOnDeath < 0) return false;
  if (!Array.isArray(unit.traits) || !unit.traits.every(isUnitTrait) || new Set(unit.traits).size !== unit.traits.length) return false;
  if (unit.traitMultipliers !== undefined && !isUnitTraitMultipliers(unit.traitMultipliers)) return false;
  if (unit.damageProtection !== undefined && !isDamageProtection(unit.damageProtection)) return false;
  if (unit.image !== undefined && !isUnitImage(unit.image)) return false;
  if (unit.gameKey !== undefined && typeof unit.gameKey !== 'string') return false;

  const traits = unit.traits as UnitTrait[];
  const multipliers = unit.traitMultipliers as UnitTraitMultipliers | undefined;
  const expectedMultiplierKeys: Array<keyof UnitTraitMultipliers> = [];
  if (traits.includes('healthy')) expectedMultiplierKeys.push('hp');
  if (traits.includes('armored')) expectedMultiplierKeys.push('protection');
  if (traits.includes('strong')) expectedMultiplierKeys.push('damage');
  if (traits.includes('fast')) expectedMultiplierKeys.push('speed');
  if (traits.includes('generous')) expectedMultiplierKeys.push('coins');

  const actualMultiplierKeys = Object.keys(multipliers ?? {}) as Array<keyof UnitTraitMultipliers>;
  return (
    expectedMultiplierKeys.length === actualMultiplierKeys.length &&
    expectedMultiplierKeys.every((key) => multipliers?.[key] !== undefined)
  );
}

function cloneDefaults(): UnitDefinition[] {
  return DEFAULT_UNITS.map((unit) => ({
    ...unit,
    traits: [...unit.traits],
    traitMultipliers: unit.traitMultipliers ? { ...unit.traitMultipliers } : undefined,
    damageProtection: unit.damageProtection ? { ...unit.damageProtection } : undefined,
    image: unit.image ? { ...unit.image } : undefined,
  }));
}

export function loadUnits(): UnitDefinition[] {
  if (typeof window === 'undefined') return cloneDefaults();

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return cloneDefaults();

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isUnit)) {
      return cloneDefaults();
    }
    return parsed;
  } catch {
    return cloneDefaults();
  }
}

export function persistUnits(units: UnitDefinition[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(units));
}
