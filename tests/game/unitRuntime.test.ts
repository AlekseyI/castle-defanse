import { describe, expect, it } from 'vitest';
import { DEFAULT_UNITS } from '../../src/editor/units/defaultUnits';
import type { UnitDefinition } from '../../src/editor/units/types';
import { WAVES } from '../../src/game/config';
import {
  createUnitLookup,
  findMissingWaveUnitIds,
  getDamageAfterProtection,
  getWaveUnitIds,
} from '../../src/game/unitRuntime';

describe('unitRuntime', () => {
  it('resolves units by the ids used by waves', () => {
    const lookup = createUnitLookup(DEFAULT_UNITS);

    for (const unitId of getWaveUnitIds(WAVES)) {
      expect(lookup.get(unitId)?.id).toBe(unitId);
    }
  });

  it('keeps the current wave balance in the default unit definitions', () => {
    const lookup = createUnitLookup(DEFAULT_UNITS);

    expect(lookup.get('wave_1_enemy')).toMatchObject({ hp: 55, speed: 38, damage: 10 });
    expect(lookup.get('wave_1_boss')).toMatchObject({ hp: 260, speed: 28, damage: 24 });
    expect(lookup.get('wave_2_enemy')).toMatchObject({ hp: 70, speed: 43, damage: 11 });
    expect(lookup.get('wave_2_boss')).toMatchObject({ hp: 380, speed: 31, damage: 28 });
    expect(lookup.get('wave_3_enemy')).toMatchObject({ hp: 90, speed: 48, damage: 12 });
    expect(lookup.get('wave_3_boss')).toMatchObject({ hp: 520, speed: 34, damage: 34 });
  });


  it('keeps wave references working after an editable unit id is changed', () => {
    const renamedUnits: UnitDefinition[] = DEFAULT_UNITS.map((unit) =>
      unit.gameKey === 'wave_1_enemy' ? { ...unit, id: 'forest_goblin' } : unit,
    );
    const lookup = createUnitLookup(renamedUnits);

    expect(lookup.get('wave_1_enemy')).toMatchObject({
      id: 'forest_goblin',
      gameKey: 'wave_1_enemy',
      hp: 55,
    });
  });

  it('applies protection and vulnerability for the matching damage source only', () => {
    const protection = {
      fire: 25,
      lightning: 100,
    };

    expect(getDamageAfterProtection(80, 'fire', protection)).toBe(60);
    expect(getDamageAfterProtection(80, 'lightning', protection)).toBe(0);
    expect(getDamageAfterProtection(80, 'ice', protection)).toBe(80);
    expect(getDamageAfterProtection(80, 'fire')).toBe(80);
    expect(getDamageAfterProtection(80, 'fire', { fire: -50 })).toBe(120);
    expect(getDamageAfterProtection(80, 'fire', { fire: -100 })).toBe(160);
    expect(getDamageAfterProtection(80, 'fire', { fire: 150 })).toBe(0);
    expect(getDamageAfterProtection(80, 'fire', { fire: -150 })).toBe(160);
  });

  it('reports a unit referenced by a wave when it is missing', () => {
    const units: UnitDefinition[] = DEFAULT_UNITS.filter((unit) => unit.id !== 'wave_2_boss');

    expect(findMissingWaveUnitIds(WAVES, units)).toEqual(['wave_2_boss']);
  });
});
