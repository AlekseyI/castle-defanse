import {
  UNIT_TRAITS,
  type DamageProtection,
  type UnitDefinition,
  type UnitTrait,
  type UnitTraitMultipliers,
} from './types';
import { normalizeUnitAnimations } from './unitAnimationLogic';
import type { DamageSource } from '../damageSources/types';

export interface UnitValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof UnitDefinition, string>>;
}

const UNIT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const UNIT_TRAIT_ORDER = new Map<UnitTrait, number>(UNIT_TRAITS.map((trait, index) => [trait, index]));

function normalizeDamageProtection(protection?: DamageProtection): DamageProtection | undefined {
  if (!protection) return undefined;

  const normalized = Object.fromEntries(
    Object.entries(protection)
      .map(([sourceId, value]) => [sourceId.trim().toLowerCase(), value] as const)
      .filter(([sourceId]) => sourceId.length > 0),
  );

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeTraits(traits: UnitTrait[]): UnitTrait[] {
  return [...new Set(traits)].sort(
    (left, right) => (UNIT_TRAIT_ORDER.get(left) ?? 0) - (UNIT_TRAIT_ORDER.get(right) ?? 0),
  );
}

function normalizeTraitMultipliers(
  traits: UnitTrait[],
  multipliers?: UnitTraitMultipliers,
): UnitTraitMultipliers | undefined {
  if (!multipliers) return undefined;

  const normalized: UnitTraitMultipliers = {};
  if (traits.includes('healthy') && multipliers.hp !== undefined) normalized.hp = multipliers.hp;
  if (traits.includes('armored') && multipliers.protection !== undefined) normalized.protection = multipliers.protection;
  if (traits.includes('strong') && multipliers.damage !== undefined) normalized.damage = multipliers.damage;
  if (traits.includes('fast') && multipliers.speed !== undefined) normalized.speed = multipliers.speed;
  if (traits.includes('generous') && multipliers.coins !== undefined) normalized.coins = multipliers.coins;

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function hasTrait(unit: Pick<UnitDefinition, 'traits'>, trait: UnitTrait): boolean {
  return unit.traits.includes(trait);
}

function applyProtectionMultiplier(
  protection: DamageProtection | undefined,
  multiplier: number,
): DamageProtection | undefined {
  if (!protection) return undefined;

  return Object.fromEntries(
    Object.entries(protection).map(([sourceId, value]) => {
      if (value > 0) return [sourceId, Math.min(100, value * multiplier)];
      if (value < 0) return [sourceId, value / multiplier];
      return [sourceId, 0];
    }),
  );
}

export function applyUnitTraitMultipliers(unit: UnitDefinition): UnitDefinition {
  const multipliers = unit.traitMultipliers;

  return {
    ...unit,
    hp: hasTrait(unit, 'healthy') ? unit.hp * (multipliers?.hp ?? 1) : unit.hp,
    damage: hasTrait(unit, 'strong') ? unit.damage * (multipliers?.damage ?? 1) : unit.damage,
    speed: hasTrait(unit, 'fast') ? unit.speed * (multipliers?.speed ?? 1) : unit.speed,
    coinsOnDeath: hasTrait(unit, 'generous')
      ? Math.round(unit.coinsOnDeath * (multipliers?.coins ?? 1))
      : unit.coinsOnDeath,
    damageProtection: hasTrait(unit, 'armored')
      ? applyProtectionMultiplier(unit.damageProtection, multipliers?.protection ?? 1)
      : unit.damageProtection,
  };
}

export function normalizeUnit(unit: UnitDefinition): UnitDefinition {
  const traits = normalizeTraits(unit.traits);
  const normalized: UnitDefinition = {
    id: unit.id.trim().toLowerCase(),
    name: unit.name.trim(),
    hp: unit.hp,
    speed: unit.speed,
    damage: unit.damage,
    damageSourceId: unit.damageSourceId.trim().toLowerCase(),
    coinsOnDeath: unit.coinsOnDeath,
    traits,
    animationSpeed: unit.animationSpeed,
    animations: normalizeUnitAnimations(unit.animations),
  };

  if (traits.includes('ranged')) {
    normalized.attackStartPathPercent = unit.attackStartPathPercent;
  }

  if (unit.gameKey) normalized.gameKey = unit.gameKey;

  const traitMultipliers = normalizeTraitMultipliers(traits, unit.traitMultipliers);
  if (traitMultipliers) normalized.traitMultipliers = traitMultipliers;

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

function hasValidMultiplier(value: number | undefined): boolean {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

export function validateUnit(
  unit: UnitDefinition,
  units: UnitDefinition[],
  damageSources: DamageSource[],
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

  if (!normalized.damageSourceId || !damageSources.some((source) => source.id === normalized.damageSourceId)) {
    errors.damageSourceId = 'Выберите существующий источник урона.';
  }

  if (!Number.isFinite(normalized.coinsOnDeath) || normalized.coinsOnDeath < 0) {
    errors.coinsOnDeath = 'Количество монет должно быть числом 0 или больше.';
  }

  if (!Number.isFinite(normalized.animationSpeed) || normalized.animationSpeed < 0.1 || normalized.animationSpeed > 100) {
    errors.animationSpeed = 'Скорость анимации должна быть от 0.1 до 100.';
  }

  if (hasTrait(normalized, 'ranged')) {
    if (
      !Number.isFinite(normalized.attackStartPathPercent) ||
      normalized.attackStartPathPercent === undefined ||
      normalized.attackStartPathPercent < 0 ||
      normalized.attackStartPathPercent > 100
    ) {
      errors.attackStartPathPercent = 'Начало атаки должно быть от 0 до 100% пути.';
    }
  }

  const multipliers = normalized.traitMultipliers;
  const invalidTraitMultiplier =
    (hasTrait(normalized, 'healthy') && !hasValidMultiplier(multipliers?.hp)) ||
    (hasTrait(normalized, 'armored') && !hasValidMultiplier(multipliers?.protection)) ||
    (hasTrait(normalized, 'strong') && !hasValidMultiplier(multipliers?.damage)) ||
    (hasTrait(normalized, 'fast') && !hasValidMultiplier(multipliers?.speed)) ||
    (hasTrait(normalized, 'generous') && !hasValidMultiplier(multipliers?.coins));

  if (invalidTraitMultiplier) {
    errors.traitMultipliers = 'Множитель выбранной особенности должен быть числом больше 0.';
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
