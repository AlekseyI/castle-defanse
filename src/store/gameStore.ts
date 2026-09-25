import { create } from 'zustand';
import type { UpgradeCardDefinition } from '../editor/upgrades/types';
import { MAX_CHARGES } from '../game/config';
import type { SpellCharges, TileKind } from '../game/types';
import {
  addUpgradeEffectToModifiers,
  type AbilityRuntimeModifiers,
} from '../game/upgrades/upgradeCalculator';

type GamePhase = 'playing' | 'upgrade-selection' | 'victory' | 'defeat';

interface GameState {
  castleHp: number;
  castleMaxHp: number;
  wave: number;
  totalWaves: number;
  charges: SpellCharges;
  kills: number;
  coins: number;
  phase: GamePhase;
  autoCastMatches: boolean;
  boardBusy: boolean;
  upgradeCounts: Record<string, number>;
  upgradeMaxCardReceives: number;
  upgradeChoices: UpgradeCardDefinition[];
  abilityModifiers: AbilityRuntimeModifiers;
  addCharge: (kind: TileKind, amount: number) => void;
  handleMatch: (kind: TileKind, amount: number, cast: (kind: TileKind) => void) => void;
  spendCharge: (kind: TileKind) => boolean;
  damageCastle: (amount: number) => void;
  healCastle: (amount: number) => void;
  setWave: (wave: number) => void;
  addKill: (coins: number) => void;
  setPhase: (phase: GamePhase) => void;
  setAutoCastMatches: (enabled: boolean) => void;
  setBoardBusy: (busy: boolean) => void;
  openUpgradeSelection: (choices: UpgradeCardDefinition[]) => void;
  dismissUpgradeSelection: () => boolean;
  selectUpgrade: (cardId: string) => boolean;
  reset: (totalWaves: number, abilityIds?: TileKind[], maxCardReceives?: number) => void;
}

const emptyCharges = (abilityIds: TileKind[] = []): SpellCharges => Object.fromEntries(
  abilityIds.map((id) => [id, 0]),
);

export const useGameStore = create<GameState>()((set, get) => ({
  castleHp: 100,
  castleMaxHp: 100,
  wave: 1,
  totalWaves: 3,
  charges: emptyCharges(),
  kills: 0,
  coins: 0,
  phase: 'playing',
  autoCastMatches: true,
  boardBusy: false,
  upgradeCounts: {},
  upgradeMaxCardReceives: 1,
  upgradeChoices: [],
  abilityModifiers: {},

  addCharge: (kind, amount) =>
    set((state) => ({
      charges: {
        ...state.charges,
        [kind]: Math.min(MAX_CHARGES, (state.charges[kind] ?? 0) + amount),
      },
    })),

  handleMatch: (kind, amount, cast) => {
    const state = get();
    if (!state.autoCastMatches) {
      state.addCharge(kind, amount);
      return;
    }

    for (let i = 0; i < amount; i += 1) cast(kind);
  },

  spendCharge: (kind) => {
    const state = get();
    const current = state.charges[kind] ?? 0;
    if (current <= 0 || state.phase !== 'playing') return false;

    set({
      charges: {
        ...state.charges,
        [kind]: current - 1,
      },
    });
    return true;
  },

  damageCastle: (amount) => {
    const state = get();
    if (state.phase !== 'playing') return;

    const nextHp = Math.max(0, state.castleHp - amount);
    set({ castleHp: nextHp, phase: nextHp <= 0 ? 'defeat' : state.phase });
  },

  healCastle: (amount) =>
    set((state) => ({ castleHp: Math.min(state.castleMaxHp, state.castleHp + amount) })),

  setWave: (wave) => set({ wave }),
  addKill: (coins) => set((state) => ({ kills: state.kills + 1, coins: state.coins + coins })),
  setPhase: (phase) => set({ phase }),
  setAutoCastMatches: (enabled) => set({ autoCastMatches: enabled }),
  setBoardBusy: (boardBusy) => set({ boardBusy }),

  openUpgradeSelection: (choices) => {
    if (choices.length === 0) return;
    set({ upgradeChoices: choices, phase: 'upgrade-selection' });
  },

  dismissUpgradeSelection: () => {
    if (get().phase !== 'upgrade-selection') return false;
    set({ upgradeChoices: [], phase: 'playing' });
    return true;
  },

  selectUpgrade: (cardId) => {
    const state = get();
    if (state.phase !== 'upgrade-selection') return false;

    const card = state.upgradeChoices.find((choice) => choice.id === cardId);
    if (!card) return false;

    const currentCount = state.upgradeCounts[card.id] ?? 0;
    if (currentCount >= state.upgradeMaxCardReceives) return false;

    const abilityModifiers: AbilityRuntimeModifiers = structuredClone(state.abilityModifiers);
    for (const effect of card.effects) addUpgradeEffectToModifiers(abilityModifiers, effect);

    set({
      upgradeCounts: {
        ...state.upgradeCounts,
        [card.id]: currentCount + 1,
      },
      abilityModifiers,
      upgradeChoices: [],
      phase: 'playing',
    });
    return true;
  },

  reset: (totalWaves, abilityIds = [], maxCardReceives = 1) =>
    set({
      castleHp: 100,
      castleMaxHp: 100,
      wave: 1,
      totalWaves,
      charges: emptyCharges(abilityIds),
      kills: 0,
      phase: 'playing',
      boardBusy: false,
      upgradeCounts: {},
      upgradeMaxCardReceives: Math.max(1, Math.floor(maxCardReceives)),
      upgradeChoices: [],
      abilityModifiers: {},
    }),
}));
