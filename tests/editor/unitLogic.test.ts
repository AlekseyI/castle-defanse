import { describe, expect, it } from 'vitest';
import {
  deleteUnit,
  normalizeUnit,
  saveUnit,
  validateUnit,
} from '../../src/editor/units/unitLogic';
import type { UnitDefinition } from '../../src/editor/units/types';

const goblin: UnitDefinition = {
  id: 'goblin',
  name: 'Гоблин',
  hp: 100,
  speed: 40,
  damage: 10,
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
      damageProtection: {
        ' FIRE ': 25,
        ' ICE ': -50,
        lightning: 100,
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
      damageProtection: {
        fire: 25,
        ice: -50,
        lightning: 100,
      },
      image: {
        name: 'elite.png',
        src: 'data:image/png;base64,elite',
      },
    });
  });

  it('rejects duplicate ids and invalid combat values', () => {
    const result = validateUnit(
      {
        id: 'goblin',
        name: 'Другой гоблин',
        hp: 0,
        speed: -1,
        damage: Number.NaN,
      },
      [goblin],
    );

    expect(result.valid).toBe(false);
    expect(result.errors.id).toBeTruthy();
    expect(result.errors.hp).toBeTruthy();
    expect(result.errors.speed).toBeTruthy();
    expect(result.errors.damage).toBeTruthy();
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
      'goblin',
    );

    expect(vulnerable.valid).toBe(true);
    expect(vulnerable.errors.damageProtection).toBeUndefined();
    expect(tooLow.valid).toBe(false);
    expect(tooLow.errors.damageProtection).toBeTruthy();
    expect(tooHigh.valid).toBe(false);
    expect(tooHigh.errors.damageProtection).toBeTruthy();
  });

  it('allows updating a unit without treating its own id as a duplicate', () => {
    const result = validateUnit({ ...goblin, name: 'Гоблин-разведчик' }, [goblin], 'goblin');

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
    const orc: UnitDefinition = { id: 'orc', name: 'Орк', hp: 160, speed: 30, damage: 18 };
    const created = saveUnit([goblin], orc);
    const updated = saveUnit(created, { ...goblin, hp: 120 }, 'goblin');
    const deleted = deleteUnit(updated, 'orc');

    expect(created).toEqual([goblin, orc]);
    expect(updated).toEqual([{ ...goblin, hp: 120 }, orc]);
    expect(deleted).toEqual([{ ...goblin, hp: 120 }]);
  });
});
