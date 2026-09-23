import { Container, Graphics } from 'pixi.js';

interface DotParticle {
  x: number;
  y: number;
  color: number;
  size: number;
  maxLife: number;
  life: number;
  vx: number;
  vy: number;
}

const FRAME_STEP = 1 / 60;
const HTML_TARGET_RADIUS = 90;
const EFFECT_RADIUS_MULTIPLIER = 1.75;
const PARTICLE_SPAWN_CHANCE = 0.7;
const SHAKE_INTERVAL = 1.2;
const SHAKE_DURATION = 0.08;

function colorFromHex(hex: string): number {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return 0x64748b;
  return Number.parseInt(hex.slice(1), 16);
}

function adjustColorBrightness(color: number, percent: number): number {
  const factor = (100 + percent) / 100;
  const red = Math.min(255, Math.max(0, Math.trunc(((color >> 16) & 0xff) * factor)));
  const green = Math.min(255, Math.max(0, Math.trunc(((color >> 8) & 0xff) * factor)));
  const blue = Math.min(255, Math.max(0, Math.trunc((color & 0xff) * factor)));
  return (red << 16) | (green << 8) | blue;
}

export class PeriodicDamageAura extends Container {
  private readonly particleGraphics = new Graphics();
  private readonly particles: DotParticle[] = [];
  private readonly palette: number[];
  private readonly effectRadius: number;
  private readonly htmlScale: number;
  private frameAccumulator = 0;
  private elapsed = 0;
  private nextShakeAt = SHAKE_INTERVAL;
  private shakeUntil = 0;
  private shakeX = 0;
  private shakeY = 0;

  constructor(color: string, isBoss: boolean) {
    super();
    this.eventMode = 'none';
    const effectColor = colorFromHex(color);
    const bodyRadius = isBoss ? 31 : 20;
    this.effectRadius = bodyRadius * EFFECT_RADIUS_MULTIPLIER;
    this.htmlScale = this.effectRadius / HTML_TARGET_RADIUS;
    this.palette = [
      effectColor,
      adjustColorBrightness(effectColor, 40),
      adjustColorBrightness(effectColor, -30),
    ];

    this.particleGraphics.blendMode = 'add';
    this.addChild(this.particleGraphics);
  }

  update(dt: number) {
    const safeDt = Math.max(0, dt);
    this.elapsed += safeDt;
    this.frameAccumulator += safeDt;

    while (this.frameAccumulator >= FRAME_STEP) {
      this.frameAccumulator -= FRAME_STEP;
      this.stepFrame();
    }

    this.updateShake();
    this.drawParticles();
  }

  private stepFrame() {
    if (Math.random() < PARTICLE_SPAWN_CHANCE) this.particles.push(this.createParticle());

    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const particle = this.particles[i];
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.life -= 1;
      if (particle.life <= 0) this.particles.splice(i, 1);
    }
  }

  private createParticle(): DotParticle {
    const maxLife = Math.random() * 40 + 50;
    return {
      x: (-60 + Math.random() * 120) * this.htmlScale,
      y: (-40 + Math.random() * 100) * this.htmlScale,
      color: this.palette[Math.floor(Math.random() * this.palette.length)],
      size: (Math.random() * 5 + 1.5) * this.htmlScale,
      maxLife,
      life: maxLife,
      vx: (Math.random() - 0.5) * 0.6 * this.htmlScale,
      vy: (-Math.random() * 0.8 - 0.3) * this.htmlScale,
    };
  }

  private drawParticles() {
    this.particleGraphics.clear();

    for (const particle of this.particles) {
      const alpha = particle.life / particle.maxLife;
      this.particleGraphics
        .circle(particle.x, particle.y, particle.size)
        .fill({ color: particle.color, alpha });
    }
  }

  private updateShake() {
    if (this.elapsed >= this.nextShakeAt) {
      do {
        this.nextShakeAt += SHAKE_INTERVAL;
      } while (this.elapsed >= this.nextShakeAt);

      this.shakeUntil = this.elapsed + SHAKE_DURATION;
      this.shakeX = (Math.random() - 0.5) * 4 * this.htmlScale;
      this.shakeY = (Math.random() - 0.5) * 4 * this.htmlScale;
    }

    if (this.elapsed < this.shakeUntil) {
      this.position.set(this.shakeX, this.shakeY);
      this.scale.set(0.97);
    } else {
      this.position.set(0, 0);
      this.scale.set(1);
    }
  }
}
