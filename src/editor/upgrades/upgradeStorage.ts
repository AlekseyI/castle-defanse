import { DEFAULT_UPGRADES } from './defaultUpgrades';
import type {
  UpgradeCardDefinition,
  UpgradeCardImage,
  UpgradeEffect,
  UpgradeEffectType,
  UpgradeRarity,
} from './types';

const STORAGE_KEY = 'game.upgrades.v1';
const CARD_KEYS = new Set(['id', 'name', 'description', 'rarity', 'weight', 'maxCount', 'effects', 'color', 'image']);
const EFFECT_KEYS = new Set(['type', 'abilityId', 'value']);
const IMAGE_KEYS = new Set(['name', 'src']);
const EFFECT_TYPES = new Set<UpgradeEffectType>([
  'ability-damage-percent',
  'ability-damage-flat',
  'ability-damage-target-count',
  'ability-damage-critical-chance',
  'ability-periodic-damage-percent',
  'ability-periodic-damage-flat',
  'ability-periodic-target-count',
  'ability-periodic-critical-chance',
  'ability-periodic-duration-percent',
  'ability-periodic-duration-flat',
  'ability-slow-percent',
  'ability-slow-target-count',
  'ability-slow-duration-percent',
  'ability-slow-duration-flat',
  'ability-heal-percent',
  'ability-heal-flat',
]);
const RARITIES = new Set<UpgradeRarity>(['common', 'rare', 'epic', 'legendary']);

function hasOnlyKeys(value: Record<string, unknown>, keys: Set<string>): boolean {
  return Object.keys(value).every((key) => keys.has(key));
}

function isImage(value: unknown): value is UpgradeCardImage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const image = value as Record<string, unknown>;
  return hasOnlyKeys(image, IMAGE_KEYS) && typeof image.name === 'string' && typeof image.src === 'string';
}

function isEffect(value: unknown): value is UpgradeEffect {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const effect = value as Record<string, unknown>;
  return (
    hasOnlyKeys(effect, EFFECT_KEYS) &&
    typeof effect.type === 'string' && EFFECT_TYPES.has(effect.type as UpgradeEffectType) &&
    typeof effect.abilityId === 'string' &&
    typeof effect.value === 'number' && Number.isFinite(effect.value) && effect.value > 0 &&
    (!String(effect.type).endsWith('-target-count') || Number.isInteger(effect.value))
  );
}

function isCard(value: unknown): value is UpgradeCardDefinition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const card = value as Record<string, unknown>;
  return (
    hasOnlyKeys(card, CARD_KEYS) &&
    typeof card.id === 'string' &&
    typeof card.name === 'string' &&
    typeof card.description === 'string' &&
    typeof card.rarity === 'string' && RARITIES.has(card.rarity as UpgradeRarity) &&
    typeof card.weight === 'number' && Number.isFinite(card.weight) && card.weight > 0 &&
    typeof card.maxCount === 'number' && Number.isInteger(card.maxCount) && card.maxCount >= 1 &&
    Array.isArray(card.effects) && card.effects.length > 0 && card.effects.every(isEffect) &&
    (card.color === undefined || typeof card.color === 'string') &&
    (card.image === undefined || isImage(card.image))
  );
}

function cloneDefaults(): UpgradeCardDefinition[] {
  return DEFAULT_UPGRADES.map((card) => ({
    ...card,
    effects: card.effects.map((effect) => ({ ...effect })),
    image: card.image ? { ...card.image } : undefined,
  }));
}

export function loadUpgrades(): UpgradeCardDefinition[] {
  if (typeof window === 'undefined') return cloneDefaults();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return cloneDefaults();

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isCard)) return cloneDefaults();
    return parsed;
  } catch {
    return cloneDefaults();
  }
}

export function persistUpgrades(cards: UpgradeCardDefinition[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}
