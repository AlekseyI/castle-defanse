import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_UNITS } from '../../src/editor/units/defaultUnits';
import { loadUnits, persistUnits } from '../../src/editor/units/unitStorage';
import type { UnitDefinition } from '../../src/editor/units/types';

function installLocalStorage() {
  const values = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('unitStorage', () => {
  it('loads saved vulnerability values down to -100%', () => {
    installLocalStorage();
    const units: UnitDefinition[] = [
      {
        id: 'vulnerable_unit',
        name: 'Уязвимый юнит',
        hp: 100,
        speed: 20,
        damage: 10,
        coinsOnDeath: 4,
        isBoss: false,
        grantsUpgradeOnKill: false,
        damageProtection: { fire: -100 },
      },
    ];

    persistUnits(units);

    expect(loadUnits()).toEqual(units);
  });

  it('rejects saved units without coinsOnDeath', () => {
    installLocalStorage();
    window.localStorage.setItem('game.units.v6', JSON.stringify([
      {
        id: 'legacy_unit',
        name: 'Старый юнит',
        hp: 100,
        speed: 20,
        damage: 10,
      },
    ]));

    const loaded = loadUnits();
    expect(loaded.map((unit) => unit.id)).toEqual(DEFAULT_UNITS.map((unit) => unit.id));
    expect(loaded.some((unit) => unit.id === 'legacy_unit')).toBe(false);
  });

  it('rejects the old unit format without isBoss', () => {
    installLocalStorage();
    window.localStorage.setItem('game.units.v6', JSON.stringify([
      {
        id: 'old_unit',
        name: 'Старый формат',
        hp: 100,
        speed: 20,
        damage: 10,
        coinsOnDeath: 1,
      },
    ]));

    const loaded = loadUnits();
    expect(loaded.map((unit) => unit.id)).toEqual(DEFAULT_UNITS.map((unit) => unit.id));
    expect(loaded.some((unit) => unit.id === 'old_unit')).toBe(false);
  });


  it('rejects the previous unit json without grantsUpgradeOnKill', () => {
    installLocalStorage();
    window.localStorage.setItem('game.units.v6', JSON.stringify([{
      id: 'old_boss',
      name: 'Старый босс',
      hp: 100,
      speed: 20,
      damage: 10,
      coinsOnDeath: 1,
      isBoss: true,
    }]));

    expect(loadUnits()).toEqual(DEFAULT_UNITS);
  });

  it('rejects saved protection values below -100%', () => {
    installLocalStorage();
    persistUnits([
      {
        id: 'invalid_unit',
        name: 'Некорректный юнит',
        hp: 100,
        speed: 20,
        damage: 10,
        coinsOnDeath: 1,
        isBoss: false,
        grantsUpgradeOnKill: false,
        damageProtection: { fire: -101 },
      },
    ]);

    const loaded = loadUnits();
    expect(loaded.map((unit) => unit.id)).toEqual(DEFAULT_UNITS.map((unit) => unit.id));
    expect(loaded.some((unit) => unit.id === 'invalid_unit')).toBe(false);
  });
});
