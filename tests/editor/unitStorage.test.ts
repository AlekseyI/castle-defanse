import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_UNITS } from '../../src/editor/units/defaultUnits';
import { createEmptyUnitAnimationSounds, createEmptyUnitAnimations } from '../../src/editor/units/unitAnimationLogic';
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

function baseStoredUnit(): UnitDefinition {
  return {
    id: 'stored_unit',
    name: 'Сохранённый юнит',
    hp: 100,
    speed: 20,
    damage: 10,
    damageSourceId: 'fire',
    coinsOnDeath: 4,
    traits: [],
    animationSpeed: 1,
    animations: createEmptyUnitAnimations(),
    animationSounds: createEmptyUnitAnimationSounds(),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('unitStorage', () => {
  it('loads saved traits, multipliers, vulnerability values, animations and animation sounds', () => {
    installLocalStorage();
    const units: UnitDefinition[] = [
      {
        ...baseStoredUnit(),
        id: 'vulnerable_unit',
        name: 'Уязвимый юнит',
        traits: ['boss', 'armored', 'generous'],
        traitMultipliers: { protection: 2, coins: 1.5 },
        damageProtection: { fire: -100 },
        animationSpeed: 1.5,
        animations: {
          move: [{ id: 'move-1', name: 'move.png', src: 'data:image/png;base64,move' }],
          attack: [{ id: 'attack-1', name: 'attack.png', src: 'data:image/png;base64,attack' }],
          death: [{ id: 'death-1', name: 'death.png', src: 'data:image/png;base64,death' }],
        },
        animationSounds: {
          move: { id: 'move-sound', name: 'move.ogg', src: 'data:audio/ogg;base64,move' },
          death: { id: 'death-sound', name: 'death.wav', src: 'data:audio/wav;base64,death' },
        },
      },
    ];

    persistUnits(units);

    expect(loadUnits()).toEqual(units);
  });

  it('rejects saved units without coinsOnDeath', () => {
    installLocalStorage();
    const { coinsOnDeath: _coinsOnDeath, ...invalidUnit } = baseStoredUnit();
    window.localStorage.setItem('game.units.v12', JSON.stringify([invalidUnit]));

    const loaded = loadUnits();
    expect(loaded.map((unit) => unit.id)).toEqual(DEFAULT_UNITS.map((unit) => unit.id));
    expect(loaded.some((unit) => unit.id === 'stored_unit')).toBe(false);
  });

  it('does not read the previous v11 unit json format', () => {
    installLocalStorage();
    window.localStorage.setItem('game.units.v11', JSON.stringify([
      {
        id: 'old_unit',
        name: 'Старый формат',
        hp: 100,
        speed: 20,
        damage: 10,
        damageSourceId: 'fire',
        coinsOnDeath: 1,
        traits: [],
      },
    ]));

    expect(loadUnits()).toEqual(DEFAULT_UNITS);
  });

  it('rejects current-format units without damageSourceId', () => {
    installLocalStorage();
    const { damageSourceId: _damageSourceId, ...invalidUnit } = baseStoredUnit();
    window.localStorage.setItem('game.units.v12', JSON.stringify([invalidUnit]));

    expect(loadUnits()).toEqual(DEFAULT_UNITS);
  });

  it('rejects current-format units without animation data', () => {
    installLocalStorage();
    const { animations: _animations, ...invalidUnit } = baseStoredUnit();
    window.localStorage.setItem('game.units.v12', JSON.stringify([invalidUnit]));

    expect(loadUnits()).toEqual(DEFAULT_UNITS);
  });

  it('rejects current-format units without animation sounds data', () => {
    installLocalStorage();
    const { animationSounds: _animationSounds, ...invalidUnit } = baseStoredUnit();
    window.localStorage.setItem('game.units.v12', JSON.stringify([invalidUnit]));

    expect(loadUnits()).toEqual(DEFAULT_UNITS);
  });

  it('loads ranged units only with a valid attack start path percent', () => {
    installLocalStorage();
    const ranged: UnitDefinition = {
      ...baseStoredUnit(),
      id: 'archer',
      name: 'Лучник',
      hp: 80,
      speed: 25,
      damage: 12,
      coinsOnDeath: 2,
      traits: ['ranged'],
      attackStartPathPercent: 60,
    };

    persistUnits([ranged]);
    expect(loadUnits()).toEqual([ranged]);

    window.localStorage.setItem('game.units.v12', JSON.stringify([
      { ...ranged, attackStartPathPercent: 101 },
    ]));
    expect(loadUnits()).toEqual(DEFAULT_UNITS);
  });

  it('rejects modifier traits without their multipliers', () => {
    installLocalStorage();
    window.localStorage.setItem('game.units.v12', JSON.stringify([
      {
        ...baseStoredUnit(),
        id: 'invalid_unit',
        name: 'Некорректный юнит',
        traits: ['healthy'],
      },
    ]));

    expect(loadUnits()).toEqual(DEFAULT_UNITS);
  });

  it('rejects saved protection values below -100%', () => {
    installLocalStorage();
    window.localStorage.setItem('game.units.v12', JSON.stringify([
      {
        ...baseStoredUnit(),
        id: 'invalid_unit',
        name: 'Некорректный юнит',
        damageProtection: { fire: -101 },
      },
    ]));

    const loaded = loadUnits();
    expect(loaded.map((unit) => unit.id)).toEqual(DEFAULT_UNITS.map((unit) => unit.id));
    expect(loaded.some((unit) => unit.id === 'invalid_unit')).toBe(false);
  });
});
