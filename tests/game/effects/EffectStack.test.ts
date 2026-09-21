import { describe, expect, it } from 'vitest';
import { EffectStack } from '../../../src/game/effects/EffectStack';

describe('EffectStack', () => {
  it('assigns every newly applied effect a higher layer', () => {
    const stack = new EffectStack<string, string>();

    const fire = stack.replace('fire', 'fire-1').entry;
    const frost = stack.replace('ice', 'ice-1').entry;
    const heal = stack.replace('shield', 'shield-1').entry;

    expect(fire.layer).toBeLessThan(frost.layer);
    expect(frost.layer).toBeLessThan(heal.layer);
    expect(stack.values()).toEqual(['fire-1', 'ice-1', 'shield-1']);
  });

  it('restarts an already active effect instead of stacking another instance', () => {
    const stack = new EffectStack<string, string>();

    const firstFire = stack.replace('fire', 'fire-1');
    stack.replace('ice', 'ice-1');
    const restartedFire = stack.replace('fire', 'fire-2');

    expect(restartedFire.replaced).toBe(firstFire.entry.value);
    expect(stack.get('fire')).toBe('fire-2');
    expect(stack.values()).toEqual(['ice-1', 'fire-2']);
    expect(restartedFire.entry.layer).toBeGreaterThan(firstFire.entry.layer);
  });

  it('keeps a restarted effect above effects that were applied earlier', () => {
    const stack = new EffectStack<string, string>();

    stack.replace('fire', 'fire-1');
    const frost = stack.replace('ice', 'ice-1').entry;
    const restartedFire = stack.replace('fire', 'fire-2').entry;

    expect(restartedFire.layer).toBeGreaterThan(frost.layer);
  });
});
