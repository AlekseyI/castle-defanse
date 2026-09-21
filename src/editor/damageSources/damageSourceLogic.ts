import type { DamageSource } from './types';

export interface DamageSourceValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof DamageSource, string>>;
}

const DAMAGE_SOURCE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function normalizeDamageSource(source: DamageSource): DamageSource {
  const normalized: DamageSource = {
    id: source.id.trim().toLowerCase(),
    name: source.name.trim(),
  };

  const description = source.description?.trim();
  const color = source.color?.trim();

  if (description) normalized.description = description;
  if (source.icon?.src) {
    normalized.icon = {
      name: source.icon.name.trim(),
      src: source.icon.src,
    };
  }
  if (color) normalized.color = color.toLowerCase();

  return normalized;
}

export function validateDamageSource(
  source: DamageSource,
  sources: DamageSource[],
  editingId?: string,
): DamageSourceValidationResult {
  const normalized = normalizeDamageSource(source);
  const errors: DamageSourceValidationResult['errors'] = {};

  if (!normalized.id) {
    errors.id = 'Укажите ID.';
  } else if (!DAMAGE_SOURCE_ID_PATTERN.test(normalized.id)) {
    errors.id = 'ID может содержать только a-z, 0-9, _ и -.';
  } else if (sources.some((item) => item.id === normalized.id && item.id !== editingId)) {
    errors.id = 'Источник с таким ID уже существует.';
  }

  if (!normalized.name) {
    errors.name = 'Укажите название.';
  }

  if (normalized.color && !HEX_COLOR_PATTERN.test(normalized.color)) {
    errors.color = 'Цвет должен быть в формате #RRGGBB.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function saveDamageSource(
  sources: DamageSource[],
  source: DamageSource,
  editingId?: string,
): DamageSource[] {
  const normalized = normalizeDamageSource(source);

  if (!editingId) {
    return [...sources, normalized];
  }

  return sources.map((item) => (item.id === editingId ? normalized : item));
}

export function deleteDamageSource(sources: DamageSource[], id: string): DamageSource[] {
  return sources.filter((source) => source.id !== id);
}
