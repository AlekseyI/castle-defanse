import { Container, Graphics } from 'pixi.js';
import { RadialGlow } from './RadialGlow';
import type { BattleEffect, EffectBounds } from './types';

interface Crystal {
  x: number;
  y: number;
  angle: number;
  maxLength: number;
  currentLength: number;
  branchDepth: number;
  done: boolean;
  settled: boolean;
}

export const FROST_DURATION = 4;
const FADE_FOR = 0.35;
const FRAME_STEP = 1 / 60;
const SPAWN_LIMIT = 4000;
const TOTAL_CRYSTAL_LIMIT = 6000;
const ANGLE_60 = Math.PI / 3;
const CRYSTAL_SPEED = 3.5;

const GLOW_STOPS = [
  { offset: 0, r: 0, g: 160, b: 255, alpha: 0 },
  { offset: 0.5, r: 0, g: 110, b: 220, alpha: 0.18 },
  { offset: 1, r: 0, g: 195, b: 255, alpha: 0.5 },
];

export class FrostEffect extends Container implements BattleEffect {
  private readonly glow: RadialGlow;
  private readonly settledGraphics = new Graphics();
  private readonly growingGraphics = new Graphics();
  private readonly crystals: Crystal[] = [];
  private bounds: EffectBounds;
  private elapsed = 0;
  private frameAccumulator = 0;
  private glowIntensity = 0;

  constructor(bounds: EffectBounds) {
    super();
    this.bounds = bounds;
    this.eventMode = 'none';
    this.glow = new RadialGlow(bounds, 0.72, [...GLOW_STOPS]);
    this.glow.alpha = 0;
    this.addChild(this.settledGraphics, this.growingGraphics, this.glow);
  }

  get done() {
    return this.elapsed >= FROST_DURATION;
  }

  update(dt: number) {
    this.elapsed += dt;
    this.frameAccumulator += dt;

    while (this.frameAccumulator >= FRAME_STEP) {
      this.frameAccumulator -= FRAME_STEP;
      this.stepFrame();
    }

    this.glow.alpha = this.glowIntensity;
    this.drawGrowingCrystals();
    this.alpha = this.elapsed > FROST_DURATION - FADE_FOR
      ? Math.max(0, (FROST_DURATION - this.elapsed) / FADE_FOR)
      : 1;
  }

  resize(bounds: EffectBounds) {
    this.bounds = bounds;
    this.crystals.length = 0;
    this.glowIntensity = 0;
    this.settledGraphics.clear();
    this.growingGraphics.clear();
    this.glow.resize(bounds);
    this.glow.alpha = 0;
  }

  private stepFrame() {
    this.spawnFrost();

    // The source iterates a live array, so branches added here also grow this frame.
    for (let i = 0; i < this.crystals.length; i += 1) {
      this.growCrystal(this.crystals[i]);
    }

    if (this.glowIntensity < 1) {
      this.glowIntensity = Math.min(1, this.glowIntensity + 0.007);
    }
  }

  private spawnFrost() {
    if (this.crystals.length >= SPAWN_LIMIT) return;

    for (let i = 0; i < 5; i += 1) {
      if (Math.random() >= 0.4) continue;

      const edge = Math.floor(Math.random() * 4);
      let x = 0;
      let y = 0;
      let angle = 0;

      if (edge === 0) {
        x = this.bounds.x + Math.random() * this.bounds.width;
        y = this.bounds.y - 5;
        angle = Math.PI / 2;
      } else if (edge === 1) {
        x = this.bounds.x - 5;
        y = this.bounds.y + Math.random() * this.bounds.height;
        angle = 0;
      } else if (edge === 2) {
        x = this.bounds.x + this.bounds.width + 5;
        y = this.bounds.y + Math.random() * this.bounds.height;
        angle = Math.PI;
      } else {
        x = this.bounds.x + Math.random() * this.bounds.width;
        y = this.bounds.y + this.bounds.height + 5;
        angle = -Math.PI / 2;
      }

      this.crystals.push(this.createCrystal(x, y, angle, Math.random() * 4 + 8, 9));
    }
  }

  private createCrystal(x: number, y: number, angle: number, maxLength: number, branchDepth: number): Crystal {
    return { x, y, angle, maxLength, currentLength: 0, branchDepth, done: false, settled: false };
  }

  private growCrystal(crystal: Crystal) {
    if (crystal.currentLength < crystal.maxLength) {
      crystal.currentLength += CRYSTAL_SPEED;
      return;
    }

    if (!crystal.settled) {
      crystal.settled = true;
      this.drawCrystal(this.settledGraphics, crystal, crystal.maxLength);
    }

    if (crystal.done) return;
    crystal.done = true;

    if (crystal.branchDepth <= 1 || this.crystals.length >= TOTAL_CRYSTAL_LIMIT) return;

    const endX = crystal.x + Math.cos(crystal.angle) * crystal.maxLength;
    const endY = crystal.y + Math.sin(crystal.angle) * crystal.maxLength;
    const depth = crystal.branchDepth - 1;

    this.crystals.push(
      this.createCrystal(endX, endY, crystal.angle, crystal.maxLength * 0.8, depth),
      this.createCrystal(endX, endY, crystal.angle + ANGLE_60, crystal.maxLength * 0.65, depth),
      this.createCrystal(endX, endY, crystal.angle - ANGLE_60, crystal.maxLength * 0.65, depth),
    );
  }

  private drawGrowingCrystals() {
    this.growingGraphics.clear();

    for (const crystal of this.crystals) {
      if (crystal.settled || crystal.currentLength <= 0) continue;
      this.drawCrystal(this.growingGraphics, crystal, crystal.currentLength);
    }
  }

  private drawCrystal(graphics: Graphics, crystal: Crystal, length: number) {
    const endX = crystal.x + Math.cos(crystal.angle) * length;
    const endY = crystal.y + Math.sin(crystal.angle) * length;
    const width = Math.max(0.3, crystal.branchDepth * 0.25);
    const alpha = 0.1 + crystal.branchDepth * 0.045;

    graphics
      .moveTo(crystal.x, crystal.y)
      .lineTo(endX, endY)
      .stroke({ color: 0x00b4ff, width: width + 2, alpha: 0.16 })
      .moveTo(crystal.x, crystal.y)
      .lineTo(endX, endY)
      .stroke({ color: 0xf0fcff, width, alpha });
  }
}
