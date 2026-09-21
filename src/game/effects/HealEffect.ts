import { Container, Graphics } from 'pixi.js';
import { RadialGlow } from './RadialGlow';
import type { BattleEffect, EffectBounds } from './types';

interface HealParticle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  life: number;
  decay: number;
  type: 'plus' | 'spark';
  wobblePhase: number;
}

const DURATION = 1;
const FADE_FOR = 0.2;
const FRAME_STEP = 1 / 60;
const MAX_PARTICLES = 200;

const GLOW_STOPS = [
  { offset: 0, r: 0, g: 255, b: 120, alpha: 0 },
  { offset: 0.5, r: 0, g: 220, b: 100, alpha: 0.12 },
  { offset: 1, r: 210, g: 255, b: 100, alpha: 0.45 },
];

export class HealEffect extends Container implements BattleEffect {
  private readonly glow: RadialGlow;
  private readonly particleGraphics = new Graphics();
  private readonly particles: HealParticle[] = [];
  private bounds: EffectBounds;
  private elapsed = 0;
  private frameAccumulator = 0;
  private glowIntensity = 0;

  constructor(bounds: EffectBounds) {
    super();
    this.bounds = bounds;
    this.eventMode = 'none';
    this.blendMode = 'screen';
    this.glow = new RadialGlow(bounds, 0.75, [...GLOW_STOPS]);
    this.glow.alpha = 0;
    this.particleGraphics.blendMode = 'screen';
    this.addChild(this.glow, this.particleGraphics);
  }

  get done() {
    return this.elapsed >= DURATION;
  }

  update(dt: number) {
    this.elapsed += dt;
    this.frameAccumulator += dt;

    while (this.frameAccumulator >= FRAME_STEP) {
      this.frameAccumulator -= FRAME_STEP;
      this.stepFrame();
    }

    this.glow.alpha = this.glowIntensity;
    this.drawParticles();
    this.alpha = this.elapsed > DURATION - FADE_FOR
      ? Math.max(0, (DURATION - this.elapsed) / FADE_FOR)
      : 1;
  }

  resize(bounds: EffectBounds) {
    this.bounds = bounds;
    this.particles.length = 0;
    this.glowIntensity = 0;
    this.particleGraphics.clear();
    this.glow.resize(bounds);
    this.glow.alpha = 0;
  }

  private stepFrame() {
    if (this.glowIntensity < 1) {
      this.glowIntensity = Math.min(1, this.glowIntensity + 0.008);
    }

    const spawnRate = Math.ceil(this.bounds.width / 150);
    for (let i = 0; i < spawnRate; i += 1) {
      if (this.particles.length < MAX_PARTICLES) this.particles.push(this.createParticle());
    }

    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const particle = this.particles[i];
      particle.y -= particle.speedY;
      particle.life -= particle.decay;
      particle.wobblePhase += 0.04;
      particle.x += Math.sin(particle.wobblePhase) * 0.4;

      if (particle.life <= 0 || particle.y < this.bounds.y - 20) {
        this.particles.splice(i, 1);
      }
    }
  }

  private createParticle(): HealParticle {
    return {
      x: this.bounds.x + Math.random() * this.bounds.width,
      y: this.bounds.y + this.bounds.height + Math.random() * 40,
      size: Math.random() * 4 + 2,
      speedY: Math.random() * 2.5 + 1.5,
      life: 1,
      decay: Math.random() * 0.01 + 0.005,
      type: Math.random() < 0.4 ? 'plus' : 'spark',
      wobblePhase: Math.random() * Math.PI * 2,
    };
  }

  private drawParticles() {
    this.particleGraphics.clear();

    for (const particle of this.particles) {
      if (particle.life <= 0) continue;

      const alpha = particle.life;
      const color = Math.random() < 0.5 ? 0x44ffaa : 0xffe666;

      // shadowColor rgba(0,255,150,.7) + shadowBlur 10 from heal.html.
      if (particle.type === 'plus') {
        this.drawPlus(particle, 10, 0x00ff96, alpha * 0.08);
        this.drawPlus(particle, 6, 0x00ff96, alpha * 0.16);
        this.drawPlus(particle, 2.5, color, alpha);
      } else {
        this.particleGraphics.circle(particle.x, particle.y, particle.size + 8)
          .fill({ color: 0x00ff96, alpha: alpha * 0.05 });
        this.particleGraphics.circle(particle.x, particle.y, particle.size + 4)
          .fill({ color: 0x00ff96, alpha: alpha * 0.14 });
        this.particleGraphics.circle(particle.x, particle.y, particle.size)
          .fill({ color, alpha });
      }
    }
  }

  private drawPlus(particle: HealParticle, width: number, color: number, alpha: number) {
    this.particleGraphics
      .moveTo(particle.x - particle.size, particle.y)
      .lineTo(particle.x + particle.size, particle.y)
      .moveTo(particle.x, particle.y - particle.size)
      .lineTo(particle.x, particle.y + particle.size)
      .stroke({ color, width, alpha });
  }
}
