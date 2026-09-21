import { describe, expect, it } from 'vitest';
import {
  deleteDamageSource,
  normalizeDamageSource,
  saveDamageSource,
  validateDamageSource,
} from '../../src/editor/damageSources/damageSourceLogic';
import type { DamageSource } from '../../src/editor/damageSources/types';

const fire: DamageSource = {
  id: 'fire',
  name: 'Огонь',
  icon: {
    name: 'fire.png',
    src: 'data:image/png;base64,fire',
  },
  color: '#e9573f',
};

describe('damageSourceLogic', () => {
  it('normalizes source data before saving', () => {
    expect(normalizeDamageSource({
      id: '  FIRE_NEW  ',
      name: '  Новый огонь  ',
      description: '  Описание  ',
      icon: {
        name: ' fire.png ',
        src: 'data:image/png;base64,fire',
      },
      color: '#ABCDEF',
    })).toEqual({
      id: 'fire_new',
      name: 'Новый огонь',
      description: 'Описание',
      icon: {
        name: 'fire.png',
        src: 'data:image/png;base64,fire',
      },
      color: '#abcdef',
    });
  });

  it('rejects duplicate ids and malformed colors', () => {
    const result = validateDamageSource(
      { id: 'fire', name: 'Другой огонь', color: 'red' },
      [fire],
    );

    expect(result.valid).toBe(false);
    expect(result.errors.id).toBeTruthy();
    expect(result.errors.color).toBeTruthy();
  });

  it('creates, updates and deletes sources without changing unrelated records', () => {
    const ice: DamageSource = { id: 'ice', name: 'Лёд' };
    const created = saveDamageSource([fire], ice);
    const updated = saveDamageSource(created, { ...fire, name: 'Пламя' }, 'fire');
    const deleted = deleteDamageSource(updated, 'ice');

    expect(created).toEqual([fire, ice]);
    expect(updated).toEqual([{ ...fire, name: 'Пламя' }, ice]);
    expect(deleted).toEqual([{ ...fire, name: 'Пламя' }]);
  });
});
