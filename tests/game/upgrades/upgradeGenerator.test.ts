import { describe, expect, it } from 'vitest';
import { cloneUpgradeGenerationConfig } from '../../../src/editor/upgrades/defaultUpgradeGeneration';
import type { AbilityDefinition } from '../../../src/editor/abilities/types';
import type { UpgradeCardDefinition, UpgradeEffectType, UpgradeGenerationConfig } from '../../../src/editor/upgrades/types';
import { buildUpgradeChoices, generateUpgradeChoices } from '../../../src/game/upgrades/upgradeGenerator';
import { addUpgradeEffectToModifiers, type AbilityRuntimeModifiers } from '../../../src/game/upgrades/upgradeCalculator';

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
  allowedUpgradeParameters: ['ability-damage-flat', 'ability-damage-percent', 'ability-damage-target-count'],
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
    expect(config.maxParametersPerEffect).toBe(2);
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

  it('does not generate target type when it is excluded by the ability editor', () => {
    const config = cloneUpgradeGenerationConfig();
    only(config, 'ability-damage-target-type');
    const restricted = {
      ...fire,
      allowedUpgradeParameters: fire.allowedUpgradeParameters.filter(
        (type) => type !== 'ability-damage-target-type',
      ),
    };

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
    only(config, 'ability-damage-flat', 'ability-damage-target-count');
    config.parametersPerCard.common = { min: 2, max: 2 };

    const result = generateUpgradeChoices(config, [fire], [], {}, 1, 5, () => 0);

    expect(result).toHaveLength(1);
    expect(result[0].effects).toHaveLength(2);
    expect(new Set(result[0].effects.map((effect) => effect.type))).toEqual(new Set([
      'ability-damage-flat',
      'ability-damage-target-count',
    ]));
    expect(result[0].effects.every((effect) => effect.abilityId === 'fire')).toBe(true);
  });

  it('pairs critical chance with its critical multiplier before unrelated parameters', () => {
    const config = cloneUpgradeGenerationConfig();
    only(
      config,
      'ability-damage-critical-chance',
      'ability-damage-critical-multiplier',
      'ability-heal-flat',
    );
    config.parametersPerCard.common = { min: 2, max: 2 };
    config.parameters['ability-damage-critical-chance'].weight = 100;
    config.parameters['ability-damage-critical-multiplier'].weight = 1;
    config.parameters['ability-heal-flat'].weight = 10_000;

    const hybrid: AbilityDefinition = {
      ...fire,
      id: 'hybrid',
      name: 'Гибрид',
      effects: [
        fire.effects[0],
        { type: 'heal', amount: 20, target: { type: 'castle' } },
      ],
      allowedUpgradeParameters: [
        'ability-damage-critical-chance',
        'ability-damage-critical-multiplier',
        'ability-heal-flat',
      ],
    };

    const result = generateUpgradeChoices(config, [hybrid], [], {}, 1, 5, () => 0);

    expect(result).toHaveLength(1);
    expect(result[0].effects.map((effect) => effect.type)).toEqual([
      'ability-damage-critical-chance',
      'ability-damage-critical-multiplier',
    ]);
  });

  it('repairs a card when critical chance was selected only after an unrelated parameter', () => {
    const config = cloneUpgradeGenerationConfig();
    only(
      config,
      'ability-damage-critical-chance',
      'ability-damage-critical-multiplier',
      'ability-heal-flat',
    );
    config.parametersPerCard.common = { min: 2, max: 2 };
    config.parameters['ability-damage-critical-chance'].weight = 100;
    config.parameters['ability-damage-critical-multiplier'].weight = 1;
    config.parameters['ability-heal-flat'].weight = 10_000;

    const hybrid: AbilityDefinition = {
      ...fire,
      id: 'hybrid',
      name: 'Гибрид',
      effects: [
        fire.effects[0],
        { type: 'heal', amount: 20, target: { type: 'castle' } },
      ],
      allowedUpgradeParameters: [
        'ability-damage-critical-chance',
        'ability-damage-critical-multiplier',
        'ability-heal-flat',
      ],
    };

    const result = generateUpgradeChoices(config, [hybrid], [], {}, 1, 5, () => 0.1);

    expect(result).toHaveLength(1);
    expect(new Set(result[0].effects.map((effect) => effect.type))).toEqual(new Set([
      'ability-damage-critical-chance',
      'ability-damage-critical-multiplier',
    ]));
  });

  it('does not spend the final slot on half of another critical pair when an independent parameter is available', () => {
    const config = cloneUpgradeGenerationConfig();
    only(
      config,
      'ability-damage-critical-chance',
      'ability-damage-critical-multiplier',
      'ability-periodic-critical-chance',
      'ability-periodic-critical-multiplier',
      'ability-heal-flat',
    );
    config.parametersPerCard.common = { min: 3, max: 3 };

    const hybrid: AbilityDefinition = {
      ...fire,
      id: 'hybrid',
      name: 'Гибрид',
      effects: [
        fire.effects[0],
        {
          type: 'periodic-damage',
          chancePercent: 100,
          amount: 10,
          duration: 3,
          criticalChancePercent: 0,
          criticalMultiplier: 1.5,
          visualColor: '#ff0000',
          target: { type: 'nearest-enemies', count: 1 },
        },
        { type: 'heal', amount: 20, target: { type: 'castle' } },
      ],
      allowedUpgradeParameters: [
        'ability-damage-critical-chance',
        'ability-damage-critical-multiplier',
        'ability-periodic-critical-chance',
        'ability-periodic-critical-multiplier',
        'ability-heal-flat',
      ],
    };

    const result = generateUpgradeChoices(config, [hybrid], [], {}, 1, 5, () => 0);
    const types = result[0].effects.map((effect) => effect.type);

    expect(types).toContain('ability-damage-critical-chance');
    expect(types).toContain('ability-damage-critical-multiplier');
    expect(types).toContain('ability-heal-flat');
  });

  it('prefers another parameter from the same ability effect over an unrelated effect', () => {
    const config = cloneUpgradeGenerationConfig();
    only(config, 'ability-damage-flat', 'ability-damage-target-count', 'ability-heal-flat');
    config.parametersPerCard.common = { min: 2, max: 2 };
    config.parameters['ability-damage-flat'].weight = 100;
    config.parameters['ability-damage-target-count'].weight = 1;
    config.parameters['ability-heal-flat'].weight = 10_000;

    const hybrid: AbilityDefinition = {
      ...fire,
      id: 'hybrid',
      name: 'Гибрид',
      effects: [
        fire.effects[0],
        { type: 'heal', amount: 20, target: { type: 'castle' } },
      ],
      allowedUpgradeParameters: ['ability-damage-flat', 'ability-damage-target-count', 'ability-heal-flat'],
    };

    const result = generateUpgradeChoices(config, [hybrid], [], {}, 1, 5, () => 0);

    expect(result).toHaveLength(1);
    expect(result[0].effects.map((effect) => effect.type)).toEqual([
      'ability-damage-flat',
      'ability-damage-target-count',
    ]);
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
      only(config, 'ability-damage-flat', 'ability-damage-target-count');
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

  it('never returns two generated cards with the same parameter values', () => {
    const config = cloneUpgradeGenerationConfig();
    only(
      config,
      'ability-slow-percent',
      'ability-slow-area-height',
    );
    config.allowDuplicateParameters = true;
    config.allowSameAbility = true;
    config.parametersPerCard.common = { min: 2, max: 2 };

    const fixedValues = {
      'ability-slow-percent': 28,
      'ability-slow-area-height': 20,
    } as const;
    for (const [type, value] of Object.entries(fixedValues) as [keyof typeof fixedValues, number][]) {
      const rule = config.parameters[type];
      if (rule.kind !== 'number') throw new Error('Expected numeric rule');
      rule.ranges.common = { min: value, max: value, step: 1 };
    }

    const slowAbility: AbilityDefinition = {
      id: 'slow',
      name: 'Замедление',
      effects: [{
        type: 'slow',
        slowPercent: 20,
        duration: 2,
        target: { type: 'area-enemies', count: 0, areaHeightPercent: 20 },
      }],
      allowedUpgradeParameters: Object.keys(fixedValues) as UpgradeEffectType[],
      visualEffect: 'ice',
      color: '#00aaff',
    };

    const result = generateUpgradeChoices(config, [slowAbility], [], {}, 3, 5, () => 0);

    expect(result).toHaveLength(1);
    expect(Object.fromEntries(result[0].effects.map((effect) => [effect.type, effect.value]))).toEqual(fixedValues);
  });

  it.each([
    ['ability-damage-percent', 'ability-damage-flat'],
    ['ability-damage-target-count', 'ability-damage-area-height'],
    ['ability-periodic-damage-percent', 'ability-periodic-damage-flat'],
    ['ability-periodic-target-count', 'ability-periodic-area-height'],
    ['ability-periodic-duration-percent', 'ability-periodic-duration-flat'],
    ['ability-slow-target-count', 'ability-slow-area-height'],
    ['ability-slow-duration-percent', 'ability-slow-duration-flat'],
    ['ability-heal-percent', 'ability-heal-flat'],
  ] as const)('does not put conflicting parameters %s and %s into one card', (left, right) => {
    const config = cloneUpgradeGenerationConfig();
    only(config, left, right);
    config.maxParametersPerEffect = 10;
    config.parametersPerCard.common = { min: 2, max: 2 };

    const ability: AbilityDefinition = {
      id: 'mixed',
      name: 'Смешанная',
      effects: [
        fire.effects[0],
        {
          type: 'periodic-damage',
          chancePercent: 100,
          amount: 10,
          duration: 3,
          criticalChancePercent: 0,
          criticalMultiplier: 1.5,
          visualColor: '#ff0000',
          target: { type: 'nearest-enemies', count: 1 },
        },
        {
          type: 'slow',
          slowPercent: 20,
          duration: 2,
          target: { type: 'nearest-enemies', count: 1 },
        },
        { type: 'heal', amount: 20, target: { type: 'castle' } },
      ],
      allowedUpgradeParameters: [left, right],
      visualEffect: 'fire',
      color: '#ff0000',
    };

    expect(generateUpgradeChoices(config, [ability], [], {}, 1, 5, () => 0)).toEqual([]);
  });

  it('limits how many parameters of one effect can be generated in a card', () => {
    const config = cloneUpgradeGenerationConfig();
    only(
      config,
      'ability-damage-flat',
      'ability-slow-percent',
      'ability-slow-area-height',
      'ability-add-slow',
    );
    config.maxParametersPerEffect = 2;
    config.parametersPerCard.common = { min: 3, max: 3 };

    const ability: AbilityDefinition = {
      ...fire,
      id: 'damage-and-slow',
      name: 'Урон и замедление',
      effects: [
        fire.effects[0],
        {
          type: 'slow',
          slowPercent: 20,
          duration: 2,
          target: { type: 'area-enemies', areaHeightPercent: 20 },
        },
      ],
      allowedUpgradeParameters: [
        'ability-damage-flat',
        'ability-slow-percent',
        'ability-slow-area-height',
        'ability-add-slow',
      ],
    };

    const result = generateUpgradeChoices(config, [ability], [], {}, 1, 5, () => 0);

    expect(result).toHaveLength(1);
    expect(result[0].effects).toHaveLength(3);
    expect(result[0].effects.filter((effect) => (
      effect.type === 'ability-add-slow' || effect.type.startsWith('ability-slow-')
    ))).toHaveLength(2);
    expect(result[0].effects.some((effect) => effect.type === 'ability-damage-flat')).toBe(true);
  });

  it('allows the same parameter types when their generated values are different', () => {
    const config = cloneUpgradeGenerationConfig();
    only(config, 'ability-damage-flat');
    config.allowDuplicateParameters = true;
    const rule = config.parameters['ability-damage-flat'];
    if (rule.kind !== 'number') throw new Error('Expected numeric rule');
    rule.ranges.common = { min: 10, max: 20, step: 10 };

    const values = [
      0, 0, 0, 0,
      0, 0, 0, 0.999999,
    ];
    let index = 0;
    const result = generateUpgradeChoices(config, [fire], [], {}, 2, 5, () => values[index++] ?? 0);

    expect(result).toHaveLength(2);
    expect(result.map((card) => card.effects[0].value)).toEqual([10, 20]);
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

  it('starts generating modifiers after the required effect is added during the run', () => {
    const config = cloneUpgradeGenerationConfig();
    only(config, 'ability-periodic-damage-flat');
    const ability: AbilityDefinition = {
      ...fire,
      allowedUpgradeParameters: ['ability-periodic-damage-flat'],
    };

    expect(generateUpgradeChoices(config, [ability], [], {}, 1, 5, () => 0)).toEqual([]);

    const modifiers: AbilityRuntimeModifiers = {};
    addUpgradeEffectToModifiers(modifiers, {
      type: 'ability-add-periodic-damage',
      abilityId: ability.id,
      value: {
        chancePercent: 25,
        amount: 4,
        duration: 2,
        criticalChancePercent: 0,
        criticalMultiplier: 1.5,
        visualColor: '#ff0000',
        target: { type: 'nearest-enemies', count: 1, areaHeightPercent: 0 },
      },
    });

    const result = generateUpgradeChoices(config, [ability], [], {}, 1, 5, () => 0, modifiers);

    expect(result).toHaveLength(1);
    expect(result[0].effects[0]).toMatchObject({
      type: 'ability-periodic-damage-flat',
      abilityId: ability.id,
    });
  });

  it('uses another active ability when only it has an active critical chance', () => {
    const config = cloneUpgradeGenerationConfig();
    only(config, 'ability-damage-critical-multiplier');

    const damageWithoutCrit: AbilityDefinition = {
      ...fire,
      id: 'damage-without-crit',
      allowedUpgradeParameters: ['ability-damage-critical-multiplier'],
    };
    const damageWithCrit: AbilityDefinition = {
      ...fire,
      id: 'damage-with-crit',
      effects: [{
        type: 'damage',
        amount: 50,
        damageSourceId: 'fire',
        criticalChancePercent: 25,
        criticalMultiplier: 1.5,
        target: { type: 'nearest-enemies', count: 1 },
      }],
      allowedUpgradeParameters: ['ability-damage-critical-multiplier'],
    };

    const result = generateUpgradeChoices(
      config,
      [damageWithoutCrit, damageWithCrit],
      [],
      {},
      1,
      5,
      () => 0,
    );

    expect(result).toHaveLength(1);
    expect(result[0].effects[0].abilityId).toBe(damageWithCrit.id);
  });

  it('does not generate a critical multiplier alone until critical chance is active', () => {
    const config = cloneUpgradeGenerationConfig();
    only(config, 'ability-damage-critical-multiplier');
    const ability: AbilityDefinition = {
      ...fire,
      allowedUpgradeParameters: ['ability-damage-critical-multiplier'],
    };

    expect(generateUpgradeChoices(config, [ability], [], {}, 1, 5, () => 0)).toEqual([]);

    const modifiers: AbilityRuntimeModifiers = {};
    addUpgradeEffectToModifiers(modifiers, {
      type: 'ability-damage-critical-chance',
      abilityId: ability.id,
      value: 20,
    });

    const result = generateUpgradeChoices(config, [ability], [], {}, 1, 5, () => 0, modifiers);

    expect(result).toHaveLength(1);
    expect(result[0].effects[0]).toMatchObject({
      type: 'ability-damage-critical-multiplier',
      abilityId: ability.id,
    });
  });

  it('hides manual effect modifiers until the effect is opened and then hides the add-effect card', () => {
    const config = cloneUpgradeGenerationConfig();
    config.enabled = false;
    const ability: AbilityDefinition = {
      ...fire,
      id: 'runtime-periodic',
      allowedUpgradeParameters: ['ability-add-periodic-damage', 'ability-periodic-damage-flat'],
    };
    const addPeriodic: UpgradeCardDefinition = {
      id: 'add-periodic',
      name: 'Добавить периодический урон',
      description: '',
      rarity: 'common',
      weight: 100,
      color: '#ff0000',
      effects: [{
        type: 'ability-add-periodic-damage',
        abilityId: ability.id,
        value: {
          chancePercent: 25,
          amount: 4,
          duration: 2,
          criticalChancePercent: 0,
          criticalMultiplier: 1.5,
          visualColor: '#ff0000',
          target: { type: 'nearest-enemies', count: 1, areaHeightPercent: 0 },
        },
      }],
    };
    const boostPeriodic: UpgradeCardDefinition = {
      id: 'boost-periodic',
      name: 'Усилить периодический урон',
      description: '',
      rarity: 'common',
      weight: 100,
      color: '#ff0000',
      effects: [{ type: 'ability-periodic-damage-flat', abilityId: ability.id, value: 5 }],
    };

    expect(buildUpgradeChoices(
      config,
      [boostPeriodic, addPeriodic],
      [ability],
      [],
      {},
      2,
      5,
      () => 0,
    )).toEqual([addPeriodic]);

    const modifiers: AbilityRuntimeModifiers = {};
    addUpgradeEffectToModifiers(modifiers, addPeriodic.effects[0]);

    expect(buildUpgradeChoices(
      config,
      [boostPeriodic, addPeriodic],
      [ability],
      [],
      {},
      2,
      5,
      () => 0,
      modifiers,
    )).toEqual([boostPeriodic]);
  });

  it('hides a manual critical multiplier until that ability has critical chance', () => {
    const config = cloneUpgradeGenerationConfig();
    config.enabled = false;
    const ability: AbilityDefinition = {
      ...fire,
      id: 'manual-crit',
      allowedUpgradeParameters: ['ability-damage-critical-multiplier'],
    };
    const multiplierCard: UpgradeCardDefinition = {
      id: 'crit-multiplier',
      name: 'Множитель крита',
      description: '',
      rarity: 'common',
      weight: 100,
      color: '#ff0000',
      effects: [{ type: 'ability-damage-critical-multiplier', abilityId: ability.id, value: 0.5 }],
    };

    expect(buildUpgradeChoices(
      config,
      [multiplierCard],
      [ability],
      [],
      {},
      1,
      5,
      () => 0,
    )).toEqual([]);

    const modifiers: AbilityRuntimeModifiers = {};
    addUpgradeEffectToModifiers(modifiers, {
      type: 'ability-damage-critical-chance',
      abilityId: ability.id,
      value: 20,
    });

    expect(buildUpgradeChoices(
      config,
      [multiplierCard],
      [ability],
      [],
      {},
      1,
      5,
      () => 0,
      modifiers,
    )).toEqual([multiplierCard]);
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
