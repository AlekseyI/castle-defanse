import type { DamageProtection, UnitDefinition } from '../editor/units/types';
import type { WaveDefinition } from './config';

export function createUnitLookup(units: UnitDefinition[]): Map<string, UnitDefinition> {
  const lookup = new Map<string, UnitDefinition>();

  // Editable IDs are useful for editor-created units, but wave-bound units are resolved
  // by their stable gameKey so renaming an ID does not break the game configuration.
  for (const unit of units) lookup.set(unit.id, unit);
  for (const unit of units) {
    if (unit.gameKey) lookup.set(unit.gameKey, unit);
  }

  return lookup;
}

export function getWaveUnitIds(waves: WaveDefinition[]): Set<string> {
  return new Set(waves.flatMap((wave) => [wave.unitId, wave.bossUnitId]));
}

export function findMissingWaveUnitIds(
  waves: WaveDefinition[],
  units: UnitDefinition[],
): string[] {
  const unitsById = createUnitLookup(units);
  return [...getWaveUnitIds(waves)].filter((unitId) => !unitsById.has(unitId));
}

export function getDamageAfterProtection(
  amount: number,
  sourceId: string,
  damageProtection?: DamageProtection,
): number {
  const protection = Math.min(100, Math.max(-100, damageProtection?.[sourceId] ?? 0));
  return amount * (1 - protection / 100);
}
