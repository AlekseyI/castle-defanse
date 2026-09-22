import { BufferImageSource, Container, Sprite, Texture } from 'pixi.js';
import type { BattleEffect, EffectBounds } from './types';

const FIRE_WIDTH = 550;
const FIRE_HEIGHT = 220;
const MAX_COLOR_INDEX = 36;
const DURATION = 1;
const FADE_FOR = 0.2;
const FRAME_STEP = 1 / 60;
const FIRE_VISIBLE_ROWS = Math.ceil((DURATION - FADE_FOR) / FRAME_STEP);
const FIRE_OVERFLOW_ROWS = 24;
const FIRE_TOP_ROW = FIRE_HEIGHT - FIRE_VISIBLE_ROWS;
const FIRE_PROPAGATION_TOP_ROW = FIRE_TOP_ROW - FIRE_OVERFLOW_ROWS;
const FIRE_PROPAGATION_ROWS = FIRE_VISIBLE_ROWS + FIRE_OVERFLOW_ROWS;

const COLORS = [
  [0, 0, 0], [7, 7, 7], [31, 7, 7], [47, 15, 7], [71, 15, 7], [87, 23, 7],
  [103, 31, 7], [119, 31, 7], [143, 39, 7], [159, 47, 7], [175, 63, 7], [191, 71, 7],
  [199, 71, 7], [223, 79, 7], [223, 87, 7], [223, 87, 7], [215, 95, 7], [215, 103, 15],
  [207, 111, 15], [207, 119, 15], [207, 127, 15], [207, 135, 23], [199, 135, 23],
  [199, 143, 23], [199, 151, 31], [195, 159, 31], [195, 159, 31], [195, 167, 39],
  [195, 175, 39], [191, 183, 47], [191, 183, 47], [191, 191, 55], [207, 199, 71],
  [223, 215, 95], [239, 231, 135], [255, 247, 191], [255, 255, 255],
] as const;

export class FireWallEffect extends Container implements BattleEffect {
  private readonly firePixels = new Uint8Array(FIRE_WIDTH * FIRE_HEIGHT);
  private readonly rgbaPixels = new Uint8Array(FIRE_WIDTH * FIRE_HEIGHT * 4);
  private readonly source: BufferImageSource;
  private readonly fireTexture: Texture;
  private readonly sprites: Sprite[] = [];
  private bounds: EffectBounds;
  private readonly areaHeightPercent: number;
  private elapsed = 0;
  private frameAccumulator = 0;

  constructor(bounds: EffectBounds, areaHeightPercent = 50) {
    super();
    this.bounds = bounds;
    this.areaHeightPercent = Math.max(1, Math.min(100, areaHeightPercent));
    this.eventMode = 'none';

    this.source = new BufferImageSource({
      resource: this.rgbaPixels,
      width: FIRE_WIDTH,
      height: FIRE_HEIGHT,
      format: 'rgba8unorm',
      scaleMode: 'linear',
    });
    this.fireTexture = new Texture({ source: this.source });

    this.initFire();
    for (let i = 0; i < FIRE_PROPAGATION_ROWS; i += 1) this.calculateFirePropagation();
    this.drawFire();
    this.applyBounds();
  }

  get done() {
    return this.elapsed >= DURATION;
  }

  update(dt: number) {
    this.elapsed += dt;
    this.frameAccumulator += dt;

    while (this.frameAccumulator >= FRAME_STEP) {
      this.frameAccumulator -= FRAME_STEP;
      this.calculateFirePropagation();
    }

    this.alpha = this.elapsed > DURATION - FADE_FOR
      ? Math.max(0, (DURATION - this.elapsed) / FADE_FOR)
      : 1;

    this.drawFire();
  }

  resize(bounds: EffectBounds) {
    this.bounds = bounds;
    this.applyBounds();
  }

  destroy(options?: Parameters<Container['destroy']>[0]) {
    super.destroy(options);
    this.fireTexture.destroy(true);
  }

  private initFire() {
    const bottomRow = (FIRE_HEIGHT - 1) * FIRE_WIDTH;
    for (let x = 0; x < FIRE_WIDTH; x += 1) {
      this.firePixels[bottomRow + x] = MAX_COLOR_INDEX;
    }
  }

  private calculateFirePropagation() {
    for (let x = 0; x < FIRE_WIDTH; x += 1) {
      for (let y = FIRE_PROPAGATION_TOP_ROW; y < FIRE_HEIGHT; y += 1) {
        const currentPixelIndex = y * FIRE_WIDTH + x;
        const belowPixelIndex = currentPixelIndex + FIRE_WIDTH;
        if (belowPixelIndex >= this.firePixels.length) continue;

        const belowPixelValue = this.firePixels[belowPixelIndex];
        const decay = Math.floor(Math.random() * 2.15);
        const shift = Math.floor(Math.random() * 3) - 1;
        const targetIndex = Math.max(0, Math.min(this.firePixels.length - 1, currentPixelIndex - decay + shift));
        const newValue = belowPixelValue - (decay & 1);
        this.firePixels[targetIndex] = Math.max(0, newValue);
      }
    }
  }

  private drawFire() {
    let rgbaIndex = 0;

    for (let i = 0; i < this.firePixels.length; i += 1) {
      const colorIndex = this.firePixels[i];
      const color = COLORS[colorIndex] ?? COLORS[0];
      this.rgbaPixels[rgbaIndex] = color[0];
      this.rgbaPixels[rgbaIndex + 1] = color[1];
      this.rgbaPixels[rgbaIndex + 2] = color[2];

      let alpha = colorIndex > 1 ? 255 : 0;
      const row = Math.floor(i / FIRE_WIDTH);
      if (alpha > 0 && row < FIRE_PROPAGATION_TOP_ROW) {
        alpha = 0;
      } else if (alpha > 0 && row < FIRE_TOP_ROW) {
        const taper = (row - FIRE_PROPAGATION_TOP_ROW) / FIRE_OVERFLOW_ROWS;
        alpha = Math.round(alpha * Math.max(0, Math.min(1, taper)));
      }
      this.rgbaPixels[rgbaIndex + 3] = alpha;
      rgbaIndex += 4;
    }

    this.source.update();
  }

  private applyBounds() {
    const areaHeight = this.bounds.height * (this.areaHeightPercent / 100);
    const pixelScale = areaHeight / FIRE_PROPAGATION_ROWS;
    const fireWidth = FIRE_WIDTH * pixelScale;
    const fireHeight = FIRE_HEIGHT * pixelScale;
    const fireBottom = this.bounds.y + this.bounds.height;
    const spriteCount = Math.max(1, Math.ceil(this.bounds.width / fireWidth));

    this.syncSprites(spriteCount);

    const stripWidth = spriteCount * fireWidth;
    const startX = this.bounds.x + (this.bounds.width - stripWidth) / 2;

    for (let i = 0; i < this.sprites.length; i += 1) {
      const sprite = this.sprites[i];
      sprite.position.set(startX + i * fireWidth, fireBottom - fireHeight);
      sprite.scale.set(pixelScale);
    }
  }

  private syncSprites(count: number) {
    while (this.sprites.length < count) {
      const sprite = new Sprite(this.fireTexture);
      sprite.eventMode = 'none';
      this.sprites.push(sprite);
      this.addChild(sprite);
    }

    while (this.sprites.length > count) {
      const sprite = this.sprites.pop();
      if (!sprite) break;
      this.removeChild(sprite);
      sprite.destroy();
    }
  }
}
