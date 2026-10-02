import { describe, expect, it } from 'vitest';
import {
  applyUnitTraitMultipliers,
  deleteUnit,
  hasTrait,
  normalizeUnit,
  saveUnit,
  validateUnit,
} from '../../src/editor/units/unitLogic';
import { createEmptyUnitAnimationSounds, createEmptyUnitAnimations } from '../../src/editor/units/unitAnimationLogic';
import type { UnitDefinition } from '../../src/editor/units/types';

const damageSources = [
  { id: 'fire', name: 'Огонь' },
  { id: 'ice', name: 'Лёд' },
];

const goblin: UnitDefinition = {
  id: 'goblin',
  name: 'Гоблин',
  hp: 100,
  speed: 40,
  damage: 10,
  damageSourceId: 'fire',
  coinsOnDeath: 1,
  traits: [],
  animationSpeed: 1,
  animations: createEmptyUnitAnimations(),
  animationSounds: createEmptyUnitAnimationSounds(),
  image: {
    name: 'goblin.png',
    src: 'data:image/png;base64,goblin',
  },
};

describe('unitLogic', () => {
  it('normalizes unit data before saving', () => {
    expect(normalizeUnit({
      id: '  GOBLIN_ELITE  ',
      name: '  Элитный гоблин  ',
      hp: 180,
      speed: 35,
      damage: 24,
      damageSourceId: ' FIRE ',
      coinsOnDeath: 7,
      traits: ['strong', 'ranged', 'boss', 'healthy', 'strong'],
      attackStartPathPercent: 60,
      traitMultipliers: {
        hp: 2,
        damage: 1.5,
        speed: 3,
      },
      damageProtection: {
        ' FIRE ': 25,
        ' ICE ': -50,
        lightning: 100,
      },
      animationSpeed: 1.5,
      animations: {
        move: [{ id: ' move-1 ', name: ' move.png ', src: 'data:image/png;base64,move' }],
        attack: [],
        death: [],
      },
      animationSounds: {
        move: { id: ' move-sound ', name: ' move.ogg ', src: 'data:audio/ogg;base64,move' },
      },
      image: {
        name: ' elite.png ',
        src: 'data:image/png;base64,elite',
      },
    })).toEqual({
      id: 'goblin_elite',
      name: 'Элитный гоблин',
      hp: 180,
      speed: 35,
      damage: 24,
      damageSourceId: 'fire',
      coinsOnDeath: 7,
      traits: ['boss', 'healthy', 'strong', 'ranged'],
      attackStartPathPercent: 60,
      traitMultipliers: {
        hp: 2,
        damage: 1.5,
      },
      damageProtection: {
        fire: 25,
        ice: -50,
        lightning: 100,
      },
      animationSpeed: 1.5,
      animations: {
        move: [{ id: 'move-1', name: 'move.png', src: 'data:image/png;base64,move' }],
        attack: [],
        death: [],
      },
      animationSounds: {
        move: { id: 'move-sound', name: 'move.ogg', src: 'data:audio/ogg;base64,move' },
      },
      image: {
        name: 'elite.png',
        src: 'data:image/png;base64,elite',
      },
    });
  });

  it('calculates final unit characteristics with all selected trait multipliers', () => {
    const final = applyUnitTraitMultipliers({
      ...goblin,
      hp: 120,
      speed: 30,
      damage: 20,
      coinsOnDeath: 3,
      traits: ['healthy', 'armored', 'strong', 'fast', 'generous'],
      traitMultipliers: { hp: 1.5, protection: 2, damage: 1.25, speed: 1.2, coins: 1.5 },
      damageProtection: { fire: 40, ice: -40, lightning: 0 },
    });

    expect(final).toMatchObject({
      hp: 180,
      speed: 36,
      damage: 25,
      coinsOnDeath: 5,
      damageProtection: { fire: 80, ice: -20, lightning: 0 },
    });
  });

  it('detects traits through the shared helper', () => {
    const boss = { ...goblin, traits: ['boss', 'fast'] as UnitDefinition['traits'] };

    expect(hasTrait(boss, 'boss')).toBe(true);
    expect(hasTrait(boss, 'fast')).toBe(true);
    expect(hasTrait(boss, 'healthy')).toBe(false);
  });

  it('rejects duplicate ids and invalid combat values', () => {
    const result = validateUnit(
      {
        ...goblin,
        id: 'goblin',
        name: 'Другой гоблин',
        hp: 0,
        speed: -1,
        damage: Number.NaN,
        damageSourceId: 'fire',
        coinsOnDeath: -1,
        traits: [],
      },
      [goblin],
      damageSources,
    );

    expect(result.valid).toBe(false);
    expect(result.errors.id).toBeTruthy();
    expect(result.errors.hp).toBeTruthy();
    expect(result.errors.speed).toBeTruthy();
    expect(result.errors.damage).toBeTruthy();
    expect(result.errors.coinsOnDeath).toBeTruthy();
  });

  it('requires a positive multiplier for every selected modifier trait', () => {
    const missing = validateUnit(
      {
        ...goblin,
        traits: ['healthy'],
      },
      [goblin],
      damageSources,
      'goblin',
    );
    const invalid = validateUnit(
      {
        ...goblin,
        traits: ['fast'],
        traitMultipliers: { speed: 0 },
      },
      [goblin],
      damageSources,
      'goblin',
    );
    const valid = validateUnit(
      {
        ...goblin,
        traits: ['healthy', 'armored', 'strong', 'fast', 'generous'],
        traitMultipliers: { hp: 2, protection: 2, damage: 1.5, speed: 1.25, coins: 3 },
      },
      [goblin],
      damageSources,
      'goblin',
    );

    expect(missing.valid).toBe(false);
    expect(missing.errors.traitMultipliers).toBeTruthy();
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.traitMultipliers).toBeTruthy();
    expect(valid.valid).toBe(true);
  });

  it('accepts vulnerability down to -100% and rejects values outside the -100..100 range', () => {
    const vulnerable = validateUnit(
      {
        ...goblin,
        damageProtection: {
          fire: -100,
        },
      },
      [goblin],
      damageSources,
      'goblin',
    );
    const tooLow = validateUnit(
      {
        ...goblin,
        damageProtection: {
          fire: -101,
        },
      },
      [goblin],
      damageSources,
      'goblin',
    );
    const tooHigh = validateUnit(
      {
        ...goblin,
        damageProtection: {
          fire: 101,
        },
      },
      [goblin],
      damageSources,
      'goblin',
    );

    expect(vulnerable.valid).toBe(true);
    expect(vulnerable.errors.damageProtection).toBeUndefined();
    expect(tooLow.valid).toBe(false);
    expect(tooLow.errors.damageProtection).toBeTruthy();
    expect(tooHigh.valid).toBe(false);
    expect(tooHigh.errors.damageProtection).toBeTruthy();
  });

  it('requires damage source selected from the damage source editor', () => {
    const missing = validateUnit({ ...goblin, damageSourceId: '' }, [goblin], damageSources, 'goblin');
    const unknown = validateUnit({ ...goblin, damageSourceId: 'poison' }, [goblin], damageSources, 'goblin');
    const valid = validateUnit({ ...goblin, damageSourceId: 'ice' }, [goblin], damageSources, 'goblin');

    expect(missing.errors.damageSourceId).toBeTruthy();
    expect(unknown.errors.damageSourceId).toBeTruthy();
    expect(valid.errors.damageSourceId).toBeUndefined();
  });

  it('requires a valid attack start path percent only for ranged units', () => {
    const missing = validateUnit(
      { ...goblin, traits: ['ranged'] },
      [goblin],
      damageSources,
      'goblin',
    );
    const tooHigh = validateUnit(
      { ...goblin, traits: ['ranged'], attackStartPathPercent: 101 },
      [goblin],
      damageSources,
      'goblin',
    );
    const valid = validateUnit(
      { ...goblin, traits: ['ranged'], attackStartPathPercent: 60 },
      [goblin],
      damageSources,
      'goblin',
    );
    const melee = normalizeUnit({ ...goblin, attackStartPathPercent: 60 });

    expect(missing.errors.attackStartPathPercent).toBeTruthy();
    expect(tooHigh.errors.attackStartPathPercent).toBeTruthy();
    expect(valid.errors.attackStartPathPercent).toBeUndefined();
    expect(melee.attackStartPathPercent).toBeUndefined();
  });

  it('allows updating a unit without treating its own id as a duplicate', () => {
    const result = validateUnit({ ...goblin, name: 'Гоблин-разведчик' }, [goblin], damageSources, 'goblin');

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('allows changing an id while keeping the internal game binding', () => {
    const boundGoblin: UnitDefinition = { ...goblin, gameKey: 'wave_1_enemy' };
    const renamed = saveUnit(
      [boundGoblin],
      { ...boundGoblin, id: 'forest_goblin' },
      'goblin',
    );

    expect(renamed).toEqual([{ ...boundGoblin, id: 'forest_goblin' }]);
  });

  it('creates, updates and deletes units without changing unrelated records', () => {
    const orc: UnitDefinition = { id: 'orc', name: 'Орк', hp: 160, speed: 30, damage: 18, damageSourceId: 'ice', coinsOnDeath: 3, traits: [], animationSpeed: 1, animations: createEmptyUnitAnimations(), animationSounds: createEmptyUnitAnimationSounds() };
    const created = saveUnit([goblin], orc);
    const updated = saveUnit(created, { ...goblin, hp: 120 }, 'goblin');
    const deleted = deleteUnit(updated, 'orc');

    expect(created).toEqual([goblin, orc]);
    expect(updated).toEqual([{ ...goblin, hp: 120 }, orc]);
    expect(deleted).toEqual([{ ...goblin, hp: 120 }]);
  });
});
