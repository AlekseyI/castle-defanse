import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_CHARGES } from '../../src/game/config';
import { useGameStore } from '../../src/store/gameStore';

describe('gameStore', () => {
  it('enables automatic match casting by default', () => {
    expect(useGameStore.getInitialState().autoCastMatches).toBe(true);
  });

  beforeEach(() => {
    useGameStore.setState({ coins: 0 });
    useGameStore.getState().setAutoCastMatches(false);
    useGameStore.getState().reset(3, ['fire', 'ice', 'lightning', 'shield']);
  });

  it('stores the automatic match casting preference across battle resets', () => {
    useGameStore.getState().setAutoCastMatches(true);
    useGameStore.getState().reset(5, ['fire', 'ice', 'lightning', 'shield']);

    expect(useGameStore.getState().autoCastMatches).toBe(true);
  });

  it('accumulates matched skills when automatic casting is disabled', () => {
    const cast = vi.fn();

    useGameStore.getState().handleMatch('fire', 2, cast);

    expect(useGameStore.getState().charges.fire).toBe(2);
    expect(cast).not.toHaveBeenCalled();
  });

  it('casts matched skills immediately without accumulating charges when enabled', () => {
    const cast = vi.fn();
    useGameStore.getState().setAutoCastMatches(true);

    useGameStore.getState().handleMatch('ice', 2, cast);

    expect(useGameStore.getState().charges.ice).toBe(0);
    expect(cast).toHaveBeenCalledTimes(2);
    expect(cast).toHaveBeenNthCalledWith(1, 'ice');
    expect(cast).toHaveBeenNthCalledWith(2, 'ice');
  });


  it('initializes and tracks charges for configured ability ids', () => {
    useGameStore.getState().reset(3, ['fire', 'meteor']);
    useGameStore.getState().addCharge('meteor', 2);

    expect(useGameStore.getState().charges).toEqual({ fire: 0, meteor: 2 });
  });

  it('caps accumulated spell charges at MAX_CHARGES', () => {
    const store = useGameStore.getState();
    store.addCharge('fire', MAX_CHARGES + 10);

    expect(useGameStore.getState().charges.fire).toBe(MAX_CHARGES);
  });

  it('spends a charge only while the game is playing and a charge is available', () => {
    expect(useGameStore.getState().spendCharge('ice')).toBe(false);

    useGameStore.getState().addCharge('ice', 2);
    expect(useGameStore.getState().spendCharge('ice')).toBe(true);
    expect(useGameStore.getState().charges.ice).toBe(1);

    useGameStore.getState().setPhase('victory');
    expect(useGameStore.getState().spendCharge('ice')).toBe(false);
    expect(useGameStore.getState().charges.ice).toBe(1);
  });

  it('awards the configured number of coins for defeated enemies', () => {
    useGameStore.getState().addKill(3);
    useGameStore.getState().addKill(5);

    const state = useGameStore.getState();
    expect(state.kills).toBe(2);
    expect(state.coins).toBe(8);
  });

  it('keeps earned coins when a battle is reset', () => {
    useGameStore.getState().addKill(1);
    useGameStore.getState().reset(5, ['fire', 'ice', 'lightning', 'shield']);

    const state = useGameStore.getState();
    expect(state.kills).toBe(0);
    expect(state.coins).toBe(1);
  });

  it('moves to defeat when castle HP reaches zero', () => {
    useGameStore.getState().damageCastle(100);

    expect(useGameStore.getState().castleHp).toBe(0);
    expect(useGameStore.getState().phase).toBe('defeat');
  });

  it('never heals the castle above its maximum HP', () => {
    useGameStore.getState().damageCastle(40);
    useGameStore.getState().healCastle(100);

    expect(useGameStore.getState().castleHp).toBe(useGameStore.getState().castleMaxHp);
  });

  it('resets battle state for a new run', () => {
    useGameStore.getState().addCharge('lightning', 3);
    useGameStore.getState().damageCastle(25);
    useGameStore.getState().setWave(2);
    useGameStore.getState().addKill(1);

    useGameStore.getState().reset(5, ['fire', 'ice', 'lightning', 'shield']);
    const state = useGameStore.getState();

    expect(state.castleHp).toBe(100);
    expect(state.wave).toBe(1);
    expect(state.totalWaves).toBe(5);
    expect(state.kills).toBe(0);
    expect(state.phase).toBe('playing');
    expect(state.charges).toEqual({ fire: 0, ice: 0, lightning: 0, shield: 0 });
  });
});

// Upgrade selection state is covered here because it belongs to the run store, not to React UI.
describe('gameStore upgrades', () => {
  beforeEach(() => {
    useGameStore.getState().reset(3, ['fire']);
  });

  it('opens upgrade selection and applies all effects of the chosen card', () => {
    const card = {
      id: 'hellfire',
      name: 'Адское пламя',
      description: '',
      rarity: 'rare' as const,
      weight: 100,
      maxCount: 2,
      effects: [
        { type: 'ability-damage-percent' as const, abilityId: 'fire', value: 20 },
        { type: 'ability-periodic-damage-percent' as const, abilityId: 'fire', value: 15 },
      ],
    };

    useGameStore.getState().openUpgradeSelection([card]);
    expect(useGameStore.getState().phase).toBe('upgrade-selection');
    expect(useGameStore.getState().selectUpgrade(card.id)).toBe(true);

    const state = useGameStore.getState();
    expect(state.phase).toBe('playing');
    expect(state.upgradeCounts.hellfire).toBe(1);
    expect(state.upgradeChoices).toEqual([]);
    expect(state.abilityModifiers.fire.damage.amountPercent).toBe(20);
    expect(state.abilityModifiers.fire.periodicDamage.amountPercent).toBe(15);
  });

  it('does not allow selecting a card outside the current choices or beyond maxCount', () => {
    const card = {
      id: 'single',
      name: 'Один раз',
      description: '',
      rarity: 'common' as const,
      weight: 100,
      maxCount: 1,
      effects: [{ type: 'ability-damage-flat' as const, abilityId: 'fire', value: 5 }],
    };

    expect(useGameStore.getState().selectUpgrade(card.id)).toBe(false);
    useGameStore.getState().openUpgradeSelection([card]);
    expect(useGameStore.getState().selectUpgrade(card.id)).toBe(true);
    useGameStore.getState().openUpgradeSelection([card]);
    expect(useGameStore.getState().selectUpgrade(card.id)).toBe(false);
  });


  it('clears match board busy state on a new run', () => {
    useGameStore.getState().setBoardBusy(true);
    expect(useGameStore.getState().boardBusy).toBe(true);

    useGameStore.getState().reset(4, ['fire']);
    expect(useGameStore.getState().boardBusy).toBe(false);
  });

  it('clears upgrade state on a new run', () => {
    const card = {
      id: 'fire_flat',
      name: 'Жар',
      description: '',
      rarity: 'common' as const,
      weight: 100,
      maxCount: 3,
      effects: [{ type: 'ability-damage-flat' as const, abilityId: 'fire', value: 5 }],
    };

    useGameStore.getState().openUpgradeSelection([card]);
    useGameStore.getState().selectUpgrade(card.id);
    useGameStore.getState().reset(4, ['fire']);

    const state = useGameStore.getState();
    expect(state.upgradeCounts).toEqual({});
    expect(state.upgradeChoices).toEqual([]);
    expect(state.abilityModifiers).toEqual({});
  });
});
