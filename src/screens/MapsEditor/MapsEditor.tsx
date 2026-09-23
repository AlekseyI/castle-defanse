import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import {
  cloneMap,
  createEmptyMap,
  createEmptySpawnBlock,
  createEmptyWave,
  createId,
  deleteMap,
  filterUnitsByNameSubstring,
  findFirstUnitByNameSubstring,
  generateWaves,
  moveWaveByIndex,
  normalizeMap,
  saveMap,
  validateMap,
} from '../../editor/maps/mapLogic';
import { loadActiveMapId, loadMaps, persistActiveMapId, persistMaps } from '../../editor/maps/mapStorage';
import type {
  MapDefinition,
  MapWaveDefinition,
  WaveBlockStartCondition,
  WaveSpawnBlock,
} from '../../editor/maps/types';
import { loadUnits } from '../../editor/units/unitStorage';
import styles from './MapsEditor.module.css';

type MapsEditorProps = {
  onBackToMain: () => void;
  onBackToEditors: () => void;
};

const START_CONDITION_LABELS: Record<WaveBlockStartCondition, string> = {
  'after-spawn': 'После завершения спавна предыдущего блока',
  'field-clear': 'Когда поле очистится',
};

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

function inputNumber(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value);
}

function drawPreview(
  canvas: HTMLCanvasElement,
  map: MapDefinition,
  image: HTMLImageElement | null,
) {
  const context = canvas.getContext('2d');
  if (!context) return;

  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = map.background.color || '#0b1020';
  context.fillRect(0, 0, width, height);

  if (image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
    const imageRatio = image.naturalWidth / image.naturalHeight;
    const canvasRatio = width / height;
    const useWidth = map.background.fit === 'cover'
      ? imageRatio < canvasRatio
      : imageRatio > canvasRatio;

    const drawWidth = useWidth ? width : height * imageRatio;
    const drawHeight = useWidth ? width / imageRatio : height;
    const x = (width - drawWidth) / 2;
    const y = (height - drawHeight) / 2;
    context.drawImage(image, x, y, drawWidth, drawHeight);
  }

  context.save();
  context.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  context.lineWidth = 1;
  context.setLineDash([6, 6]);
  context.strokeRect(16, 16, width - 32, height - 32);
  context.restore();
}

function duplicateWave(wave: MapWaveDefinition): MapWaveDefinition {
  return {
    id: createId('wave'),
    blocks: wave.blocks.map((block) => ({ ...block, id: createId('block') })),
  };
}

export function MapsEditor({ onBackToMain, onBackToEditors }: MapsEditorProps) {
  const [units] = useState(() => loadUnits());
  const unitIds = useMemo(() => units.map((unit) => unit.id), [units]);
  const firstUnitId = unitIds[0] ?? '';
  const generatorUnitIds = useMemo(() => units.filter((unit) => !unit.isBoss).map((unit) => unit.id), [units]);
  const generatorBossUnitIds = useMemo(() => units.filter((unit) => unit.isBoss).map((unit) => unit.id), [units]);
  const [maps, setMaps] = useState<MapDefinition[]>(() => loadMaps());
  const sortedMaps = useMemo(
    () => [...maps].sort((a, b) => a.name.localeCompare(b.name, 'ru') || a.id.localeCompare(b.id)),
    [maps],
  );
  const [initialMap] = useState<MapDefinition | null>(() => {
    const activeId = loadActiveMapId();
    return (activeId ? maps.find((map) => map.id === activeId) : undefined) ?? maps[0] ?? null;
  });
  const [selectedId, setSelectedId] = useState<string | null>(() => initialMap?.id ?? null);
  const [editingId, setEditingId] = useState<string | undefined>(() => initialMap?.id);
  const [draft, setDraft] = useState<MapDefinition>(() => cloneMap(initialMap ?? createEmptyMap(firstUnitId)));
  const [isCreating, setIsCreating] = useState(false);
  const [unitFilters, setUnitFilters] = useState<Record<string, string>>({});
  const [generatorWaveCount, setGeneratorWaveCount] = useState(10);
  const [generatorMinUnitCount, setGeneratorMinUnitCount] = useState(5);
  const [generatorMaxUnitCount, setGeneratorMaxUnitCount] = useState(15);
  const [generatorMinDifferentUnitCount, setGeneratorMinDifferentUnitCount] = useState(1);
  const [generatorMaxDifferentUnitCount, setGeneratorMaxDifferentUnitCount] = useState(2);
  const [generatorBossEveryWaves, setGeneratorBossEveryWaves] = useState(5);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const selectedMap = maps.find((map) => map.id === selectedId) ?? null;
  const validation = useMemo(
    () => validateMap(draft, maps, unitIds, editingId),
    [draft, maps, unitIds, editingId],
  );

  const updateMaps = (next: MapDefinition[]) => {
    setMaps(next);
    persistMaps(next);
  };

  useEffect(() => {
    if (isCreating) return;
    if (selectedId && maps.some((map) => map.id === selectedId)) return;

    const next = [...maps].sort((a, b) => a.name.localeCompare(b.name, 'ru') || a.id.localeCompare(b.id))[0] ?? null;
    setSelectedId(next?.id ?? null);
    setEditingId(next?.id);
    setDraft(cloneMap(next ?? createEmptyMap(firstUnitId)));
  }, [firstUnitId, isCreating, maps, selectedId]);

  useEffect(() => {
    if (!validation.valid) return;

    const normalized = normalizeMap(draft);
    const current = editingId ? maps.find((map) => map.id === editingId) : undefined;
    if (current && JSON.stringify(current) === JSON.stringify(normalized)) return;

    const next = saveMap(maps, normalized, editingId);
    updateMaps(next);
    setSelectedId(normalized.id);
    setEditingId(normalized.id);
    persistActiveMapId(normalized.id);
    setIsCreating(false);
  }, [draft, editingId, maps, validation.valid]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const src = draft.background.image?.src;
    if (!src) {
      drawPreview(canvas, draft, null);
      return;
    }

    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) drawPreview(canvas, draft, image);
    };
    image.onerror = () => {
      if (!cancelled) drawPreview(canvas, draft, null);
    };
    image.src = src;

    return () => {
      cancelled = true;
    };
  }, [draft.background.color, draft.background.fit, draft.background.image?.src]);

  const selectMap = (map: MapDefinition) => {
    setSelectedId(map.id);
    setEditingId(map.id);
    setDraft(cloneMap(map));
    persistActiveMapId(map.id);
    setIsCreating(false);
  };

  const openCreate = () => {
    setSelectedId(null);
    setEditingId(undefined);
    setDraft(createEmptyMap(firstUnitId));
    setIsCreating(true);
  };

  const cancelCreate = () => {
    const next = sortedMaps[0] ?? null;
    setSelectedId(next?.id ?? null);
    setEditingId(next?.id);
    setDraft(cloneMap(next ?? createEmptyMap(firstUnitId)));
    if (next) persistActiveMapId(next.id);
    setIsCreating(false);
  };

  const remove = () => {
    if (!selectedMap) return;
    if (!window.confirm(`Удалить карту «${selectedMap.name}»?`)) return;

    const selectedIndex = sortedMaps.findIndex((map) => map.id === selectedMap.id);
    const remaining = deleteMap(maps, selectedMap.id);
    updateMaps(remaining);

    const nextSorted = [...remaining].sort((a, b) => a.name.localeCompare(b.name, 'ru') || a.id.localeCompare(b.id));
    const next = nextSorted[selectedIndex] ?? nextSorted[selectedIndex - 1] ?? null;
    setSelectedId(next?.id ?? null);
    setEditingId(next?.id);
    setDraft(cloneMap(next ?? createEmptyMap(firstUnitId)));
    if (next) persistActiveMapId(next.id);
    setIsCreating(false);
  };

  const handleBackgroundUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    try {
      const src = await readFileAsDataUrl(file);
      setDraft((current) => ({
        ...current,
        background: {
          ...current.background,
          image: { name: file.name, src },
        },
      }));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Не удалось загрузить фон карты.');
    }
  };

  const updateWave = (waveId: string, updater: (wave: MapWaveDefinition) => MapWaveDefinition) => {
    setDraft((current) => ({
      ...current,
      waves: current.waves.map((wave) => (wave.id === waveId ? updater(wave) : wave)),
    }));
  };

  const addWave = () => {
    setDraft((current) => ({
      ...current,
      waves: [...current.waves, createEmptyWave(firstUnitId)],
    }));
  };

  const removeWave = (waveId: string) => {
    setDraft((current) => ({
      ...current,
      waves: current.waves.filter((wave) => wave.id !== waveId),
    }));
  };

  const cloneWave = (waveId: string) => {
    setDraft((current) => {
      const index = current.waves.findIndex((wave) => wave.id === waveId);
      if (index < 0) return current;
      const next = [...current.waves];
      next.splice(index + 1, 0, duplicateWave(current.waves[index]));
      return { ...current, waves: next };
    });
  };

  const moveWave = (waveIndex: number, direction: -1 | 1) => {
    setDraft((current) => ({
      ...current,
      waves: moveWaveByIndex(current.waves, waveIndex, direction),
    }));
  };

  const addBlock = (waveId: string) => {
    updateWave(waveId, (wave) => ({
      ...wave,
      blocks: [...wave.blocks, createEmptySpawnBlock(firstUnitId)],
    }));
  };

  const updateBlock = (waveId: string, blockId: string, patch: Partial<WaveSpawnBlock>) => {
    updateWave(waveId, (wave) => ({
      ...wave,
      blocks: wave.blocks.map((block) => (block.id === blockId ? { ...block, ...patch } : block)),
    }));
  };

  const removeBlock = (waveId: string, blockId: string) => {
    updateWave(waveId, (wave) => ({
      ...wave,
      blocks: wave.blocks.filter((block) => block.id !== blockId),
    }));
  };

  const generatorError = useMemo(() => {
    if (!Number.isInteger(generatorWaveCount) || generatorWaveCount < 1) {
      return 'Количество волн должно быть целым числом от 1.';
    }
    if (!Number.isInteger(generatorMinUnitCount) || generatorMinUnitCount < 1) {
      return 'Минимальное количество юнитов должно быть целым числом от 1.';
    }
    if (!Number.isInteger(generatorMaxUnitCount) || generatorMaxUnitCount < generatorMinUnitCount) {
      return 'Максимальное количество юнитов должно быть не меньше минимального.';
    }
    if (!Number.isInteger(generatorMinDifferentUnitCount) || generatorMinDifferentUnitCount < 1) {
      return 'Минимальное количество разных юнитов должно быть целым числом от 1.';
    }
    if (
      !Number.isInteger(generatorMaxDifferentUnitCount) ||
      generatorMaxDifferentUnitCount < generatorMinDifferentUnitCount
    ) {
      return 'Максимальное количество разных юнитов должно быть не меньше минимального.';
    }
    if (generatorUnitIds.length === 0) {
      return 'Для генерации нужен хотя бы один юнит без отметки «Босс».';
    }
    if (generatorMaxDifferentUnitCount > generatorUnitIds.length) {
      return 'Максимум разных юнитов не должен превышать число доступных обычных юнитов.';
    }
    if (generatorMaxDifferentUnitCount > generatorMinUnitCount) {
      return 'Максимум разных юнитов не должен превышать минимальное общее количество юнитов в волне.';
    }
    if (!Number.isInteger(generatorBossEveryWaves) || generatorBossEveryWaves < 1) {
      return 'Период появления босса должен быть целым числом от 1.';
    }
    if (generatorBossUnitIds.length === 0) {
      return 'Для генерации нужен хотя бы один юнит с отметкой «Босс».';
    }
    return '';
  }, [
    generatorBossEveryWaves,
    generatorBossUnitIds.length,
    generatorMaxDifferentUnitCount,
    generatorMaxUnitCount,
    generatorMinDifferentUnitCount,
    generatorMinUnitCount,
    generatorUnitIds.length,
    generatorWaveCount,
  ]);

  const handleGenerateWaves = () => {
    if (generatorError) return;

    const waves = generateWaves({
      waveCount: generatorWaveCount,
      minUnitCount: generatorMinUnitCount,
      maxUnitCount: generatorMaxUnitCount,
      minDifferentUnitCount: generatorMinDifferentUnitCount,
      maxDifferentUnitCount: generatorMaxDifferentUnitCount,
      unitIds: generatorUnitIds,
      bossEveryWaves: generatorBossEveryWaves,
      bossUnitIds: generatorBossUnitIds,
    });

    setUnitFilters({});
    setDraft((current) => ({
      ...current,
      waves,
      endless: {
        ...current.endless,
        repeatLastWaves: Math.min(current.endless.repeatLastWaves, waves.length),
      },
    }));
  };

  const hasEditor = isCreating || selectedMap !== null;

  return (
    <main className={styles.screen}>
      <header className={styles.topbar}>
        <button className={styles.toolbarButton} type="button" onClick={onBackToMain}>Главное меню</button>
        <strong>Редактор карт и волн</strong>
        <span className={styles.prototypeBadge}>Подключён к игре</span>
        <button className={styles.toolbarButton} type="button" onClick={onBackToEditors}>Все редакторы</button>
      </header>

      <div className={styles.layout}>
        <aside className={styles.listPanel} aria-label="Карты">
          <div className={styles.listHeader}>
            <div>
              <h2>Карты</h2>
              <p>{maps.length} в редакторе</p>
            </div>
            <button className={styles.addButton} type="button" onClick={openCreate} aria-label="Добавить карту">+</button>
          </div>

          <div className={styles.list}>
            {sortedMaps.map((map) => (
              <button
                key={map.id}
                type="button"
                className={`${styles.listItem}${map.id === selectedId && !isCreating ? ` ${styles.active}` : ''}`}
                onClick={() => selectMap(map)}
              >
                <span className={styles.mapThumb} style={{ backgroundColor: map.background.color }}>
                  {map.background.image
                    ? <img src={map.background.image.src} alt="" />
                    : <span aria-hidden="true">▧</span>}
                </span>
                <span className={styles.listItemText}>
                  <strong>{map.name || 'Без названия'}</strong>
                  <small>{map.id} · волн: {map.waves.length}</small>
                </span>
              </button>
            ))}
          </div>
        </aside>

        {hasEditor ? (
          <section className={styles.editorPanel}>
            <div className={styles.editorHeader}>
              <div>
                <span className={styles.kicker}>Карта</span>
                <h1>{isCreating ? 'Новая карта' : draft.name || 'Без названия'}</h1>
                <p>Выбранная карта и её волны используются игровой сценой.</p>
              </div>
              <div className={styles.headerActions}>
                {isCreating ? (
                  <button className={styles.toolbarButton} type="button" onClick={cancelCreate}>Отмена</button>
                ) : (
                  <button className={styles.dangerButton} type="button" onClick={remove}>Удалить карту</button>
                )}
              </div>
            </div>

            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <div>
                  <h2>Основное</h2>
                  <p>ID и название карты.</p>
                </div>
              </div>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>ID</span>
                  <input
                    value={draft.id}
                    aria-invalid={Boolean(validation.errors.id)}
                    onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))}
                    placeholder="forest_map"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                  {validation.errors.id && <small className={styles.fieldError}>{validation.errors.id}</small>}
                </label>
                <label className={styles.field}>
                  <span>Название</span>
                  <input
                    value={draft.name}
                    aria-invalid={Boolean(validation.errors.name)}
                    onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Лес"
                  />
                  {validation.errors.name && <small className={styles.fieldError}>{validation.errors.name}</small>}
                </label>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <div>
                  <h2>Background canvas</h2>
                  <p>Фон для будущей игровой карты. Сейчас отображается только в preview редактора.</p>
                </div>
                <div className={styles.inlineActions}>
                  <label className={styles.fileButton}>
                    Загрузить фон
                    <input type="file" accept="image/*,.svg" onChange={handleBackgroundUpload} />
                  </label>
                  <button
                    className={styles.toolbarButton}
                    type="button"
                    disabled={!draft.background.image}
                    onClick={() => setDraft((current) => ({
                      ...current,
                      background: { ...current.background, image: undefined },
                    }))}
                  >
                    Убрать фон
                  </button>
                </div>
              </div>

              <div className={styles.backgroundLayout}>
                <div className={styles.canvasFrame}>
                  <canvas ref={canvasRef} width={960} height={540} aria-label="Предпросмотр фона карты" />
                  <span className={styles.canvasHint}>Preview 16:9</span>
                </div>

                <div className={styles.backgroundControls}>
                  <label className={styles.field}>
                    <span>Цвет фона</span>
                    <div className={styles.colorRow}>
                      <input
                        className={styles.colorInput}
                        type="color"
                        value={/^#[0-9a-f]{6}$/i.test(draft.background.color) ? draft.background.color : '#0b1020'}
                        onChange={(event) => setDraft((current) => ({
                          ...current,
                          background: { ...current.background, color: event.target.value },
                        }))}
                      />
                      <input
                        value={draft.background.color}
                        aria-invalid={Boolean(validation.errors.backgroundColor)}
                        onChange={(event) => setDraft((current) => ({
                          ...current,
                          background: { ...current.background, color: event.target.value },
                        }))}
                      />
                    </div>
                    {validation.errors.backgroundColor && <small className={styles.fieldError}>{validation.errors.backgroundColor}</small>}
                  </label>

                  <label className={styles.field}>
                    <span>Режим изображения</span>
                    <select
                      value={draft.background.fit}
                      onChange={(event) => setDraft((current) => ({
                        ...current,
                        background: {
                          ...current.background,
                          fit: event.target.value as MapDefinition['background']['fit'],
                        },
                      }))}
                    >
                      <option value="cover">Cover — заполнить canvas</option>
                      <option value="contain">Contain — показать целиком</option>
                    </select>
                  </label>

                  <div className={styles.fileInfo}>
                    <span>Файл</span>
                    <strong>{draft.background.image?.name ?? 'Изображение не выбрано'}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <div>
                  <h2>Бесконечный режим</h2>
                  <p>После созданных вручную волн повторяются последние N волн с усилением каждого цикла.</p>
                </div>
                <label className={styles.switchLabel}>
                  <input
                    type="checkbox"
                    checked={draft.endless.enabled}
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      endless: { ...current.endless, enabled: event.target.checked },
                    }))}
                  />
                  <span>Включить</span>
                </label>
              </div>

              <div className={`${styles.formGrid} ${!draft.endless.enabled ? styles.disabledSection : ''}`}>
                <label className={styles.field}>
                  <span>Повторять последние волн</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    disabled={!draft.endless.enabled}
                    value={Number.isFinite(draft.endless.repeatLastWaves) ? draft.endless.repeatLastWaves : ''}
                    aria-invalid={Boolean(validation.errors.repeatLastWaves)}
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      endless: { ...current.endless, repeatLastWaves: inputNumber(event.target.value) },
                    }))}
                  />
                  <small className={styles.fieldHint}>Сколько последних созданных вручную волн использовать как шаблон одного бесконечного цикла.</small>
                  {validation.errors.repeatLastWaves && <small className={styles.fieldError}>{validation.errors.repeatLastWaves}</small>}
                </label>

                <label className={styles.field}>
                  <span>HP за цикл, +%</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    disabled={!draft.endless.enabled}
                    value={Number.isFinite(draft.endless.hpGrowthPercent) ? draft.endless.hpGrowthPercent : ''}
                    aria-invalid={Boolean(validation.errors.hpGrowthPercent)}
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      endless: { ...current.endless, hpGrowthPercent: inputNumber(event.target.value) },
                    }))}
                  />
                  <small className={styles.fieldHint}>На сколько процентов увеличивать HP всех врагов при каждом новом цикле повторения.</small>
                  {validation.errors.hpGrowthPercent && <small className={styles.fieldError}>{validation.errors.hpGrowthPercent}</small>}
                </label>

                <label className={styles.field}>
                  <span>Урон за цикл, +%</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    disabled={!draft.endless.enabled}
                    value={Number.isFinite(draft.endless.damageGrowthPercent) ? draft.endless.damageGrowthPercent : ''}
                    aria-invalid={Boolean(validation.errors.damageGrowthPercent)}
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      endless: { ...current.endless, damageGrowthPercent: inputNumber(event.target.value) },
                    }))}
                  />
                  <small className={styles.fieldHint}>На сколько процентов увеличивать урон врагов при каждом новом цикле повторения.</small>
                  {validation.errors.damageGrowthPercent && <small className={styles.fieldError}>{validation.errors.damageGrowthPercent}</small>}
                </label>

                <label className={styles.field}>
                  <span>Скорость за цикл, +%</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    disabled={!draft.endless.enabled}
                    value={Number.isFinite(draft.endless.speedGrowthPercent) ? draft.endless.speedGrowthPercent : ''}
                    aria-invalid={Boolean(validation.errors.speedGrowthPercent)}
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      endless: { ...current.endless, speedGrowthPercent: inputNumber(event.target.value) },
                    }))}
                  />
                  <small className={styles.fieldHint}>На сколько процентов увеличивать скорость движения врагов при каждом новом цикле.</small>
                  {validation.errors.speedGrowthPercent && <small className={styles.fieldError}>{validation.errors.speedGrowthPercent}</small>}
                </label>

                <label className={styles.field}>
                  <span>Количество за цикл, +</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    disabled={!draft.endless.enabled}
                    value={Number.isFinite(draft.endless.countGrowth) ? draft.endless.countGrowth : ''}
                    aria-invalid={Boolean(validation.errors.countGrowth)}
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      endless: { ...current.endless, countGrowth: inputNumber(event.target.value) },
                    }))}
                  />
                  <small className={styles.fieldHint}>Сколько дополнительных юнитов добавлять в каждый блок спавна с каждым новым циклом.</small>
                  {validation.errors.countGrowth && <small className={styles.fieldError}>{validation.errors.countGrowth}</small>}
                </label>

                <label className={styles.field}>
                  <span>Сокращение интервала за цикл, %</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    disabled={!draft.endless.enabled}
                    value={Number.isFinite(draft.endless.spawnIntervalReductionPercent) ? draft.endless.spawnIntervalReductionPercent : ''}
                    aria-invalid={Boolean(validation.errors.spawnIntervalReductionPercent)}
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      endless: { ...current.endless, spawnIntervalReductionPercent: inputNumber(event.target.value) },
                    }))}
                  />
                  <small className={styles.fieldHint}>На сколько процентов уменьшать интервал появления юнитов в каждом блоке с каждым новым циклом.</small>
                  {validation.errors.spawnIntervalReductionPercent && <small className={styles.fieldError}>{validation.errors.spawnIntervalReductionPercent}</small>}
                </label>

                <label className={styles.field}>
                  <span>Минимальный интервал, сек.</span>
                  <input
                    type="number"
                    min="0"
                    step="0.05"
                    disabled={!draft.endless.enabled}
                    value={Number.isFinite(draft.endless.minSpawnInterval) ? draft.endless.minSpawnInterval : ''}
                    aria-invalid={Boolean(validation.errors.minSpawnInterval)}
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      endless: { ...current.endless, minSpawnInterval: inputNumber(event.target.value) },
                    }))}
                  />
                  <small className={styles.fieldHint}>Нижний предел интервала: ускорение спавна никогда не уменьшит интервал ниже этого значения.</small>
                  {validation.errors.minSpawnInterval && <small className={styles.fieldError}>{validation.errors.minSpawnInterval}</small>}
                </label>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <div>
                  <h2>Волны</h2>
                  <p>Каждая волна состоит из последовательных блоков спавна.</p>
                </div>
                <button className={styles.primaryButton} type="button" onClick={addWave}>+ Добавить волну</button>
              </div>

              <div className={styles.waveGenerator}>
                <div className={styles.waveGeneratorHeader}>
                  <div>
                    <strong>Генерация волн</strong>
                    <span>Создаёт новый набор волн и заменяет текущие. Количество и число разных обычных юнитов выбираются из заданных диапазонов, босс добавляется с указанной периодичностью.</span>
                  </div>
                  <button
                    className={styles.primaryButton}
                    type="button"
                    disabled={Boolean(generatorError)}
                    onClick={handleGenerateWaves}
                  >
                    Сгенерировать волны
                  </button>
                </div>
                <div className={styles.waveGeneratorFields}>
                  <label className={`${styles.field} ${styles.compactField}`}>
                    <span>Количество волн</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={Number.isFinite(generatorWaveCount) ? generatorWaveCount : ''}
                      onChange={(event) => setGeneratorWaveCount(inputNumber(event.target.value))}
                    />
                  </label>
                  <label className={`${styles.field} ${styles.compactField}`}>
                    <span>Юнитов от</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={Number.isFinite(generatorMinUnitCount) ? generatorMinUnitCount : ''}
                      onChange={(event) => setGeneratorMinUnitCount(inputNumber(event.target.value))}
                    />
                  </label>
                  <label className={`${styles.field} ${styles.compactField}`}>
                    <span>Юнитов до</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={Number.isFinite(generatorMaxUnitCount) ? generatorMaxUnitCount : ''}
                      onChange={(event) => setGeneratorMaxUnitCount(inputNumber(event.target.value))}
                    />
                  </label>
                  <label className={`${styles.field} ${styles.compactField}`}>
                    <span>Разных юнитов от</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={Number.isFinite(generatorMinDifferentUnitCount) ? generatorMinDifferentUnitCount : ''}
                      onChange={(event) => setGeneratorMinDifferentUnitCount(inputNumber(event.target.value))}
                    />
                  </label>
                  <label className={`${styles.field} ${styles.compactField}`}>
                    <span>Разных юнитов до</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={Number.isFinite(generatorMaxDifferentUnitCount) ? generatorMaxDifferentUnitCount : ''}
                      onChange={(event) => setGeneratorMaxDifferentUnitCount(inputNumber(event.target.value))}
                    />
                  </label>
                  <label className={`${styles.field} ${styles.compactField}`}>
                    <span>Босс каждые N волн</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={Number.isFinite(generatorBossEveryWaves) ? generatorBossEveryWaves : ''}
                      onChange={(event) => setGeneratorBossEveryWaves(inputNumber(event.target.value))}
                    />
                  </label>
                </div>
                {generatorError && <small className={styles.fieldError}>{generatorError}</small>}
              </div>

              <div className={styles.waves}>
                {draft.waves.length === 0 && (
                  <div className={styles.emptyInline}>
                    <strong>Волн пока нет</strong>
                    <span>Добавьте первую волну, затем настройте блоки появления юнитов.</span>
                  </div>
                )}

                {draft.waves.map((wave, waveIndex) => (
                  <article key={wave.id} className={styles.waveCard}>
                    <header className={styles.waveHeader}>
                      <div className={styles.waveTitle}>
                        <span className={styles.waveNumber}>{waveIndex + 1}</span>
                        <div>
                          <h3>Волна {waveIndex + 1}</h3>
                          <small>{wave.blocks.length} блок(а)</small>
                        </div>
                      </div>
                      <div className={styles.waveActions}>
                        <button type="button" onClick={() => moveWave(waveIndex, -1)} disabled={waveIndex === 0}>↑</button>
                        <button type="button" onClick={() => moveWave(waveIndex, 1)} disabled={waveIndex === draft.waves.length - 1}>↓</button>
                        <button type="button" onClick={() => cloneWave(wave.id)}>Дублировать</button>
                        <button className={styles.smallDangerButton} type="button" onClick={() => removeWave(wave.id)}>Удалить</button>
                      </div>
                    </header>

                    <div className={styles.blocks}>
                      {wave.blocks.map((block, blockIndex) => {
                        const errorKey = `wave.${wave.id}.block.${block.id}`;
                        const unitFilter = unitFilters[block.id] ?? '';
                        const filteredUnits = filterUnitsByNameSubstring(units, unitFilter);
                        const hasSelectedUnit = units.some((unit) => unit.id === block.unitId);
                        const selectedUnitId = filteredUnits.some((unit) => unit.id === block.unitId)
                          ? block.unitId
                          : '';
                        return (
                          <div key={block.id} className={styles.spawnBlock}>
                            <div className={styles.blockIndex}>
                              <span>{blockIndex + 1}</span>
                              {blockIndex > 0 && <i aria-hidden="true">↓</i>}
                            </div>
                            <div className={styles.blockFields}>
                              <label className={styles.field}>
                                <span>Юнит</span>
                                <div className={styles.unitPicker}>
                                  <input
                                    type="search"
                                    value={unitFilter}
                                    placeholder="Фильтр по названию..."
                                    onChange={(event) => {
                                      const nextFilter = event.target.value;
                                      setUnitFilters((current) => ({
                                        ...current,
                                        [block.id]: nextFilter,
                                      }));

                                      const firstMatch = findFirstUnitByNameSubstring(units, nextFilter);
                                      if (firstMatch) {
                                        updateBlock(wave.id, block.id, { unitId: firstMatch.id });
                                      }
                                    }}
                                  />
                                  <select
                                    value={selectedUnitId}
                                    aria-invalid={Boolean(validation.errors[`${errorKey}.unitId`])}
                                    onChange={(event) => updateBlock(wave.id, block.id, { unitId: event.target.value })}
                                  >
                                    {!unitFilter.trim() && !hasSelectedUnit && <option value="">Выберите юнита</option>}
                                    {unitFilter.trim() && filteredUnits.length === 0 && <option value="">Совпадений нет</option>}
                                    {filteredUnits.map((unit) => (
                                      <option key={unit.id} value={unit.id}>{unit.name}</option>
                                    ))}
                                  </select>
                                </div>
                                {validation.errors[`${errorKey}.unitId`] && (
                                  <small className={styles.fieldError}>{validation.errors[`${errorKey}.unitId`]}</small>
                                )}
                              </label>

                              <label className={`${styles.field} ${styles.compactField}`}>
                                <span>Количество</span>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={Number.isFinite(block.count) ? block.count : ''}
                                  aria-invalid={Boolean(validation.errors[`${errorKey}.count`])}
                                  onChange={(event) => updateBlock(wave.id, block.id, { count: inputNumber(event.target.value) })}
                                />
                                {validation.errors[`${errorKey}.count`] && (
                                  <small className={styles.fieldError}>{validation.errors[`${errorKey}.count`]}</small>
                                )}
                              </label>

                              <label className={`${styles.field} ${styles.compactField}`}>
                                <span>Интервал, сек.</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.05"
                                  value={Number.isFinite(block.spawnEvery) ? block.spawnEvery : ''}
                                  aria-invalid={Boolean(validation.errors[`${errorKey}.spawnEvery`])}
                                  onChange={(event) => updateBlock(wave.id, block.id, { spawnEvery: inputNumber(event.target.value) })}
                                />
                                {validation.errors[`${errorKey}.spawnEvery`] && (
                                  <small className={styles.fieldError}>{validation.errors[`${errorKey}.spawnEvery`]}</small>
                                )}
                              </label>

                              <label className={`${styles.field} ${styles.compactField} ${styles.conditionField}`}>
                                <span>Условие запуска</span>
                                <select
                                  value={block.startWhen}
                                  onChange={(event) => updateBlock(wave.id, block.id, {
                                    startWhen: event.target.value as WaveBlockStartCondition,
                                  })}
                                >
                                  {Object.entries(START_CONDITION_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                  ))}
                                </select>
                              </label>
                            </div>
                            <button
                              className={styles.removeBlockButton}
                              type="button"
                              aria-label={`Удалить блок ${blockIndex + 1}`}
                              onClick={() => removeBlock(wave.id, block.id)}
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}

                      {validation.errors[`wave.${wave.id}`] && (
                        <small className={styles.fieldError}>{validation.errors[`wave.${wave.id}`]}</small>
                      )}

                      <button className={styles.addBlockButton} type="button" onClick={() => addBlock(wave.id)}>
                        + Добавить блок спавна
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

          </section>
        ) : (
          <section className={styles.emptyState}>
            <span className={styles.kicker}>Карты</span>
            <h1>Создайте первую карту</h1>
            <p>Редактор пока работает отдельно от игры и безопасно хранит только собственные данные.</p>
            <button className={styles.primaryButton} type="button" onClick={openCreate}>+ Создать карту</button>
          </section>
        )}
      </div>
    </main>
  );
}
