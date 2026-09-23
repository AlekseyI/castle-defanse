import { describe, expect, it } from 'vitest';
import { changeAbilityEffectTypes } from '../../src/editor/abilities/abilityLogic';
import type { AbilityDefinition } from '../../src/editor/abilities/types';

const ability: AbilityDefinition = {
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

describe('ability effect types', () => {
  it('adds another behavior with its own target and keeps the selected visual effect', () => {
    const changed = changeAbilityEffectTypes(ability, ['slow', 'damage'], [{ id: 'fire', name: 'Огонь' }]);

    expect(changed.effects).toEqual([
      {
        type: 'slow',
        slowPercent: 50,
        duration: 3,
        target: { type: 'all-enemies' },
      },
      {
        type: 'damage',
        amount: 0,
        damageSourceId: 'fire',
        criticalChancePercent: 0,
        criticalMultiplier: 1.5,
        target: { type: 'nearest-enemies', count: 1 },
      },
    ]);
    expect(changed.visualEffect).toBe('ice');
  });
});
