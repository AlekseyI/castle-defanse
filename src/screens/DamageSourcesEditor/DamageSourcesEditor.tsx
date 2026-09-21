import { useMemo, useState } from 'react';
import {
  deleteDamageSource,
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
  icon: '',
  color: '#ffffff',
};

export function DamageSourcesEditor() {
  const [sources, setSources] = useState<DamageSource[]>(() => loadDamageSources());
  const [editingId, setEditingId] = useState<string | undefined>();
  const [draft, setDraft] = useState<DamageSource>({ ...EMPTY_SOURCE });
  const [showForm, setShowForm] = useState(false);
  const validation = useMemo(
    () => validateDamageSource(draft, sources, editingId),
    [draft, editingId, sources],
  );

  const updateSources = (next: DamageSource[]) => {
    setSources(next);
    persistDamageSources(next);
  };

  const openCreate = () => {
    setEditingId(undefined);
    setDraft({ ...EMPTY_SOURCE });
    setShowForm(true);
  };

  const openEdit = (source: DamageSource) => {
    setEditingId(source.id);
    setDraft({ ...source });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(undefined);
    setDraft({ ...EMPTY_SOURCE });
  };

  const submit = () => {
    if (!validation.valid) return;
    updateSources(saveDamageSource(sources, draft, editingId));
    closeForm();
  };

  const remove = (source: DamageSource) => {
    if (!window.confirm(`Удалить источник «${source.name}»?`)) return;
    updateSources(deleteDamageSource(sources, source.id));
    if (editingId === source.id) closeForm();
  };

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Редакторы игры</div>
          <h1>Источники урона</h1>
          <p>Справочник источников. Здесь хранится только их описание и визуальная идентичность.</p>
        </div>
        <div className={styles.headerActions}>
          <a className={styles.secondaryButton} href={window.location.pathname}>В игру</a>
          <button className={styles.primaryButton} type="button" onClick={openCreate}>+ Добавить</button>
        </div>
      </header>

      <section className={styles.content}>
        <div className={styles.listHeader}>
          <strong>{sources.length} источника</strong>
          <span>ID используется как технический ключ.</span>
        </div>

        <div className={styles.grid}>
          {sources.map((source) => (
            <article className={styles.card} key={source.id}>
              <div className={styles.cardTop}>
                <div
                  className={styles.iconBox}
                  style={{ backgroundColor: source.color ?? '#1e293b' }}
                >
                  {source.icon || '•'}
                </div>
                <div className={styles.cardTitle}>
                  <h2>{source.name}</h2>
                  <code>{source.id}</code>
                </div>
              </div>

              <p className={styles.description}>{source.description || 'Без описания'}</p>

              <div className={styles.cardMeta}>
                <span>Цвет</span>
                <div className={styles.colorValue}>
                  <i style={{ backgroundColor: source.color ?? 'transparent' }} />
                  <code>{source.color || '—'}</code>
                </div>
              </div>

              <div className={styles.cardActions}>
                <button type="button" onClick={() => openEdit(source)}>Редактировать</button>
                <button className={styles.deleteButton} type="button" onClick={() => remove(source)}>Удалить</button>
              </div>
            </article>
          ))}
        </div>

        {sources.length === 0 && (
          <div className={styles.emptyState}>
            <strong>Источников пока нет</strong>
            <span>Добавьте первый источник урона.</span>
            <button className={styles.primaryButton} type="button" onClick={openCreate}>+ Добавить источник</button>
          </div>
        )}
      </section>

      {showForm && (
        <div className={styles.overlay} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeForm();
        }}>
          <section className={styles.editorPanel}>
            <div className={styles.panelHeader}>
              <div>
                <span>{editingId ? 'Редактирование' : 'Новый источник'}</span>
                <h2>{editingId ? draft.name || editingId : 'Источник урона'}</h2>
              </div>
              <button className={styles.closeButton} type="button" onClick={closeForm} aria-label="Закрыть">×</button>
            </div>

            <div className={styles.form}>
              <label>
                <span>ID *</span>
                <input
                  value={draft.id}
                  onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))}
                  placeholder="fire"
                  autoCapitalize="none"
                  spellCheck={false}
                />
                {validation.errors.id && <small>{validation.errors.id}</small>}
              </label>

              <label>
                <span>Название *</span>
                <input
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Огонь"
                />
                {validation.errors.name && <small>{validation.errors.name}</small>}
              </label>

              <label className={styles.fullWidth}>
                <span>Описание</span>
                <textarea
                  value={draft.description ?? ''}
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Короткое описание источника"
                  rows={4}
                />
              </label>

              <label>
                <span>Иконка</span>
                <input
                  value={draft.icon ?? ''}
                  onChange={(event) => setDraft((current) => ({ ...current, icon: event.target.value }))}
                  placeholder="🔥"
                />
              </label>

              <label>
                <span>Цвет</span>
                <div className={styles.colorInputRow}>
                  <input
                    className={styles.colorPicker}
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(draft.color ?? '') ? draft.color : '#ffffff'}
                    onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))}
                  />
                  <input
                    value={draft.color ?? ''}
                    onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))}
                    placeholder="#e9573f"
                    spellCheck={false}
                  />
                </div>
                {validation.errors.color && <small>{validation.errors.color}</small>}
              </label>
            </div>

            <div className={styles.panelFooter}>
              <button className={styles.secondaryButton} type="button" onClick={closeForm}>Отмена</button>
              <button className={styles.primaryButton} type="button" onClick={submit} disabled={!validation.valid}>Сохранить</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
