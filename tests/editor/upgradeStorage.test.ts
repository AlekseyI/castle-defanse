import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_UPGRADES } from '../../src/editor/upgrades/defaultUpgrades';
import { loadUpgrades, persistUpgrades } from '../../src/editor/upgrades/upgradeStorage';
import type { UpgradeCardDefinition } from '../../src/editor/upgrades/types';

function installLocalStorage() {
  const values = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

const card: UpgradeCardDefinition = {
  id: 'fire_damage',
  name: 'Адское пламя',
  description: '+20% основного урона',
  rarity: 'common',
  weight: 100,
  effects: [{ type: 'ability-damage-percent', abilityId: 'fire', value: 20 }],
};

describe('upgradeStorage', () => {
  it('persists and loads the current card format', () => {
    installLocalStorage();
    persistUpgrades([card]);
    expect(loadUpgrades()).toEqual([card]);
  });

  it('persists added effects with every parameter stored explicitly', () => {
    installLocalStorage();
    const withAddedEffect: UpgradeCardDefinition = {
      ...card,
      id: 'ignite',
      effects: [
        {
          type: 'ability-add-periodic-damage',
          abilityId: 'bolt',
          value: {
            chancePercent: 0,
            amount: 20,
            duration: 0,
            criticalChancePercent: 0,
            criticalMultiplier: 0,
            visualColor: '#000000',
            target: {
              type: 'nearest-enemies',
              count: 1,
              areaHeightPercent: 0,
            },
          },
        },
      ],
    };

    persistUpgrades([withAddedEffect]);
    expect(loadUpgrades()).toEqual([withAddedEffect]);
  });

  it('persists and loads negative numeric trade-off effects', () => {
    installLocalStorage();
    const tradeOff: UpgradeCardDefinition = {
      ...card,
      id: 'cursed_power',
      effects: [
        { type: 'ability-damage-percent', abilityId: 'fire', value: -35 },
        { type: 'ability-damage-target-count', abilityId: 'fire', value: -1 },
        { type: 'ability-periodic-duration-flat', abilityId: 'fire', value: -1.5 },
      ],
    };

    persistUpgrades([tradeOff]);
    expect(loadUpgrades()).toEqual([tradeOff]);
  });

  it('persists direct target, source and color values in the current format', () => {
    installLocalStorage();
    const current: UpgradeCardDefinition = {
      ...card,
      effects: [
        { type: 'ability-damage-target-type', abilityId: 'fire', value: { type: 'area-enemies', count: 0, areaHeightPercent: 45 } },
        { type: 'ability-damage-source', abilityId: 'fire', value: 'magic' },
        { type: 'ability-periodic-visual-color', abilityId: 'fire', value: '#00ff00' },
      ],
    };

    persistUpgrades([current]);
    expect(loadUpgrades()).toEqual([current]);
  });

  it('does not load the previous storage version', () => {
    installLocalStorage();
    window.localStorage.setItem('game.upgrades.v2', JSON.stringify([card]));

    expect(loadUpgrades()).toEqual(DEFAULT_UPGRADES);
  });

  it('rejects the previous target json shape instead of migrating it', () => {
    installLocalStorage();
    window.localStorage.setItem('game.upgrades.v3', JSON.stringify([{
      ...card,
      effects: [{ type: 'ability-damage-target-type', abilityId: 'fire', value: 'area-enemies' }],
    }]));

    expect(loadUpgrades()).toEqual(DEFAULT_UPGRADES);
  });

});
