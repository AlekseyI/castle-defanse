import { DEFAULT_UNITS } from './defaultUnits';
import type { DamageProtection, UnitDefinition, UnitImage } from './types';

const STORAGE_KEY = 'game.units.v7';

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

function isUnit(value: unknown): value is UnitDefinition {
  if (!value || typeof value !== 'object') return false;

  const unit = value as Record<string, unknown>;
  return (
    hasOnlyFields(unit, ['id', 'name', 'hp', 'speed', 'damage', 'coinsOnDeath', 'isBoss', 'damageProtection', 'image', 'gameKey']) &&
    typeof unit.id === 'string' &&
    typeof unit.name === 'string' &&
    typeof unit.hp === 'number' && Number.isFinite(unit.hp) &&
    typeof unit.speed === 'number' && Number.isFinite(unit.speed) &&
    typeof unit.damage === 'number' && Number.isFinite(unit.damage) &&
    typeof unit.coinsOnDeath === 'number' && Number.isFinite(unit.coinsOnDeath) && unit.coinsOnDeath >= 0 &&
    typeof unit.isBoss === 'boolean' &&
    (unit.damageProtection === undefined || isDamageProtection(unit.damageProtection)) &&
    (unit.image === undefined || isUnitImage(unit.image)) &&
    (unit.gameKey === undefined || typeof unit.gameKey === 'string')
  );
}

function cloneDefaults(): UnitDefinition[] {
  return DEFAULT_UNITS.map((unit) => ({
    ...unit,
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
