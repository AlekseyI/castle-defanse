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
});
