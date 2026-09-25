import type { UpgradeCardDefinition } from '../../editor/upgrades/types';

function pickWeightedCard(
  pool: UpgradeCardDefinition[],
  random: () => number,
): UpgradeCardDefinition | undefined {
  const totalWeight = pool.reduce((sum, card) => sum + card.weight, 0);
  if (totalWeight <= 0) return undefined;

  const rawRandom = Math.min(0.999999999999, Math.max(0, random()));
  let cursor = rawRandom * totalWeight;

  for (const card of pool) {
    cursor -= card.weight;
    if (cursor < 0) return card;
  }

  return pool[pool.length - 1];
}

export function generateUpgradeChoices(
  cards: UpgradeCardDefinition[],
  counts: Record<string, number>,
  cardCount: number,
  maxCardReceives: number,
  random: () => number = Math.random,
): UpgradeCardDefinition[] {
  const targetCount = Math.max(0, Math.floor(cardCount));
  if (targetCount === 0) return [];

  const available = cards.filter((card) => (
    Number.isFinite(card.weight) &&
    card.weight > 0 &&
    (counts[card.id] ?? 0) < maxCardReceives
  ));
  if (available.length === 0) return [];

  const result: UpgradeCardDefinition[] = [];
  const uniquePool = [...available];

  while (result.length < targetCount && uniquePool.length > 0) {
    const selected = pickWeightedCard(uniquePool, random);
    if (!selected) break;

    result.push(selected);
    uniquePool.splice(uniquePool.indexOf(selected), 1);
  }

  while (result.length < targetCount) {
    const selected = pickWeightedCard(available, random);
    if (!selected) break;
    result.push(selected);
  }

  return result;
}
