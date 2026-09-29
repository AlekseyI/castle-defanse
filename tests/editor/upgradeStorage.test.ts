import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_UPGRADE_GENERATION_CONFIG,
  cloneUpgradeGenerationConfig,
} from '../../src/editor/upgrades/defaultUpgradeGeneration';
import type { UpgradeCardDefinition } from '../../src/editor/upgrades/types';
import {
  loadUpgradeCards,
  loadUpgradeGenerationConfig,
  persistUpgradeCards,
  persistUpgradeGenerationConfig,
} from '../../src/editor/upgrades/upgradeStorage';

function installLocalStorage() {
  const values = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
  return values;
}

const manualCard: UpgradeCardDefinition = {
  id: 'manual-fire',
  name: 'Ручная карточка',
  description: 'Проверка ручного хранения.',
  rarity: 'rare',
  weight: 50,
  effects: [
    { type: 'ability-damage-flat', abilityId: 'fire', value: 10 },
    { type: 'ability-damage-percent', abilityId: 'fire', value: 15 },
  ],
  color: '#ff0000',
  image: undefined,
};

afterEach(() => vi.unstubAllGlobals());

describe('upgradeStorage', () => {
  it('persists and loads generation rules in the new format', () => {
    installLocalStorage();
    const config = cloneUpgradeGenerationConfig();
    config.enabled = false;
    config.previewCardCount = 7;
    config.minParametersPerCard = 2;
    config.maxParametersPerCard = 4;
    config.rarityWeights.legendary = 25;
    const rule = config.parameters['ability-damage-percent'];
    if (rule.kind === 'number') rule.ranges.epic = { min: 33, max: 44, step: 1 };

    persistUpgradeGenerationConfig(config);

    expect(loadUpgradeGenerationConfig()).toEqual(config);
  });

  it('persists manual cards separately from generator settings', () => {
    installLocalStorage();

    persistUpgradeCards([manualCard]);

    expect(loadUpgradeCards()).toEqual([manualCard]);
    expect(loadUpgradeGenerationConfig()).toEqual(DEFAULT_UPGRADE_GENERATION_CONFIG);
  });

  it('does not use legacy card or generator json', () => {
    const values = installLocalStorage();
    values.set('game.upgrades.v3', JSON.stringify([{ id: 'old-card' }]));
    values.set('game.upgrade-generation.v1', JSON.stringify({ enabled: true }));

    expect(loadUpgradeCards()).toEqual([]);
    expect(loadUpgradeGenerationConfig()).toEqual(DEFAULT_UPGRADE_GENERATION_CONFIG);
    expect(values.has('game.upgrades.v3')).toBe(false);
    expect(values.has('game.upgrade-generation.v1')).toBe(false);
  });

  it('rejects malformed generation json instead of migrating it', () => {
    const values = installLocalStorage();
    values.set('game.upgrade-generation.v2', JSON.stringify({
      enabled: true,
      previewCardCount: 10,
      minParametersPerCard: 1,
      maxParametersPerCard: 1,
      allowDuplicateParameters: false,
      allowSameAbility: true,
      rarityWeights: { common: 100, rare: 50, epic: 20, legendary: 5 },
      parameters: {},
    }));

    expect(loadUpgradeGenerationConfig()).toEqual(DEFAULT_UPGRADE_GENERATION_CONFIG);
  });

  it('rejects malformed manual-card json', () => {
    const values = installLocalStorage();
    values.set('game.upgrade-cards.v1', JSON.stringify([{ id: 'broken' }]));

    expect(loadUpgradeCards()).toEqual([]);
  });
});
