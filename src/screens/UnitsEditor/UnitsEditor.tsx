import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { deleteUnit, normalizeUnit, saveUnit, validateUnit } from '../../editor/units/unitLogic';
import { loadDamageSources } from '../../editor/damageSources/damageSourceStorage';
import { loadUnits, persistUnits } from '../../editor/units/unitStorage';
import type { UnitDefinition } from '../../editor/units/types';
import styles from './UnitsEditor.module.css';


const EMPTY_UNIT: UnitDefinition = {
  id: '',
  name: '',
  hp: 100,
  speed: 40,
  damage: 10,
  coinsOnDeath: 1,
  isBoss: false,
  damageProtection: {},
};

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

function cloneUnit(unit: UnitDefinition): UnitDefinition {
  return {
    ...unit,
    damageProtection: unit.damageProtection ? { ...unit.damageProtection } : {},
    image: unit.image ? { ...unit.image } : undefined,
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

  const selectedUnit = units.find((unit) => unit.id === selectedId) ?? null;
  const validation = useMemo(
    () => validateUnit(draft, units, editingId),
    [draft, editingId, units],
  );

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
  };

  const openCreate = () => {
    setSelectedId(null);
    setEditingId(undefined);
    setDraft(cloneUnit(EMPTY_UNIT));
    setIsCreating(true);
  };

  const cancelCreate = () => {
    const next = sortedUnits[0] ?? null;
    setSelectedId(next?.id ?? null);
    setEditingId(next?.id);
    setDraft(cloneUnit(next ?? EMPTY_UNIT));
    setIsCreating(false);
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
      && current.coinsOnDeath === normalized.coinsOnDeath
      && current.isBoss === normalized.isBoss
      && current.gameKey === normalized.gameKey
      && isSameDamageProtection(current.damageProtection, normalized.damageProtection)
      && current.image?.name === normalized.image?.name
      && current.image?.src === normalized.image?.src;

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
                  Загрузить картинку
                  <input type="file" accept="image/*,.svg" onChange={handleImageUpload} />
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
                  <input
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
                  <input
                    value={draft.name}
                    aria-invalid={Boolean(validation.errors.name)}
                    onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Гоблин"
                  />
                  {validation.errors.name && <small className={styles.fieldError}>{validation.errors.name}</small>}
                </label>

                <label className={styles.field}>
                  <span>HP</span>
                  <input
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
                  <input
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
                  <input
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
                  <span>Монеты за смерть</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={Number.isFinite(draft.coinsOnDeath) ? draft.coinsOnDeath : ''}
                    aria-invalid={Boolean(validation.errors.coinsOnDeath)}
                    onChange={(event) => setDraft((current) => ({ ...current, coinsOnDeath: parseNumber(event.target.value) }))}
                  />
                  {validation.errors.coinsOnDeath && <small className={styles.fieldError}>{validation.errors.coinsOnDeath}</small>}
                </label>

                <label className={styles.checkboxField}>
                  <input
                    type="checkbox"
                    checked={draft.isBoss}
                    onChange={(event) => setDraft((current) => ({ ...current, isBoss: event.target.checked }))}
                  />
                  <span>Босс</span>
                </label>
              </div>
            </div>

            <div className={styles.formSection}>
              <h2>Защита от источников урона</h2>
              <div className={styles.formGrid}>
                {damageSources.map((source) => (
                  <label className={styles.field} key={source.id}>
                    <span>{source.name}, %</span>
                    <input
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
