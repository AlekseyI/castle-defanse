import { getAllowedTargets } from '../../editor/abilities/abilityLogic';
import type { AbilityDefinition, AbilityEffectType, AbilityTargetType } from '../../editor/abilities/types';
import type { DamageSource } from '../../editor/damageSources/types';
import { getUpgradeEffectOption, validateUpgradeCard } from '../../editor/upgrades/upgradeLogic';
import type {
  UpgradeAddEffectGenerationRule,
  UpgradeAddEffectType,
  UpgradeAddedTarget,
  UpgradeCardDefinition,
  UpgradeEffect,
  UpgradeEffectType,
  UpgradeGenerationConfig,
  UpgradeNumberGenerationRule,
  UpgradeNumberRange,
  UpgradeOptionGenerationRule,
  UpgradeParameterGenerationRule,
  UpgradeRarity,
} from '../../editor/upgrades/types';

const RARITIES: UpgradeRarity[] = ['common', 'rare', 'epic', 'legendary'];
const RARITY_LABELS: Record<UpgradeRarity, string> = {
  common: 'Обычное',
  rare: 'Редкое',
  epic: 'Эпическое',
  legendary: 'Легендарное',
};

interface Candidate {
  ability: AbilityDefinition;
  type: UpgradeEffectType;
  rule: UpgradeParameterGenerationRule;
}

function randomIndex(length: number, random: () => number): number {
  if (length <= 1) return 0;
  const raw = Math.min(0.999999999999, Math.max(0, random()));
  return Math.floor(raw * length);
}

function randomInteger(min: number, max: number, random: () => number): number {
  if (max <= min) return min;
  return min + randomIndex(max - min + 1, random);
}

function pickWeighted<T>(
  items: T[],
  weightOf: (item: T) => number,
  random: () => number,
): T | undefined {
  const total = items.reduce((sum, item) => {
    const weight = weightOf(item);
    return Number.isFinite(weight) && weight > 0 ? sum + weight : sum;
  }, 0);
  if (total <= 0) return undefined;

  let cursor = Math.min(0.999999999999, Math.max(0, random())) * total;
  for (const item of items) {
    const weight = weightOf(item);
    if (!Number.isFinite(weight) || weight <= 0) continue;
    cursor -= weight;
    if (cursor < 0) return item;
  }
  return items[items.length - 1];
}

function isValidRange(range: UpgradeNumberRange | undefined): range is UpgradeNumberRange {
  return Boolean(
    range &&
    Number.isFinite(range.min) &&
    Number.isFinite(range.max) &&
    Number.isFinite(range.step) &&
    range.step > 0 &&
    range.min <= range.max,
  );
}

function pickRangeValue(range: UpgradeNumberRange, random: () => number, allowZero = false): number | undefined {
  if (!isValidRange(range)) return undefined;
  const steps = Math.floor((range.max - range.min) / range.step + 1e-9);
  const index = randomIndex(steps + 1, random);
  const precision = Math.max(0, (String(range.step).split('.')[1] ?? '').length);
  let value = Number((range.min + index * range.step).toFixed(Math.min(10, precision + 2)));

  if (!allowZero && value === 0) {
    for (let offset = 1; offset <= steps; offset += 1) {
      const upIndex = index + offset;
      if (upIndex <= steps) {
        const candidate = Number((range.min + upIndex * range.step).toFixed(Math.min(10, precision + 2)));
        if (candidate !== 0) return candidate;
      }
      const downIndex = index - offset;
      if (downIndex >= 0) {
        const candidate = Number((range.min + downIndex * range.step).toFixed(Math.min(10, precision + 2)));
        if (candidate !== 0) return candidate;
      }
    }
    return undefined;
  }

  if (value > range.max) value = range.max;
  return value;
}

function abilitySupportsParameter(ability: AbilityDefinition, type: UpgradeEffectType): boolean {
  if (!ability.allowedUpgradeParameters.includes(type)) return false;
  const option = getUpgradeEffectOption(type);
  if (!option) return false;
  if (option.valueKind === 'add-effect') return true;
  return ability.effects.some((effect) => effect.type === option.abilityEffectType);
}

function getOptionValues(candidate: Candidate, damageSources: DamageSource[]): string[] {
  const rule = candidate.rule as UpgradeOptionGenerationRule;
  const option = getUpgradeEffectOption(candidate.type);
  if (!option) return [];

  if (option.valueKind === 'damage-source') {
    const validSources = new Set(damageSources.map((source) => source.id));
    return rule.values.filter((value) => validSources.has(value));
  }

  if (option.valueKind === 'target-type') {
    const allowed = new Set(getAllowedTargets(option.abilityEffectType));
    return rule.values.filter((value) => allowed.has(value as AbilityTargetType));
  }

  return rule.values.filter((value) => /^#[0-9a-fA-F]{6}$/.test(value));
}

function addRuleHasValueForRarity(rule: UpgradeAddEffectGenerationRule, rarity: UpgradeRarity): boolean {
  const settings = rule.settings;
  const rangeKeys = [
    'amount',
    'chancePercent',
    'duration',
    'criticalChancePercent',
    'criticalMultiplier',
    'slowPercent',
    'targetCount',
    'areaHeightPercent',
  ] as const;
  return settings.targetTypes.length > 0 && rangeKeys.every((key) => (
    settings[key] === undefined || isValidRange(settings[key]?.[rarity])
  ));
}

function candidateSupportsRarity(
  candidate: Candidate,
  rarity: UpgradeRarity,
  damageSources: DamageSource[],
): boolean {
  if (!candidate.rule.enabled || candidate.rule.weight <= 0) return false;
  if (candidate.rule.kind === 'number') {
    const range = candidate.rule.ranges[rarity];
    if (!isValidRange(range)) return false;
    return range.min !== 0 || range.max !== 0;
  }
  if (candidate.rule.kind === 'option') return getOptionValues(candidate, damageSources).length > 0;
  if (!addRuleHasValueForRarity(candidate.rule, rarity)) return false;

  if (candidate.type === 'ability-add-damage') {
    const ids = new Set(damageSources.map((source) => source.id));
    return Boolean(candidate.rule.settings.damageSourceIds?.some((id) => ids.has(id)));
  }
  if (candidate.type === 'ability-add-periodic-damage') {
    return Boolean(candidate.rule.settings.visualColors?.some((color) => /^#[0-9a-fA-F]{6}$/.test(color)));
  }
  return true;
}

function createTarget(
  targetTypes: AbilityTargetType[],
  effectType: AbilityEffectType,
  rarity: UpgradeRarity,
  rule: UpgradeAddEffectGenerationRule,
  random: () => number,
): UpgradeAddedTarget | undefined {
  const allowed = new Set(getAllowedTargets(effectType));
  const candidates = targetTypes.filter((type) => allowed.has(type));
  if (candidates.length === 0) return undefined;

  const type = candidates[randomIndex(candidates.length, random)];
  if (type === 'nearest-enemies' || type === 'random-enemies') {
    const count = rule.settings.targetCount
      ? pickRangeValue(rule.settings.targetCount[rarity], random)
      : 1;
    if (count === undefined) return undefined;
    return { type, count: Math.max(1, Math.floor(count)), areaHeightPercent: 0 };
  }
  if (type === 'area-enemies') {
    const areaHeightPercent = rule.settings.areaHeightPercent
      ? pickRangeValue(rule.settings.areaHeightPercent[rarity], random)
      : 50;
    if (areaHeightPercent === undefined) return undefined;
    return { type, count: 0, areaHeightPercent: Math.min(100, Math.max(1, areaHeightPercent)) };
  }
  return { type, count: 0, areaHeightPercent: 0 };
}

type AddRangeKey =
  | 'amount'
  | 'chancePercent'
  | 'duration'
  | 'criticalChancePercent'
  | 'criticalMultiplier'
  | 'slowPercent'
  | 'targetCount'
  | 'areaHeightPercent';

function rangeValue(
  rule: UpgradeAddEffectGenerationRule,
  key: AddRangeKey,
  rarity: UpgradeRarity,
  random: () => number,
  allowZero = true,
): number | undefined {
  const ranges = rule.settings[key];
  if (!ranges) return undefined;
  return pickRangeValue(ranges[rarity], random, allowZero);
}

function createAddEffect(
  candidate: Candidate,
  rarity: UpgradeRarity,
  damageSources: DamageSource[],
  random: () => number,
): UpgradeEffect | undefined {
  const type = candidate.type as UpgradeAddEffectType;
  const rule = candidate.rule as UpgradeAddEffectGenerationRule;
  const option = getUpgradeEffectOption(type);
  if (!option) return undefined;
  const target = createTarget(rule.settings.targetTypes, option.abilityEffectType, rarity, rule, random);
  if (!target) return undefined;

  if (type === 'ability-add-damage') {
    const validSources = new Set(damageSources.map((source) => source.id));
    const sources = (rule.settings.damageSourceIds ?? []).filter((id) => validSources.has(id));
    const amount = rangeValue(rule, 'amount', rarity, random, false);
    if (sources.length === 0 || amount === undefined) return undefined;
    return {
      type,
      abilityId: candidate.ability.id,
      value: {
        amount,
        damageSourceId: sources[randomIndex(sources.length, random)],
        criticalChancePercent: rangeValue(rule, 'criticalChancePercent', rarity, random) ?? 0,
        criticalMultiplier: rangeValue(rule, 'criticalMultiplier', rarity, random) ?? 0,
        target,
      },
    };
  }

  if (type === 'ability-add-periodic-damage') {
    const colors = (rule.settings.visualColors ?? []).filter((color) => /^#[0-9a-fA-F]{6}$/.test(color));
    const amount = rangeValue(rule, 'amount', rarity, random, false);
    const duration = rangeValue(rule, 'duration', rarity, random, false);
    if (colors.length === 0 || amount === undefined || duration === undefined) return undefined;
    return {
      type,
      abilityId: candidate.ability.id,
      value: {
        chancePercent: rangeValue(rule, 'chancePercent', rarity, random) ?? 0,
        amount,
        duration,
        criticalChancePercent: rangeValue(rule, 'criticalChancePercent', rarity, random) ?? 0,
        criticalMultiplier: rangeValue(rule, 'criticalMultiplier', rarity, random) ?? 0,
        visualColor: colors[randomIndex(colors.length, random)],
        target,
      },
    };
  }

  if (type === 'ability-add-slow') {
    const slowPercent = rangeValue(rule, 'slowPercent', rarity, random, false);
    const duration = rangeValue(rule, 'duration', rarity, random, false);
    if (slowPercent === undefined || duration === undefined) return undefined;
    return {
      type,
      abilityId: candidate.ability.id,
      value: { slowPercent, duration, target },
    };
  }

  const amount = rangeValue(rule, 'amount', rarity, random, false);
  if (amount === undefined) return undefined;
  return {
    type,
    abilityId: candidate.ability.id,
    value: { amount, target },
  };
}

function createEffect(
  candidate: Candidate,
  rarity: UpgradeRarity,
  damageSources: DamageSource[],
  random: () => number,
): UpgradeEffect | undefined {
  if (candidate.rule.kind === 'number') {
    const value = pickRangeValue((candidate.rule as UpgradeNumberGenerationRule).ranges[rarity], random);
    if (value === undefined) return undefined;
    return { type: candidate.type, abilityId: candidate.ability.id, value } as UpgradeEffect;
  }

  if (candidate.rule.kind === 'option') {
    const values = getOptionValues(candidate, damageSources);
    if (values.length === 0) return undefined;
    const selected = values[randomIndex(values.length, random)];
    const option = getUpgradeEffectOption(candidate.type);
    if (option?.valueKind === 'target-type') {
      const type = selected as AbilityTargetType;
      return {
        type: candidate.type,
        abilityId: candidate.ability.id,
        value: {
          type,
          count: type === 'nearest-enemies' || type === 'random-enemies' ? 1 : 0,
          areaHeightPercent: type === 'area-enemies' ? 50 : 0,
        },
      } as UpgradeEffect;
    }
    return { type: candidate.type, abilityId: candidate.ability.id, value: selected } as UpgradeEffect;
  }

  return createAddEffect(candidate, rarity, damageSources, random);
}

function buildCandidates(config: UpgradeGenerationConfig, abilities: AbilityDefinition[]): Candidate[] {
  const candidates: Candidate[] = [];
  for (const ability of abilities) {
    for (const [type, rule] of Object.entries(config.parameters) as [UpgradeEffectType, UpgradeParameterGenerationRule][]) {
      if (!rule.enabled || rule.weight <= 0 || !abilitySupportsParameter(ability, type)) continue;
      candidates.push({ ability, type, rule });
    }
  }
  return candidates;
}

function availableCandidates(
  candidates: Candidate[],
  rarity: UpgradeRarity,
  damageSources: DamageSource[],
  config: UpgradeGenerationConfig,
  selectedAcrossCards: Candidate[],
): Candidate[] {
  const usedTypes = new Set(selectedAcrossCards.map((item) => item.type));
  const usedAbilities = new Set(selectedAcrossCards.map((item) => item.ability.id));
  return candidates.filter((candidate) => (
    candidateSupportsRarity(candidate, rarity, damageSources) &&
    (config.allowDuplicateParameters || !usedTypes.has(candidate.type)) &&
    (config.allowSameAbility || !usedAbilities.has(candidate.ability.id))
  ));
}

function getParameterCountBounds(
  config: UpgradeGenerationConfig,
  rarity: UpgradeRarity,
): { min: number; max: number } {
  const range = config.parametersPerCard[rarity];
  const min = Math.max(1, Math.floor(range.min));
  const max = Math.max(min, Math.floor(range.max));
  return { min, max };
}

function createReceiveKey(abilityId: string, candidates: Candidate[]): string {
  const types = candidates.map((candidate) => candidate.type).sort();
  return `${abilityId}:${types.join('+')}`;
}

function createGeneratedCard(
  available: Candidate[],
  rarity: UpgradeRarity,
  config: UpgradeGenerationConfig,
  damageSources: DamageSource[],
  counts: Record<string, number>,
  maxCardReceives: number,
  slot: number,
  random: () => number,
): { card: UpgradeCardDefinition; candidates: Candidate[] } | undefined {
  const { min, max } = getParameterCountBounds(config, rarity);
  const byAbility = new Map<string, Candidate[]>();
  for (const candidate of available) {
    const current = byAbility.get(candidate.ability.id) ?? [];
    current.push(candidate);
    byAbility.set(candidate.ability.id, current);
  }

  const abilities = Array.from(byAbility.entries())
    .filter(([, items]) => items.length >= min)
    .map(([abilityId, items]) => ({ abilityId, items }));
  if (abilities.length === 0) return undefined;

  const attempts = Math.max(8, abilities.length * 4);
  const blockedKeys = new Set<string>();
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const abilityChoice = pickWeighted(
      abilities,
      (entry) => entry.items.reduce((sum, item) => sum + Math.max(0, item.rule.weight), 0),
      random,
    );
    if (!abilityChoice) return undefined;

    const desiredCount = randomInteger(min, Math.min(max, abilityChoice.items.length), random);
    const remaining = [...abilityChoice.items];
    const chosen: Candidate[] = [];
    const effects: UpgradeEffect[] = [];

    while (chosen.length < desiredCount && remaining.length > 0) {
      const candidate = pickWeighted(remaining, (item) => item.rule.weight, random);
      if (!candidate) break;
      remaining.splice(remaining.indexOf(candidate), 1);
      const effect = createEffect(candidate, rarity, damageSources, random);
      if (!effect) continue;
      chosen.push(candidate);
      effects.push(effect);
    }

    if (chosen.length < min) continue;
    const receiveKey = createReceiveKey(abilityChoice.abilityId, chosen);
    if (blockedKeys.has(receiveKey) || (counts[receiveKey] ?? 0) >= maxCardReceives) {
      blockedKeys.add(receiveKey);
      continue;
    }

    const ability = chosen[0].ability;
    const labels = chosen.map((candidate) => getUpgradeEffectOption(candidate.type)?.label ?? candidate.type);
    const averageWeight = chosen.reduce((sum, candidate) => sum + candidate.rule.weight, 0) / chosen.length;
    const card: UpgradeCardDefinition = {
      id: `generated_${ability.id}_${chosen.map((item) => item.type).sort().join('_')}_${rarity}_${slot}`,
      receiveKey,
      name: chosen.length === 1 ? `${ability.name}: ${labels[0]}` : `${ability.name}: ${chosen.length} улучшения`,
      description: chosen.length === 1
        ? `${RARITY_LABELS[rarity]} улучшение способности «${ability.name}».`
        : `${RARITY_LABELS[rarity]} улучшение способности «${ability.name}»: ${labels.join(', ')}.`,
      rarity,
      weight: averageWeight,
      effects,
      color: ability.color,
      image: ability.image ? { ...ability.image } : undefined,
    };

    if (!validateUpgradeCard(card, [], [ability], undefined, damageSources).valid) continue;
    return { card, candidates: chosen };
  }

  return undefined;
}

export function generateUpgradeChoices(
  config: UpgradeGenerationConfig,
  abilities: AbilityDefinition[],
  damageSources: DamageSource[],
  counts: Record<string, number>,
  cardCount: number,
  maxCardReceives: number,
  random: () => number = Math.random,
): UpgradeCardDefinition[] {
  if (!config.enabled) return [];
  const targetCount = Math.max(0, Math.floor(cardCount));
  if (targetCount === 0) return [];

  const candidates = buildCandidates(config, abilities);
  if (candidates.length === 0) return [];

  const selectedAcrossCards: Candidate[] = [];
  const cards: UpgradeCardDefinition[] = [];
  const maxAttempts = Math.max(20, targetCount * 20);
  let attempts = 0;

  while (cards.length < targetCount && attempts < maxAttempts) {
    attempts += 1;
    const availableRarities = RARITIES.filter((rarity) => {
      if (config.rarityWeights[rarity] <= 0) return false;
      const available = availableCandidates(candidates, rarity, damageSources, config, selectedAcrossCards);
      const { min } = getParameterCountBounds(config, rarity);
      const abilityCounts = new Map<string, number>();
      for (const candidate of available) {
        abilityCounts.set(candidate.ability.id, (abilityCounts.get(candidate.ability.id) ?? 0) + 1);
      }
      return Array.from(abilityCounts.values()).some((count) => count >= min);
    });
    const rarity = pickWeighted(availableRarities, (item) => config.rarityWeights[item], random);
    if (!rarity) break;

    const available = availableCandidates(candidates, rarity, damageSources, config, selectedAcrossCards);
    const generated = createGeneratedCard(
      available,
      rarity,
      config,
      damageSources,
      counts,
      maxCardReceives,
      cards.length,
      random,
    );
    if (!generated) break;

    cards.push(generated.card);
    selectedAcrossCards.push(...generated.candidates);
  }

  return cards;
}

function manualCardIsAvailable(
  card: UpgradeCardDefinition,
  manualCards: UpgradeCardDefinition[],
  abilities: AbilityDefinition[],
  damageSources: DamageSource[],
  counts: Record<string, number>,
  maxCardReceives: number,
): boolean {
  const receiveKey = card.receiveKey ?? card.id;
  if ((counts[receiveKey] ?? 0) >= maxCardReceives) return false;
  return validateUpgradeCard(card, manualCards, abilities, card.id, damageSources).valid;
}

export function buildUpgradeChoices(
  config: UpgradeGenerationConfig,
  manualCards: UpgradeCardDefinition[],
  abilities: AbilityDefinition[],
  damageSources: DamageSource[],
  counts: Record<string, number>,
  cardCount: number,
  maxCardReceives: number,
  random: () => number = Math.random,
): UpgradeCardDefinition[] {
  const targetCount = Math.max(0, Math.floor(cardCount));
  if (targetCount === 0) return [];

  const generated = generateUpgradeChoices(
    config,
    abilities,
    damageSources,
    counts,
    targetCount,
    maxCardReceives,
    random,
  );
  const manual = manualCards.filter((card) => manualCardIsAvailable(
    card,
    manualCards,
    abilities,
    damageSources,
    counts,
    maxCardReceives,
  ));
  const pool = [...manual, ...generated];
  const selected: UpgradeCardDefinition[] = [];

  while (selected.length < targetCount && pool.length > 0) {
    const card = pickWeighted(pool, (item) => item.weight, random);
    if (!card) break;
    selected.push(card);
    pool.splice(pool.indexOf(card), 1);
  }

  return selected;
}
