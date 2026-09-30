import { useEffect, useState, type ChangeEvent } from 'react';
import {
  UNIT_ANIMATION_LABELS,
  getUnitAnimationFrameDuration,
} from '../../editor/units/unitAnimationLogic';
import {
  UNIT_ANIMATION_TYPES,
  type UnitAnimationFrame,
  type UnitAnimations,
  type UnitAnimationType,
} from '../../editor/units/types';
import { EditorFileInput, EditorInput } from '../../components/EditorControls';
import styles from './UnitsEditor.module.css';

type UnitAnimationEditorProps = {
  animationSpeed: number;
  animations: UnitAnimations;
  onChange: (value: { animationSpeed: number; animations: UnitAnimations }) => void;
};

function createRuntimeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `unit-animation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

function AnimationPreview({ frames, speed, label }: { frames: UnitAnimationFrame[]; speed: number; label: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
    if (frames.length < 2) return undefined;
    const interval = window.setInterval(
      () => setIndex((current) => (current + 1) % frames.length),
      getUnitAnimationFrameDuration(speed) * 1000,
    );
    return () => window.clearInterval(interval);
  }, [frames, speed]);

  return frames.length > 0
    ? <img src={frames[index]?.src} alt={label} draggable={false} />
    : <span>Нет кадров</span>;
}

export function UnitAnimationEditor({ animationSpeed, animations, onChange }: UnitAnimationEditorProps) {
  const [selectedType, setSelectedType] = useState<UnitAnimationType>('move');
  const selectedFrames = animations[selectedType];

  const replaceFrames = (frames: UnitAnimationFrame[]) => {
    onChange({
      animationSpeed,
      animations: { ...animations, [selectedType]: frames },
    });
  };

  const uploadFrames = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = (Array.from(event.currentTarget.files ?? []) as File[]).filter((file) => file.type.startsWith('image/'));
    event.currentTarget.value = '';
    if (files.length === 0) return;

    try {
      const frames = await Promise.all(files.map(async (file): Promise<UnitAnimationFrame> => ({
        id: createRuntimeId(),
        name: file.name,
        src: await readFileAsDataUrl(file),
      })));
      replaceFrames([...selectedFrames, ...frames]);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Не удалось загрузить кадры анимации.');
    }
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
            <AnimationPreview frames={selectedFrames} speed={animationSpeed} label={UNIT_ANIMATION_LABELS[selectedType]} />
          </div>
          <div className={styles.animationStatus}>
            <span>{selectedFrames.length > 0 ? `Кадров: ${selectedFrames.length}` : 'Кадров нет'}</span>
            <span>{selectedFrames.length > 1 ? 'Предпросмотр проигрывается автоматически' : 'Для анимации нужно 2+ кадра'}</span>
          </div>
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
