import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAbilities, persistAbilities } from '../../src/editor/abilities/abilityStorage';
import type { AbilityDefinition } from '../../src/editor/abilities/types';

function installLocalStorage() {
  const values = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ability effects storage', () => {
  it('persists different targets for effects in the same ability', () => {
    installLocalStorage();
    const abilities: AbilityDefinition[] = [{
      id: 'castle_combo',
      name: 'Замковое комбо',
      effects: [
        {
          type: 'damage',
          amount: 10,
          damageSourceId: 'fire',
          criticalChancePercent: 0,
          criticalMultiplier: 1.5,
          target: { type: 'area-enemies', areaHeightPercent: 40 },
        },
        {
          type: 'heal',
          amount: 20,
          target: { type: 'castle' },
        },
      ],
      visualEffect: 'fire',
      color: '#58c985',
    }];

    persistAbilities(abilities);
    expect(loadAbilities()).toEqual(abilities);
  });
});
