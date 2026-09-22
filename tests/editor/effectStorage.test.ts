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
  it('persists multiple effects as part of the ability json', () => {
    installLocalStorage();
    const abilities: AbilityDefinition[] = [{
      id: 'castle_combo',
      name: 'Замковое комбо',
      effects: [
        { type: 'damage', amount: 10, damageSourceId: 'fire' },
        { type: 'heal', amount: 20 },
      ],
      color: '#58c985',
      target: { type: 'castle' },
    }];

    persistAbilities(abilities);
    expect(loadAbilities()).toEqual(abilities);
  });
});
