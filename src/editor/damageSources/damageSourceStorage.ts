import { DEFAULT_DAMAGE_SOURCES } from './defaultDamageSources';
import type { DamageSource, DamageSourceIcon } from './types';

const STORAGE_KEY = 'game.damageSources.v2';

function isDamageSourceIcon(value: unknown): value is DamageSourceIcon {
  if (!value || typeof value !== 'object') return false;
  const icon = value as Record<string, unknown>;
  return typeof icon.name === 'string' && typeof icon.src === 'string';
}

function isDamageSource(value: unknown): value is DamageSource {
  if (!value || typeof value !== 'object') return false;

  const source = value as Record<string, unknown>;
  return (
    typeof source.id === 'string' &&
    typeof source.name === 'string' &&
    (source.description === undefined || typeof source.description === 'string') &&
    (source.icon === undefined || isDamageSourceIcon(source.icon)) &&
    (source.color === undefined || typeof source.color === 'string')
  );
}

function cloneDefaults(): DamageSource[] {
  return DEFAULT_DAMAGE_SOURCES.map((source) => ({
    ...source,
    icon: source.icon ? { ...source.icon } : undefined,
  }));
}

export function loadDamageSources(): DamageSource[] {
  if (typeof window === 'undefined') return cloneDefaults();

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return cloneDefaults();

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isDamageSource)) {
      return cloneDefaults();
    }
    return parsed;
  } catch {
    return cloneDefaults();
  }
}

export function persistDamageSources(sources: DamageSource[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sources));
}
