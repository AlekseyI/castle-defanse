import type {
  MapDefinition,
  MapWaveDefinition,
  WaveSpawnBlock,
} from './types';

export interface MapValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

const MAP_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

export interface UnitNameOption {
  id: string;
  name: string;
}

export interface GenerateWavesOptions {
  waveCount: number;
  minUnitCount: number;
  maxUnitCount: number;
  minDifferentUnitCount: number;
  maxDifferentUnitCount: number;
  unitIds: string[];
  bossEveryWaves: number;
  bossUnitIds: string[];
  spawnEvery?: number;
}

function randomIndex(length: number, random: () => number): number {
  const value = Math.min(0.999999999999, Math.max(0, random()));
  return Math.floor(value * length);
}

function pickDistinctUnitIds(
  unitIds: string[],
  count: number,
  random: () => number,
): string[] {
  const pool = [...unitIds];
  const picked: string[] = [];

  while (picked.length < count) {
    picked.push(pool.splice(randomIndex(pool.length, random), 1)[0]);
  }

  return picked;
}

export function generateWaves(
  options: GenerateWavesOptions,
  random: () => number = Math.random,
): MapWaveDefinition[] {
  const {
    waveCount,
    minUnitCount,
    maxUnitCount,
    minDifferentUnitCount,
    maxDifferentUnitCount,
    unitIds,
    bossEveryWaves,
    bossUnitIds,
    spawnEvery = 1,
  } = options;

  if (!Number.isInteger(waveCount) || waveCount < 1) {
    throw new RangeError('Количество волн должно быть целым числом от 1.');
  }
  if (!Number.isInteger(minUnitCount) || minUnitCount < 1) {
    throw new RangeError('Минимальное количество юнитов должно быть целым числом от 1.');
  }
  if (!Number.isInteger(maxUnitCount) || maxUnitCount < minUnitCount) {
    throw new RangeError('Максимальное количество юнитов должно быть не меньше минимального.');
  }
  if (!Number.isInteger(minDifferentUnitCount) || minDifferentUnitCount < 1) {
    throw new RangeError('Минимальное количество разных юнитов должно быть целым числом от 1.');
  }
  if (!Number.isInteger(maxDifferentUnitCount) || maxDifferentUnitCount < minDifferentUnitCount) {
    throw new RangeError('Максимальное количество разных юнитов должно быть не меньше минимального.');
  }
  if (unitIds.length === 0) {
    throw new RangeError('Для генерации нужен хотя бы один обычный юнит.');
  }
  if (maxDifferentUnitCount > unitIds.length) {
    throw new RangeError('Диапазон разных юнитов не должен превышать число доступных обычных юнитов.');
  }
  if (maxDifferentUnitCount > minUnitCount) {
    throw new RangeError('Максимум разных юнитов не должен превышать минимальное общее количество юнитов в волне.');
  }
  if (!Number.isInteger(bossEveryWaves) || bossEveryWaves < 1) {
    throw new RangeError('Период появления босса должен быть целым числом от 1.');
  }
  if (bossUnitIds.length === 0) {
    throw new RangeError('Для генерации нужен хотя бы один юнит с отметкой «Босс».');
  }
  if (!Number.isFinite(spawnEvery) || spawnEvery < 0) {
    throw new RangeError('Интервал спавна должен быть числом 0 или больше.');
  }

  const unitCountRange = maxUnitCount - minUnitCount + 1;
  const differentUnitCountRange = maxDifferentUnitCount - minDifferentUnitCount + 1;

  return Array.from({ length: waveCount }, (_, waveIndex) => {
    const totalUnitCount = minUnitCount + randomIndex(unitCountRange, random);
    const differentUnitCount = minDifferentUnitCount + randomIndex(differentUnitCountRange, random);
    const selectedUnitIds = pickDistinctUnitIds(unitIds, differentUnitCount, random);
    const baseCount = Math.floor(totalUnitCount / differentUnitCount);
    const remainder = totalUnitCount % differentUnitCount;

    const blocks: WaveSpawnBlock[] = selectedUnitIds.map((unitId, blockIndex) => ({
      id: createId('block'),
      unitId,
      count: baseCount + (blockIndex < remainder ? 1 : 0),
      spawnEvery,
      startWhen: 'after-spawn',
    }));

    if ((waveIndex + 1) % bossEveryWaves === 0) {
      blocks.push({
        id: createId('block'),
        unitId: bossUnitIds[randomIndex(bossUnitIds.length, random)],
        count: 1,
        spawnEvery: 0,
        startWhen: 'field-clear',
      });
    }

    return {
      id: createId('wave'),
      blocks,
      upgradeReward: { override: false, enabled: false, cardCount: 3 },
    };
  });
}

function normalizeUnitNameQuery(value: string): string {
  return value.trim().toLocaleLowerCase('ru');
}

export function filterUnitsByNameSubstring<T extends UnitNameOption>(
  units: T[],
  query: string,
): T[] {
  const normalizedQuery = normalizeUnitNameQuery(query);
  if (!normalizedQuery) return units;

  return units.filter((unit) => unit.name.toLocaleLowerCase('ru').includes(normalizedQuery));
}

export function findFirstUnitByNameSubstring<T extends UnitNameOption>(
  units: T[],
  query: string,
): T | undefined {
  const normalizedQuery = normalizeUnitNameQuery(query);
  if (!normalizedQuery) return undefined;

  return units.find((unit) => unit.name.toLocaleLowerCase('ru').includes(normalizedQuery));
}

export function clampRepeatLastWaves(value: number, waveCount: number): number {
  if (!Number.isFinite(value)) return value;
  if (waveCount < 1) return 1;
  return Math.min(waveCount, Math.max(1, Math.floor(value)));
}

export function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createEmptySpawnBlock(unitId = ''): WaveSpawnBlock {
  return {
    id: createId('block'),
    unitId,
    count: 1,
    spawnEvery: 1,
    startWhen: 'after-spawn',
  };
}

export function createEmptyWave(unitId = ''): MapWaveDefinition {
  return {
    id: createId('wave'),
    blocks: [createEmptySpawnBlock(unitId)],
    upgradeReward: { override: false, enabled: false, cardCount: 3 },
  };
}

export function createEmptyMap(unitId = ''): MapDefinition {
  return {
    id: '',
    name: '',
    background: {
      color: '#0b1020',
      fit: 'cover',
    },
    upgradeSettings: {
      enabled: false,
      cardCount: 3,
      maxCardReceives: 5,
      rewardOnBossKill: false,
    },
    waves: [createEmptyWave(unitId)],
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
}

export function cloneMap(map: MapDefinition): MapDefinition {
  return {
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
  };
}

export function normalizeMap(map: MapDefinition): MapDefinition {
  const normalized: MapDefinition = cloneMap({
    ...map,
    id: map.id.trim().toLowerCase(),
    name: map.name.trim(),
    background: {
      ...map.background,
      color: map.background.color.trim().toLowerCase(),
      image: map.background.image?.src
        ? { name: map.background.image.name.trim(), src: map.background.image.src }
        : undefined,
    },
    waves: map.waves.map((wave) => ({
      ...wave,
      id: wave.id.trim(),
      blocks: wave.blocks.map((block) => ({
        ...block,
        id: block.id.trim(),
        unitId: block.unitId.trim(),
      })),
      upgradeReward: { ...wave.upgradeReward },
    })),
  });

  if (!normalized.background.image) delete normalized.background.image;
  return normalized;
}

export function validateMap(
  map: MapDefinition,
  maps: MapDefinition[],
  availableUnitIds: string[],
  editingId?: string,
): MapValidationResult {
  const normalized = normalizeMap(map);
  const errors: Record<string, string> = {};

  if (!normalized.id) {
    errors.id = 'Укажите ID.';
  } else if (!MAP_ID_PATTERN.test(normalized.id)) {
    errors.id = 'ID может содержать только a-z, 0-9, _ и -.';
  } else if (maps.some((item) => item.id === normalized.id && item.id !== editingId)) {
    errors.id = 'Карта с таким ID уже существует.';
  }

  if (!normalized.name) errors.name = 'Укажите название.';
  if (!/^#[0-9a-f]{6}$/i.test(normalized.background.color)) {
    errors.backgroundColor = 'Укажите цвет в формате #RRGGBB.';
  }

  if (!Number.isInteger(normalized.upgradeSettings.cardCount) || normalized.upgradeSettings.cardCount < 1) {
    errors.upgradeCardCount = 'Количество карточек должно быть целым числом от 1.';
  }
  if (!Number.isInteger(normalized.upgradeSettings.maxCardReceives) || normalized.upgradeSettings.maxCardReceives < 1) {
    errors.upgradeMaxCardReceives = 'Максимальное количество получений должно быть целым числом от 1.';
  }

  normalized.waves.forEach((wave, waveIndex) => {
    if (wave.blocks.length === 0) {
      errors[`wave.${wave.id}`] = `Волна ${waveIndex + 1} должна содержать хотя бы один блок.`;
    }

    if (
      wave.upgradeReward.override &&
      (!Number.isInteger(wave.upgradeReward.cardCount) || wave.upgradeReward.cardCount < 1)
    ) {
      errors[`wave.${wave.id}.upgradeReward.cardCount`] = 'Количество карточек должно быть целым числом от 1.';
    }

    wave.blocks.forEach((block, blockIndex) => {
      const key = `wave.${wave.id}.block.${block.id}`;
      if (!block.unitId || !availableUnitIds.includes(block.unitId)) {
        errors[`${key}.unitId`] = `Выберите существующего юнита для блока ${blockIndex + 1}.`;
      }
      if (!Number.isFinite(block.count) || block.count < 1 || !Number.isInteger(block.count)) {
        errors[`${key}.count`] = 'Количество должно быть целым числом от 1.';
      }
      if (!Number.isFinite(block.spawnEvery) || block.spawnEvery < 0) {
        errors[`${key}.spawnEvery`] = 'Интервал должен быть числом 0 или больше.';
      }
    });
  });

  if (normalized.endless.enabled) {
    if (
      !Number.isInteger(normalized.endless.repeatLastWaves) ||
      normalized.endless.repeatLastWaves < 1 ||
      normalized.endless.repeatLastWaves > normalized.waves.length
    ) {
      errors.repeatLastWaves = 'Количество повторяемых волн должно быть от 1 до числа созданных волн.';
    }
    if (!Number.isFinite(normalized.endless.hpGrowthPercent) || normalized.endless.hpGrowthPercent < 0) {
      errors.hpGrowthPercent = 'Рост HP должен быть 0 или больше.';
    }
    if (!Number.isFinite(normalized.endless.damageGrowthPercent) || normalized.endless.damageGrowthPercent < 0) {
      errors.damageGrowthPercent = 'Рост урона должен быть 0 или больше.';
    }
    if (!Number.isFinite(normalized.endless.speedGrowthPercent) || normalized.endless.speedGrowthPercent < 0) {
      errors.speedGrowthPercent = 'Рост скорости должен быть 0 или больше.';
    }
    if (!Number.isInteger(normalized.endless.countGrowth) || normalized.endless.countGrowth < 0) {
      errors.countGrowth = 'Прирост количества должен быть целым числом 0 или больше.';
    }
    if (
      !Number.isFinite(normalized.endless.spawnIntervalReductionPercent) ||
      normalized.endless.spawnIntervalReductionPercent < 0 ||
      normalized.endless.spawnIntervalReductionPercent > 100
    ) {
      errors.spawnIntervalReductionPercent = 'Снижение интервала должно быть от 0 до 100%.';
    }
    if (!Number.isFinite(normalized.endless.minSpawnInterval) || normalized.endless.minSpawnInterval < 0) {
      errors.minSpawnInterval = 'Минимальный интервал должен быть 0 или больше.';
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function moveWaveByIndex(
  waves: MapWaveDefinition[],
  index: number,
  direction: -1 | 1,
): MapWaveDefinition[] {
  const target = index + direction;
  if (index < 0 || index >= waves.length || target < 0 || target >= waves.length) return waves;

  const next = [...waves];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function saveMap(maps: MapDefinition[], map: MapDefinition, editingId?: string): MapDefinition[] {
  const normalized = normalizeMap(map);
  if (!editingId) return [...maps, normalized];
  return maps.map((item) => (item.id === editingId ? normalized : item));
}

export function deleteMap(maps: MapDefinition[], id: string): MapDefinition[] {
  return maps.filter((map) => map.id !== id);
}
