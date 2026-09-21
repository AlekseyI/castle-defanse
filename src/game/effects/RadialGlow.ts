import { BufferImageSource, Sprite, Texture } from 'pixi.js';
import type { EffectBounds } from './types';

export interface RadialGlowStop {
  offset: number;
  r: number;
  g: number;
  b: number;
  alpha: number;
}

const MAX_TEXTURE_DIMENSION = 320;

export class RadialGlow extends Sprite {
  private radialTexture: Texture;
  private readonly radiusScale: number;
  private readonly stops: RadialGlowStop[];

  constructor(bounds: EffectBounds, radiusScale: number, stops: RadialGlowStop[]) {
    const texture = createTexture(bounds, radiusScale, stops);
    super(texture);
    this.radialTexture = texture;
    this.radiusScale = radiusScale;
    this.stops = stops;
    this.eventMode = 'none';
    this.blendMode = 'screen';
    this.applyBounds(bounds);
  }

  resize(bounds: EffectBounds) {
    const nextTexture = createTexture(bounds, this.radiusScale, this.stops);
    const previousTexture = this.radialTexture;
    this.radialTexture = nextTexture;
    this.texture = nextTexture;
    this.applyBounds(bounds);
    previousTexture.destroy(true);
  }

  destroy(options?: Parameters<Sprite['destroy']>[0]) {
    const texture = this.radialTexture;
    super.destroy(options);
    texture.destroy(true);
  }

  private applyBounds(bounds: EffectBounds) {
    this.position.set(bounds.x, bounds.y);
    this.width = bounds.width;
    this.height = bounds.height;
  }
}

function createTexture(bounds: EffectBounds, radiusScale: number, stops: RadialGlowStop[]) {
  const maxDimension = Math.max(1, bounds.width, bounds.height);
  const scale = Math.min(1, MAX_TEXTURE_DIMENSION / maxDimension);
  const width = Math.max(1, Math.round(bounds.width * scale));
  const height = Math.max(1, Math.round(bounds.height * scale));
  const data = new Uint8Array(width * height * 4);
  const radius = maxDimension * radiusScale;
  const centerX = bounds.width / 2;
  const centerY = bounds.height / 2;

  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    const actualY = ((y + 0.5) / height) * bounds.height;
    for (let x = 0; x < width; x += 1) {
      const actualX = ((x + 0.5) / width) * bounds.width;
      const distance = Math.hypot(actualX - centerX, actualY - centerY);
      const t = Math.min(1, radius > 0 ? distance / radius : 1);
      const color = sampleStops(stops, t);

      data[offset] = color.r;
      data[offset + 1] = color.g;
      data[offset + 2] = color.b;
      data[offset + 3] = Math.round(color.alpha * 255);
      offset += 4;
    }
  }

  const source = new BufferImageSource({
    resource: data,
    width,
    height,
    format: 'rgba8unorm',
    scaleMode: 'linear',
  });
  return new Texture({ source });
}

function sampleStops(stops: RadialGlowStop[], t: number) {
  if (t <= stops[0].offset) return stops[0];

  for (let i = 1; i < stops.length; i += 1) {
    const right = stops[i];
    if (t > right.offset) continue;

    const left = stops[i - 1];
    const span = Math.max(0.0001, right.offset - left.offset);
    const progress = (t - left.offset) / span;
    return {
      offset: t,
      r: Math.round(left.r + (right.r - left.r) * progress),
      g: Math.round(left.g + (right.g - left.g) * progress),
      b: Math.round(left.b + (right.b - left.b) * progress),
      alpha: left.alpha + (right.alpha - left.alpha) * progress,
    };
  }

  return stops[stops.length - 1];
}
