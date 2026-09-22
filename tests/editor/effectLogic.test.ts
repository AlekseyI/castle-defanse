import { describe, expect, it } from 'vitest';
import { changeAbilityEffectTypes } from '../../src/editor/abilities/abilityLogic';
import type { AbilityDefinition } from '../../src/editor/abilities/types';

const ability: AbilityDefinition = {
  id: 'fire',
  name: 'Огонь',
  effects: [{ type: 'damage', amount: 55, damageSourceId: 'fire' }],
  color: '#e9573f',
  target: { type: 'nearest-enemies', count: 1 },
};

describe('ability effect types', () => {
  it('stores multiple effect behaviors directly on the ability', () => {
    const changed = changeAbilityEffectTypes(ability, ['damage', 'slow'], [{ id: 'fire', name: 'Огонь' }]);

    expect(changed.effects).toEqual([
      { type: 'damage', amount: 55, damageSourceId: 'fire' },
      { type: 'slow', slowPercent: 0, duration: 0 },
    ]);
  });
});
