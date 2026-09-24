import { describe, expect, it } from 'vitest';
import { generateUpgradeChoices } from '../../../src/game/upgrades/upgradeGenerator';
import type { UpgradeCardDefinition } from '../../../src/editor/upgrades/types';

const cards: UpgradeCardDefinition[] = [
  { id: 'a', name: 'A', description: '', rarity: 'common', weight: 100, maxCount: 2, effects: [] },
  { id: 'b', name: 'B', description: '', rarity: 'rare', weight: 50, maxCount: 1, effects: [] },
  { id: 'c', name: 'C', description: '', rarity: 'epic', weight: 10, maxCount: 3, effects: [] },
];

describe('upgradeGenerator', () => {
  it('excludes cards that reached maxCount and fills every requested slot by repeating available cards', () => {
    const result = generateUpgradeChoices(cards, { b: 1 }, 3, () => 0);
    expect(result.map((card) => card.id)).toEqual(['a', 'c', 'a']);
  });

  it('duplicates the only available card until cardCount is reached', () => {
    const result = generateUpgradeChoices(cards, { a: 2, b: 1 }, 3, () => 0);
    expect(result.map((card) => card.id)).toEqual(['c', 'c', 'c']);
  });

  it('uses weight while selecting choices', () => {
    expect(generateUpgradeChoices(cards, {}, 1, () => 0)[0].id).toBe('a');
    expect(generateUpgradeChoices(cards, {}, 1, () => 0.999999)[0].id).toBe('c');
  });

  it('returns no choices when every card reached maxCount', () => {
    expect(generateUpgradeChoices(cards, { a: 2, b: 1, c: 3 }, 3, () => 0)).toEqual([]);
  });
});
