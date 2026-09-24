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
  maxCount: 5,
  effects: [
    { type: 'ability-damage-percent', abilityId: 'fire', value: 20 },
    { type: 'ability-periodic-damage-percent', abilityId: 'fire', value: 15 },
    { type: 'ability-periodic-duration-percent', abilityId: 'fire', value: 10 },
    { type: 'ability-damage-target-count', abilityId: 'fire', value: 1 },
  ],
};

describe('upgradeCalculator', () => {
  it('applies every effect in a card for every selected copy without mutating base ability', () => {
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

  it('applies negative modifiers as penalties while keeping runtime values in valid ranges', () => {
    const cursedCard: UpgradeCardDefinition = {
      ...card,
      id: 'cursed_power',
      effects: [
        { type: 'ability-damage-percent', abilityId: 'fire', value: -50 },
        { type: 'ability-damage-target-count', abilityId: 'fire', value: -1 },
        { type: 'ability-damage-critical-chance', abilityId: 'fire', value: -10 },
        { type: 'ability-periodic-duration-percent', abilityId: 'fire', value: -50 },
        { type: 'ability-periodic-damage-flat', abilityId: 'fire', value: -20 },
      ],
    };

    const modifiers = buildAbilityRuntimeModifiers([cursedCard], { cursed_power: 1 });
    const upgraded = applyAbilityRuntimeModifier(ability, modifiers.fire);
    const damage = upgraded.effects.find((effect) => effect.type === 'damage');
    const periodic = upgraded.effects.find((effect) => effect.type === 'periodic-damage');

    if (damage?.type === 'damage') {
      expect(damage.amount).toBe(25);
      expect(damage.target).toEqual({ type: 'random-enemies', count: 1 });
      expect(damage.criticalChancePercent).toBe(0);
    }

    if (periodic?.type === 'periodic-damage') {
      expect(periodic.amount).toBe(0);
      expect(periodic.duration).toBe(2);
    }
  });

  it('adds a missing periodic damage effect using values from the upgrade card', () => {
    const damageOnlyAbility: AbilityDefinition = {
      ...ability,
      effects: [ability.effects[0]],
    };
    const addPeriodicCard: UpgradeCardDefinition = {
      ...card,
      id: 'ignite',
      effects: [
        { type: 'ability-periodic-damage-flat', abilityId: 'fire', value: 12 },
        { type: 'ability-periodic-duration-flat', abilityId: 'fire', value: 3 },
        { type: 'ability-periodic-chance', abilityId: 'fire', value: 40 },
        { type: 'ability-periodic-critical-chance', abilityId: 'fire', value: 10 },
        { type: 'ability-periodic-critical-multiplier', abilityId: 'fire', value: 0.5 },
        { type: 'ability-periodic-target-type', abilityId: 'fire', value: 'area-enemies' },
        { type: 'ability-periodic-area-height', abilityId: 'fire', value: 20 },
        { type: 'ability-periodic-visual-color', abilityId: 'fire', value: '#00ff00' },
      ],
    };

    const modifiers = buildAbilityRuntimeModifiers([addPeriodicCard], { ignite: 1 });
    const upgraded = applyAbilityRuntimeModifier(damageOnlyAbility, modifiers.fire);
    const periodic = upgraded.effects.find((effect) => effect.type === 'periodic-damage');

    expect(periodic).toBeTruthy();
    if (periodic?.type === 'periodic-damage') {
      expect(periodic.amount).toBe(12);
      expect(periodic.duration).toBe(3);
      expect(periodic.chancePercent).toBe(40);
      expect(periodic.criticalChancePercent).toBe(10);
      expect(periodic.criticalMultiplier).toBe(2);
      expect(periodic.visualColor).toBe('#00ff00');
      expect(periodic.target).toEqual({ type: 'area-enemies', areaHeightPercent: 70 });
    }

    expect(damageOnlyAbility.effects).toHaveLength(1);
  });

  it('applies the direct ability parameters exposed by upgrade cards', () => {
    const directCard: UpgradeCardDefinition = {
      ...card,
      id: 'direct_parameters',
      effects: [
        { type: 'ability-damage-target-type', abilityId: 'fire', value: 'area-enemies' },
        { type: 'ability-damage-area-height', abilityId: 'fire', value: 20 },
        { type: 'ability-damage-source', abilityId: 'fire', value: 'magic' },
        { type: 'ability-damage-critical-multiplier', abilityId: 'fire', value: 0.5 },
        { type: 'ability-periodic-target-type', abilityId: 'fire', value: 'random-enemies' },
        { type: 'ability-periodic-target-count', abilityId: 'fire', value: 1 },
        { type: 'ability-periodic-visual-color', abilityId: 'fire', value: '#00ff00' },
      ],
    };

    const modifiers = buildAbilityRuntimeModifiers([directCard], { direct_parameters: 1 });
    const upgraded = applyAbilityRuntimeModifier(ability, modifiers.fire);
    const damage = upgraded.effects.find((effect) => effect.type === 'damage');
    const periodic = upgraded.effects.find((effect) => effect.type === 'periodic-damage');

    if (damage?.type === 'damage') {
      expect(damage.target).toEqual({ type: 'area-enemies', areaHeightPercent: 70 });
      expect(damage.damageSourceId).toBe('magic');
      expect(damage.criticalMultiplier).toBe(2);
    }

    if (periodic?.type === 'periodic-damage') {
      expect(periodic.target).toEqual({ type: 'random-enemies', count: 2 });
      expect(periodic.visualColor).toBe('#00ff00');
    }
  });

  it('adds missing slow and heal effects with card values', () => {
    const damageOnlyAbility: AbilityDefinition = {
      ...ability,
      effects: [ability.effects[0]],
    };
    const addEffectsCard: UpgradeCardDefinition = {
      ...card,
      id: 'control_and_heal',
      effects: [
        { type: 'ability-slow-percent', abilityId: 'fire', value: 25 },
        { type: 'ability-slow-duration-flat', abilityId: 'fire', value: 2 },
        { type: 'ability-heal-flat', abilityId: 'fire', value: 15 },
      ],
    };

    const modifiers = buildAbilityRuntimeModifiers([addEffectsCard], { control_and_heal: 1 });
    const upgraded = applyAbilityRuntimeModifier(damageOnlyAbility, modifiers.fire);
    const slow = upgraded.effects.find((effect) => effect.type === 'slow');
    const heal = upgraded.effects.find((effect) => effect.type === 'heal');

    expect(slow).toBeTruthy();
    if (slow?.type === 'slow') {
      expect(slow.slowPercent).toBe(25);
      expect(slow.duration).toBe(2);
      expect(slow.target).toEqual({ type: 'all-enemies' });
    }

    expect(heal).toBeTruthy();
    if (heal?.type === 'heal') {
      expect(heal.amount).toBe(15);
      expect(heal.target).toEqual({ type: 'castle' });
    }
  });

});
