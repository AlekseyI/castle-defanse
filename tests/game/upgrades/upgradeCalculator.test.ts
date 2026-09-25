import { describe, expect, it } from 'vitest';
import type { AbilityDefinition } from '../../../src/editor/abilities/types';
import type { UpgradeCardDefinition } from '../../../src/editor/upgrades/types';
import {
  applyAbilityRuntimeModifier,
  buildAbilityRuntimeModifiers,
} from '../../../src/game/upgrades/upgradeCalculator';

const ability: AbilityDefinition = {
  id: 'fire',
  name: 'Огонь',
  visualEffect: 'fire',
  color: '#ff0000',
  effects: [
    {
      type: 'damage',
      amount: 50,
      damageSourceId: 'fire',
      criticalChancePercent: 5,
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
};

const card: UpgradeCardDefinition = {
  id: 'hellfire',
  name: 'Адское пламя',
  description: '',
  rarity: 'rare',
  weight: 100,
  effects: [
    { type: 'ability-damage-percent', abilityId: 'fire', value: 20 },
    { type: 'ability-periodic-damage-percent', abilityId: 'fire', value: 15 },
    { type: 'ability-periodic-duration-percent', abilityId: 'fire', value: 10 },
    { type: 'ability-damage-target-count', abilityId: 'fire', value: 1 },
  ],
};

describe('upgradeCalculator', () => {
  it('applies every modifier in a card for every selected copy without mutating base ability', () => {
    const modifiers = buildAbilityRuntimeModifiers([card], { hellfire: 2 });
    const upgraded = applyAbilityRuntimeModifier(ability, modifiers.fire);
    const damage = upgraded.effects[0];
    const periodic = upgraded.effects[1];

    expect(damage.type).toBe('damage');
    if (damage.type === 'damage') {
      expect(damage.amount).toBe(70);
      expect(damage.target).toEqual({ type: 'random-enemies', count: 4 });
    }

    expect(periodic.type).toBe('periodic-damage');
    if (periodic.type === 'periodic-damage') {
      expect(periodic.amount).toBe(13);
      expect(periodic.duration).toBeCloseTo(4.8);
      expect(periodic.target).toEqual({ type: 'all-enemies' });
    }

    expect(ability.effects[0]).toMatchObject({ amount: 50, target: { type: 'random-enemies', count: 2 } });
    expect(ability.effects[1]).toMatchObject({ amount: 10, duration: 4 });
  });

  it('adds a periodic effect with exactly the parameters stored in the card', () => {
    const damageOnlyAbility: AbilityDefinition = {
      ...ability,
      effects: [ability.effects[0]],
    };
    const addPeriodicCard: UpgradeCardDefinition = {
      ...card,
      id: 'ignite',
      effects: [{
        type: 'ability-add-periodic-damage',
        abilityId: 'fire',
        value: {
          chancePercent: 40,
          amount: 12,
          duration: 3,
          criticalChancePercent: 10,
          criticalMultiplier: 2,
          visualColor: '#00ff00',
          target: { type: 'area-enemies', count: 0, areaHeightPercent: 70 },
        },
      }],
    };

    const modifiers = buildAbilityRuntimeModifiers([addPeriodicCard], { ignite: 1 });
    const upgraded = applyAbilityRuntimeModifier(damageOnlyAbility, modifiers.fire);
    const periodic = upgraded.effects.find((effect) => effect.type === 'periodic-damage');

    expect(periodic).toEqual({
      type: 'periodic-damage',
      chancePercent: 40,
      amount: 12,
      duration: 3,
      criticalChancePercent: 10,
      criticalMultiplier: 2,
      visualColor: '#00ff00',
      target: { type: 'area-enemies', areaHeightPercent: 70 },
    });
    expect(damageOnlyAbility.effects).toHaveLength(1);
  });

  it('keeps explicit zero values when a new effect is added', () => {
    const base: AbilityDefinition = {
      id: 'bolt',
      name: 'Разряд',
      visualEffect: 'lightning',
      color: '#00aaff',
      effects: [],
    };
    const zeroCard: UpgradeCardDefinition = {
      id: 'zero_periodic',
      name: 'Пустой периодический эффект',
      description: '',
      rarity: 'common',
      weight: 1,
      effects: [{
        type: 'ability-add-periodic-damage',
        abilityId: 'bolt',
        value: {
          chancePercent: 0,
          amount: 0,
          duration: 0,
          criticalChancePercent: 0,
          criticalMultiplier: 0,
          visualColor: '#000000',
          target: { type: 'nearest-enemies', count: 0, areaHeightPercent: 0 },
        },
      }],
    };

    const modifiers = buildAbilityRuntimeModifiers([zeroCard], { zero_periodic: 1 });
    const upgraded = applyAbilityRuntimeModifier(base, modifiers.bolt);

    expect(upgraded.effects).toEqual([{
      type: 'periodic-damage',
      chancePercent: 0,
      amount: 0,
      duration: 0,
      criticalChancePercent: 0,
      criticalMultiplier: 0,
      visualColor: '#000000',
      target: { type: 'nearest-enemies', count: 0 },
    }]);
  });

  it('adds damage, slow and heal effects from add-effect cards', () => {
    const base: AbilityDefinition = {
      id: 'utility',
      name: 'Утилита',
      visualEffect: 'none',
      color: '#ffffff',
      effects: [],
    };
    const addEffectsCard: UpgradeCardDefinition = {
      id: 'all_added',
      name: 'Новые эффекты',
      description: '',
      rarity: 'legendary',
      weight: 1,
      effects: [
        {
          type: 'ability-add-damage',
          abilityId: 'utility',
          value: {
            amount: 25,
            damageSourceId: 'magic',
            criticalChancePercent: 20,
            criticalMultiplier: 2.5,
            target: { type: 'random-enemies', count: 4, areaHeightPercent: 0 },
          },
        },
        {
          type: 'ability-add-slow',
          abilityId: 'utility',
          value: {
            slowPercent: 35,
            duration: 2.5,
            target: { type: 'all-enemies', count: 0, areaHeightPercent: 0 },
          },
        },
        {
          type: 'ability-add-heal',
          abilityId: 'utility',
          value: {
            amount: 18,
            target: { type: 'castle', count: 0, areaHeightPercent: 0 },
          },
        },
      ],
    };

    const modifiers = buildAbilityRuntimeModifiers([addEffectsCard], { all_added: 1 });
    const upgraded = applyAbilityRuntimeModifier(base, modifiers.utility);

    expect(upgraded.effects).toEqual([
      {
        type: 'damage',
        amount: 25,
        damageSourceId: 'magic',
        criticalChancePercent: 20,
        criticalMultiplier: 2.5,
        target: { type: 'random-enemies', count: 4 },
      },
      {
        type: 'slow',
        slowPercent: 35,
        duration: 2.5,
        target: { type: 'all-enemies' },
      },
      {
        type: 'heal',
        amount: 18,
        target: { type: 'castle' },
      },
    ]);
  });

  it('does not create a missing effect from a regular modifier', () => {
    const damageOnlyAbility: AbilityDefinition = {
      ...ability,
      effects: [ability.effects[0]],
    };
    const invalidRuntimeCard: UpgradeCardDefinition = {
      ...card,
      id: 'periodic_modifier_without_add',
      effects: [{ type: 'ability-periodic-damage-flat', abilityId: 'fire', value: 20 }],
    };

    const modifiers = buildAbilityRuntimeModifiers([invalidRuntimeCard], { periodic_modifier_without_add: 1 });
    const upgraded = applyAbilityRuntimeModifier(damageOnlyAbility, modifiers.fire);

    expect(upgraded.effects).toHaveLength(1);
    expect(upgraded.effects[0].type).toBe('damage');
  });
});
