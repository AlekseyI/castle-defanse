export interface EffectPoint {
  x: number;
  y: number;
}

export interface EffectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpellEffectOptions {
  source?: EffectPoint;
  targets?: EffectPoint[];
  areaHeightPercent?: number;
}

export interface BattleEffect {
  readonly done: boolean;
  update(dt: number): void;
  resize(bounds: EffectBounds): void;
}
