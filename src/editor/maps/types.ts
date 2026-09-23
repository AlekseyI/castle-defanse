export interface MapImage {
  name: string;
  src: string;
}

export type MapBackgroundFit = 'cover' | 'contain';
export type WaveBlockStartCondition = 'after-spawn' | 'field-clear';

export interface MapBackground {
  color: string;
  fit: MapBackgroundFit;
  image?: MapImage;
}

export interface WaveSpawnBlock {
  id: string;
  unitId: string;
  count: number;
  spawnEvery: number;
  startWhen: WaveBlockStartCondition;
}

export interface MapWaveDefinition {
  id: string;
  blocks: WaveSpawnBlock[];
}

export interface EndlessWaveSettings {
  enabled: boolean;
  repeatLastWaves: number;
  hpGrowthPercent: number;
  damageGrowthPercent: number;
  speedGrowthPercent: number;
  countGrowth: number;
  spawnIntervalReductionPercent: number;
  minSpawnInterval: number;
}

export interface MapDefinition {
  id: string;
  name: string;
  background: MapBackground;
  waves: MapWaveDefinition[];
  endless: EndlessWaveSettings;
}
