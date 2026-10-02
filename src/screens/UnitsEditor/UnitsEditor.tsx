import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { EditorFileInput, EditorInput, EditorMultiSelect, EditorSelect } from '../../components/EditorControls';
import { applyUnitTraitMultipliers, deleteUnit, hasTrait, normalizeUnit, saveUnit, validateUnit } from '../../editor/units/unitLogic';
import { loadDamageSources } from '../../editor/damageSources/damageSourceStorage';
import { loadUnits, persistUnits } from '../../editor/units/unitStorage';
import {
  cloneUnitAnimationSounds,
  cloneUnitAnimations,
  createEmptyUnitAnimationSounds,
  createEmptyUnitAnimations,
} from '../../editor/units/unitAnimationLogic';
import type { UnitDefinition, UnitTrait, UnitTraitMultipliers } from '../../editor/units/types';
import { UnitAnimationEditor } from './UnitAnimationEditor';
import styles from './UnitsEditor.module.css';


const EMPTY_UNIT: UnitDefinition = {
  id: '',
  name: '',
  hp: 100,
  speed: 40,
  damage: 10,
  damageSourceId: '',
  coinsOnDeath: 1,
  traits: [],
  damageProtection: {},
  animationSpeed: 1,
  animations: createEmptyUnitAnimations(),
  animationSounds: createEmptyUnitAnimationSounds(),
};


const TRAIT_OPTIONS = [
  { value: 'boss', label: 'Босс' },
  { value: 'healthy', label: 'Здоровяк' },
  { value: 'armored', label: 'Бронированный' },
  { value: 'strong', label: 'Сильный' },
  { value: 'fast', label: 'Быстрый' },
  { value: 'generous', label: 'Щедрый' },
  { value: 'ranged', label: 'Дальняя атака' },
] satisfies ReadonlyArray<{ value: UnitTrait; label: string }>;

const TRAIT_MULTIPLIER_KEYS: Partial<Record<UnitTrait, keyof UnitTraitMultipliers>> = {
  healthy: 'hp',
  armored: 'protection',
  strong: 'damage',
  fast: 'speed',
  generous: 'coins',
};

const DEFAULT_TRAIT_MULTIPLIER = 1;

type UnitsEditorProps = {
  onBackToMain: () => void;
  onBackToEditors: () => void;
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

function parseNumber(value: string): number {
  if (value.trim() === '') return Number.NaN;
  return Number(value);
}

function formatStatValue(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, '');
}

function cloneUnit(unit: UnitDefinition): UnitDefinition {
  return {
    ...unit,
    traits: [...unit.traits],
    traitMultipliers: unit.traitMultipliers ? { ...unit.traitMultipliers } : undefined,
    damageProtection: unit.damageProtection ? { ...unit.damageProtection } : {},
    image: unit.image ? { ...unit.image } : undefined,
    animations: cloneUnitAnimations(unit.animations),
    animationSounds: cloneUnitAnimationSounds(unit.animationSounds),
  };
}

function isSameDamageProtection(
  left: UnitDefinition['damageProtection'],
  right: UnitDefinition['damageProtection'],
): boolean {
  const leftEntries = Object.entries(left ?? {});
  const rightEntries = Object.entries(right ?? {});
  if (leftEntries.length !== rightEntries.length) return false;

  return leftEntries.every(([sourceId, value]) => right?.[sourceId] === value);
}


function isSameAnimations(
  left: UnitDefinition['animations'],
  right: UnitDefinition['animations'],
): boolean {
  return (['move', 'attack', 'death'] as const).every((type) => {
    const leftFrames = left[type];
    const rightFrames = right[type];
    return leftFrames.length === rightFrames.length && leftFrames.every((frame, index) => {
      const rightFrame = rightFrames[index];
      return frame.id === rightFrame?.id && frame.name === rightFrame.name && frame.src === rightFrame.src;
    });
  });
}

function isSameAnimationSounds(
  left: UnitDefinition['animationSounds'],
  right: UnitDefinition['animationSounds'],
): boolean {
  return (['move', 'attack', 'death'] as const).every((type) => {
    const leftSound = left?.[type];
    const rightSound = right?.[type];
    return leftSound?.id === rightSound?.id
      && leftSound?.name === rightSound?.name
      && leftSound?.src === rightSound?.src;
  });
}

function isSameTraits(left: UnitTrait[], right: UnitTrait[]): boolean {
  return left.length === right.length && left.every((trait, index) => trait === right[index]);
}

function isSameTraitMultipliers(
  left: UnitDefinition['traitMultipliers'],
  right: UnitDefinition['traitMultipliers'],
): boolean {
  const keys: Array<keyof UnitTraitMultipliers> = ['hp', 'protection', 'damage', 'speed', 'coins'];
  return keys.every((key) => left?.[key] === right?.[key]);
}

export function UnitsEditor({ onBackToMain, onBackToEditors }: UnitsEditorProps) {
  const [units, setUnits] = useState<UnitDefinition[]>(() => loadUnits());
  const [damageSources] = useState(() => loadDamageSources());
  const sortedUnits = useMemo(
    () => [...units].sort((a, b) => a.name.localeCompare(b.name, 'ru') || a.id.localeCompare(b.id)),
    [units],
  );
  const [selectedId, setSelectedId] = useState<string | null>(() => sortedUnits[0]?.id ?? null);
  const [editingId, setEditingId] = useState<string | undefined>(() => sortedUnits[0]?.id);
  const [draft, setDraft] = useState<UnitDefinition>(() => cloneUnit(sortedUnits[0] ?? EMPTY_UNIT));
  const [isCreating, setIsCreating] = useState(false);
  const [showFinalStats, setShowFinalStats] = useState(false);

  const selectedUnit = units.find((unit) => unit.id === selectedId) ?? null;
  const validation = useMemo(
    () => validateUnit(draft, units, damageSources, editingId),
    [damageSources, draft, editingId, units],
  );
  const finalStats = useMemo(() => applyUnitTraitMultipliers(draft), [draft]);
  const canPreviewFinalStats = !validation.errors.hp
    && !validation.errors.speed
    && !validation.errors.damage
    && !validation.errors.coinsOnDeath
    && !validation.errors.attackStartPathPercent
    && !validation.errors.traitMultipliers
    && !validation.errors.damageProtection
    && !validation.errors.animationSpeed;

  const updateUnits = (next: UnitDefinition[]) => {
    setUnits(next);
    persistUnits(next);
  };

  useEffect(() => {
    if (isCreating) return;
    if (selectedId && units.some((unit) => unit.id === selectedId)) return;

    const next = [...units].sort((a, b) => a.name.localeCompare(b.name, 'ru') || a.id.localeCompare(b.id))[0] ?? null;
    setSelectedId(next?.id ?? null);
    setEditingId(next?.id);
    setDraft(cloneUnit(next ?? EMPTY_UNIT));
  }, [isCreating, selectedId, units]);

  const selectUnit = (unit: UnitDefinition) => {
    setSelectedId(unit.id);
    setEditingId(unit.id);
    setDraft(cloneUnit(unit));
    setIsCreating(false);
    setShowFinalStats(false);
  };

  const openCreate = () => {
    setSelectedId(null);
    setEditingId(undefined);
    setDraft(cloneUnit({ ...EMPTY_UNIT, damageSourceId: damageSources[0]?.id ?? '' }));
    setIsCreating(true);
    setShowFinalStats(false);
  };

  const cancelCreate = () => {
    const next = sortedUnits[0] ?? null;
    setSelectedId(next?.id ?? null);
    setEditingId(next?.id);
    setDraft(cloneUnit(next ?? EMPTY_UNIT));
    setIsCreating(false);
    setShowFinalStats(false);
  };

  useEffect(() => {
    if (!validation.valid) return;

    const normalized = normalizeUnit(draft);
    const current = editingId ? units.find((unit) => unit.id === editingId) : undefined;
    const isUnchanged = current
      && current.id === normalized.id
      && current.name === normalized.name
      && current.hp === normalized.hp
      && current.speed === normalized.speed
      && current.damage === normalized.damage
      && current.damageSourceId === normalized.damageSourceId
      && current.coinsOnDeath === normalized.coinsOnDeath
      && current.attackStartPathPercent === normalized.attackStartPathPercent
      && isSameTraits(current.traits, normalized.traits)
      && isSameTraitMultipliers(current.traitMultipliers, normalized.traitMultipliers)
      && current.gameKey === normalized.gameKey
      && isSameDamageProtection(current.damageProtection, normalized.damageProtection)
      && current.image?.name === normalized.image?.name
      && current.image?.src === normalized.image?.src
      && current.animationSpeed === normalized.animationSpeed
      && isSameAnimations(current.animations, normalized.animations)
      && isSameAnimationSounds(current.animationSounds, normalized.animationSounds);

    if (isUnchanged) return;

    const next = saveUnit(units, normalized, editingId);
    updateUnits(next);
    setSelectedId(normalized.id);
    setEditingId(normalized.id);
    setIsCreating(false);
  }, [draft, editingId, units, validation.valid]);

  const remove = () => {
    if (!selectedUnit) return;
    if (!window.confirm(`Удалить юнита «${selectedUnit.name}»?`)) return;

    const selectedIndex = sortedUnits.findIndex((unit) => unit.id === selectedUnit.id);
    const remaining = deleteUnit(units, selectedUnit.id);
    updateUnits(remaining);

    const nextSorted = [...remaining].sort((a, b) => a.name.localeCompare(b.name, 'ru') || a.id.localeCompare(b.id));
    const next = nextSorted[selectedIndex] ?? nextSorted[selectedIndex - 1] ?? null;
    setSelectedId(next?.id ?? null);
    setEditingId(next?.id);
    setDraft(cloneUnit(next ?? EMPTY_UNIT));
    setIsCreating(false);
  };

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    try {
      const src = await readFileAsDataUrl(file);
      setDraft((current) => ({
        ...current,
        image: { name: file.name, src },
      }));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Не удалось загрузить изображение.');
    }
  };

  const hasEditor = isCreating || selectedUnit !== null;
  const fallbackLabel = draft.name.slice(0, 1).toUpperCase() || '•';

  return (
    <main className={styles.screen}>
      <header className={styles.topbar}>
        <button className={styles.toolbarButton} type="button" onClick={onBackToMain}>Главное меню</button>
        <strong>Редактор юнитов</strong>
        <button className={styles.toolbarButton} type="button" onClick={onBackToEditors}>Все редакторы</button>
      </header>

      <div className={styles.layout}>
        <aside className={styles.listPanel} aria-label="Юниты">
          <div className={styles.listHeader}>
            <div>
              <h2>Юниты</h2>
              <p>{units.length} в проекте</p>
            </div>
            <button className={styles.addButton} type="button" onClick={openCreate} aria-label="Добавить юнита">+</button>
          </div>

          <div className={styles.list}>
            {sortedUnits.map((unit) => (
              <button
                key={unit.id}
                type="button"
                className={`${styles.listItem}${unit.id === selectedId && !isCreating ? ` ${styles.active}` : ''}`}
                onClick={() => selectUnit(unit)}
              >
                <span className={styles.listIcon}>
                  {unit.image ? <img src={unit.image.src} alt="" /> : unit.name.slice(0, 1).toUpperCase() || '•'}
                </span>
                <span className={styles.listItemText}>
                  <strong>{unit.name || 'Без названия'}</strong>
                  <small>{unit.id}</small>
                </span>
              </button>
            ))}
          </div>
        </aside>

        {hasEditor ? (
          <section className={styles.formPanel}>
            <div className={styles.formHeader}>
              <div className={styles.previewCard}>
                <div className={styles.preview}>
                  {draft.image ? <img src={draft.image.src} alt="" /> : fallbackLabel}
                </div>
                <div className={styles.previewText}>
                  <span className={styles.kicker}>Юнит</span>
                  <h1>{isCreating ? 'Новый юнит' : draft.name || 'Без названия'}</h1>
                  <p>HP {Number.isFinite(draft.hp) ? draft.hp : '—'} · Скорость {Number.isFinite(draft.speed) ? draft.speed : '—'} · Урон {Number.isFinite(draft.damage) ? draft.damage : '—'}</p>
                </div>
              </div>

              <div className={styles.headerActions}>
                <label className={styles.fileButton}>
                  Загрузить картинку для UI
                  <EditorFileInput accept="image/*,.svg" onChange={handleImageUpload} />
                </label>
                <button
                  className={styles.toolbarButton}
                  type="button"
                  disabled={!draft.image}
                  onClick={() => setDraft((current) => ({ ...current, image: undefined }))}
                >
                  Убрать картинку
                </button>
                {isCreating ? (
                  <button className={styles.toolbarButton} type="button" onClick={cancelCreate}>Отмена</button>
                ) : (
                  <button
                    className={styles.dangerButton}
                    type="button"
                    onClick={remove}
                  >
                    Удалить
                  </button>
                )}
              </div>
            </div>

            <div className={styles.formSection}>
              <h2>Основное</h2>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>ID</span>
                  <EditorInput
                    value={draft.id}
                    aria-invalid={Boolean(validation.errors.id)}
                    onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))}
                    placeholder="goblin"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                  {validation.errors.id && <small className={styles.fieldError}>{validation.errors.id}</small>}
                </label>

                <label className={styles.field}>
                  <span>Название</span>
                  <EditorInput
                    value={draft.name}
                    aria-invalid={Boolean(validation.errors.name)}
                    onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Гоблин"
                  />
                  {validation.errors.name && <small className={styles.fieldError}>{validation.errors.name}</small>}
                </label>

                <label className={styles.field}>
                  <span>HP</span>
                  <EditorInput
                    type="number"
                    min="1"
                    step="1"
                    value={Number.isFinite(draft.hp) ? draft.hp : ''}
                    aria-invalid={Boolean(validation.errors.hp)}
                    onChange={(event) => setDraft((current) => ({ ...current, hp: parseNumber(event.target.value) }))}
                  />
                  {validation.errors.hp && <small className={styles.fieldError}>{validation.errors.hp}</small>}
                </label>

                <label className={styles.field}>
                  <span>Скорость</span>
                  <EditorInput
                    type="number"
                    min="0"
                    step="1"
                    value={Number.isFinite(draft.speed) ? draft.speed : ''}
                    aria-invalid={Boolean(validation.errors.speed)}
                    onChange={(event) => setDraft((current) => ({ ...current, speed: parseNumber(event.target.value) }))}
                  />
                  {validation.errors.speed && <small className={styles.fieldError}>{validation.errors.speed}</small>}
                </label>

                <label className={styles.field}>
                  <span>Урон</span>
                  <EditorInput
                    type="number"
                    min="0"
                    step="1"
                    value={Number.isFinite(draft.damage) ? draft.damage : ''}
                    aria-invalid={Boolean(validation.errors.damage)}
                    onChange={(event) => setDraft((current) => ({ ...current, damage: parseNumber(event.target.value) }))}
                  />
                  {validation.errors.damage && <small className={styles.fieldError}>{validation.errors.damage}</small>}
                </label>

                <label className={styles.field}>
                  <span>Источник урона</span>
                  <EditorSelect
                    value={draft.damageSourceId}
                    aria-invalid={Boolean(validation.errors.damageSourceId)}
                    onChange={(event) => setDraft((current) => ({ ...current, damageSourceId: event.target.value }))}
                  >
                    {damageSources.length === 0 && <option value="">Нет источников урона</option>}
                    {damageSources.map((source) => (
                      <option key={source.id} value={source.id}>{source.name}</option>
                    ))}
                  </EditorSelect>
                  {validation.errors.damageSourceId && <small className={styles.fieldError}>{validation.errors.damageSourceId}</small>}
                </label>

                <label className={styles.field}>
                  <span>Монеты за смерть</span>
                  <EditorInput
                    type="number"
                    min="0"
                    step="1"
                    value={Number.isFinite(draft.coinsOnDeath) ? draft.coinsOnDeath : ''}
                    aria-invalid={Boolean(validation.errors.coinsOnDeath)}
                    onChange={(event) => setDraft((current) => ({ ...current, coinsOnDeath: parseNumber(event.target.value) }))}
                  />
                  {validation.errors.coinsOnDeath && <small className={styles.fieldError}>{validation.errors.coinsOnDeath}</small>}
                </label>

                <div className={`${styles.field} ${styles.fullRow}`}>
                  <span>Особенности</span>
                  <EditorMultiSelect
                    value={draft.traits}
                    options={TRAIT_OPTIONS}
                    placeholder="Нет особенностей"
                    invalid={Boolean(validation.errors.traitMultipliers)}
                    onChange={(traits) => setDraft((current) => {
                      const traitMultipliers = { ...(current.traitMultipliers ?? {}) };

                      for (const [trait, key] of Object.entries(TRAIT_MULTIPLIER_KEYS) as Array<[
                        UnitTrait,
                        keyof UnitTraitMultipliers,
                      ]>) {
                        if (traits.includes(trait)) {
                          if (traitMultipliers[key] === undefined) {
                            traitMultipliers[key] = DEFAULT_TRAIT_MULTIPLIER;
                          }
                        } else {
                          delete traitMultipliers[key];
                        }
                      }

                      return {
                        ...current,
                        traits,
                        attackStartPathPercent: traits.includes('ranged')
                          ? (current.attackStartPathPercent ?? 60)
                          : undefined,
                        traitMultipliers: Object.keys(traitMultipliers).length > 0 ? traitMultipliers : undefined,
                      };
                    })}
                  />
                  {validation.errors.traitMultipliers && (
                    <small className={styles.fieldError}>{validation.errors.traitMultipliers}</small>
                  )}
                </div>

                {hasTrait(draft, 'ranged') && (
                  <label className={styles.field}>
                    <span>Начало атаки, % пути</span>
                    <EditorInput
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={Number.isFinite(draft.attackStartPathPercent) ? draft.attackStartPathPercent : ''}
                      aria-invalid={Boolean(validation.errors.attackStartPathPercent)}
                      onChange={(event) => setDraft((current) => ({
                        ...current,
                        attackStartPathPercent: parseNumber(event.target.value),
                      }))}
                    />
                    {validation.errors.attackStartPathPercent && (
                      <small className={styles.fieldError}>{validation.errors.attackStartPathPercent}</small>
                    )}
                  </label>
                )}

                {hasTrait(draft, 'healthy') && (
                  <label className={styles.field}>
                    <span>Множитель HP</span>
                    <EditorInput
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={Number.isFinite(draft.traitMultipliers?.hp) ? draft.traitMultipliers?.hp : ''}
                      aria-invalid={Boolean(validation.errors.traitMultipliers)}
                      onChange={(event) => setDraft((current) => ({
                        ...current,
                        traitMultipliers: { ...current.traitMultipliers, hp: parseNumber(event.target.value) },
                      }))}
                    />
                  </label>
                )}

                {hasTrait(draft, 'armored') && (
                  <label className={styles.field}>
                    <span>Множитель защиты</span>
                    <EditorInput
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={Number.isFinite(draft.traitMultipliers?.protection) ? draft.traitMultipliers?.protection : ''}
                      aria-invalid={Boolean(validation.errors.traitMultipliers)}
                      onChange={(event) => setDraft((current) => ({
                        ...current,
                        traitMultipliers: { ...current.traitMultipliers, protection: parseNumber(event.target.value) },
                      }))}
                    />
                  </label>
                )}

                {hasTrait(draft, 'strong') && (
                  <label className={styles.field}>
                    <span>Множитель урона</span>
                    <EditorInput
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={Number.isFinite(draft.traitMultipliers?.damage) ? draft.traitMultipliers?.damage : ''}
                      aria-invalid={Boolean(validation.errors.traitMultipliers)}
                      onChange={(event) => setDraft((current) => ({
                        ...current,
                        traitMultipliers: { ...current.traitMultipliers, damage: parseNumber(event.target.value) },
                      }))}
                    />
                  </label>
                )}

                {hasTrait(draft, 'fast') && (
                  <label className={styles.field}>
                    <span>Множитель скорости</span>
                    <EditorInput
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={Number.isFinite(draft.traitMultipliers?.speed) ? draft.traitMultipliers?.speed : ''}
                      aria-invalid={Boolean(validation.errors.traitMultipliers)}
                      onChange={(event) => setDraft((current) => ({
                        ...current,
                        traitMultipliers: { ...current.traitMultipliers, speed: parseNumber(event.target.value) },
                      }))}
                    />
                  </label>
                )}

                {hasTrait(draft, 'generous') && (
                  <label className={styles.field}>
                    <span>Множитель монет</span>
                    <EditorInput
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={Number.isFinite(draft.traitMultipliers?.coins) ? draft.traitMultipliers?.coins : ''}
                      aria-invalid={Boolean(validation.errors.traitMultipliers)}
                      onChange={(event) => setDraft((current) => ({
                        ...current,
                        traitMultipliers: { ...current.traitMultipliers, coins: parseNumber(event.target.value) },
                      }))}
                    />
                  </label>
                )}

                <div className={`${styles.finalStats} ${styles.fullRow}`}>
                  <button
                    className={styles.previewStatsButton}
                    type="button"
                    disabled={!canPreviewFinalStats}
                    onClick={() => setShowFinalStats(true)}
                  >
                    Проверить итоговые характеристики
                  </button>

                  {showFinalStats && canPreviewFinalStats && (
                    <div className={styles.finalStatsResult}>
                      <div className={styles.finalStatsGrid}>
                        <span><small>HP</small><strong>{formatStatValue(finalStats.hp)}</strong></span>
                        <span><small>Урон</small><strong>{formatStatValue(finalStats.damage)}</strong></span>
                        <span><small>Скорость</small><strong>{formatStatValue(finalStats.speed)}</strong></span>
                        <span><small>Монеты</small><strong>{formatStatValue(finalStats.coinsOnDeath)}</strong></span>
                      </div>

                      <div className={styles.finalProtection}>
                        <small>Защита после множителей</small>
                        {Object.entries(finalStats.damageProtection ?? {}).length > 0 ? (
                          <div className={styles.finalProtectionList}>
                            {Object.entries(finalStats.damageProtection ?? {}).map(([sourceId, value]) => (
                              <span key={sourceId}>
                                {damageSources.find((source) => source.id === sourceId)?.name ?? sourceId}: {formatStatValue(value)}%
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className={styles.noProtection}>Нет заданной защиты.</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>

            <UnitAnimationEditor
              animationSpeed={draft.animationSpeed}
              animations={draft.animations}
              animationSounds={draft.animationSounds ?? createEmptyUnitAnimationSounds()}
              onChange={({ animationSpeed, animations, animationSounds }) => setDraft((current) => ({
                ...current,
                animationSpeed,
                animations,
                animationSounds,
              }))}
            />

            <div className={styles.formSection}>
              <h2>Защита от источников урона</h2>
              <div className={styles.formGrid}>
                {damageSources.map((source) => (
                  <label className={styles.field} key={source.id}>
                    <span>{source.name}, %</span>
                    <EditorInput
                      type="number"
                      min="-100"
                      max="100"
                      step="1"
                      value={Number.isFinite(draft.damageProtection?.[source.id]) ? draft.damageProtection?.[source.id] : 0}
                      aria-invalid={Boolean(validation.errors.damageProtection)}
                      onChange={(event) => {
                        const value = parseNumber(event.target.value);
                        setDraft((current) => {
                          const nextProtection = { ...(current.damageProtection ?? {}) };

                          if (value === 0) {
                            delete nextProtection[source.id];
                          } else {
                            nextProtection[source.id] = value;
                          }

                          return {
                            ...current,
                            damageProtection: nextProtection,
                          };
                        });
                      }}
                    />
                  </label>
                ))}
              </div>
              {validation.errors.damageProtection && (
                <small className={styles.fieldError}>{validation.errors.damageProtection}</small>
              )}
            </div>
          </section>
        ) : (
          <section className={styles.emptyState}>
            <h1>Юнитов пока нет</h1>
            <p>Добавьте первого юнита.</p>
            <button className={styles.addEmptyButton} type="button" onClick={openCreate}>Добавить</button>
          </section>
        )}
      </div>
    </main>
  );
}
