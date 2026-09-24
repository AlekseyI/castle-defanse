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

  it('exposes parameters for effects that are not yet present on the selected ability', () => {
    const types = getCompatibleUpgradeEffectTypes(abilities[0]);

    expect(types).toContain('ability-damage-percent');
    expect(types).toContain('ability-damage-target-count');
    expect(types).toContain('ability-damage-critical-multiplier');
    expect(types).toContain('ability-periodic-damage-percent');
    expect(types).toContain('ability-periodic-chance');
    expect(types).toContain('ability-periodic-critical-multiplier');
    expect(types).toContain('ability-periodic-target-count');
    expect(types).toContain('ability-damage-target-type');
    expect(types).toContain('ability-damage-source');
    expect(types).toContain('ability-periodic-area-height');
    expect(types).toContain('ability-periodic-visual-color');
    expect(types).toContain('ability-slow-percent');
    expect(types).toContain('ability-heal-percent');
  });

  it('accepts a card that adds an effect missing from the ability', () => {
    const result = validateUpgradeCard({
      ...card,
      effects: [
        { type: 'ability-heal-flat', abilityId: 'fire', value: 25 },
        { type: 'ability-slow-percent', abilityId: 'fire', value: 15 },
      ],
    }, [], abilities);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('validates direct effect parameters used by the ability editor', () => {
    const result = validateUpgradeCard({
      ...card,
      effects: [
        { type: 'ability-damage-target-type', abilityId: 'fire', value: 'castle' },
        { type: 'ability-damage-source', abilityId: 'fire', value: 'magic' },
        { type: 'ability-periodic-visual-color', abilityId: 'fire', value: '#00ff00' },
      ],
    }, [], abilities, undefined, [{ id: 'magic', name: 'Магия' }]);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
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
