import { describe, expect, it } from 'vitest';
import { UPGRADE_EFFECT_TYPES } from '../../src/editor/upgrades/types';
import { DEFAULT_ABILITIES } from '../../src/editor/abilities/defaultAbilities';
import type { AbilityDefinition } from '../../src/editor/abilities/types';
import { DEFAULT_DAMAGE_SOURCES } from '../../src/editor/damageSources/defaultDamageSources';
import { DEFAULT_UPGRADES } from '../../src/editor/upgrades/defaultUpgrades';
import {
  calculateUpgradeCardChancePercent,
  changeAddedTargetType,
  getCompatibleUpgradeEffectTypes,
  getDefaultUpgradeEffectValue,
  getGeneratableUpgradeEffectTypes,
  getGroupedUpgradeEffectOptions,
  normalizeUpgradeCard,
  removeUpgradeParametersFromCards,
  validateUpgradeCard,
} from '../../src/editor/upgrades/upgradeLogic';
import type { UpgradeCardDefinition } from '../../src/editor/upgrades/types';

const abilities: AbilityDefinition[] = [
  {
    id: 'fire',
    name: 'Огонь',
    effects: [
      {
        type: 'damage',
        amount: 50,
        damageSourceId: 'fire',
        criticalChancePercent: 0,
        criticalMultiplier: 1.5,
        target: { type: 'random-enemies', count: 2 },
      },
      {
        type: 'periodic-damage',
        chancePercent: 100,
        amount: 10,
        duration: 4,
        criticalChancePercent: 0,
        criticalMultiplier: 1.5,
        visualColor: '#ff0000',
        target: { type: 'all-enemies' },
      },
    ],
    allowedUpgradeParameters: [...UPGRADE_EFFECT_TYPES],
    visualEffect: 'fire',
    color: '#ff0000',
  },
  {
    id: 'bolt',
    name: 'Разряд',
    effects: [
      {
        type: 'damage',
        amount: 30,
        damageSourceId: 'magic',
        criticalChancePercent: 0,
        criticalMultiplier: 1.5,
        target: { type: 'nearest-enemies', count: 1 },
      },
    ],
    allowedUpgradeParameters: [...UPGRADE_EFFECT_TYPES],
    visualEffect: 'lightning',
    color: '#00aaff',
  },
];

const card: UpgradeCardDefinition = {
  id: 'hellfire',
  name: 'Адское пламя',
  description: 'Усиливает Огонь',
  rarity: 'rare',
  weight: 50,
  color: '#AA3300',
  effects: [
    { type: 'ability-damage-percent', abilityId: 'fire', value: 20 },
    { type: 'ability-periodic-damage-percent', abilityId: 'fire', value: 15 },
  ],
};

describe('upgradeLogic', () => {
  it('normalizes card metadata and every effect ability id', () => {
    expect(normalizeUpgradeCard({
      ...card,
      id: '  HELLFIRE  ',
      name: '  Адское пламя  ',
      description: '  Усиливает Огонь  ',
      effects: [{ type: 'ability-damage-percent', abilityId: ' FIRE ', value: 20 }],
    })).toEqual({
      ...card,
      id: 'hellfire',
      name: 'Адское пламя',
      description: 'Усиливает Огонь',
      color: '#aa3300',
      effects: [{ type: 'ability-damage-percent', abilityId: 'fire', value: 20 }],
    });
  });

  it('offers only parameters explicitly allowed by the selected ability', () => {
    const restrictedAbility: AbilityDefinition = {
      ...abilities[0],
      allowedUpgradeParameters: ['ability-damage-percent', 'ability-add-slow'],
    };

    expect(getCompatibleUpgradeEffectTypes(restrictedAbility)).toEqual([
      'ability-damage-percent',
      'ability-add-slow',
    ]);
  });

  it('groups upgrade parameters by their ability effect', () => {
    const groups = getGroupedUpgradeEffectOptions();

    expect(groups.map((group) => group.label)).toEqual([
      'Основной урон',
      'Периодический урон',
      'Замедление',
      'Лечение',
    ]);
    expect(groups.find((group) => group.abilityEffectType === 'slow')?.options.map((option) => option.type)).toEqual([
      'ability-add-slow',
      'ability-slow-percent',
      'ability-slow-target-type',
      'ability-slow-target-count',
      'ability-slow-area-height',
      'ability-slow-duration-percent',
      'ability-slow-duration-flat',
    ]);
  });

  it('keeps only requested parameters and removes empty groups', () => {
    const groups = getGroupedUpgradeEffectOptions([
      'ability-damage-percent',
      'ability-add-slow',
      'ability-slow-area-height',
    ]);

    expect(groups.map((group) => ({
      label: group.label,
      types: group.options.map((option) => option.type),
    }))).toEqual([
      { label: 'Основной урон', types: ['ability-damage-percent'] },
      { label: 'Замедление', types: ['ability-add-slow', 'ability-slow-area-height'] },
    ]);
  });

  it('omits parameters from the generator editor when every ability excludes them', () => {
    const withoutTargetTypes = abilities.map((ability) => ({
      ...ability,
      allowedUpgradeParameters: ability.allowedUpgradeParameters.filter((type) => (
        type !== 'ability-damage-target-type' &&
        type !== 'ability-periodic-target-type' &&
        type !== 'ability-slow-target-type'
      )),
    }));

    const visibleTypes = getGeneratableUpgradeEffectTypes(withoutTargetTypes);

    expect(visibleTypes).not.toContain('ability-damage-target-type');
    expect(visibleTypes).not.toContain('ability-periodic-target-type');
    expect(visibleTypes).not.toContain('ability-slow-target-type');
    expect(visibleTypes).toContain('ability-damage-percent');
  });

  it('hides a parameter when it is allowed only on abilities that cannot generate it', () => {
    const slowAbility: AbilityDefinition = {
      id: 'ice',
      name: 'Лёд',
      effects: [{ type: 'slow', slowPercent: 30, duration: 3, target: { type: 'all-enemies' } }],
      allowedUpgradeParameters: [],
      visualEffect: 'ice',
      color: '#00aaff',
    };

    const visibleTypes = getGeneratableUpgradeEffectTypes([slowAbility, ...abilities]);

    expect(visibleTypes).not.toContain('ability-slow-duration-flat');
  });

  it('keeps a parameter visible in the generator editor when at least one ability allows it', () => {
    const targetType = 'ability-damage-target-type' as const;
    const mixedAbilities = abilities.map((ability, index) => ({
      ...ability,
      allowedUpgradeParameters: index === 0
        ? ability.allowedUpgradeParameters
        : ability.allowedUpgradeParameters.filter((type) => type !== targetType),
    }));

    expect(getGeneratableUpgradeEffectTypes(mixedAbilities)).toContain(targetType);
  });

  it('rejects a parameter that is not allowed for the selected ability', () => {
    const restrictedAbility: AbilityDefinition = {
      ...abilities[0],
      allowedUpgradeParameters: ['ability-damage-percent'],
    };
    const result = validateUpgradeCard({
      ...card,
      effects: [{ type: 'ability-heal-flat', abilityId: 'fire', value: 5 }],
    }, [], [restrictedAbility, abilities[1]]);

    expect(result.valid).toBe(false);
    expect(result.errors['effect.0.type']).toBeTruthy();
  });

  it('removes disabled parameters from cards and deletes cards left without effects', () => {
    const result = removeUpgradeParametersFromCards([
      card,
      {
        ...card,
        id: 'only_crit',
        effects: [{ type: 'ability-damage-critical-chance', abilityId: 'fire', value: 5 }],
      },
      {
        ...card,
        id: 'mixed',
        effects: [
          { type: 'ability-damage-critical-chance', abilityId: 'fire', value: 5 },
          { type: 'ability-damage-percent', abilityId: 'bolt', value: 10 },
        ],
      },
    ], 'fire', ['ability-damage-critical-chance']);

    expect(result.changedCardCount).toBe(1);
    expect(result.deletedCardCount).toBe(1);
    expect(result.cards.map((item) => item.id)).toEqual(['hellfire', 'mixed']);
    expect(result.cards[1].effects).toEqual([
      { type: 'ability-damage-percent', abilityId: 'bolt', value: 10 },
    ]);
  });

  it('calculates informational chance from the current card weight and total pool weight', () => {
    const cards: UpgradeCardDefinition[] = [
      { ...card, id: 'a', weight: 100 },
      { ...card, id: 'b', weight: 60 },
      { ...card, id: 'c', weight: 40 },
    ];

    expect(calculateUpgradeCardChancePercent(cards[0], cards, 'a')).toBeCloseTo(50);
    expect(calculateUpgradeCardChancePercent({ ...cards[0], weight: 120 }, cards, 'a')).toBeCloseTo(120 / 220 * 100);
  });

  it('creates every added effect with explicit usable target defaults', () => {
    expect(getDefaultUpgradeEffectValue('ability-add-damage', abilities[1])).toEqual({
      amount: 0,
      damageSourceId: '',
      criticalChancePercent: 0,
      criticalMultiplier: 0,
      target: { type: 'nearest-enemies', count: 1, areaHeightPercent: 0 },
    });
    expect(getDefaultUpgradeEffectValue('ability-add-periodic-damage', abilities[1])).toEqual({
      chancePercent: 0,
      amount: 0,
      duration: 0,
      criticalChancePercent: 0,
      criticalMultiplier: 0,
      visualColor: '#000000',
      target: { type: 'nearest-enemies', count: 1, areaHeightPercent: 0 },
    });
    expect(getDefaultUpgradeEffectValue('ability-add-slow', abilities[1])).toEqual({
      slowPercent: 0,
      duration: 0,
      target: { type: 'all-enemies', count: 0, areaHeightPercent: 0 },
    });
    expect(getDefaultUpgradeEffectValue('ability-add-heal', abilities[1])).toEqual({
      amount: 0,
      target: { type: 'castle', count: 0, areaHeightPercent: 0 },
    });
  });

  it('clears target parameters that become hidden after changing the target type', () => {
    const periodic = getDefaultUpgradeEffectValue('ability-add-periodic-damage', abilities[1]);
    if (typeof periodic !== 'object' || !('target' in periodic)) throw new Error('Expected added periodic effect value.');

    const withCount = {
      ...periodic,
      target: { ...periodic.target, count: 3, areaHeightPercent: 40 },
    };
    const allEnemies = changeAddedTargetType(withCount, 'all-enemies');

    expect(allEnemies.target).toEqual({
      type: 'all-enemies',
      count: 0,
      areaHeightPercent: 0,
    });
  });

  it('accepts a card that explicitly adds effects missing from the ability', () => {
    const result = validateUpgradeCard({
      ...card,
      effects: [
        {
          type: 'ability-add-heal',
          abilityId: 'fire',
          value: {
            amount: 25,
            target: { type: 'castle', count: 0, areaHeightPercent: 0 },
          },
        },
        {
          type: 'ability-add-slow',
          abilityId: 'fire',
          value: {
            slowPercent: 15,
            duration: 0,
            target: { type: 'all-enemies', count: 0, areaHeightPercent: 0 },
          },
        },
      ],
    }, [], abilities);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('allows any supported parameter even when the ability does not have that effect yet', () => {
    const result = validateUpgradeCard({
      ...card,
      effects: [
        { type: 'ability-periodic-damage-flat', abilityId: 'bolt', value: 20 },
        { type: 'ability-slow-percent', abilityId: 'bolt', value: 15 },
        { type: 'ability-heal-flat', abilityId: 'bolt', value: 5 },
      ],
    }, [], abilities);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('validates direct source and color parameters used by the ability editor', () => {
    const result = validateUpgradeCard({
      ...card,
      effects: [
        { type: 'ability-damage-source', abilityId: 'fire', value: 'magic' },
        { type: 'ability-periodic-visual-color', abilityId: 'fire', value: '#00ff00' },
      ],
    }, [], abilities, undefined, [{ id: 'magic', name: 'Магия' }]);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('allows target type modifiers only when enabled in the ability settings', () => {
    expect(getCompatibleUpgradeEffectTypes(abilities[0])).toContain('ability-damage-target-type');

    const enabledResult = validateUpgradeCard({
      ...card,
      effects: [{
        type: 'ability-damage-target-type',
        abilityId: 'fire',
        value: { type: 'castle', count: 0, areaHeightPercent: 0 },
      }],
    }, [], abilities);
    expect(enabledResult.valid).toBe(true);

    const restrictedAbility: AbilityDefinition = {
      ...abilities[0],
      allowedUpgradeParameters: abilities[0].allowedUpgradeParameters.filter(
        (type) => type !== 'ability-damage-target-type',
      ),
    };
    expect(getCompatibleUpgradeEffectTypes(restrictedAbility)).not.toContain('ability-damage-target-type');

    const disabledResult = validateUpgradeCard({
      ...card,
      effects: [{
        type: 'ability-damage-target-type',
        abilityId: 'fire',
        value: { type: 'castle', count: 0, areaHeightPercent: 0 },
      }],
    }, [], [restrictedAbility, abilities[1]]);
    expect(disabledResult.valid).toBe(false);
    expect(disabledResult.errors['effect.0.type']).toBeTruthy();
  });

  it('accepts negative numeric modifiers for trade-off cards', () => {
    const result = validateUpgradeCard({
      ...card,
      effects: [
        { type: 'ability-damage-percent', abilityId: 'fire', value: -35 },
        { type: 'ability-damage-target-count', abilityId: 'fire', value: -1 },
        { type: 'ability-periodic-critical-multiplier', abilityId: 'fire', value: -0.25 },
        { type: 'ability-periodic-duration-flat', abilityId: 'fire', value: -1.5 },
      ],
    }, [], abilities);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('validates weight and existing abilities', () => {
    const result = validateUpgradeCard({
      ...card,
      weight: 0,
      effects: [{ type: 'ability-damage-percent', abilityId: 'missing', value: 20 }],
    }, [], abilities);

    expect(result.valid).toBe(false);
    expect(result.errors.weight).toBeTruthy();
    expect(result.errors['effect.0.abilityId']).toBeTruthy();
  });


  it('does not silently replace a zero critical multiplier when critical chance is enabled', () => {
    const abilitiesWithoutBoltDamage: AbilityDefinition[] = abilities.map((ability) => (
      ability.id === 'bolt'
        ? { ...ability, effects: ability.effects.filter((effect) => effect.type !== 'damage') }
        : ability
    ));

    const damageResult = validateUpgradeCard({
      ...card,
      effects: [{
        type: 'ability-add-damage',
        abilityId: 'bolt',
        value: {
          amount: 10,
          damageSourceId: 'magic',
          criticalChancePercent: 25,
          criticalMultiplier: 0,
          target: { type: 'nearest-enemies', count: 1, areaHeightPercent: 0 },
        },
      }],
    }, [], abilitiesWithoutBoltDamage, undefined, [{ id: 'magic', name: 'Магия' }]);

    const periodicResult = validateUpgradeCard({
      ...card,
      effects: [{
        type: 'ability-add-periodic-damage',
        abilityId: 'bolt',
        value: {
          chancePercent: 100,
          amount: 10,
          duration: 2,
          criticalChancePercent: 25,
          criticalMultiplier: 0,
          visualColor: '#000000',
          target: { type: 'nearest-enemies', count: 1, areaHeightPercent: 0 },
        },
      }],
    }, [], abilities);

    expect(damageResult.valid).toBe(false);
    expect(damageResult.errors['effect.0.value']).toBeTruthy();
    expect(periodicResult.valid).toBe(false);
    expect(periodicResult.errors['effect.0.value']).toBeTruthy();
  });

  it('requires an explicit visual color for a newly added periodic effect', () => {
    const result = validateUpgradeCard({
      ...card,
      effects: [{
        type: 'ability-add-periodic-damage',
        abilityId: 'bolt',
        value: {
          chancePercent: 0,
          amount: 0,
          duration: 0,
          criticalChancePercent: 0,
          criticalMultiplier: 0,
          visualColor: '',
          target: { type: 'nearest-enemies', count: 0, areaHeightPercent: 0 },
        },
      }],
    }, [], abilities);

    expect(result.valid).toBe(false);
    expect(result.errors['effect.0.visualColor']).toBeTruthy();
  });
  it('ships valid sample cards across every rarity and weight range', () => {
    expect(new Set(DEFAULT_UPGRADES.map((item) => item.rarity))).toEqual(new Set(['common', 'rare', 'epic', 'legendary']));
    expect(new Set(DEFAULT_UPGRADES.map((item) => item.weight)).size).toBeGreaterThan(4);

    for (const sample of DEFAULT_UPGRADES) {
      const result = validateUpgradeCard(sample, DEFAULT_UPGRADES, DEFAULT_ABILITIES, sample.id, DEFAULT_DAMAGE_SOURCES);
      expect(result.errors).toEqual({});
    }
  });

});
