import { Container, Graphics } from 'pixi.js';
import {
  damageSourceColorToNumber,
  getRangedProjectileDuration,
  getRangedProjectilePoint,
  type ProjectilePoint,
} from '../rangedProjectileLogic';

const MAX_TRAIL_POINTS = 9;
const IMPACT_DURATION = 0.18;

export class RangedProjectile extends Container {
  private readonly trail = new Graphics();
  private readonly glow = new Graphics();
  private readonly core = new Graphics();
  private readonly impact = new Graphics();
  private readonly history: ProjectilePoint[] = [];
  private readonly start: ProjectilePoint;
  private readonly end: ProjectilePoint;
  private readonly color: number;
  private readonly duration: number;
  private elapsed = 0;

  constructor(start: ProjectilePoint, end: ProjectilePoint, color?: string) {
    super();
    this.eventMode = 'none';
    this.start = { ...start };
    this.end = { ...end };
    this.color = damageSourceColorToNumber(color);
    this.duration = getRangedProjectileDuration(start, end);
    this.history.push({ ...start });

    this.trail.blendMode = 'add';
    this.glow.blendMode = 'add';
    this.core.blendMode = 'add';
    this.impact.blendMode = 'add';
    this.addChild(this.trail, this.glow, this.core, this.impact);
    this.drawFlight(start, 0);
  }

  get done(): boolean {
    return this.elapsed >= this.duration + IMPACT_DURATION;
  }

  update(dt: number) {
    this.elapsed += Math.max(0, dt);

    if (this.elapsed < this.duration) {
      const progress = this.elapsed / this.duration;
      const point = getRangedProjectilePoint(this.start, this.end, progress);
      this.rememberPoint(point);
      this.drawFlight(point, progress);
      return;
    }

    this.drawImpact(Math.min(1, (this.elapsed - this.duration) / IMPACT_DURATION));
  }

  private rememberPoint(point: ProjectilePoint) {
    const previous = this.history[this.history.length - 1];
    if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 2) {
      this.history.push({ ...point });
    }
    while (this.history.length > MAX_TRAIL_POINTS) this.history.shift();
  }

  private drawFlight(point: ProjectilePoint, progress: number) {
    this.impact.clear();
    this.drawTrail();

    const pulse = 0.5 + 0.5 * Math.sin(progress * Math.PI * 8);
    this.glow
      .clear()
      .circle(point.x, point.y, 12 + pulse * 2)
      .fill({ color: this.color, alpha: 0.12 })
      .circle(point.x, point.y, 7 + pulse)
      .fill({ color: this.color, alpha: 0.28 });

    this.core
      .clear()
      .circle(point.x, point.y, 4.5)
      .fill({ color: this.color, alpha: 0.95 })
      .circle(point.x, point.y, 2)
      .fill({ color: 0xffffff, alpha: 0.95 })
      .moveTo(point.x - 7, point.y)
      .lineTo(point.x + 7, point.y)
      .stroke({ color: 0xffffff, width: 1, alpha: 0.32 })
      .moveTo(point.x, point.y - 7)
      .lineTo(point.x, point.y + 7)
      .stroke({ color: 0xffffff, width: 1, alpha: 0.24 });
  }

  private drawTrail() {
    this.trail.clear();
    if (this.history.length < 2) return;

    for (let i = 1; i < this.history.length; i += 1) {
      const previous = this.history[i - 1];
      const point = this.history[i];
      const strength = i / (this.history.length - 1);
      this.trail
        .moveTo(previous.x, previous.y)
        .lineTo(point.x, point.y)
        .stroke({ color: this.color, width: 9 * strength, alpha: 0.035 + strength * 0.08 });
    }

    for (let i = 1; i < this.history.length; i += 1) {
      const previous = this.history[i - 1];
      const point = this.history[i];
      const strength = i / (this.history.length - 1);
      this.trail
        .moveTo(previous.x, previous.y)
        .lineTo(point.x, point.y)
        .stroke({ color: this.color, width: 1.2 + strength * 2.4, alpha: 0.14 + strength * 0.58 });
    }
  }

  private drawImpact(progress: number) {
    this.trail.clear();
    this.glow.clear();
    this.core.clear();

    const fade = 1 - progress;
    const radius = 5 + progress * 22;
    this.impact
      .clear()
      .circle(this.end.x, this.end.y, radius)
      .stroke({ color: this.color, width: 2.5 * fade + 0.5, alpha: fade * 0.8 })
      .circle(this.end.x, this.end.y, 10 + progress * 7)
      .fill({ color: this.color, alpha: fade * 0.16 })
      .circle(this.end.x, this.end.y, Math.max(1, 5 * fade))
      .fill({ color: 0xffffff, alpha: fade * 0.8 });

    for (let ray = 0; ray < 8; ray += 1) {
      const angle = (Math.PI * 2 * ray) / 8 + Math.PI / 8;
      const innerRadius = 5 + progress * 7;
      const outerRadius = innerRadius + 8 + progress * 9;
      this.impact
        .moveTo(
          this.end.x + Math.cos(angle) * innerRadius,
          this.end.y + Math.sin(angle) * innerRadius,
        )
        .lineTo(
          this.end.x + Math.cos(angle) * outerRadius,
          this.end.y + Math.sin(angle) * outerRadius,
        )
        .stroke({ color: this.color, width: 1.6, alpha: fade * 0.55 });
    }
  }
}
