import { afterEach, describe, expect, it, vi } from 'vitest';
import { UPGRADE_CARD_EFFECT_TYPES, UPGRADE_EFFECT_TYPES } from '../../src/editor/upgrades/types';
import { DEFAULT_ABILITIES } from '../../src/editor/abilities/defaultAbilities';
import { loadAbilities, persistAbilities } from '../../src/editor/abilities/abilityStorage';
import type { AbilityDefinition } from '../../src/editor/abilities/types';

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

describe('abilityStorage', () => {
  it('does not enable add-effect upgrade parameters in a clean project', () => {
    installLocalStorage();

    expect(loadAbilities().every((ability) => ability.allowedUpgradeParameters.every(
      (type) => !type.startsWith('ability-add-'),
    ))).toBe(true);
  });

  it('loads abilities with independent effect targets and a selected visual effect', () => {
    installLocalStorage();
    const abilities: AbilityDefinition[] = [
      {
        id: 'fire_heal',
        name: 'Огненное лечение',
        effects: [
          {
            type: 'damage',
            amount: 55,
            damageSourceId: 'fire',
            criticalChancePercent: 20,
            criticalMultiplier: 1.5,
            target: { type: 'area-enemies', areaHeightPercent: 50 },
          },
          {
            type: 'heal',
            amount: 20,
            target: { type: 'castle' },
          },
        ],
        allowedUpgradeParameters: [...UPGRADE_CARD_EFFECT_TYPES],
        visualEffect: 'fire',
        color: '#e9573f',
        image: { name: 'fire.svg', src: 'data:image/svg+xml;base64,AAA' },
      },
    ];

    persistAbilities(abilities);
    expect(loadAbilities()).toEqual(abilities);
  });

  it('loads abilities with periodic damage parameters', () => {
    installLocalStorage();
    const abilities: AbilityDefinition[] = [
      {
        id: 'fire_dot',
        name: 'Горение',
        effects: [
          {
            type: 'periodic-damage',
            chancePercent: 45,
            amount: 12,
            duration: 6,
            criticalChancePercent: 30,
            criticalMultiplier: 1.75,
            visualColor: '#f97316',
            target: { type: 'area-enemies', areaHeightPercent: 50 },
          },
        ],
        allowedUpgradeParameters: [...UPGRADE_CARD_EFFECT_TYPES],
        visualEffect: 'fire',
        color: '#e9573f',
        image: { name: 'fire.svg', src: 'data:image/svg+xml;base64,AAA' },
      },
    ];

    persistAbilities(abilities);
    expect(loadAbilities()).toEqual(abilities);
  });

  it('removes target type parameters from current saved abilities', () => {
    installLocalStorage();
    const ability: AbilityDefinition = {
      id: 'fire',
      name: 'Огонь',
      effects: [{
        type: 'damage',
        amount: 55,
        damageSourceId: 'fire',
        criticalChancePercent: 0,
        criticalMultiplier: 1.5,
        target: { type: 'all-enemies' },
      }],
      allowedUpgradeParameters: [...UPGRADE_EFFECT_TYPES],
      visualEffect: 'fire',
      color: '#e9573f',
    };
    window.localStorage.setItem('game.abilities.v9', JSON.stringify([ability]));

    expect(loadAbilities()).toEqual([{
      ...ability,
      allowedUpgradeParameters: [...UPGRADE_CARD_EFFECT_TYPES],
    }]);
    expect(JSON.parse(window.localStorage.getItem('game.abilities.v9') ?? '[]')).toEqual([{
      ...ability,
      allowedUpgradeParameters: [...UPGRADE_CARD_EFFECT_TYPES],
    }]);
  });


  it('preserves target type parameters after they are enabled through the ability setting', () => {
    installLocalStorage();
    const ability: AbilityDefinition = {
      id: 'fire',
      name: 'Огонь',
      effects: [{
        type: 'damage',
        amount: 55,
        damageSourceId: 'fire',
        criticalChancePercent: 0,
        criticalMultiplier: 1.5,
        target: { type: 'all-enemies' },
      }],
      allowedUpgradeParameters: [...UPGRADE_EFFECT_TYPES],
      visualEffect: 'fire',
      color: '#e9573f',
    };

    persistAbilities([ability]);

    expect(loadAbilities()).toEqual([ability]);
  });

  it('rejects duplicate effect types in saved json', () => {
    installLocalStorage();
    window.localStorage.setItem('game.abilities.v9', JSON.stringify([
      {
        id: 'double_damage',
        name: 'Двойной урон',
        effects: [
          {
            type: 'damage',
            amount: 10,
            damageSourceId: 'fire',
            criticalChancePercent: 0,
            criticalMultiplier: 1.5,
            target: { type: 'all-enemies' },
          },
          {
            type: 'damage',
            amount: 20,
            damageSourceId: 'fire',
            criticalChancePercent: 0,
            criticalMultiplier: 1.5,
            target: { type: 'all-enemies' },
          },
        ],
        allowedUpgradeParameters: [...UPGRADE_CARD_EFFECT_TYPES],
        visualEffect: 'fire',
        color: '#e9573f',
      },
    ]));

    expect(loadAbilities()).toEqual(DEFAULT_ABILITIES);
  });

  it('does not load the previous json storage version', () => {
    installLocalStorage();
    window.localStorage.setItem('game.abilities.v8', JSON.stringify([
      {
        id: 'fire',
        name: 'Огонь',
        effects: [{
          type: 'damage',
          amount: 55,
          damageSourceId: 'fire',
          target: { type: 'area-enemies', areaHeightPercent: 50 },
        }],
        visualEffect: 'fire',
        color: '#e9573f',
      },
    ]));

    expect(loadAbilities()).toEqual(DEFAULT_ABILITIES);
  });
});
