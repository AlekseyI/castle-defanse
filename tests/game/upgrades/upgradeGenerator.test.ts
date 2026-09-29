import { describe, expect, it } from 'vitest';
import { cloneUpgradeGenerationConfig } from '../../../src/editor/upgrades/defaultUpgradeGeneration';
import type { AbilityDefinition } from '../../../src/editor/abilities/types';
import type { UpgradeCardDefinition, UpgradeEffectType, UpgradeGenerationConfig } from '../../../src/editor/upgrades/types';
import { buildUpgradeChoices, generateUpgradeChoices } from '../../../src/game/upgrades/upgradeGenerator';

function only(config: UpgradeGenerationConfig, ...types: UpgradeEffectType[]) {
  const enabled = new Set(types);
  for (const [type, rule] of Object.entries(config.parameters) as [UpgradeEffectType, UpgradeGenerationConfig['parameters'][UpgradeEffectType]][]) {
    rule.enabled = enabled.has(type);
  }
  config.rarityWeights = { common: 100, rare: 0, epic: 0, legendary: 0 };
}

const fire: AbilityDefinition = {
  id: 'fire',
  name: 'Огонь',
  effects: [{
    type: 'damage',
    amount: 50,
    damageSourceId: 'fire',
    criticalChancePercent: 0,
    criticalMultiplier: 1.5,
    target: { type: 'nearest-enemies', count: 1 },
  }],
  allowedUpgradeParameters: ['ability-damage-flat', 'ability-damage-percent'],
  visualEffect: 'fire',
  color: '#ff0000',
};

const ice: AbilityDefinition = {
  ...fire,
  id: 'ice',
  name: 'Лёд',
  color: '#00aaff',
};

const manualCard: UpgradeCardDefinition = {
  id: 'manual_fire',
  name: 'Ручной огонь',
  description: 'Ручная карточка.',
  rarity: 'common',
  weight: 100,
  effects: [{ type: 'ability-damage-flat', abilityId: 'fire', value: 7 }],
  color: '#ff0000',
};

describe('upgradeGenerator', () => {
  it('uses the configured default parameter-count range for each rarity', () => {
    const config = cloneUpgradeGenerationConfig();

    expect(config.parametersPerCard).toEqual({
      common: { min: 1, max: 2 },
      rare: { min: 2, max: 3 },
      epic: { min: 3, max: 4 },
      legendary: { min: 4, max: 5 },
    });
  });

  it('uses only parameters enabled both globally and for the ability', () => {
    const config = cloneUpgradeGenerationConfig();
    only(config, 'ability-damage-flat', 'ability-damage-percent');
    config.parameters['ability-damage-flat'].enabled = false;

    const result = generateUpgradeChoices(config, [fire], [], {}, 3, 5, () => 0);

    expect(result).toHaveLength(1);
    expect(result[0].effects[0].type).toBe('ability-damage-percent');
  });

  it('never generates a parameter disabled in the ability settings', () => {
    const config = cloneUpgradeGenerationConfig();
    only(config, 'ability-damage-flat');
    const restricted = { ...fire, allowedUpgradeParameters: [] };

    expect(generateUpgradeChoices(config, [restricted], [], {}, 3, 5, () => 0)).toEqual([]);
  });

  it('generates a numeric value inside the rarity range using its step', () => {
    const config = cloneUpgradeGenerationConfig();
    only(config, 'ability-damage-flat');
    const rule = config.parameters['ability-damage-flat'];
    if (rule.kind !== 'number') throw new Error('Expected numeric rule');
    rule.ranges.common = { min: 10, max: 20, step: 5 };

    const result = generateUpgradeChoices(config, [fire], [], {}, 1, 5, () => 0.999999);

    expect(result[0].rarity).toBe('common');
    expect(result[0].effects[0]).toEqual({
      type: 'ability-damage-flat',
      abilityId: 'fire',
      value: 20,
    });
  });

  it('generates multiple distinct parameters in one card within configured bounds', () => {
    const config = cloneUpgradeGenerationConfig();
    only(config, 'ability-damage-flat', 'ability-damage-percent');
    config.parametersPerCard.common = { min: 2, max: 2 };

    const result = generateUpgradeChoices(config, [fire], [], {}, 1, 5, () => 0);

    expect(result).toHaveLength(1);
    expect(result[0].effects).toHaveLength(2);
    expect(new Set(result[0].effects.map((effect) => effect.type))).toEqual(new Set([
      'ability-damage-flat',
      'ability-damage-percent',
    ]));
    expect(result[0].effects.every((effect) => effect.abilityId === 'fire')).toBe(true);
  });

  it('does not create a card when an ability has fewer eligible parameters than configured minimum', () => {
    const config = cloneUpgradeGenerationConfig();
    only(config, 'ability-damage-flat');
    config.parametersPerCard.common = { min: 2, max: 3 };

    expect(generateUpgradeChoices(config, [fire], [], {}, 1, 5, () => 0)).toEqual([]);
  });

  it('uses parameter-count bounds configured separately for every rarity', () => {
    for (const rarity of ['common', 'rare', 'epic', 'legendary'] as const) {
      const config = cloneUpgradeGenerationConfig();
      only(config, 'ability-damage-flat', 'ability-damage-percent');
      config.rarityWeights = { common: 0, rare: 0, epic: 0, legendary: 0 };
      config.rarityWeights[rarity] = 100;
      config.parametersPerCard[rarity] = { min: 2, max: 2 };

      const result = generateUpgradeChoices(config, [fire], [], {}, 1, 5, () => 0);

      expect(result).toHaveLength(1);
      expect(result[0].rarity).toBe(rarity);
      expect(result[0].effects).toHaveLength(2);
    }
  });

  it('uses the stable receive key for a one-parameter generated card', () => {
    const config = cloneUpgradeGenerationConfig();
    only(config, 'ability-damage-flat');

    const result = generateUpgradeChoices(
      config,
      [fire],
      [],
      { 'fire:ability-damage-flat': 2 },
      1,
      2,
      () => 0,
    );

    expect(result).toEqual([]);
  });

  it('respects duplicate-parameter and same-ability restrictions between generated cards', () => {
    const config = cloneUpgradeGenerationConfig();
    only(config, 'ability-damage-flat', 'ability-damage-percent');
    config.allowDuplicateParameters = false;
    config.allowSameAbility = false;

    const result = generateUpgradeChoices(config, [fire, ice], [], {}, 4, 5, () => 0);

    expect(result).toHaveLength(2);
    expect(new Set(result.map((card) => card.effects[0].type)).size).toBe(2);
    expect(new Set(result.map((card) => card.effects[0].abilityId)).size).toBe(2);
  });

  it('does not generate modifiers for an effect that the ability does not have', () => {
    const config = cloneUpgradeGenerationConfig();
    only(config, 'ability-heal-flat');
    const misleadingAbility = {
      ...fire,
      allowedUpgradeParameters: ['ability-heal-flat'] as UpgradeEffectType[],
    };

    expect(generateUpgradeChoices(config, [misleadingAbility], [], {}, 1, 5, () => 0)).toEqual([]);
  });

  it('keeps manual cards available when automatic generation is disabled', () => {
    const config = cloneUpgradeGenerationConfig();
    config.enabled = false;

    const result = buildUpgradeChoices(config, [manualCard], [fire], [], {}, 1, 5, () => 0);

    expect(result).toEqual([manualCard]);
  });

  it('mixes manual and generated cards in the same selection pool', () => {
    const config = cloneUpgradeGenerationConfig();
    only(config, 'ability-damage-percent');

    const result = buildUpgradeChoices(config, [manualCard], [fire], [], {}, 2, 5, () => 0);

    expect(result).toHaveLength(2);
    expect(result.some((card) => card.id === manualCard.id)).toBe(true);
    expect(result.some((card) => card.id.startsWith('generated_'))).toBe(true);
  });
});
