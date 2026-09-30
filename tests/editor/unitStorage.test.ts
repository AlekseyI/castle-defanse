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
  it('loads saved traits, multipliers and vulnerability values', () => {
    installLocalStorage();
    const units: UnitDefinition[] = [
      {
        id: 'vulnerable_unit',
        name: 'Уязвимый юнит',
        hp: 100,
        speed: 20,
        damage: 10,
        coinsOnDeath: 4,
        traits: ['boss', 'armored', 'generous'],
        traitMultipliers: { protection: 2, coins: 1.5 },
        damageProtection: { fire: -100 },
      },
    ];

    persistUnits(units);

    expect(loadUnits()).toEqual(units);
  });

  it('rejects saved units without coinsOnDeath', () => {
    installLocalStorage();
    window.localStorage.setItem('game.units.v8', JSON.stringify([
      {
        id: 'invalid_unit',
        name: 'Некорректный юнит',
        hp: 100,
        speed: 20,
        damage: 10,
        traits: [],
      },
    ]));

    const loaded = loadUnits();
    expect(loaded.map((unit) => unit.id)).toEqual(DEFAULT_UNITS.map((unit) => unit.id));
    expect(loaded.some((unit) => unit.id === 'invalid_unit')).toBe(false);
  });

  it('does not read the previous unit json format', () => {
    installLocalStorage();
    window.localStorage.setItem('game.units.v7', JSON.stringify([
      {
        id: 'old_unit',
        name: 'Старый формат',
        hp: 100,
        speed: 20,
        damage: 10,
        coinsOnDeath: 1,
        isBoss: true,
      },
    ]));

    expect(loadUnits()).toEqual(DEFAULT_UNITS);
  });

  it('rejects modifier traits without their multipliers', () => {
    installLocalStorage();
    window.localStorage.setItem('game.units.v8', JSON.stringify([
      {
        id: 'invalid_unit',
        name: 'Некорректный юнит',
        hp: 100,
        speed: 20,
        damage: 10,
        coinsOnDeath: 1,
        traits: ['healthy'],
      },
    ]));

    expect(loadUnits()).toEqual(DEFAULT_UNITS);
  });

  it('rejects saved protection values below -100%', () => {
    installLocalStorage();
    window.localStorage.setItem('game.units.v8', JSON.stringify([
      {
        id: 'invalid_unit',
        name: 'Некорректный юнит',
        hp: 100,
        speed: 20,
        damage: 10,
        coinsOnDeath: 1,
        traits: [],
        damageProtection: { fire: -101 },
      },
    ]));

    const loaded = loadUnits();
    expect(loaded.map((unit) => unit.id)).toEqual(DEFAULT_UNITS.map((unit) => unit.id));
    expect(loaded.some((unit) => unit.id === 'invalid_unit')).toBe(false);
  });
});
