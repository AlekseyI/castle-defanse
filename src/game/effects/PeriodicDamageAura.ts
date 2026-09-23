import { Container, Graphics } from 'pixi.js';

function colorFromHex(hex: string): number {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return 0x64748b;
  return Number.parseInt(hex.slice(1), 16);
}

export class PeriodicDamageAura extends Container {
  private readonly glow = new Graphics();
  private readonly mist = new Graphics();
  private readonly sparks = new Graphics();
  private readonly color: number;
  private readonly bodyRadius: number;
  private elapsed = 0;

  constructor(color: string, isBoss: boolean) {
    super();
    this.eventMode = 'none';
    this.color = colorFromHex(color);
    this.bodyRadius = isBoss ? 31 : 20;
    this.glow.blendMode = 'screen';
    this.mist.blendMode = 'screen';
    this.sparks.blendMode = 'screen';
    this.addChild(this.glow, this.mist, this.sparks);
    this.redraw();
  }

  update(dt: number) {
    this.elapsed += Math.max(0, dt);
    this.redraw();
  }

  private redraw() {
    const pulse = 0.5 + Math.sin(this.elapsed * 4.2) * 0.5;
    const breathe = 0.5 + Math.sin(this.elapsed * 2.1 + 0.8) * 0.5;
    const baseY = -this.bodyRadius - 5;

    this.glow.clear();
    this.mist.clear();
    this.sparks.clear();

    // Мягкое цветное сияние вокруг цели: помогает быстро заметить активный DoT.
    this.glow
      .circle(0, -2, this.bodyRadius * (1.02 + pulse * 0.08))
      .fill({ color: this.color, alpha: 0.035 + pulse * 0.035 });
    this.glow
      .circle(0, -2, this.bodyRadius * (1.18 + breathe * 0.08))
      .stroke({ color: this.color, width: 2.2, alpha: 0.13 + pulse * 0.11 });
    this.glow
      .circle(0, -2, this.bodyRadius * (1.38 + breathe * 0.1))
      .stroke({ color: this.color, width: 1.2, alpha: 0.04 + pulse * 0.055 });

    // Несколько поднимающихся полупрозрачных клубов создают эффект магического дыма.
    for (let i = 0; i < 7; i += 1) {
      const speed = 0.72 + i * 0.055;
      const phase = this.elapsed * speed + i * 1.17;
      const travel = (phase * 17) % 34;
      const drift = Math.sin(phase * 2.25 + i) * (5.5 + (i % 3) * 2.2);
      const wobble = Math.cos(phase * 1.35 + i * 0.7) * 2.3;
      const y = baseY - travel;
      const radius = 4.2 + (i % 3) * 1.7 + pulse * 1.2;
      const fade = Math.max(0, 1 - travel / 34);
      const alpha = (0.055 + fade * 0.14) * (0.72 + pulse * 0.28);

      this.mist.circle(drift, y, radius).fill({ color: this.color, alpha });
      this.mist.circle(drift + wobble, y - radius * 0.55, radius * 0.72).fill({
        color: this.color,
        alpha: alpha * 0.72,
      });
    }

    // Верхнее мерцающее кольцо и частицы делают статус заметным, но не перекрывают моба.
    const crownY = baseY - 30;
    this.sparks
      .circle(0, crownY, 7 + pulse * 2)
      .stroke({ color: this.color, width: 1.4, alpha: 0.12 + pulse * 0.16 });

    for (let i = 0; i < 6; i += 1) {
      const angle = this.elapsed * (1.25 + i * 0.03) + i * Math.PI / 3;
      const orbit = 10 + (i % 2) * 4 + breathe * 2;
      const x = Math.cos(angle) * orbit;
      const y = crownY + Math.sin(angle) * 4.5;
      const radius = 1.2 + (i % 3) * 0.45 + pulse * 0.35;
      this.sparks.circle(x, y, radius).fill({
        color: this.color,
        alpha: 0.2 + pulse * 0.38,
      });
    }
  }
}
