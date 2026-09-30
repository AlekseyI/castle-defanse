import type {
  UpgradeAddEffectGenerationRule,
  UpgradeEffectType,
  UpgradeGenerationConfig,
  UpgradeNumberGenerationRule,
  UpgradeOptionGenerationRule,
  UpgradeRarityRanges,
} from './types';

function ranges(
  common: [number, number, number],
  rare: [number, number, number],
  epic: [number, number, number],
  legendary: [number, number, number],
): UpgradeRarityRanges {
  return {
    common: { min: common[0], max: common[1], step: common[2] },
    rare: { min: rare[0], max: rare[1], step: rare[2] },
    epic: { min: epic[0], max: epic[1], step: epic[2] },
    legendary: { min: legendary[0], max: legendary[1], step: legendary[2] },
  };
}

const percentRanges = () => ranges([5, 10, 1], [10, 20, 1], [20, 35, 1], [35, 60, 1]);
const flatRanges = () => ranges([5, 15, 1], [15, 30, 1], [30, 60, 5], [60, 100, 5]);
const countRanges = () => ranges([1, 1, 1], [1, 2, 1], [2, 3, 1], [3, 5, 1]);
const durationRanges = () => ranges([0.5, 1, 0.5], [1, 2, 0.5], [2, 3, 0.5], [3, 5, 0.5]);
const multiplierRanges = () => ranges([0.1, 0.25, 0.05], [0.25, 0.5, 0.05], [0.5, 0.75, 0.05], [0.75, 1, 0.05]);
const addedMultiplierRanges = () => ranges([1, 1.25, 0.05], [1.25, 1.5, 0.05], [1.5, 2, 0.1], [2, 3, 0.1]);
const areaRanges = () => ranges([5, 10, 5], [10, 20, 5], [20, 35, 5], [35, 50, 5]);

function numberRule(valueRanges: UpgradeRarityRanges, weight = 100): UpgradeNumberGenerationRule {
  return { enabled: true, weight, kind: 'number', ranges: valueRanges };
}

function optionRule(values: string[], weight = 60): UpgradeOptionGenerationRule {
  return { enabled: true, weight, kind: 'option', values };
}

function addEffectRule(
  settings: UpgradeAddEffectGenerationRule['settings'],
  weight = 40,
): UpgradeAddEffectGenerationRule {
  return { enabled: true, weight, kind: 'add-effect', settings };
}

export const DEFAULT_UPGRADE_GENERATION_CONFIG: UpgradeGenerationConfig = {
  enabled: true,
  previewCardCount: 10,
  parametersPerCard: {
    common: { min: 1, max: 2 },
    rare: { min: 2, max: 3 },
    epic: { min: 3, max: 4 },
    legendary: { min: 4, max: 5 },
  },
  maxParametersPerEffect: 2,
  allowDuplicateParameters: false,
  allowSameAbility: true,
  rarityWeights: {
    common: 100,
    rare: 50,
    epic: 20,
    legendary: 5,
  },
  parameters: {
    'ability-damage-percent': numberRule(percentRanges()),
    'ability-damage-flat': numberRule(flatRanges()),
    'ability-damage-target-type': optionRule(['nearest-enemies', 'random-enemies', 'area-enemies', 'all-enemies', 'castle'], 35),
    'ability-damage-target-count': numberRule(countRanges(), 65),
    'ability-damage-area-height': numberRule(areaRanges(), 65),
    'ability-damage-source': optionRule(['fire', 'ice', 'lightning'], 35),
    'ability-damage-critical-chance': numberRule(percentRanges(), 70),
    'ability-damage-critical-multiplier': numberRule(multiplierRanges(), 55),
    'ability-periodic-damage-percent': numberRule(percentRanges()),
    'ability-periodic-damage-flat': numberRule(flatRanges()),
    'ability-periodic-target-type': optionRule(['nearest-enemies', 'random-enemies', 'area-enemies', 'all-enemies'], 35),
    'ability-periodic-target-count': numberRule(countRanges(), 65),
    'ability-periodic-area-height': numberRule(areaRanges(), 65),
    'ability-periodic-chance': numberRule(percentRanges(), 70),
    'ability-periodic-critical-chance': numberRule(percentRanges(), 60),
    'ability-periodic-critical-multiplier': numberRule(multiplierRanges(), 50),
    'ability-periodic-duration-percent': numberRule(percentRanges(), 70),
    'ability-periodic-duration-flat': numberRule(durationRanges(), 70),
    'ability-periodic-visual-color': optionRule(['#ef4444', '#3b82f6', '#eab308', '#a855f7'], 30),
    'ability-slow-percent': numberRule(percentRanges()),
    'ability-slow-target-type': optionRule(['nearest-enemies', 'random-enemies', 'area-enemies', 'all-enemies'], 35),
    'ability-slow-target-count': numberRule(countRanges(), 65),
    'ability-slow-area-height': numberRule(areaRanges(), 65),
    'ability-slow-duration-percent': numberRule(percentRanges(), 70),
    'ability-slow-duration-flat': numberRule(durationRanges(), 70),
    'ability-heal-percent': numberRule(percentRanges()),
    'ability-heal-flat': numberRule(flatRanges()),
    'ability-add-damage': addEffectRule({
      amount: flatRanges(),
      criticalChancePercent: percentRanges(),
      criticalMultiplier: addedMultiplierRanges(),
      targetCount: countRanges(),
      areaHeightPercent: areaRanges(),
      damageSourceIds: ['fire', 'ice', 'lightning'],
      targetTypes: ['nearest-enemies', 'random-enemies', 'area-enemies', 'all-enemies', 'castle'],
    }),
    'ability-add-periodic-damage': addEffectRule({
      chancePercent: percentRanges(),
      amount: flatRanges(),
      duration: durationRanges(),
      criticalChancePercent: percentRanges(),
      criticalMultiplier: addedMultiplierRanges(),
      targetCount: countRanges(),
      areaHeightPercent: areaRanges(),
      visualColors: ['#ef4444', '#3b82f6', '#eab308', '#a855f7'],
      targetTypes: ['nearest-enemies', 'random-enemies', 'area-enemies', 'all-enemies'],
    }),
    'ability-add-slow': addEffectRule({
      slowPercent: percentRanges(),
      duration: durationRanges(),
      targetCount: countRanges(),
      areaHeightPercent: areaRanges(),
      targetTypes: ['nearest-enemies', 'random-enemies', 'area-enemies', 'all-enemies'],
    }),
    'ability-add-heal': addEffectRule({
      amount: flatRanges(),
      targetTypes: ['castle'],
    }),
  },
};

export function cloneUpgradeGenerationConfig(
  config: UpgradeGenerationConfig = DEFAULT_UPGRADE_GENERATION_CONFIG,
): UpgradeGenerationConfig {
  return structuredClone(config);
}

export const UPGRADE_GENERATION_PARAMETER_TYPES = Object.keys(
  DEFAULT_UPGRADE_GENERATION_CONFIG.parameters,
) as UpgradeEffectType[];
