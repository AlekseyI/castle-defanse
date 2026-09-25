import { describe, expect, it } from 'vitest';
import { DEFAULT_ABILITIES } from '../../src/editor/abilities/defaultAbilities';
import type { AbilityDefinition } from '../../src/editor/abilities/types';
import { DEFAULT_DAMAGE_SOURCES } from '../../src/editor/damageSources/defaultDamageSources';
import { DEFAULT_UPGRADES } from '../../src/editor/upgrades/defaultUpgrades';
import {
  changeAddedTargetType,
  getCompatibleUpgradeEffectTypes,
  getDefaultUpgradeEffectValue,
  normalizeUpgradeCard,
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

  it('offers the same complete parameter set for every selected ability', () => {
    const fireTypes = getCompatibleUpgradeEffectTypes(abilities[0]);
    const boltTypes = getCompatibleUpgradeEffectTypes(abilities[1]);

    expect(fireTypes).toEqual(boltTypes);
    expect(fireTypes).toContain('ability-damage-percent');
    expect(fireTypes).toContain('ability-periodic-damage-flat');
    expect(fireTypes).toContain('ability-slow-percent');
    expect(fireTypes).toContain('ability-heal-flat');
    expect(fireTypes).toContain('ability-add-damage');
    expect(fireTypes).toContain('ability-add-periodic-damage');
    expect(fireTypes).toContain('ability-add-slow');
    expect(fireTypes).toContain('ability-add-heal');
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

  it('validates direct effect parameters used by the ability editor', () => {
    const result = validateUpgradeCard({
      ...card,
      effects: [
        { type: 'ability-damage-target-type', abilityId: 'fire', value: { type: 'castle', count: 0, areaHeightPercent: 0 } },
        { type: 'ability-damage-source', abilityId: 'fire', value: 'magic' },
        { type: 'ability-periodic-visual-color', abilityId: 'fire', value: '#00ff00' },
      ],
    }, [], abilities, undefined, [{ id: 'magic', name: 'Магия' }]);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('requires dependent parameters for target changes', () => {
    const nearest = validateUpgradeCard({
      ...card,
      effects: [{
        type: 'ability-damage-target-type',
        abilityId: 'fire',
        value: { type: 'nearest-enemies', count: 0, areaHeightPercent: 0 },
      }],
    }, [], abilities);
    const area = validateUpgradeCard({
      ...card,
      effects: [{
        type: 'ability-periodic-target-type',
        abilityId: 'fire',
        value: { type: 'area-enemies', count: 0, areaHeightPercent: 0 },
      }],
    }, [], abilities);

    expect(nearest.valid).toBe(false);
    expect(nearest.errors['effect.0.value']).toBeTruthy();
    expect(area.valid).toBe(false);
    expect(area.errors['effect.0.value']).toBeTruthy();
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
