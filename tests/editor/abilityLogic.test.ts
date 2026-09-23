import { describe, expect, it } from 'vitest';
import {
  changeAbilityEffectTarget,
  changeAbilityEffectTypes,
  createEmptyAbility,
  getAllowedTargets,
  normalizeAbility,
  validateAbility,
} from '../../src/editor/abilities/abilityLogic';
import type { AbilityDefinition } from '../../src/editor/abilities/types';
import type { DamageSource } from '../../src/editor/damageSources/types';

const damageSources: DamageSource[] = [
  { id: 'fire', name: 'Огонь' },
  { id: 'lightning', name: 'Молния' },
];

const fireAbility: AbilityDefinition = {
  id: 'fire',
  name: 'Огонь',
  effects: [{
    type: 'damage',
    amount: 55,
    damageSourceId: 'fire',
    criticalChancePercent: 0,
    criticalMultiplier: 1.5,
    target: { type: 'nearest-enemies', count: 4 },
  }],
  visualEffect: 'fire',
  color: '#e9573f',
};

describe('abilityLogic', () => {
  it('creates a damage ability with an independent target and no visual effect by default', () => {
    expect(createEmptyAbility(damageSources)).toEqual({
      id: '',
      name: '',
      effects: [{
        type: 'damage',
        amount: 0,
        damageSourceId: 'fire',
        criticalChancePercent: 0,
        criticalMultiplier: 1.5,
        target: { type: 'nearest-enemies', count: 1 },
      }],
      visualEffect: 'none',
      color: '#64748b',
    });
  });

  it('adds another effect with its own default target without changing the visual effect', () => {
    expect(changeAbilityEffectTypes(fireAbility, ['damage', 'slow'], damageSources)).toEqual({
      ...fireAbility,
      effects: [
        {
          type: 'damage',
          amount: 55,
          damageSourceId: 'fire',
          criticalChancePercent: 0,
          criticalMultiplier: 1.5,
          target: { type: 'nearest-enemies', count: 4 },
        },
        {
          type: 'slow',
          slowPercent: 0,
          duration: 0,
          target: { type: 'all-enemies' },
        },
      ],
    });
  });

  it('adds periodic damage with chance, damage and duration defaults', () => {
    const changed = changeAbilityEffectTypes(fireAbility, ['damage', 'periodic-damage'], damageSources);

    expect(changed.effects[1]).toEqual({
      type: 'periodic-damage',
      chancePercent: 100,
      amount: 0,
      duration: 1,
      criticalChancePercent: 0,
      criticalMultiplier: 1.5,
      visualColor: '#e9573f',
      target: { type: 'nearest-enemies', count: 1 },
    });
  });

  it('keeps the selected visual when damage is added to an ice ability', () => {
    const iceAbility: AbilityDefinition = {
      id: 'ice',
      name: 'Лёд',
      effects: [{
        type: 'slow',
        slowPercent: 50,
        duration: 3,
        target: { type: 'all-enemies' },
      }],
      visualEffect: 'ice',
      color: '#4ba3ff',
    };

    const changed = changeAbilityEffectTypes(iceAbility, ['slow', 'damage'], damageSources);
    expect(changed.visualEffect).toBe('ice');
    expect(changed.effects.map((effect) => effect.type)).toEqual(['slow', 'damage']);
  });

  it('returns targets for each effect independently', () => {
    expect(getAllowedTargets('damage')).toEqual([
      'nearest-enemies',
      'random-enemies',
      'area-enemies',
      'all-enemies',
      'castle',
    ]);
    expect(getAllowedTargets('periodic-damage')).toEqual([
      'nearest-enemies',
      'random-enemies',
      'area-enemies',
      'all-enemies',
    ]);
    expect(getAllowedTargets('slow')).toEqual([
      'nearest-enemies',
      'random-enemies',
      'area-enemies',
      'all-enemies',
    ]);
    expect(getAllowedTargets('heal')).toEqual(['castle']);
  });

  it('changes only the target of the selected effect', () => {
    const combo = changeAbilityEffectTypes(fireAbility, ['damage', 'heal'], damageSources);
    const changed = changeAbilityEffectTarget(combo, 'damage', 'area-enemies');

    expect(changed.effects).toEqual([
      {
        type: 'damage',
        amount: 55,
        damageSourceId: 'fire',
        criticalChancePercent: 0,
        criticalMultiplier: 1.5,
        target: { type: 'area-enemies', areaHeightPercent: 50 },
      },
      {
        type: 'heal',
        amount: 0,
        target: { type: 'castle' },
      },
    ]);
  });

  it('allows damage and healing in one ability with different targets', () => {
    const combo: AbilityDefinition = {
      id: 'combo',
      name: 'Комбо',
      effects: [
        {
          type: 'damage',
          amount: 55,
          damageSourceId: 'fire',
          criticalChancePercent: 0,
          criticalMultiplier: 1.5,
          target: { type: 'area-enemies', areaHeightPercent: 35 },
        },
        {
          type: 'heal',
          amount: 20,
          target: { type: 'castle' },
        },
      ],
      visualEffect: 'fire',
      color: '#e9573f',
    };

    expect(validateAbility(combo, [], damageSources).valid).toBe(true);
  });

  it('normalizes color, image, targets and effect-specific values', () => {
    expect(normalizeAbility({
      ...fireAbility,
      id: '  FIRE_NEW  ',
      name: '  Новый огонь  ',
      description: '  Описание  ',
      color: '#ABCDEF',
      image: { name: ' icon.svg ', src: 'data:image/svg+xml;base64,AAA' },
      effects: [
        {
          type: 'damage',
          amount: 70,
          damageSourceId: ' fire ',
          criticalChancePercent: 25,
          criticalMultiplier: 1.75,
          target: { type: 'area-enemies', areaHeightPercent: 40 },
        },
        {
          type: 'periodic-damage',
          chancePercent: 35,
          amount: 12,
          duration: 5,
          criticalChancePercent: 35,
          criticalMultiplier: 1.75,
          visualColor: ' #4BA3FF ',
          target: { type: 'all-enemies' },
        },
        {
          type: 'slow',
          slowPercent: 50,
          duration: 9,
          target: { type: 'random-enemies', count: 2 },
        },
      ],
      visualEffect: 'ice',
    })).toEqual({
      id: 'fire_new',
      name: 'Новый огонь',
      description: 'Описание',
      effects: [
        {
          type: 'damage',
          amount: 70,
          damageSourceId: 'fire',
          criticalChancePercent: 25,
          criticalMultiplier: 1.75,
          target: { type: 'area-enemies', areaHeightPercent: 40 },
        },
        {
          type: 'periodic-damage',
          chancePercent: 35,
          amount: 12,
          duration: 5,
          criticalChancePercent: 35,
          criticalMultiplier: 1.75,
          visualColor: '#4ba3ff',
          target: { type: 'all-enemies' },
        },
        {
          type: 'slow',
          slowPercent: 50,
          duration: 9,
          target: { type: 'random-enemies', count: 2 },
        },
      ],
      visualEffect: 'ice',
      color: '#abcdef',
      image: { name: 'icon.svg', src: 'data:image/svg+xml;base64,AAA' },
    });
  });

  it('validates parameters and targets of every selected effect', () => {
    const invalid: AbilityDefinition = {
      id: 'combo',
      name: 'Комбо',
      effects: [
        {
          type: 'damage',
          amount: -1,
          damageSourceId: 'missing',
          criticalChancePercent: 101,
          criticalMultiplier: 0.5,
          target: { type: 'random-enemies', count: 0 },
        },
        {
          type: 'periodic-damage',
          chancePercent: 101,
          amount: -5,
          duration: 0,
          criticalChancePercent: 101,
          criticalMultiplier: 0.5,
          visualColor: 'blue',
          target: { type: 'all-enemies' },
        },
        {
          type: 'slow',
          slowPercent: 101,
          duration: -1,
          target: { type: 'area-enemies', areaHeightPercent: 0 },
        },
      ],
      visualEffect: 'lightning',
      color: 'yellow',
    };

    const result = validateAbility(invalid, [fireAbility], damageSources);
    expect(result.errors.color).toBeTruthy();
    expect(result.errors.damageTargetCount).toBeTruthy();
    expect(result.errors.slowAreaHeightPercent).toBeTruthy();
    expect(result.errors.damageAmount).toBeTruthy();
    expect(result.errors.damageSourceId).toBeTruthy();
    expect(result.errors.damageCriticalChancePercent).toBeTruthy();
    expect(result.errors.damageCriticalMultiplier).toBeTruthy();
    expect(result.errors.periodicDamageChancePercent).toBeTruthy();
    expect(result.errors.periodicDamageAmount).toBeTruthy();
    expect(result.errors.periodicDamageDuration).toBeTruthy();
    expect(result.errors.periodicDamageCriticalChancePercent).toBeTruthy();
    expect(result.errors.periodicDamageCriticalMultiplier).toBeTruthy();
    expect(result.errors.periodicDamageVisualColor).toBeTruthy();
    expect(result.errors.slowPercent).toBeTruthy();
    expect(result.errors.duration).toBeTruthy();
  });

  it('requires at least one effect but does not require effects to share a target', () => {
    const withoutEffects = validateAbility({ ...fireAbility, effects: [] }, [], damageSources);
    expect(withoutEffects.errors.effects).toBeTruthy();

    const mixed: AbilityDefinition = {
      ...fireAbility,
      effects: [
        {
          type: 'slow',
          slowPercent: 20,
          duration: 2,
          target: { type: 'all-enemies' },
        },
        {
          type: 'heal',
          amount: 10,
          target: { type: 'castle' },
        },
      ],
      visualEffect: 'ice',
    };
    expect(validateAbility(mixed, [], damageSources).valid).toBe(true);
  });
});
