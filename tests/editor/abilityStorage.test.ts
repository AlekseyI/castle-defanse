import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ABILITIES } from '../../src/editor/abilities/defaultAbilities';
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

describe('abilityStorage', () => {
  it('loads abilities with multiple effects saved in the current format', () => {
    installLocalStorage();
    const abilities: AbilityDefinition[] = [
      {
        id: 'fire_slow',
        name: 'Огненный холод',
        effects: [
          { type: 'damage', amount: 55, damageSourceId: 'fire' },
          { type: 'slow', slowPercent: 30, duration: 2 },
        ],
        color: '#e9573f',
        image: { name: 'fire.svg', src: 'data:image/svg+xml;base64,AAA' },
        target: { type: 'area-enemies', areaHeightPercent: 50 },
      },
    ];

    persistAbilities(abilities);
    expect(loadAbilities()).toEqual(abilities);
  });

  it('rejects duplicate effect types in saved json', () => {
    installLocalStorage();
    window.localStorage.setItem('game.abilities.v4', JSON.stringify([
      {
        id: 'double_damage',
        name: 'Двойной урон',
        effects: [
          { type: 'damage', amount: 10, damageSourceId: 'fire' },
          { type: 'damage', amount: 20, damageSourceId: 'fire' },
        ],
        color: '#e9573f',
        target: { type: 'all-enemies' },
      },
    ]));

    expect(loadAbilities()).toEqual(DEFAULT_ABILITIES);
  });

  it('does not migrate the previous single-effect storage version', () => {
    installLocalStorage();
    window.localStorage.setItem('game.abilities.v3', JSON.stringify([
      {
        id: 'fire',
        name: 'Огонь',
        effectType: 'damage',
        color: '#e9573f',
        target: { type: 'area-enemies', areaHeightPercent: 50 },
        parameters: { amount: 55, damageSourceId: 'fire' },
      },
    ]));

    expect(loadAbilities()).toEqual(DEFAULT_ABILITIES);
  });
});
