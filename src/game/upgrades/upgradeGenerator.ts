import { getAllowedTargets } from '../../editor/abilities/abilityLogic';
import type { AbilityDefinition, AbilityEffectType, AbilityTargetType } from '../../editor/abilities/types';
import type { DamageSource } from '../../editor/damageSources/types';
import {
  getUpgradeEffectOption,
  validateUpgradeCard,
} from '../../editor/upgrades/upgradeLogic';
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
import { applyAbilityRuntimeModifier, type AbilityRuntimeModifiers } from './upgradeCalculator';

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

const COMPLEMENTARY_PARAMETERS: Partial<Record<UpgradeEffectType, UpgradeEffectType[]>> = {
  'ability-damage-critical-chance': ['ability-damage-critical-multiplier'],
  'ability-damage-critical-multiplier': ['ability-damage-critical-chance'],
  'ability-periodic-critical-chance': ['ability-periodic-critical-multiplier'],
  'ability-periodic-critical-multiplier': ['ability-periodic-critical-chance'],
};

const CONFLICTING_PARAMETERS: Partial<Record<UpgradeEffectType, UpgradeEffectType[]>> = {
  'ability-damage-percent': ['ability-damage-flat'],
  'ability-damage-target-count': ['ability-damage-area-height'],
  'ability-periodic-damage-percent': ['ability-periodic-damage-flat'],
  'ability-periodic-target-count': ['ability-periodic-area-height'],
  'ability-periodic-duration-percent': ['ability-periodic-duration-flat'],
  'ability-slow-target-count': ['ability-slow-area-height'],
  'ability-slow-duration-percent': ['ability-slow-duration-flat'],
  'ability-heal-percent': ['ability-heal-flat'],
};

function areComplementaryParameters(left: UpgradeEffectType, right: UpgradeEffectType): boolean {
  return COMPLEMENTARY_PARAMETERS[left]?.includes(right) === true
    || COMPLEMENTARY_PARAMETERS[right]?.includes(left) === true;
}

function parameterFamily(type: UpgradeEffectType): AbilityEffectType | undefined {
  return getUpgradeEffectOption(type)?.abilityEffectType;
}

function areConflictingParameters(left: UpgradeEffectType, right: UpgradeEffectType): boolean {
  return CONFLICTING_PARAMETERS[left]?.includes(right) === true
    || CONFLICTING_PARAMETERS[right]?.includes(left) === true;
}

function canAddCandidate(
  candidate: Candidate,
  chosen: Candidate[],
  maxParametersPerEffect: number,
): boolean {
  if (chosen.some((selected) => areConflictingParameters(selected.type, candidate.type))) return false;

  const family = parameterFamily(candidate.type);
  if (!family) return true;
  const familyCount = chosen.filter((selected) => parameterFamily(selected.type) === family).length;
  return familyCount < maxParametersPerEffect;
}

function isCandidateSetCompatible(candidates: Candidate[], maxParametersPerEffect: number): boolean {
  return candidates.every((candidate, index) => (
    canAddCandidate(candidate, candidates.slice(0, index), maxParametersPerEffect)
  ));
}

function maxCompatibleCandidateCount(candidates: Candidate[], maxParametersPerEffect: number): number {
  const byFamily = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const family = parameterFamily(candidate.type) ?? candidate.type;
    const items = byFamily.get(family) ?? [];
    items.push(candidate);
    byFamily.set(family, items);
  }

  let total = 0;
  for (const items of byFamily.values()) {
    let best = 0;
    const chosen: Candidate[] = [];

    const visit = (index: number) => {
      best = Math.max(best, chosen.length);
      if (best >= maxParametersPerEffect || index >= items.length) return;
      if (chosen.length + items.length - index <= best) return;

      for (let itemIndex = index; itemIndex < items.length; itemIndex += 1) {
        const candidate = items[itemIndex];
        if (!canAddCandidate(candidate, chosen, maxParametersPerEffect)) continue;
        chosen.push(candidate);
        visit(itemIndex + 1);
        chosen.pop();
        if (best >= maxParametersPerEffect) return;
      }
    };

    visit(0);
    total += best;
  }

  return total;
}

function pickCoherentCandidate(
  remaining: Candidate[],
  chosen: Candidate[],
  slotsLeft: number,
  maxParametersPerEffect: number,
  random: () => number,
): Candidate | undefined {
  const compatibleRemaining = remaining.filter((candidate) => (
    canAddCandidate(candidate, chosen, maxParametersPerEffect)
  ));
  if (compatibleRemaining.length === 0) return undefined;

  if (chosen.length === 0) {
    return pickWeighted(compatibleRemaining, (item) => item.rule.weight, random);
  }

  const complementary = compatibleRemaining.filter((candidate) =>
    chosen.some((selected) => areComplementaryParameters(selected.type, candidate.type)),
  );
  if (complementary.length > 0) {
    return pickWeighted(complementary, (item) => item.rule.weight, random);
  }

  const safeRemaining = slotsLeft === 1
    ? compatibleRemaining.filter((candidate) => !compatibleRemaining.some((other) => (
      other !== candidate && areComplementaryParameters(candidate.type, other.type)
    )))
    : compatibleRemaining;
  const candidatePool = safeRemaining.length > 0 ? safeRemaining : compatibleRemaining;

  const selectedFamilies = new Set(chosen.map((candidate) => parameterFamily(candidate.type)));
  const sameFamily = candidatePool.filter((candidate) => selectedFamilies.has(parameterFamily(candidate.type)));
  if (sameFamily.length > 0) {
    return pickWeighted(sameFamily, (item) => item.rule.weight, random);
  }

  return pickWeighted(candidatePool, (item) => item.rule.weight, random);
}

function findComplementaryRepair(
  chosen: Candidate[],
  remaining: Candidate[],
  maxParametersPerEffect: number,
): { replacementIndex: number; counterpart: Candidate } | undefined {
  for (let orphanIndex = 0; orphanIndex < chosen.length; orphanIndex += 1) {
    const orphan = chosen[orphanIndex];
    const alreadyPaired = chosen.some((candidate, index) => (
      index !== orphanIndex && areComplementaryParameters(orphan.type, candidate.type)
    ));
    if (alreadyPaired) continue;

    const counterpart = remaining.find((candidate) => areComplementaryParameters(orphan.type, candidate.type));
    if (!counterpart) continue;

    const replacementIndexes = chosen
      .map((candidate, index) => ({ candidate, index }))
      .filter(({ index }) => index !== orphanIndex)
      .filter(({ candidate, index }) => !chosen.some((other, otherIndex) => (
        otherIndex !== index && areComplementaryParameters(candidate.type, other.type)
      )))
      .filter(({ index }) => isCandidateSetCompatible(
        chosen.map((candidate, candidateIndex) => (
          candidateIndex === index ? counterpart : candidate
        )),
        maxParametersPerEffect,
      ))
      .sort((left, right) => {
        const leftSameFamily = parameterFamily(left.candidate.type) === parameterFamily(orphan.type) ? 1 : 0;
        const rightSameFamily = parameterFamily(right.candidate.type) === parameterFamily(orphan.type) ? 1 : 0;
        return leftSameFamily - rightSameFamily;
      });

    const replacementIndex = replacementIndexes[0]?.index;
    if (replacementIndex !== undefined) {
      return { replacementIndex, counterpart };
    }
  }

  return undefined;
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

const CRITICAL_CHANCE_TYPES: Partial<Record<UpgradeEffectType, UpgradeEffectType>> = {
  'ability-damage-critical-multiplier': 'ability-damage-critical-chance',
  'ability-periodic-critical-multiplier': 'ability-periodic-critical-chance',
};

function abilitySupportsParameter(ability: AbilityDefinition, type: UpgradeEffectType): boolean {
  if (!ability.allowedUpgradeParameters.includes(type)) return false;
  const option = getUpgradeEffectOption(type);
  if (!option) return false;

  const hasEffect = ability.effects.some((effect) => effect.type === option.abilityEffectType);
  return option.valueKind === 'add-effect' ? !hasEffect : hasEffect;
}

function withRuntimeModifiers(
  abilities: AbilityDefinition[],
  abilityModifiers: AbilityRuntimeModifiers,
): AbilityDefinition[] {
  return abilities.map((ability) => applyAbilityRuntimeModifier(ability, abilityModifiers[ability.id]));
}

function hasActiveCriticalChance(ability: AbilityDefinition, multiplierType: UpgradeEffectType): boolean {
  const option = getUpgradeEffectOption(multiplierType);
  if (!option) return false;

  return ability.effects.some((effect) => (
    effect.type === option.abilityEffectType &&
    (effect.type === 'damage' || effect.type === 'periodic-damage') &&
    effect.criticalChancePercent > 0
  ));
}

function projectedCriticalChanceIsActive(
  ability: AbilityDefinition,
  card: UpgradeCardDefinition,
  multiplierType: UpgradeEffectType,
): boolean {
  const chanceType = CRITICAL_CHANCE_TYPES[multiplierType];
  const option = getUpgradeEffectOption(multiplierType);
  if (!chanceType || !option) return true;

  const chances = ability.effects
    .filter((effect) => effect.type === option.abilityEffectType)
    .map((effect) => (effect.type === 'damage' || effect.type === 'periodic-damage' ? effect.criticalChancePercent : 0));

  for (const effect of card.effects) {
    if (effect.abilityId !== ability.id) continue;
    const effectOption = getUpgradeEffectOption(effect.type);
    if (effectOption?.valueKind !== 'add-effect' || effectOption.abilityEffectType !== option.abilityEffectType) continue;
    if (typeof effect.value !== 'object' || !('criticalChancePercent' in effect.value)) continue;
    chances.push(effect.value.criticalChancePercent);
  }

  const bonus = card.effects.reduce((sum, effect) => (
    effect.abilityId === ability.id && effect.type === chanceType && typeof effect.value === 'number'
      ? sum + effect.value
      : sum
  ), 0);

  return chances.some((chance) => Math.min(100, Math.max(0, chance + bonus)) > 0);
}

function cardAddsEffect(
  card: UpgradeCardDefinition,
  abilityId: string,
  abilityEffectType: AbilityEffectType,
): boolean {
  return card.effects.some((effect) => {
    if (effect.abilityId !== abilityId) return false;
    const option = getUpgradeEffectOption(effect.type);
    return option?.valueKind === 'add-effect' && option.abilityEffectType === abilityEffectType;
  });
}

function effectHasRuntimePrerequisite(
  effect: UpgradeEffect,
  ability: AbilityDefinition,
  card: UpgradeCardDefinition,
): boolean {
  if (!ability.allowedUpgradeParameters.includes(effect.type)) return false;
  const option = getUpgradeEffectOption(effect.type);
  if (!option) return false;

  const hasEffect = ability.effects.some((current) => current.type === option.abilityEffectType);
  if (option.valueKind === 'add-effect') return !hasEffect;
  if (!hasEffect && !cardAddsEffect(card, ability.id, option.abilityEffectType)) return false;

  if (CRITICAL_CHANCE_TYPES[effect.type]) {
    return projectedCriticalChanceIsActive(ability, card, effect.type);
  }

  return true;
}

function cardHasRuntimeBenefit(card: UpgradeCardDefinition, abilities: AbilityDefinition[]): boolean {
  const abilitiesById = new Map(abilities.map((ability) => [ability.id, ability]));
  return card.effects.some((effect) => {
    const ability = abilitiesById.get(effect.abilityId);
    return Boolean(ability && effectHasRuntimePrerequisite(effect, ability, card));
  });
}

function generatedCardEffectsAreApplicable(card: UpgradeCardDefinition, ability: AbilityDefinition): boolean {
  return card.effects.every((effect) => effectHasRuntimePrerequisite(effect, ability, card));
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

      const criticalChanceType = CRITICAL_CHANCE_TYPES[type];
      if (criticalChanceType && !hasActiveCriticalChance(ability, type)) {
        const chanceRule = config.parameters[criticalChanceType];
        if (!chanceRule.enabled || chanceRule.weight <= 0 || !abilitySupportsParameter(ability, criticalChanceType)) continue;
      }

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

function createGeneratedParametersKey(card: UpgradeCardDefinition): string {
  const effects = [...card.effects]
    .sort((left, right) => {
      const abilityCompare = left.abilityId.localeCompare(right.abilityId);
      return abilityCompare !== 0 ? abilityCompare : left.type.localeCompare(right.type);
    })
    .map((effect) => ({
      type: effect.type,
      abilityId: effect.abilityId,
      value: effect.value,
    }));
  return JSON.stringify(effects);
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
  const maxParametersPerEffect = Math.max(1, Math.floor(config.maxParametersPerEffect));
  const byAbility = new Map<string, Candidate[]>();
  for (const candidate of available) {
    const current = byAbility.get(candidate.ability.id) ?? [];
    current.push(candidate);
    byAbility.set(candidate.ability.id, current);
  }

  const abilities = Array.from(byAbility.entries())
    .map(([abilityId, items]) => ({
      abilityId,
      items,
      maxCompatibleCount: maxCompatibleCandidateCount(items, maxParametersPerEffect),
    }))
    .filter((entry) => entry.maxCompatibleCount >= min);
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

    const desiredCount = randomInteger(min, Math.min(max, abilityChoice.maxCompatibleCount), random);
    const remaining = [...abilityChoice.items];
    const chosen: Candidate[] = [];
    const effects: UpgradeEffect[] = [];

    while (chosen.length < desiredCount && remaining.length > 0) {
      const candidate = pickCoherentCandidate(
        remaining,
        chosen,
        desiredCount - chosen.length,
        maxParametersPerEffect,
        random,
      );
      if (!candidate) break;
      remaining.splice(remaining.indexOf(candidate), 1);
      const effect = createEffect(candidate, rarity, damageSources, random);
      if (!effect) continue;
      chosen.push(candidate);
      effects.push(effect);
    }

    while (true) {
      const repair = findComplementaryRepair(chosen, remaining, maxParametersPerEffect);
      if (!repair) break;

      const counterpartEffect = createEffect(repair.counterpart, rarity, damageSources, random);
      if (!counterpartEffect) break;

      const removedCandidate = chosen[repair.replacementIndex];
      const counterpartIndex = remaining.indexOf(repair.counterpart);
      if (counterpartIndex < 0) break;

      remaining.splice(counterpartIndex, 1);
      remaining.push(removedCandidate);
      chosen[repair.replacementIndex] = repair.counterpart;
      effects[repair.replacementIndex] = counterpartEffect;
    }

    if (chosen.length < min) continue;
    if (!isCandidateSetCompatible(chosen, maxParametersPerEffect)) continue;
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
    if (!generatedCardEffectsAreApplicable(card, ability)) continue;
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
  abilityModifiers: AbilityRuntimeModifiers = {},
): UpgradeCardDefinition[] {
  if (!config.enabled) return [];
  const targetCount = Math.max(0, Math.floor(cardCount));
  if (targetCount === 0) return [];

  const currentAbilities = withRuntimeModifiers(abilities, abilityModifiers);
  const candidates = buildCandidates(config, currentAbilities);
  if (candidates.length === 0) return [];

  const selectedAcrossCards: Candidate[] = [];
  const usedParameterKeys = new Set<string>();
  const cards: UpgradeCardDefinition[] = [];
  const maxAttempts = Math.max(20, targetCount * 20);
  let attempts = 0;

  while (cards.length < targetCount && attempts < maxAttempts) {
    attempts += 1;
    const availableRarities = RARITIES.filter((rarity) => {
      if (config.rarityWeights[rarity] <= 0) return false;
      const available = availableCandidates(candidates, rarity, damageSources, config, selectedAcrossCards);
      const { min } = getParameterCountBounds(config, rarity);
      const maxParametersPerEffect = Math.max(1, Math.floor(config.maxParametersPerEffect));
      const candidatesByAbility = new Map<string, Candidate[]>();
      for (const candidate of available) {
        const items = candidatesByAbility.get(candidate.ability.id) ?? [];
        items.push(candidate);
        candidatesByAbility.set(candidate.ability.id, items);
      }
      return Array.from(candidatesByAbility.values()).some((items) => (
        maxCompatibleCandidateCount(items, maxParametersPerEffect) >= min
      ));
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

    const parameterKey = createGeneratedParametersKey(generated.card);
    if (usedParameterKeys.has(parameterKey)) continue;

    cards.push(generated.card);
    usedParameterKeys.add(parameterKey);
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
  if (!validateUpgradeCard(card, manualCards, abilities, card.id, damageSources).valid) return false;

  return cardHasRuntimeBenefit(card, abilities);
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
  abilityModifiers: AbilityRuntimeModifiers = {},
): UpgradeCardDefinition[] {
  const targetCount = Math.max(0, Math.floor(cardCount));
  if (targetCount === 0) return [];

  const currentAbilities = withRuntimeModifiers(abilities, abilityModifiers);
  const generated = generateUpgradeChoices(
    config,
    abilities,
    damageSources,
    counts,
    targetCount,
    maxCardReceives,
    random,
    abilityModifiers,
  );
  const manual = manualCards.filter((card) => manualCardIsAvailable(
    card,
    manualCards,
    currentAbilities,
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
