import { cloneUpgradeGenerationConfig } from './defaultUpgradeGeneration';
import { cloneUpgradeCard } from './upgradeLogic';
import type {
  UpgradeCardDefinition,
  UpgradeEffectType,
  UpgradeGenerationConfig,
  UpgradeNumberRange,
  UpgradeParameterCountRange,
  UpgradeParameterGenerationRule,
  UpgradeRarity,
  UpgradeRarityRanges,
} from './types';
import { UPGRADE_EFFECT_TYPES } from './types';

const GENERATION_STORAGE_KEY = 'game.upgrade-generation.v5';
const CARDS_STORAGE_KEY = 'game.upgrade-cards.v1';
const LEGACY_GENERATION_STORAGE_KEYS = [
  'game.upgrade-generation.v1',
  'game.upgrade-generation.v2',
  'game.upgrade-generation.v3',
  'game.upgrade-generation.v4',
];
const LEGACY_CARDS_STORAGE_KEY = 'game.upgrades.v3';
const RARITIES: UpgradeRarity[] = ['common', 'rare', 'epic', 'legendary'];
const TARGET_TYPES = new Set(['nearest-enemies', 'random-enemies', 'area-enemies', 'all-enemies', 'castle']);
const EFFECT_TYPES = new Set<string>(UPGRADE_EFFECT_TYPES);

function removeLegacyStorage(): void {
  if (typeof window === 'undefined') return;
  LEGACY_GENERATION_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
  window.localStorage.removeItem(LEGACY_CARDS_STORAGE_KEY);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRange(value: unknown): value is UpgradeNumberRange {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const range = value as Record<string, unknown>;
  return (
    Object.keys(range).length === 3 &&
    isFiniteNumber(range.min) &&
    isFiniteNumber(range.max) &&
    isFiniteNumber(range.step) &&
    range.step > 0
  );
}

function isRanges(value: unknown): value is UpgradeRarityRanges {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const ranges = value as Record<string, unknown>;
  return (
    Object.keys(ranges).length === RARITIES.length &&
    RARITIES.every((rarity) => isRange(ranges[rarity]))
  );
}

function isParameterCountRange(value: unknown): value is UpgradeParameterCountRange {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const range = value as Record<string, unknown>;
  return (
    Object.keys(range).length === 2 &&
    isFiniteNumber(range.min) && Number.isInteger(range.min) && range.min >= 1 &&
    isFiniteNumber(range.max) && Number.isInteger(range.max) && range.max >= range.min
  );
}

function isParameterCountRanges(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const ranges = value as Record<string, unknown>;
  return (
    Object.keys(ranges).length === RARITIES.length &&
    RARITIES.every((rarity) => isParameterCountRange(ranges[rarity]))
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isBaseRule(value: Record<string, unknown>): boolean {
  return (
    typeof value.enabled === 'boolean' &&
    isFiniteNumber(value.weight) &&
    value.weight >= 0
  );
}

function isNumberRule(value: Record<string, unknown>): boolean {
  return value.kind === 'number' && isBaseRule(value) && isRanges(value.ranges);
}

function isOptionRule(value: Record<string, unknown>): boolean {
  return value.kind === 'option' && isBaseRule(value) && isStringArray(value.values);
}

function isAddEffectRule(value: Record<string, unknown>): boolean {
  if (value.kind !== 'add-effect' || !isBaseRule(value) || !value.settings || typeof value.settings !== 'object' || Array.isArray(value.settings)) {
    return false;
  }

  const settings = value.settings as Record<string, unknown>;
  const rangeKeys = [
    'amount',
    'chancePercent',
    'duration',
    'criticalChancePercent',
    'criticalMultiplier',
    'slowPercent',
    'targetCount',
    'areaHeightPercent',
  ];

  for (const key of rangeKeys) {
    if (settings[key] !== undefined && !isRanges(settings[key])) return false;
  }
  if (settings.damageSourceIds !== undefined && !isStringArray(settings.damageSourceIds)) return false;
  if (settings.visualColors !== undefined && !isStringArray(settings.visualColors)) return false;
  if (!isStringArray(settings.targetTypes) || settings.targetTypes.some((type) => !TARGET_TYPES.has(type))) return false;
  return true;
}

function isRule(value: unknown): value is UpgradeParameterGenerationRule {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const rule = value as Record<string, unknown>;
  return isNumberRule(rule) || isOptionRule(rule) || isAddEffectRule(rule);
}

function isConfig(value: unknown): value is UpgradeGenerationConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const config = value as Record<string, unknown>;
  if (
    typeof config.enabled !== 'boolean' ||
    !isFiniteNumber(config.previewCardCount) || !Number.isInteger(config.previewCardCount) || config.previewCardCount < 1 ||
    !isParameterCountRanges(config.parametersPerCard) ||
    !isFiniteNumber(config.maxParametersPerEffect) || !Number.isInteger(config.maxParametersPerEffect) || config.maxParametersPerEffect < 1 ||
    typeof config.allowDuplicateParameters !== 'boolean' ||
    typeof config.allowSameAbility !== 'boolean' ||
    !config.rarityWeights || typeof config.rarityWeights !== 'object' || Array.isArray(config.rarityWeights) ||
    !config.parameters || typeof config.parameters !== 'object' || Array.isArray(config.parameters)
  ) return false;

  const rarityWeights = config.rarityWeights as Record<string, unknown>;
  if (!RARITIES.every((rarity) => isFiniteNumber(rarityWeights[rarity]) && rarityWeights[rarity] >= 0)) return false;

  const parameters = config.parameters as Record<string, unknown>;
  return UPGRADE_EFFECT_TYPES.every((type: UpgradeEffectType) => isRule(parameters[type]));
}

function isTargetValue(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const target = value as Record<string, unknown>;
  return (
    typeof target.type === 'string' && TARGET_TYPES.has(target.type) &&
    isFiniteNumber(target.count) &&
    isFiniteNumber(target.areaHeightPercent)
  );
}

function isEffectValue(value: unknown): boolean {
  if (typeof value === 'number' || typeof value === 'string') return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const object = value as Record<string, unknown>;
  if ('target' in object) {
    if (!isTargetValue(object.target)) return false;
    return Object.entries(object).every(([key, field]) => (
      key === 'target' || typeof field === 'string' || isFiniteNumber(field)
    ));
  }
  return isTargetValue(value);
}

function isCard(value: unknown): value is UpgradeCardDefinition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const card = value as Record<string, unknown>;
  if (
    typeof card.id !== 'string' ||
    typeof card.name !== 'string' ||
    typeof card.description !== 'string' ||
    typeof card.rarity !== 'string' || !RARITIES.includes(card.rarity as UpgradeRarity) ||
    !isFiniteNumber(card.weight) ||
    !Array.isArray(card.effects)
  ) return false;

  if (card.receiveKey !== undefined && typeof card.receiveKey !== 'string') return false;
  if (card.color !== undefined && typeof card.color !== 'string') return false;
  if (card.image !== undefined) {
    if (!card.image || typeof card.image !== 'object' || Array.isArray(card.image)) return false;
    const image = card.image as Record<string, unknown>;
    if (typeof image.name !== 'string' || typeof image.src !== 'string') return false;
  }

  return card.effects.every((effect) => {
    if (!effect || typeof effect !== 'object' || Array.isArray(effect)) return false;
    const item = effect as Record<string, unknown>;
    return (
      typeof item.type === 'string' && EFFECT_TYPES.has(item.type) &&
      typeof item.abilityId === 'string' &&
      isEffectValue(item.value)
    );
  });
}

export function loadUpgradeGenerationConfig(): UpgradeGenerationConfig {
  if (typeof window === 'undefined') return cloneUpgradeGenerationConfig();

  removeLegacyStorage();
  const raw = window.localStorage.getItem(GENERATION_STORAGE_KEY);
  if (!raw) return cloneUpgradeGenerationConfig();

  try {
    const parsed: unknown = JSON.parse(raw);
    return isConfig(parsed) ? cloneUpgradeGenerationConfig(parsed) : cloneUpgradeGenerationConfig();
  } catch {
    return cloneUpgradeGenerationConfig();
  }
}

export function persistUpgradeGenerationConfig(config: UpgradeGenerationConfig): void {
  removeLegacyStorage();
  window.localStorage.setItem(GENERATION_STORAGE_KEY, JSON.stringify(config));
}

export function loadUpgradeCards(): UpgradeCardDefinition[] {
  if (typeof window === 'undefined') return [];

  removeLegacyStorage();
  const raw = window.localStorage.getItem(CARDS_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(isCard)
      ? parsed.map((card) => cloneUpgradeCard(card))
      : [];
  } catch {
    return [];
  }
}

export function persistUpgradeCards(cards: UpgradeCardDefinition[]): void {
  removeLegacyStorage();
  window.localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(cards));
}
