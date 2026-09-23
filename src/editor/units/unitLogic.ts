import type { DamageProtection, UnitDefinition } from './types';

export interface UnitValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof UnitDefinition, string>>;
}

const UNIT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

function normalizeDamageProtection(protection?: DamageProtection): DamageProtection | undefined {
  if (!protection) return undefined;

  const normalized = Object.fromEntries(
    Object.entries(protection)
      .map(([sourceId, value]) => [sourceId.trim().toLowerCase(), value] as const)
      .filter(([sourceId]) => sourceId.length > 0),
  );

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function normalizeUnit(unit: UnitDefinition): UnitDefinition {
  const normalized: UnitDefinition = {
    id: unit.id.trim().toLowerCase(),
    name: unit.name.trim(),
    hp: unit.hp,
    speed: unit.speed,
    damage: unit.damage,
    coinsOnDeath: unit.coinsOnDeath,
    isBoss: unit.isBoss,
  };

  if (unit.gameKey) normalized.gameKey = unit.gameKey;

  const damageProtection = normalizeDamageProtection(unit.damageProtection);
  if (damageProtection) normalized.damageProtection = damageProtection;

  if (unit.image?.src) {
    normalized.image = {
      name: unit.image.name.trim(),
      src: unit.image.src,
    };
  }

  return normalized;
}

export function validateUnit(
  unit: UnitDefinition,
  units: UnitDefinition[],
  editingId?: string,
): UnitValidationResult {
  const normalized = normalizeUnit(unit);
  const errors: UnitValidationResult['errors'] = {};

  if (!normalized.id) {
    errors.id = 'Укажите ID.';
  } else if (!UNIT_ID_PATTERN.test(normalized.id)) {
    errors.id = 'ID может содержать только a-z, 0-9, _ и -.';
  } else if (units.some((item) => item.id === normalized.id && item.id !== editingId)) {
    errors.id = 'Юнит с таким ID уже существует.';
  }

  if (!normalized.name) {
    errors.name = 'Укажите название.';
  }

  if (!Number.isFinite(normalized.hp) || normalized.hp <= 0) {
    errors.hp = 'HP должен быть числом больше 0.';
  }

  if (!Number.isFinite(normalized.speed) || normalized.speed < 0) {
    errors.speed = 'Скорость должна быть числом 0 или больше.';
  }

  if (!Number.isFinite(normalized.damage) || normalized.damage < 0) {
    errors.damage = 'Урон должен быть числом 0 или больше.';
  }

  if (!Number.isFinite(normalized.coinsOnDeath) || normalized.coinsOnDeath < 0) {
    errors.coinsOnDeath = 'Количество монет должно быть числом 0 или больше.';
  }

  if (normalized.damageProtection) {
    const hasInvalidProtection = Object.values(normalized.damageProtection).some(
      (value) => !Number.isFinite(value) || value < -100 || value > 100,
    );
    if (hasInvalidProtection) {
      errors.damageProtection = 'Защита от источника урона должна быть от -100 до 100%.';
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function saveUnit(
  units: UnitDefinition[],
  unit: UnitDefinition,
  editingId?: string,
): UnitDefinition[] {
  const normalized = normalizeUnit(unit);

  if (!editingId) {
    return [...units, normalized];
  }

  return units.map((item) => (item.id === editingId ? normalized : item));
}

export function deleteUnit(units: UnitDefinition[], id: string): UnitDefinition[] {
  return units.filter((unit) => unit.id !== id);
}
