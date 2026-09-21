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
    useGameStore.getState().reset(3);
  });

  it('stores the automatic match casting preference across battle resets', () => {
    useGameStore.getState().setAutoCastMatches(true);
    useGameStore.getState().reset(5);

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

  it('awards one coin for every defeated enemy', () => {
    useGameStore.getState().addKill();
    useGameStore.getState().addKill();

    const state = useGameStore.getState();
    expect(state.kills).toBe(2);
    expect(state.coins).toBe(2);
  });

  it('keeps earned coins when a battle is reset', () => {
    useGameStore.getState().addKill();
    useGameStore.getState().reset(5);

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
    useGameStore.getState().addKill();

    useGameStore.getState().reset(5);
    const state = useGameStore.getState();

    expect(state.castleHp).toBe(100);
    expect(state.wave).toBe(1);
    expect(state.totalWaves).toBe(5);
    expect(state.kills).toBe(0);
    expect(state.phase).toBe('playing');
    expect(state.charges).toEqual({ fire: 0, ice: 0, lightning: 0, shield: 0 });
  });
});
