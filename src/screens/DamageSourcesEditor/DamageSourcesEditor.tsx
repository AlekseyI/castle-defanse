import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  deleteDamageSource,
  normalizeDamageSource,
  saveDamageSource,
  validateDamageSource,
} from '../../editor/damageSources/damageSourceLogic';
import {
  loadDamageSources,
  persistDamageSources,
} from '../../editor/damageSources/damageSourceStorage';
import type { DamageSource } from '../../editor/damageSources/types';
import styles from './DamageSourcesEditor.module.css';

const EMPTY_SOURCE: DamageSource = {
  id: '',
  name: '',
  description: '',
  color: '#ffffff',
};

type DamageSourcesEditorProps = {
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

export function DamageSourcesEditor({ onBackToMain, onBackToEditors }: DamageSourcesEditorProps) {
  const [sources, setSources] = useState<DamageSource[]>(() => loadDamageSources());
  const sortedSources = useMemo(
    () => [...sources].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [sources],
  );
  const [selectedId, setSelectedId] = useState<string | null>(() => sortedSources[0]?.id ?? null);
  const [editingId, setEditingId] = useState<string | undefined>(() => sortedSources[0]?.id);
  const [draft, setDraft] = useState<DamageSource>(() => ({ ...(sortedSources[0] ?? EMPTY_SOURCE) }));
  const [isCreating, setIsCreating] = useState(false);

  const selectedSource = sources.find((source) => source.id === selectedId) ?? null;
  const validation = useMemo(
    () => validateDamageSource(draft, sources, editingId),
    [draft, editingId, sources],
  );

  const updateSources = (next: DamageSource[]) => {
    setSources(next);
    persistDamageSources(next);
  };

  useEffect(() => {
    if (isCreating) return;
    if (selectedId && sources.some((source) => source.id === selectedId)) return;

    const next = [...sources].sort((a, b) => a.name.localeCompare(b.name, 'ru'))[0] ?? null;
    setSelectedId(next?.id ?? null);
    setEditingId(next?.id);
    setDraft({ ...(next ?? EMPTY_SOURCE) });
  }, [isCreating, selectedId, sources]);

  const selectSource = (source: DamageSource) => {
    setSelectedId(source.id);
    setEditingId(source.id);
    setDraft({ ...source });
    setIsCreating(false);
  };

  const openCreate = () => {
    setSelectedId(null);
    setEditingId(undefined);
    setDraft({ ...EMPTY_SOURCE });
    setIsCreating(true);
  };

  const cancelCreate = () => {
    const next = sortedSources[0] ?? null;
    setSelectedId(next?.id ?? null);
    setEditingId(next?.id);
    setDraft({ ...(next ?? EMPTY_SOURCE) });
    setIsCreating(false);
  };

  useEffect(() => {
    if (!validation.valid) return;

    const normalized = normalizeDamageSource(draft);
    const current = editingId ? sources.find((source) => source.id === editingId) : undefined;
    const isUnchanged = current
      && current.id === normalized.id
      && current.name === normalized.name
      && current.description === normalized.description
      && current.color === normalized.color
      && current.icon?.name === normalized.icon?.name
      && current.icon?.src === normalized.icon?.src;

    if (isUnchanged) return;

    const next = saveDamageSource(sources, normalized, editingId);
    updateSources(next);
    setSelectedId(normalized.id);
    setEditingId(normalized.id);
    setIsCreating(false);
  }, [draft, editingId, sources, validation.valid]);

  const remove = () => {
    if (!selectedSource) return;
    if (!window.confirm(`Удалить источник «${selectedSource.name}»?`)) return;

    const selectedIndex = sortedSources.findIndex((source) => source.id === selectedSource.id);
    const remaining = deleteDamageSource(sources, selectedSource.id);
    updateSources(remaining);

    const nextSorted = [...remaining].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    const next = nextSorted[selectedIndex] ?? nextSorted[selectedIndex - 1] ?? null;
    setSelectedId(next?.id ?? null);
    setEditingId(next?.id);
    setDraft({ ...(next ?? EMPTY_SOURCE) });
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
        icon: { name: file.name, src },
      }));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Не удалось загрузить изображение.');
    }
  };

  const hasEditor = isCreating || selectedSource !== null;
  const previewColor = draft.color && /^#[0-9a-fA-F]{6}$/.test(draft.color) ? draft.color : '#0f2940';
  const fallbackLabel = draft.name.slice(0, 1).toUpperCase() || '•';

  return (
    <main className={styles.screen}>
      <header className={styles.topbar}>
        <button className={styles.toolbarButton} type="button" onClick={onBackToMain}>Главное меню</button>
        <strong>Редактор источников урона</strong>
        <button className={styles.toolbarButton} type="button" onClick={onBackToEditors}>Все редакторы</button>
      </header>

      <div className={styles.layout}>
        <aside className={styles.listPanel} aria-label="Источники урона">
          <div className={styles.listHeader}>
            <div>
              <h2>Источники урона</h2>
              <p>{sources.length} в проекте</p>
            </div>
            <button className={styles.addButton} type="button" onClick={openCreate} aria-label="Добавить источник урона">+</button>
          </div>

          <div className={styles.list}>
            {sortedSources.map((source) => (
              <button
                key={source.id}
                type="button"
                className={`${styles.listItem}${source.id === selectedId && !isCreating ? ` ${styles.active}` : ''}`}
                onClick={() => selectSource(source)}
              >
                <span className={styles.listIcon} style={{ backgroundColor: source.color ?? '#0f2940' }}>
                  {source.icon ? (
                    <img src={source.icon.src} alt="" />
                  ) : (
                    source.name.slice(0, 1).toUpperCase() || '•'
                  )}
                </span>
                <span className={styles.listItemText}>
                  <strong>{source.name || 'Без названия'}</strong>
                  <small>{source.id}</small>
                </span>
              </button>
            ))}
          </div>
        </aside>

        {hasEditor ? (
          <section className={styles.formPanel}>
            <div className={styles.formHeader}>
              <div className={styles.previewCard}>
                <div className={styles.preview} style={{ backgroundColor: previewColor }}>
                  {draft.icon ? <img src={draft.icon.src} alt="" /> : fallbackLabel}
                </div>
                <div className={styles.previewText}>
                  <span className={styles.kicker}>Источник урона</span>
                  <h1>{isCreating ? 'Новый источник' : draft.name || 'Без названия'}</h1>
                  <p>{draft.description || 'Без описания'}</p>
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
                  disabled={!draft.icon}
                  onClick={() => setDraft((current) => ({ ...current, icon: undefined }))}
                >
                  Убрать картинку
                </button>
                {isCreating ? (
                  <button className={styles.toolbarButton} type="button" onClick={cancelCreate}>Отмена</button>
                ) : (
                  <button className={styles.dangerButton} type="button" onClick={remove}>Удалить</button>
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
                    placeholder="fire"
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
                    placeholder="Огонь"
                  />
                  {validation.errors.name && <small className={styles.fieldError}>{validation.errors.name}</small>}
                </label>

                <label className={styles.field}>
                  <span>Цвет</span>
                  <div className={styles.colorRow}>
                    <input
                      className={styles.colorPicker}
                      type="color"
                      value={/^#[0-9a-fA-F]{6}$/.test(draft.color ?? '') ? draft.color : '#ffffff'}
                      onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))}
                    />
                    <input
                      value={draft.color ?? ''}
                      aria-invalid={Boolean(validation.errors.color)}
                      onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))}
                      placeholder="#e9573f"
                      spellCheck={false}
                    />
                  </div>
                  {validation.errors.color && <small className={styles.fieldError}>{validation.errors.color}</small>}
                </label>

                <label className={`${styles.field} ${styles.fullRow}`}>
                  <span>Описание</span>
                  <textarea
                    value={draft.description ?? ''}
                    onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Короткое описание источника"
                  />
                </label>
              </div>
            </div>
          </section>
        ) : (
          <section className={styles.emptyState}>
            <h1>Источников урона пока нет</h1>
            <p>Добавьте первый источник урона.</p>
            <button className={styles.addEmptyButton} type="button" onClick={openCreate}>Добавить</button>
          </section>
        )}
      </div>
    </main>
  );
}
