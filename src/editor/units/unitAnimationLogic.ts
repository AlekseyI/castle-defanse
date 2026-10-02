import {
  UNIT_ANIMATION_TYPES,
  type UnitAnimationFrame,
  type UnitAnimationSounds,
  type UnitAnimations,
  type UnitAnimationType,
} from './types';

export const UNIT_ANIMATION_LABELS: Record<UnitAnimationType, string> = {
  move: 'Движение',
  attack: 'Атака',
  death: 'Смерть',
};


export function createEmptyUnitAnimationSounds(): UnitAnimationSounds {
  return {};
}

export function cloneUnitAnimationSounds(sounds?: UnitAnimationSounds): UnitAnimationSounds {
  return Object.fromEntries(
    UNIT_ANIMATION_TYPES.flatMap((type) => sounds?.[type] ? [[type, { ...sounds[type] }]] : []),
  ) as UnitAnimationSounds;
}

export function normalizeUnitAnimationSounds(sounds?: UnitAnimationSounds): UnitAnimationSounds {
  return Object.fromEntries(
    UNIT_ANIMATION_TYPES.flatMap((type) => {
      const sound = sounds?.[type];
      return sound ? [[type, { id: sound.id.trim(), name: sound.name.trim(), src: sound.src }]] : [];
    }),
  ) as UnitAnimationSounds;
}

export function createEmptyUnitAnimations(): UnitAnimations {
  return {
    move: [],
    attack: [],
    death: [],
  };
}

export function cloneUnitAnimations(animations: UnitAnimations): UnitAnimations {
  return {
    move: animations.move.map((frame) => ({ ...frame })),
    attack: animations.attack.map((frame) => ({ ...frame })),
    death: animations.death.map((frame) => ({ ...frame })),
  };
}

export function normalizeUnitAnimations(animations: UnitAnimations): UnitAnimations {
  return Object.fromEntries(
    UNIT_ANIMATION_TYPES.map((type) => [
      type,
      animations[type].map((frame): UnitAnimationFrame => ({
        id: frame.id.trim(),
        name: frame.name.trim(),
        src: frame.src,
      })),
    ]),
  ) as UnitAnimations;
}

export function hasUnitAnimationFrames(animations: UnitAnimations): boolean {
  return UNIT_ANIMATION_TYPES.some((type) => animations[type].length > 0);
}

export function getUnitAnimationFrames(
  animations: UnitAnimations,
  state: UnitAnimationType,
): UnitAnimationFrame[] {
  const fallbackOrder: Record<UnitAnimationType, readonly UnitAnimationType[]> = {
    move: ['move', 'attack', 'death'],
    attack: ['attack', 'move', 'death'],
    death: ['death'],
  };

  for (const type of fallbackOrder[state]) {
    const frames = animations[type];
    if (frames.length > 0) return frames;
  }

  return [];
}

export function getUnitAnimationFrameDuration(animationSpeed: number): number {
  const safeSpeed = Number.isFinite(animationSpeed) ? Math.max(0.1, animationSpeed) : 1;
  return Math.max(0.04, 0.8 / safeSpeed);
}

export function getUnitAnimationFrameIndex(
  elapsed: number,
  frameCount: number,
  animationSpeed: number,
  loop: boolean,
): number {
  if (frameCount <= 1) return 0;
  const rawIndex = Math.floor(Math.max(0, elapsed) / getUnitAnimationFrameDuration(animationSpeed));
  return loop ? rawIndex % frameCount : Math.min(frameCount - 1, rawIndex);
}

export function getUnitAnimationDuration(frameCount: number, animationSpeed: number): number {
  return frameCount * getUnitAnimationFrameDuration(animationSpeed);
}
