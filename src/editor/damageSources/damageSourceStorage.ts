import { DEFAULT_DAMAGE_SOURCES } from './defaultDamageSources';
import type { DamageSource } from './types';

const STORAGE_KEY = 'game.damageSources.v1';

function isDamageSource(value: unknown): value is DamageSource {
  if (!value || typeof value !== 'object') return false;

  const source = value as Record<string, unknown>;
  return (
    typeof source.id === 'string' &&
    typeof source.name === 'string' &&
    (source.description === undefined || typeof source.description === 'string') &&
    (source.icon === undefined || typeof source.icon === 'string') &&
    (source.color === undefined || typeof source.color === 'string')
  );
}

export function loadDamageSources(): DamageSource[] {
  if (typeof window === 'undefined') return DEFAULT_DAMAGE_SOURCES.map((source) => ({ ...source }));

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_DAMAGE_SOURCES.map((source) => ({ ...source }));

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isDamageSource)) {
      return DEFAULT_DAMAGE_SOURCES.map((source) => ({ ...source }));
    }
    return parsed;
  } catch {
    return DEFAULT_DAMAGE_SOURCES.map((source) => ({ ...source }));
  }
}

export function persistDamageSources(sources: DamageSource[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sources));
}
