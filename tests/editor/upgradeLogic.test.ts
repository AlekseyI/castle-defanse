import { describe, expect, it } from 'vitest';
import type { AbilityDefinition } from '../../src/editor/abilities/types';
import {
  getCompatibleUpgradeEffectTypes,
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
];

const card: UpgradeCardDefinition = {
  id: 'hellfire',
  name: 'Адское пламя',
  description: 'Усиливает Огонь',
  rarity: 'rare',
  weight: 50,
  maxCount: 5,
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

  it('exposes only parameters actually supported by the selected ability', () => {
    const types = getCompatibleUpgradeEffectTypes(abilities[0]);

    expect(types).toContain('ability-damage-percent');
    expect(types).toContain('ability-damage-target-count');
    expect(types).toContain('ability-periodic-damage-percent');
    expect(types).toContain('ability-periodic-duration-percent');
    expect(types).not.toContain('ability-periodic-target-count');
    expect(types).not.toContain('ability-heal-percent');
  });

  it('accepts multiple effects in one card and rejects an incompatible parameter', () => {
    expect(validateUpgradeCard(card, [], abilities).valid).toBe(true);

    const invalid = validateUpgradeCard({
      ...card,
      effects: [{ type: 'ability-heal-percent', abilityId: 'fire', value: 20 }],
    }, [], abilities);

    expect(invalid.valid).toBe(false);
    expect(invalid.errors['effect.0.type']).toBeTruthy();
  });

  it('validates maxCount, weight and existing abilities', () => {
    const result = validateUpgradeCard({
      ...card,
      weight: 0,
      maxCount: 0,
      effects: [{ type: 'ability-damage-percent', abilityId: 'missing', value: 20 }],
    }, [], abilities);

    expect(result.valid).toBe(false);
    expect(result.errors.weight).toBeTruthy();
    expect(result.errors.maxCount).toBeTruthy();
    expect(result.errors['effect.0.abilityId']).toBeTruthy();
  });
});
