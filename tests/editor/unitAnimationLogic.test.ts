import { describe, expect, it } from 'vitest';
import {
  createEmptyUnitAnimations,
  getUnitAnimationDuration,
  getUnitAnimationFrameDuration,
  getUnitAnimationFrameIndex,
  getUnitAnimationFrames,
  hasUnitAnimationFrames,
} from '../../src/editor/units/unitAnimationLogic';
import type { UnitAnimations } from '../../src/editor/units/types';

function frame(id: string) {
  return { id, name: `${id}.png`, src: `data:image/png;base64,${id}` };
}

describe('unitAnimationLogic', () => {
  it('detects whether a unit has any canvas animation frames', () => {
    const empty = createEmptyUnitAnimations();
    const withAttack: UnitAnimations = { ...empty, attack: [frame('attack-1')] };

    expect(hasUnitAnimationFrames(empty)).toBe(false);
    expect(hasUnitAnimationFrames(withAttack)).toBe(true);
  });

  it('uses the requested movement/attack animation and falls back to another available visual animation', () => {
    const animations: UnitAnimations = {
      move: [],
      attack: [frame('attack-1')],
      death: [frame('death-1')],
    };

    expect(getUnitAnimationFrames(animations, 'attack').map((item) => item.id)).toEqual(['attack-1']);
    expect(getUnitAnimationFrames(animations, 'move').map((item) => item.id)).toEqual(['attack-1']);
  });

  it('does not substitute another animation for death', () => {
    const animations: UnitAnimations = {
      move: [frame('move-1')],
      attack: [frame('attack-1')],
      death: [],
    };

    expect(getUnitAnimationFrames(animations, 'death')).toEqual([]);
  });

  it('calculates looping and non-looping animation frame positions from animation speed', () => {
    expect(getUnitAnimationFrameDuration(1)).toBeCloseTo(0.8);
    expect(getUnitAnimationFrameDuration(2)).toBeCloseTo(0.4);
    expect(getUnitAnimationFrameDuration(Number.NaN)).toBeCloseTo(0.8);
    expect(getUnitAnimationFrameIndex(0.81, 3, 1, true)).toBe(1);
    expect(getUnitAnimationFrameIndex(2.5, 3, 1, true)).toBe(0);
    expect(getUnitAnimationFrameIndex(99, 3, 1, false)).toBe(2);
    expect(getUnitAnimationDuration(3, 2)).toBeCloseTo(1.2);
  });
});
