import { Container, Graphics } from 'pixi.js';
import type { BattleEffect, EffectBounds, EffectPoint } from './types';

interface Bolt {
  points: EffectPoint[];
  isBranch: boolean;
  opacity: number;
  fadeSpeed: number;
  width: number;
}

const FRAME_STEP = 1 / 60;
const SECOND_STRIKE_DELAY = 0.06;

export class LightningEffect extends Container implements BattleEffect {
  private readonly graphics = new Graphics();
  private bounds: EffectBounds;
  private readonly source: EffectPoint;
  private readonly targets: EffectPoint[];
  private bolts: Bolt[] = [];
  private elapsed = 0;
  private frameAccumulator = 0;
  private secondStrikeCreated = false;
  private flashAlpha = 0;

  constructor(bounds: EffectBounds, source: EffectPoint, targets: EffectPoint[]) {
    super();
    this.bounds = bounds;
    this.source = { ...source };
    this.targets = targets.map((target) => ({ ...target }));
    this.eventMode = 'none';
    this.blendMode = 'screen';
    this.addChild(this.graphics);
    this.createStrikeWave();
    this.draw();
  }

  get done() {
    return this.secondStrikeCreated && this.bolts.length === 0 && this.flashAlpha <= 0;
  }

  update(dt: number) {
    this.elapsed += dt;

    if (!this.secondStrikeCreated && this.elapsed >= SECOND_STRIKE_DELAY) {
      this.secondStrikeCreated = true;
      this.createStrikeWave();
    }

    this.frameAccumulator += dt;
    while (this.frameAccumulator >= FRAME_STEP) {
      this.frameAccumulator -= FRAME_STEP;
      this.stepFrame();
    }

    this.draw();
  }

  resize(bounds: EffectBounds) {
    this.bounds = bounds;
    this.draw();
  }

  private createStrikeWave() {
    for (const target of this.targets) this.createStrike(target);
  }

  private createStrike(target: EffectPoint) {
    const main = this.createBolt(this.source, target, false, 25);
    if (main.points.length >= 2) this.bolts.push(main);
    this.flashAlpha = Math.random() * 0.14 + 0.07;
  }

  private createBolt(
    start: EffectPoint,
    end: EffectPoint,
    isBranch: boolean,
    maxSegments: number,
  ): Bolt {
    const bolt: Bolt = {
      points: [],
      isBranch,
      opacity: 1,
      fadeSpeed: isBranch ? 0.07 : 0.045,
      width: isBranch ? 1.5 : 3.8,
    };

    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance < 10) return bolt;

    bolt.points.push({ ...start });
    const angle = Math.atan2(deltaY, deltaX);

    for (let i = 1; i <= maxSegments; i += 1) {
      const progress = i / maxSegments;
      const targetX = start.x + deltaX * progress;
      const targetY = start.y + deltaY * progress;
      const maxOffset = isBranch ? 10 : 22;
      const offset = (Math.random() - 0.5) * maxOffset;
      const next = {
        x: targetX + Math.cos(angle + Math.PI / 2) * offset,
        y: targetY + Math.sin(angle + Math.PI / 2) * offset,
      };

      bolt.points.push(next);

      if (!isBranch && Math.random() < 0.14 && i < maxSegments - 3) {
        const branchAngle = angle + (Math.random() - 0.5) * 1.1;
        const branchLength = distance * (1 - progress) * (Math.random() * 0.35 + 0.2);
        const branchEnd = {
          x: next.x + Math.cos(branchAngle) * branchLength,
          y: next.y + Math.sin(branchAngle) * branchLength,
        };
        const branch = this.createBolt(next, branchEnd, true, Math.floor(maxSegments * 0.4));
        if (branch.points.length >= 2) this.bolts.push(branch);
      }
    }

    bolt.points[bolt.points.length - 1] = { ...end };
    return bolt;
  }

  private stepFrame() {
    this.flashAlpha = Math.max(0, this.flashAlpha - 0.025);
    this.bolts = this.bolts.filter((bolt) => {
      bolt.opacity -= bolt.fadeSpeed;
      return bolt.opacity > 0;
    });
  }

  private draw() {
    this.graphics.clear();

    if (this.flashAlpha > 0) {
      this.graphics.rect(this.bounds.x, this.bounds.y, this.bounds.width, this.bounds.height)
        .fill({ color: 0x82b4ff, alpha: this.flashAlpha });
    }

    // Broad halo approximates the HTML shadowBlur while remaining on the shared Pixi canvas.
    for (const bolt of this.bolts) {
      if (bolt.points.length < 2) continue;
      this.drawBoltPath(bolt, 0x4da6ff, bolt.width * 5, Math.max(0, bolt.opacity * 0.1));
    }

    for (const bolt of this.bolts) {
      if (bolt.points.length < 2) continue;
      this.drawBoltPath(bolt, 0x4da6ff, bolt.width * 2.5, Math.max(0, bolt.opacity * 0.4));
    }

    for (const bolt of this.bolts) {
      if (bolt.points.length < 2) continue;
      this.drawBoltPath(bolt, 0xffffff, bolt.width, Math.max(0, bolt.opacity));
    }
  }

  private drawBoltPath(bolt: Bolt, color: number, width: number, alpha: number) {
    const first = bolt.points[0];
    this.graphics.moveTo(first.x, first.y);

    for (let i = 1; i < bolt.points.length - 1; i += 1) {
      const point = bolt.points[i];
      const next = bolt.points[i + 1];
      this.graphics.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
    }

    const last = bolt.points[bolt.points.length - 1];
    this.graphics.lineTo(last.x, last.y).stroke({ color, width, alpha });
  }
}
