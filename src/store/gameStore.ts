import { create } from 'zustand';
import { MAX_CHARGES } from '../game/config';
import type { SpellCharges, TileKind } from '../game/types';

interface GameState {
  castleHp: number;
  castleMaxHp: number;
  wave: number;
  totalWaves: number;
  charges: SpellCharges;
  kills: number;
  coins: number;
  phase: 'playing' | 'victory' | 'defeat';
  autoCastMatches: boolean;
  addCharge: (kind: TileKind, amount: number) => void;
  handleMatch: (kind: TileKind, amount: number, cast: (kind: TileKind) => void) => void;
  spendCharge: (kind: TileKind) => boolean;
  damageCastle: (amount: number) => void;
  healCastle: (amount: number) => void;
  setWave: (wave: number) => void;
  addKill: (coins: number) => void;
  setPhase: (phase: GameState['phase']) => void;
  setAutoCastMatches: (enabled: boolean) => void;
  reset: (totalWaves: number, abilityIds?: TileKind[]) => void;
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

  reset: (totalWaves, abilityIds = []) =>
    set({
      castleHp: 100,
      castleMaxHp: 100,
      wave: 1,
      totalWaves,
      charges: emptyCharges(abilityIds),
      kills: 0,
      phase: 'playing',
    }),
}));
