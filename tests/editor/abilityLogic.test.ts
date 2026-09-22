import { describe, expect, it } from 'vitest';
import {
  changeAbilityEffectTypes,
  changeAbilityTarget,
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
  effects: [{ type: 'damage', amount: 55, damageSourceId: 'fire' }],
  color: '#e9573f',
  target: { type: 'nearest-enemies', count: 4 },
};

describe('abilityLogic', () => {
  it('creates a damage ability with one effect by default', () => {
    expect(createEmptyAbility(damageSources)).toEqual({
      id: '',
      name: '',
      effects: [{ type: 'damage', amount: 0, damageSourceId: 'fire' }],
      color: '#64748b',
      target: { type: 'nearest-enemies', count: 1 },
    });
  });

  it('adds another effect without losing parameters of already selected effects', () => {
    expect(changeAbilityEffectTypes(fireAbility, ['damage', 'slow'], damageSources)).toEqual({
      ...fireAbility,
      effects: [
        { type: 'damage', amount: 55, damageSourceId: 'fire' },
        { type: 'slow', slowPercent: 0, duration: 0 },
      ],
    });
  });

  it('keeps only targets shared by all selected effects', () => {
    expect(getAllowedTargets(['damage', 'slow'])).toEqual([
      'nearest-enemies',
      'random-enemies',
      'area-enemies',
      'all-enemies',
    ]);
    expect(getAllowedTargets(['damage', 'heal'])).toEqual(['castle']);
    expect(getAllowedTargets(['slow', 'heal'])).toEqual([]);
  });

  it('moves to a valid common target when selected effects require it', () => {
    expect(changeAbilityEffectTypes(fireAbility, ['damage', 'heal'], damageSources)).toEqual({
      ...fireAbility,
      effects: [
        { type: 'damage', amount: 55, damageSourceId: 'fire' },
        { type: 'heal', amount: 0 },
      ],
      target: { type: 'castle' },
    });
  });

  it('allows AoE for damage and slow and removes target count when it is selected', () => {
    expect(getAllowedTargets(['damage', 'slow'])).toContain('area-enemies');

    expect(changeAbilityTarget(fireAbility, 'area-enemies')).toEqual({
      ...fireAbility,
      target: { type: 'area-enemies', areaHeightPercent: 50 },
    });
  });

  it('validates AoE height and keeps all effects in normalized data', () => {
    const aoe: AbilityDefinition = {
      ...fireAbility,
      effects: [
        { type: 'damage', amount: 55, damageSourceId: 'fire' },
        { type: 'slow', slowPercent: 30, duration: 2 },
      ],
      target: { type: 'area-enemies', areaHeightPercent: 35 },
    };

    expect(normalizeAbility(aoe)).toEqual({
      ...aoe,
      target: { type: 'area-enemies', areaHeightPercent: 35 },
    });
    expect(validateAbility(aoe, [], damageSources).valid).toBe(true);

    const invalid = validateAbility({
      ...aoe,
      target: { type: 'area-enemies', areaHeightPercent: 0 },
    }, [], damageSources);
    expect(invalid.errors.areaHeightPercent).toBeTruthy();
  });

  it('normalizes color, image and effect-specific values', () => {
    expect(normalizeAbility({
      ...fireAbility,
      id: '  FIRE_NEW  ',
      name: '  Новый огонь  ',
      description: '  Описание  ',
      color: '#ABCDEF',
      image: { name: ' icon.svg ', src: 'data:image/svg+xml;base64,AAA' },
      effects: [
        { type: 'damage', amount: 70, damageSourceId: ' fire ' },
        { type: 'slow', slowPercent: 50, duration: 9 },
      ],
    })).toEqual({
      id: 'fire_new',
      name: 'Новый огонь',
      description: 'Описание',
      effects: [
        { type: 'damage', amount: 70, damageSourceId: 'fire' },
        { type: 'slow', slowPercent: 50, duration: 9 },
      ],
      color: '#abcdef',
      image: { name: 'icon.svg', src: 'data:image/svg+xml;base64,AAA' },
      target: { type: 'nearest-enemies', count: 4 },
    });
  });

  it('validates every selected effect', () => {
    const invalid: AbilityDefinition = {
      id: 'combo',
      name: 'Комбо',
      effects: [
        { type: 'damage', amount: -1, damageSourceId: 'missing' },
        { type: 'slow', slowPercent: 101, duration: -1 },
      ],
      color: 'yellow',
      target: { type: 'random-enemies', count: 0 },
    };

    const result = validateAbility(invalid, [fireAbility], damageSources);
    expect(result.errors.color).toBeTruthy();
    expect(result.errors.targetCount).toBeTruthy();
    expect(result.errors.damageAmount).toBeTruthy();
    expect(result.errors.damageSourceId).toBeTruthy();
    expect(result.errors.slowPercent).toBeTruthy();
    expect(result.errors.duration).toBeTruthy();
  });

  it('requires at least one effect and rejects incompatible effect combinations', () => {
    const withoutEffects = validateAbility({ ...fireAbility, effects: [] }, [], damageSources);
    expect(withoutEffects.errors.effects).toBeTruthy();

    const incompatible = validateAbility({
      ...fireAbility,
      effects: [
        { type: 'slow', slowPercent: 20, duration: 2 },
        { type: 'heal', amount: 10 },
      ],
    }, [], damageSources);
    expect(incompatible.errors.effects).toBeTruthy();
  });
});
