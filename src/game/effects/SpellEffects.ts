import { Container } from 'pixi.js';
import type { TileKind } from '../types';
import { EffectStack } from './EffectStack';
import { FireWallEffect } from './FireWallEffect';
import { FrostEffect } from './FrostEffect';
import { HealEffect } from './HealEffect';
import { LightningEffect } from './LightningEffect';
import type { BattleEffect, EffectBounds, EffectPoint, SpellEffectOptions } from './types';

type EffectContainer = Container & BattleEffect;

const DEFAULT_BOUNDS: EffectBounds = { x: 0, y: 0, width: 1, height: 1 };

export class SpellEffects extends Container {
  private readonly activeEffects = new EffectStack<TileKind, EffectContainer>();
  private bounds: EffectBounds = DEFAULT_BOUNDS;

  constructor() {
    super();
    this.eventMode = 'none';
    this.sortableChildren = true;
  }

  play(kind: TileKind, options: SpellEffectOptions = {}) {
    const effect = this.createEffect(kind, options);
    if (!effect) return;

    // Only one instance of every spell type may exist at a time. Re-applying the
    // same spell removes the running instance and starts the animation from zero.
    const { entry, replaced } = this.activeEffects.replace(kind, effect);
    if (replaced) {
      this.removeChild(replaced);
      replaced.destroy({ children: true });
    }

    effect.zIndex = entry.layer;
    this.addChild(effect);
  }

  update(dt: number) {
    for (const effect of [...this.activeEffects.values()]) {
      effect.update(dt);
      if (!effect.done) continue;

      this.activeEffects.remove(effect);
      this.removeChild(effect);
      effect.destroy({ children: true });
    }
  }

  resize(bounds: EffectBounds) {
    this.bounds = { ...bounds };
    for (const effect of this.activeEffects.values()) effect.resize(this.bounds);
  }

  clearEffects() {
    for (const effect of this.activeEffects.values()) {
      this.removeChild(effect);
      effect.destroy({ children: true });
    }
    this.activeEffects.clear();
  }

  private createEffect(kind: TileKind, options: SpellEffectOptions): EffectContainer | null {
    switch (kind) {
      case 'fire':
        return new FireWallEffect(this.bounds);
      case 'ice':
        return new FrostEffect(this.bounds);
      case 'lightning': {
        const source = options.source ?? this.defaultLightningSource();
        const targets = options.targets ?? [];
        return targets.length > 0 ? new LightningEffect(this.bounds, source, targets) : null;
      }
      case 'shield':
        return new HealEffect(this.bounds);
    }
  }

  private defaultLightningSource(): EffectPoint {
    return {
      x: this.bounds.x + this.bounds.width / 2,
      y: this.bounds.y + this.bounds.height,
    };
  }
}
