import { describe, expect, it } from 'vitest';
import { DEFAULT_ABILITIES } from '../../../src/editor/abilities/defaultAbilities';
import type { AbilityDefinition } from '../../../src/editor/abilities/types';
import { DEFAULT_UPGRADES } from '../../../src/editor/upgrades/defaultUpgrades';
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

  it('creates a missing effect from regular parameters and accumulates its cards', () => {
    const damageOnlyAbility: AbilityDefinition = {
      ...ability,
      effects: [ability.effects[0]],
    };
    const periodicCards: UpgradeCardDefinition[] = [
      {
        ...card,
        id: 'periodic_damage',
        effects: [{ type: 'ability-periodic-damage-flat', abilityId: 'fire', value: 20 }],
      },
      {
        ...card,
        id: 'periodic_duration',
        effects: [{ type: 'ability-periodic-duration-flat', abilityId: 'fire', value: 3 }],
      },
      {
        ...card,
        id: 'periodic_chance',
        effects: [{ type: 'ability-periodic-chance', abilityId: 'fire', value: 40 }],
      },
    ];

    const modifiers = buildAbilityRuntimeModifiers(periodicCards, {
      periodic_damage: 1,
      periodic_duration: 1,
      periodic_chance: 1,
    });
    const upgraded = applyAbilityRuntimeModifier(damageOnlyAbility, modifiers.fire);
    const periodic = upgraded.effects.find((effect) => effect.type === 'periodic-damage');

    expect(periodic).toEqual({
      type: 'periodic-damage',
      chancePercent: 40,
      amount: 20,
      duration: 3,
      criticalChancePercent: 0,
      criticalMultiplier: 0,
      visualColor: '#ff0000',
      target: { type: 'nearest-enemies', count: 1 },
    });
  });

  it('uses target card values as exact configuration and keeps target bonuses additive', () => {
    const targetCard: UpgradeCardDefinition = {
      ...card,
      id: 'retarget',
      effects: [
        {
          type: 'ability-damage-target-type',
          abilityId: 'fire',
          value: { type: 'nearest-enemies', count: 3, areaHeightPercent: 0 },
        },
        { type: 'ability-damage-target-count', abilityId: 'fire', value: 2 },
        {
          type: 'ability-periodic-target-type',
          abilityId: 'fire',
          value: { type: 'area-enemies', count: 0, areaHeightPercent: 30 },
        },
        { type: 'ability-periodic-area-height', abilityId: 'fire', value: 10 },
      ],
    };

    const modifiers = buildAbilityRuntimeModifiers([targetCard], { retarget: 1 });
    const upgraded = applyAbilityRuntimeModifier(ability, modifiers.fire);
    const damage = upgraded.effects.find((effect) => effect.type === 'damage');
    const periodic = upgraded.effects.find((effect) => effect.type === 'periodic-damage');

    expect(damage?.target).toEqual({ type: 'nearest-enemies', count: 5 });
    expect(periodic?.target).toEqual({ type: 'area-enemies', areaHeightPercent: 40 });
  });

  it('improves effects that were introduced by other default cards', () => {
    const byId = new Map(DEFAULT_UPGRADES.map((item) => [item.id, item]));

    const ice = DEFAULT_ABILITIES.find((item) => item.id === 'ice');
    const lightning = DEFAULT_ABILITIES.find((item) => item.id === 'lightning');
    const fire = DEFAULT_ABILITIES.find((item) => item.id === 'fire');
    const shield = DEFAULT_ABILITIES.find((item) => item.id === 'shield');
    if (!ice || !lightning || !fire || !shield) throw new Error('Expected default abilities.');

    const selectedIds = [
      'add_damage_small',
      'ice_added_damage_boost',
      'ice_added_damage_critical',
      'ice_added_damage_targets',
      'add_periodic_small',
      'lightning_added_periodic_boost',
      'lightning_added_periodic_critical',
      'lightning_added_periodic_targets',
      'add_slow_small',
      'fire_added_slow_boost',
      'fire_added_slow_targets',
      'add_heal_small',
      'fire_added_heal_boost',
      'add_damage_max',
      'shield_added_damage_boost',
    ];
    const selectedCards = selectedIds.map((id) => {
      const item = byId.get(id);
      if (!item) throw new Error(`Expected default upgrade ${id}.`);
      return item;
    });
    const counts = Object.fromEntries(selectedIds.map((id) => [id, 1]));
    const modifiers = buildAbilityRuntimeModifiers(selectedCards, counts);

    const upgradedIce = applyAbilityRuntimeModifier(ice, modifiers.ice);
    const iceDamage = upgradedIce.effects.find((effect) => effect.type === 'damage');
    expect(iceDamage).toEqual({
      type: 'damage',
      amount: 9.25,
      damageSourceId: 'ice',
      criticalChancePercent: 20,
      criticalMultiplier: 1,
      target: { type: 'nearest-enemies', count: 2 },
    });

    const upgradedLightning = applyAbilityRuntimeModifier(lightning, modifiers.lightning);
    const lightningPeriodic = upgradedLightning.effects.find((effect) => effect.type === 'periodic-damage');
    expect(lightningPeriodic).toEqual({
      type: 'periodic-damage',
      chancePercent: 30,
      amount: 5,
      duration: 2.5,
      criticalChancePercent: 20,
      criticalMultiplier: 1,
      visualColor: '#000000',
      target: { type: 'nearest-enemies', count: 2 },
    });

    const upgradedFire = applyAbilityRuntimeModifier(fire, modifiers.fire);
    const fireSlow = upgradedFire.effects.find((effect) => effect.type === 'slow');
    const fireHeal = upgradedFire.effects.find((effect) => effect.type === 'heal');
    expect(fireSlow).toEqual({
      type: 'slow',
      slowPercent: 11,
      duration: 1.5,
      target: { type: 'nearest-enemies', count: 3 },
    });
    expect(fireHeal).toEqual({
      type: 'heal',
      amount: 6.25,
      target: { type: 'castle' },
    });

    const upgradedShield = applyAbilityRuntimeModifier(shield, modifiers.shield);
    const shieldDamage = upgradedShield.effects.find((effect) => effect.type === 'damage');
    expect(shieldDamage).toEqual({
      type: 'damage',
      amount: 250,
      damageSourceId: 'fire',
      criticalChancePercent: 100,
      criticalMultiplier: 3,
      target: { type: 'area-enemies', areaHeightPercent: 100 },
    });
  });

});
