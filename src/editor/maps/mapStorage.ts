import { DEFAULT_MAPS } from './defaultMaps';
import type {
  EndlessWaveSettings,
  MapBackground,
  MapDefinition,
  MapImage,
  MapUpgradeSettings,
  MapWaveDefinition,
  WaveUpgradeReward,
  WaveSpawnBlock,
} from './types';

const STORAGE_KEY = 'game.maps.v2';
const ACTIVE_MAP_STORAGE_KEY = 'game.maps.active.v2';
const MAP_KEYS = new Set(['id', 'name', 'background', 'upgradeSettings', 'waves', 'endless']);
const BACKGROUND_KEYS = new Set(['color', 'fit', 'image']);
const IMAGE_KEYS = new Set(['name', 'src']);
const MAP_UPGRADE_SETTINGS_KEYS = new Set(['enabled', 'cardCount', 'rewardOnBossKill']);
const WAVE_KEYS = new Set(['id', 'blocks', 'upgradeReward']);
const UPGRADE_REWARD_KEYS = new Set(['override', 'enabled', 'cardCount']);
const BLOCK_KEYS = new Set(['id', 'unitId', 'count', 'spawnEvery', 'startWhen']);
const ENDLESS_KEYS = new Set([
  'enabled',
  'repeatLastWaves',
  'hpGrowthPercent',
  'damageGrowthPercent',
  'speedGrowthPercent',
  'countGrowth',
  'spawnIntervalReductionPercent',
  'minSpawnInterval',
]);

function hasOnlyKeys(value: Record<string, unknown>, keys: Set<string>): boolean {
  return Object.keys(value).every((key) => keys.has(key));
}

function isImage(value: unknown): value is MapImage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const image = value as Record<string, unknown>;
  return hasOnlyKeys(image, IMAGE_KEYS) && typeof image.name === 'string' && typeof image.src === 'string';
}

function isBackground(value: unknown): value is MapBackground {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const background = value as Record<string, unknown>;
  return (
    hasOnlyKeys(background, BACKGROUND_KEYS) &&
    typeof background.color === 'string' &&
    (background.fit === 'cover' || background.fit === 'contain') &&
    (background.image === undefined || isImage(background.image))
  );
}

function isBlock(value: unknown): value is WaveSpawnBlock {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const block = value as Record<string, unknown>;
  return (
    hasOnlyKeys(block, BLOCK_KEYS) &&
    typeof block.id === 'string' &&
    typeof block.unitId === 'string' &&
    typeof block.count === 'number' && Number.isFinite(block.count) &&
    typeof block.spawnEvery === 'number' && Number.isFinite(block.spawnEvery) &&
    (block.startWhen === 'after-spawn' || block.startWhen === 'field-clear')
  );
}


function isMapUpgradeSettings(value: unknown): value is MapUpgradeSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const settings = value as Record<string, unknown>;
  return (
    hasOnlyKeys(settings, MAP_UPGRADE_SETTINGS_KEYS) &&
    typeof settings.enabled === 'boolean' &&
    typeof settings.cardCount === 'number' && Number.isInteger(settings.cardCount) && settings.cardCount >= 1 &&
    typeof settings.rewardOnBossKill === 'boolean'
  );
}

function isUpgradeReward(value: unknown): value is WaveUpgradeReward {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const reward = value as Record<string, unknown>;
  return (
    hasOnlyKeys(reward, UPGRADE_REWARD_KEYS) &&
    typeof reward.override === 'boolean' &&
    typeof reward.enabled === 'boolean' &&
    typeof reward.cardCount === 'number' && Number.isInteger(reward.cardCount) && reward.cardCount >= 1
  );
}

function isWave(value: unknown): value is MapWaveDefinition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const wave = value as Record<string, unknown>;
  return (
    hasOnlyKeys(wave, WAVE_KEYS) &&
    typeof wave.id === 'string' &&
    Array.isArray(wave.blocks) &&
    wave.blocks.every(isBlock) &&
    isUpgradeReward(wave.upgradeReward)
  );
}

function isEndless(value: unknown): value is EndlessWaveSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const endless = value as Record<string, unknown>;
  return (
    hasOnlyKeys(endless, ENDLESS_KEYS) &&
    typeof endless.enabled === 'boolean' &&
    typeof endless.repeatLastWaves === 'number' && Number.isFinite(endless.repeatLastWaves) &&
    typeof endless.hpGrowthPercent === 'number' && Number.isFinite(endless.hpGrowthPercent) &&
    typeof endless.damageGrowthPercent === 'number' && Number.isFinite(endless.damageGrowthPercent) &&
    typeof endless.speedGrowthPercent === 'number' && Number.isFinite(endless.speedGrowthPercent) &&
    typeof endless.countGrowth === 'number' && Number.isFinite(endless.countGrowth) &&
    typeof endless.spawnIntervalReductionPercent === 'number' && Number.isFinite(endless.spawnIntervalReductionPercent) &&
    typeof endless.minSpawnInterval === 'number' && Number.isFinite(endless.minSpawnInterval)
  );
}

function isMap(value: unknown): value is MapDefinition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const map = value as Record<string, unknown>;
  return (
    hasOnlyKeys(map, MAP_KEYS) &&
    typeof map.id === 'string' &&
    typeof map.name === 'string' &&
    isBackground(map.background) &&
    isMapUpgradeSettings(map.upgradeSettings) &&
    Array.isArray(map.waves) &&
    map.waves.every(isWave) &&
    isEndless(map.endless)
  );
}

function cloneDefaults(): MapDefinition[] {
  return DEFAULT_MAPS.map((map) => ({
    ...map,
    background: {
      ...map.background,
      image: map.background.image ? { ...map.background.image } : undefined,
    },
    upgradeSettings: { ...map.upgradeSettings },
    waves: map.waves.map((wave) => ({
      ...wave,
      blocks: wave.blocks.map((block) => ({ ...block })),
      upgradeReward: { ...wave.upgradeReward },
    })),
    endless: { ...map.endless },
  }));
}

export function loadMaps(): MapDefinition[] {
  if (typeof window === 'undefined') return cloneDefaults();

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return cloneDefaults();

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isMap)) return cloneDefaults();
    return parsed;
  } catch {
    return cloneDefaults();
  }
}

export function persistMaps(maps: MapDefinition[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(maps));
}


export function loadActiveMapId(): string | null {
  if (typeof window === 'undefined') return null;
  const id = window.localStorage.getItem(ACTIVE_MAP_STORAGE_KEY);
  return id && id.trim() ? id : null;
}

export function persistActiveMapId(id: string): void {
  window.localStorage.setItem(ACTIVE_MAP_STORAGE_KEY, id);
}

export function loadActiveMap(): MapDefinition {
  const maps = loadMaps();
  const activeId = loadActiveMapId();
  const active = activeId ? maps.find((map) => map.id === activeId) : undefined;
  const fallback = active ?? maps[0] ?? DEFAULT_MAPS[0];

  return {
    ...fallback,
    background: {
      ...fallback.background,
      image: fallback.background.image ? { ...fallback.background.image } : undefined,
    },
    upgradeSettings: { ...fallback.upgradeSettings },
    waves: fallback.waves.map((wave) => ({
      ...wave,
      blocks: wave.blocks.map((block) => ({ ...block })),
      upgradeReward: { ...wave.upgradeReward },
    })),
    endless: { ...fallback.endless },
  };
}
