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
  maxCount: 5,
  effects: [{ type: 'ability-damage-percent', abilityId: 'fire', value: 20 }],
};

describe('upgradeStorage', () => {
  it('persists and loads the current card format', () => {
    installLocalStorage();
    persistUpgrades([card]);
    expect(loadUpgrades()).toEqual([card]);
  });

  it('rejects incomplete or unknown card json instead of migrating it', () => {
    installLocalStorage();
    window.localStorage.setItem('game.upgrades.v1', JSON.stringify([{
      id: 'legacy',
      name: 'Legacy',
      effects: [],
    }]));
    expect(loadUpgrades()).toEqual(DEFAULT_UPGRADES);
  });
});
