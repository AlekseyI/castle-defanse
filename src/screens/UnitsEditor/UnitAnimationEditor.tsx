import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Application, Sprite, Texture } from 'pixi.js';
import {
  UNIT_ANIMATION_LABELS,
  getUnitAnimationFrameIndex,
} from '../../editor/units/unitAnimationLogic';
import {
  UNIT_ANIMATION_TYPES,
  type UnitAnimationFrame,
  type UnitAnimationSounds,
  type UnitAnimations,
  type UnitAnimationType,
} from '../../editor/units/types';
import { EditorFileInput, EditorInput } from '../../components/EditorControls';
import styles from './UnitsEditor.module.css';

type UnitAnimationEditorProps = {
  animationSpeed: number;
  animations: UnitAnimations;
  animationSounds: UnitAnimationSounds;
  onChange: (value: {
    animationSpeed: number;
    animations: UnitAnimations;
    animationSounds: UnitAnimationSounds;
  }) => void;
};

function createRuntimeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error(`Не удалось прочитать файл «${file.name}».`));
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error(`Не удалось прочитать файл «${file.name}».`));
    reader.readAsDataURL(file);
  });
}

interface AnimationPreviewTexture {
  texture: Texture;
}

class PixiAnimationPreview {
  private readonly app = new Application();
  private readonly host: HTMLDivElement;
  private label = '';
  private readonly textures = new Map<string, AnimationPreviewTexture>();
  private sprite: Sprite | null = null;
  private frames: UnitAnimationFrame[] = [];
  private speed = 1;
  private elapsed = 0;
  private frameIndex = 0;
  private loadVersion = 0;
  private initialized = false;
  private disposed = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor(host: HTMLDivElement) {
    this.host = host;
  }

  async start() {
    const bounds = this.host.getBoundingClientRect();
    await this.app.init({
      preference: 'webgl',
      width: Math.max(1, Math.round(bounds.width || 180)),
      height: Math.max(1, Math.round(bounds.height || 180)),
      background: 0x0b1020,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      powerPreference: 'high-performance',
    });

    if (this.disposed) {
      this.app.destroy(true, true);
      return;
    }

    this.initialized = true;
    this.app.canvas.setAttribute('aria-label', `Предпросмотр анимации: ${this.label}`);
    this.host.appendChild(this.app.canvas);
    this.app.ticker.add(this.update);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.resize);
      this.resizeObserver.observe(this.host);
    }

    this.loadFrames();
    this.resize();
  }

  setAnimation(frames: UnitAnimationFrame[], speed: number, label: string) {
    const framesChanged = this.frames !== frames;
    this.frames = frames;
    this.speed = speed;
    this.label = label;
    this.elapsed = 0;
    this.frameIndex = 0;
    if (!this.initialized) return;
    this.app.canvas.setAttribute('aria-label', `Предпросмотр анимации: ${this.label}`);
    if (framesChanged) this.loadFrames();
    else this.refreshFrame();
  }

  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.loadVersion += 1;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    if (!this.initialized) return;
    this.app.ticker.remove(this.update);
    this.clearTextures();
    this.app.destroy(true, true);
    this.initialized = false;
  }

  private clearTextures() {
    if (this.sprite) {
      this.app.stage.removeChild(this.sprite);
      this.sprite.destroy();
      this.sprite = null;
    }

    for (const asset of this.textures.values()) asset.texture.destroy(true);
    this.textures.clear();
  }

  private loadFrames() {
    const version = ++this.loadVersion;
    this.clearTextures();

    const sources = new Set(this.frames.map((frame) => frame.src));
    for (const src of sources) {
      const image = new Image();
      image.onload = () => {
        if (this.disposed || version !== this.loadVersion) return;
        this.textures.set(src, {
          texture: Texture.from(image),
        });
        this.refreshFrame();
      };
      image.src = src;
    }
  }

  private refreshFrame() {
    const frame = this.frames[this.frameIndex];
    if (!frame) return;

    const asset = this.textures.get(frame.src);
    if (!asset) return;

    if (this.sprite) {
      this.sprite.texture = asset.texture;
    } else {
      this.sprite = new Sprite(asset.texture);
      this.sprite.anchor.set(0.5);
      this.app.stage.addChild(this.sprite);
    }

    this.sprite.tint = 0xffffff;
    this.stretchSpriteToCanvas();
  }

  private stretchSpriteToCanvas() {
    if (!this.sprite) return;
    this.sprite.width = this.app.screen.width;
    this.sprite.height = this.app.screen.height;
    this.sprite.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
  }

  private readonly resize = () => {
    if (!this.initialized || this.disposed) return;
    const bounds = this.host.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    if (width !== this.app.screen.width || height !== this.app.screen.height) {
      this.app.renderer.resize(width, height);
    }
    this.stretchSpriteToCanvas();
  };

  private readonly update = (ticker: { deltaMS: number }) => {
    if (this.frames.length < 2) return;
    this.elapsed += Math.min(0.05, ticker.deltaMS / 1000);
    const nextFrameIndex = getUnitAnimationFrameIndex(
      this.elapsed,
      this.frames.length,
      this.speed,
      true,
    );
    if (nextFrameIndex === this.frameIndex) return;
    this.frameIndex = nextFrameIndex;
    this.refreshFrame();
  };
}

function AnimationPreview({
  frames,
  speed,
  label,
}: {
  frames: UnitAnimationFrame[];
  speed: number;
  label: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<PixiAnimationPreview | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const preview = new PixiAnimationPreview(host);
    previewRef.current = preview;
    void preview.start().catch((error) => {
      console.error('Не удалось запустить Pixi-предпросмотр анимации юнита.', error);
    });

    return () => {
      previewRef.current = null;
      preview.destroy();
    };
  }, []);

  useEffect(() => {
    previewRef.current?.setAnimation(frames, speed, label);
  }, [frames, speed, label]);

  return (
    <div className={styles.animationPixiPreview}>
      <div ref={hostRef} className={styles.animationPixiHost} />
      {frames.length === 0 ? <span>Нет кадров</span> : null}
    </div>
  );
}

export function UnitAnimationEditor({ animationSpeed, animations, animationSounds, onChange }: UnitAnimationEditorProps) {
  const [selectedType, setSelectedType] = useState<UnitAnimationType>('move');
  const selectedFrames = animations[selectedType];
  const selectedSound = animationSounds[selectedType];

  const replaceFrames = (frames: UnitAnimationFrame[]) => {
    onChange({
      animationSpeed,
      animations: { ...animations, [selectedType]: frames },
      animationSounds,
    });
  };

  const uploadFrames = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = (Array.from(event.currentTarget.files ?? []) as File[]).filter((file) => file.type.startsWith('image/'));
    event.currentTarget.value = '';
    if (files.length === 0) return;

    try {
      const frames = await Promise.all(files.map(async (file): Promise<UnitAnimationFrame> => ({
        id: createRuntimeId('unit-animation-frame'),
        name: file.name,
        src: await readFileAsDataUrl(file),
      })));
      replaceFrames([...selectedFrames, ...frames]);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Не удалось загрузить кадры анимации.');
    }
  };

  const uploadSound = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    try {
      onChange({
        animationSpeed,
        animations,
        animationSounds: {
          ...animationSounds,
          [selectedType]: {
            id: createRuntimeId('unit-animation-sound'),
            name: file.name,
            src: await readFileAsDataUrl(file),
          },
        },
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Не удалось загрузить звук анимации.');
    }
  };

  const removeSound = () => {
    const nextSounds = { ...animationSounds };
    delete nextSounds[selectedType];
    onChange({ animationSpeed, animations, animationSounds: nextSounds });
  };

  return (
    <div className={styles.formSection}>
      <div className={styles.animationHeading}>
        <div>
          <h2>Анимации</h2>
          <p>Кадры используются для отображения юнита на игровом canvas. Картинка юнита выше остаётся только для UI.</p>
        </div>
        <div className={styles.animationToolbar}>
          <label className={styles.fileButton}>
            Загрузить кадры
            <EditorFileInput accept="image/*,.svg" multiple onChange={uploadFrames} />
          </label>
          <label className={styles.fileButton}>
            Загрузить звук
            <EditorFileInput accept="audio/*" onChange={uploadSound} />
          </label>
          <button
            type="button"
            className={styles.toolbarButton}
            disabled={selectedFrames.length === 0}
            onClick={() => replaceFrames([])}
          >
            Очистить {UNIT_ANIMATION_LABELS[selectedType]}
          </button>
        </div>
      </div>

      <div className={styles.animationSettings}>
        <label className={styles.field}>
          <span>Скорость анимации</span>
          <EditorInput
            type="number"
            min="0.1"
            max="100"
            step="0.1"
            value={Number.isFinite(animationSpeed) ? animationSpeed : ''}
            onChange={(event) => onChange({
              animationSpeed: event.target.value.trim() === '' ? Number.NaN : Number(event.target.value),
              animations,
              animationSounds,
            })}
          />
        </label>
      </div>

      <div className={styles.animationGroupTitle}>Тип анимации</div>
      <div className={styles.animationTypeGrid}>
        {UNIT_ANIMATION_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            className={`${styles.animationTypeButton}${selectedType === type ? ` ${styles.active}` : ''}`}
            onClick={() => setSelectedType(type)}
          >
            <span>{UNIT_ANIMATION_LABELS[type]}</span>
            <small>{animations[type].length} кадров</small>
          </button>
        ))}
      </div>

      <div className={styles.animationWorkspace}>
        <div className={styles.animationPreviewPanel}>
          <strong>Предпросмотр: {UNIT_ANIMATION_LABELS[selectedType]}</strong>
          <div className={styles.animationStage}>
            <AnimationPreview
              frames={selectedFrames}
              speed={animationSpeed}
              label={UNIT_ANIMATION_LABELS[selectedType]}
            />
          </div>
          <div className={styles.animationStatus}>
            <span>{selectedFrames.length > 0 ? `Кадров: ${selectedFrames.length}` : 'Кадров нет'}</span>
            <span>{selectedFrames.length > 1 ? 'Предпросмотр проигрывается автоматически' : 'Для анимации нужно 2+ кадра'}</span>
          </div>
          {selectedSound ? (
            <div className={styles.animationSoundPreview}>
              <strong title={selectedSound.name}>Звук: {selectedSound.name}</strong>
              <audio controls src={selectedSound.src}><track kind="captions" /></audio>
              <button type="button" className={styles.dangerButton} onClick={removeSound}>Удалить звук</button>
            </div>
          ) : (
            <p className={styles.animationSoundEmpty}>Звук для выбранной анимации не загружен.</p>
          )}
        </div>

        <div className={styles.animationFrameGrid}>
          {selectedFrames.map((frame, index) => (
            <article key={frame.id} className={styles.animationFrameCard}>
              <div className={styles.animationFrameImage}><img src={frame.src} alt={`Кадр ${index + 1}`} draggable={false} /></div>
              <div className={styles.animationFrameMeta}><strong>#{index + 1}</strong><span title={frame.name}>{frame.name}</span></div>
              <button type="button" className={styles.dangerButton} onClick={() => replaceFrames(selectedFrames.filter((item) => item.id !== frame.id))}>Удалить</button>
            </article>
          ))}
          {selectedFrames.length === 0 ? (
            <div className={styles.animationEmptyState}>
              <strong>{UNIT_ANIMATION_LABELS[selectedType]}</strong>
              <span>Загрузите изображения, чтобы добавить кадры этого типа.</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
