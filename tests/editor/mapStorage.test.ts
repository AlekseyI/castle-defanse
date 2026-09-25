import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MAPS } from '../../src/editor/maps/defaultMaps';
import { loadActiveMap, loadActiveMapId, loadMaps, persistActiveMapId, persistMaps } from '../../src/editor/maps/mapStorage';
import type { MapDefinition } from '../../src/editor/maps/types';

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

const customMap: MapDefinition = {
  id: 'arena',
  name: 'Арена',
  background: {
    color: '#101827',
    fit: 'cover',
  },
  upgradeSettings: { enabled: false, cardCount: 3, maxCardReceives: 5, rewardOnBossKill: false },
  waves: [{
    id: 'wave_a',
    blocks: [{
      id: 'block_a',
      unitId: 'wave_1_enemy',
      count: 8,
      spawnEvery: 0.8,
      startWhen: 'after-spawn',
    }],
    upgradeReward: { override: false, enabled: false, cardCount: 3 },
  }],
  endless: {
    enabled: false,
    repeatLastWaves: 1,
    hpGrowthPercent: 10,
    damageGrowthPercent: 5,
    speedGrowthPercent: 2,
    countGrowth: 2,
    spawnIntervalReductionPercent: 3,
    minSpawnInterval: 0.25,
  },
};

describe('mapStorage', () => {
  it('persists and loads the current map editor format', () => {
    installLocalStorage();
    persistMaps([customMap]);
    expect(loadMaps()).toEqual([customMap]);
  });


  it('stores the active map separately and loads it for the game', () => {
    installLocalStorage();
    const secondMap: MapDefinition = {
      ...customMap,
      id: 'second_arena',
      name: 'Вторая арена',
    };

    persistMaps([customMap, secondMap]);
    persistActiveMapId(secondMap.id);

    expect(loadActiveMapId()).toBe('second_arena');
    expect(loadActiveMap()).toEqual(secondMap);
  });

  it('falls back to the first current map when the stored active id no longer exists', () => {
    installLocalStorage();
    persistMaps([customMap]);
    persistActiveMapId('deleted_map');

    expect(loadActiveMap()).toEqual(customMap);
  });

  it('rejects old or incomplete map json instead of migrating it', () => {
    installLocalStorage();
    window.localStorage.setItem('game.maps.v2', JSON.stringify([{
      id: 'legacy',
      name: 'Старая карта',
      background: '#000000',
      waves: [{ count: 5, unitId: 'wave_1_enemy' }],
    }]));

    expect(loadMaps()).toEqual(DEFAULT_MAPS);
  });

  it('rejects unknown fields in the new format', () => {
    installLocalStorage();
    window.localStorage.setItem('game.maps.v2', JSON.stringify([{
      ...customMap,
      legacyWaveMode: true,
    }]));

    expect(loadMaps()).toEqual(DEFAULT_MAPS);
  });
});
