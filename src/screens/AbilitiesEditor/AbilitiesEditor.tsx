import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { EditorCheckbox, EditorColorInput, EditorFileInput, EditorInput, EditorSelect, EditorTextarea } from '../../components/EditorControls';
import { loadDamageSources } from '../../editor/damageSources/damageSourceStorage';
import {
  changeAbilityEffectTypes,
  changeAbilityEffectTarget,
  createEmptyAbility,
  deleteAbility,
  getAllowedTargets,
  normalizeAbility,
  saveAbility,
  validateAbility,
} from '../../editor/abilities/abilityLogic';
import { loadAbilities, persistAbilities } from '../../editor/abilities/abilityStorage';
import type {
  AbilityDefinition,
  AbilityEffect,
  AbilityEffectType,
  AbilityTargetType,
  DamageAbilityEffect,
  HealAbilityEffect,
  PeriodicDamageAbilityEffect,
  SlowAbilityEffect,
  AbilityVisualEffect,
} from '../../editor/abilities/types';
import styles from './AbilitiesEditor.module.css';

type AbilitiesEditorProps = {
  onBackToMain: () => void;
  onBackToEditors: () => void;
};

const EFFECT_TYPE_LABELS: Record<AbilityEffectType, string> = {
  damage: 'Урон',
  'periodic-damage': 'Периодический урон',
  slow: 'Замедление',
  heal: 'Лечение',
};

const VISUAL_EFFECT_LABELS: Record<AbilityVisualEffect, string> = {
  none: 'Без эффекта',
  fire: 'Огненная стена',
  ice: 'Заморозка',
  lightning: 'Удар молнии',
  heal: 'Лечение',
};

const TARGET_LABELS: Record<AbilityTargetType, string> = {
  'nearest-enemies': 'Ближайшие враги',
  'random-enemies': 'Случайные враги',
  'area-enemies': 'Область (AoE)',
  'all-enemies': 'Все враги',
  castle: 'Замок',
};

const LEGACY_GLYPHS: Record<string, string> = {
  fire: '🔥',
  ice: '❄',
  lightning: '⚡',
  shield: '✚',
};

function cloneAbility(ability: AbilityDefinition): AbilityDefinition {
  return {
    ...ability,
    image: ability.image ? { ...ability.image } : undefined,
    effects: ability.effects.map((effect) => ({ ...effect, target: { ...effect.target } })),
  };
}

function inputNumber(value: string): number {
  return value === '' ? 0 : Number(value);
}

function getEffectTypes(ability: AbilityDefinition): AbilityEffectType[] {
  return ability.effects.map((effect) => effect.type);
}

function getEffectLabel(ability: AbilityDefinition): string {
  return getEffectTypes(ability).map((type) => EFFECT_TYPE_LABELS[type]).join(', ') || 'Эффекты не выбраны';
}

function getAbilityGlyph(ability: AbilityDefinition): string {
  return LEGACY_GLYPHS[ability.id] ?? (ability.name.slice(0, 1).toUpperCase() || '•');
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

export function AbilitiesEditor({ onBackToMain, onBackToEditors }: AbilitiesEditorProps) {
  const damageSources = useMemo(() => loadDamageSources(), []);
  const [abilities, setAbilities] = useState<AbilityDefinition[]>(() => loadAbilities());
  const sortedAbilities = useMemo(
    () => [...abilities].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [abilities],
  );
  const [selectedId, setSelectedId] = useState<string | null>(() => sortedAbilities[0]?.id ?? null);
  const [editingId, setEditingId] = useState<string | undefined>(() => sortedAbilities[0]?.id);
  const [draft, setDraft] = useState<AbilityDefinition>(() => cloneAbility(
    sortedAbilities[0] ?? createEmptyAbility(damageSources),
  ));
  const [isCreating, setIsCreating] = useState(false);

  const selectedAbility = abilities.find((ability) => ability.id === selectedId) ?? null;
  const validation = useMemo(
    () => validateAbility(draft, abilities, damageSources, editingId),
    [draft, editingId, abilities, damageSources],
  );

  const updateAbilities = (next: AbilityDefinition[]) => {
    setAbilities(next);
    persistAbilities(next);
  };

  useEffect(() => {
    if (isCreating) return;
    if (selectedId && abilities.some((ability) => ability.id === selectedId)) return;

    const next = [...abilities].sort((a, b) => a.name.localeCompare(b.name, 'ru'))[0] ?? null;
    setSelectedId(next?.id ?? null);
    setEditingId(next?.id);
    setDraft(cloneAbility(next ?? createEmptyAbility(damageSources)));
  }, [abilities, damageSources, isCreating, selectedId]);

  useEffect(() => {
    if (!validation.valid) return;

    const normalized = normalizeAbility(draft);
    const current = editingId ? abilities.find((ability) => ability.id === editingId) : undefined;
    if (current && JSON.stringify(current) === JSON.stringify(normalized)) return;

    const next = saveAbility(abilities, normalized, editingId);
    updateAbilities(next);
    setSelectedId(normalized.id);
    setEditingId(normalized.id);
    setIsCreating(false);
  }, [draft, editingId, abilities, validation.valid]);

  const selectAbility = (ability: AbilityDefinition) => {
    setSelectedId(ability.id);
    setEditingId(ability.id);
    setDraft(cloneAbility(ability));
    setIsCreating(false);
  };

  const openCreate = () => {
    setSelectedId(null);
    setEditingId(undefined);
    setDraft(createEmptyAbility(damageSources));
    setIsCreating(true);
  };

  const cancelCreate = () => {
    const next = sortedAbilities[0] ?? null;
    setSelectedId(next?.id ?? null);
    setEditingId(next?.id);
    setDraft(cloneAbility(next ?? createEmptyAbility(damageSources)));
    setIsCreating(false);
  };

  const remove = () => {
    if (!selectedAbility) return;
    if (!window.confirm(`Удалить способность «${selectedAbility.name}»?`)) return;

    const selectedIndex = sortedAbilities.findIndex((ability) => ability.id === selectedAbility.id);
    const remaining = deleteAbility(abilities, selectedAbility.id);
    updateAbilities(remaining);

    const nextSorted = [...remaining].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    const next = nextSorted[selectedIndex] ?? nextSorted[selectedIndex - 1] ?? null;
    setSelectedId(next?.id ?? null);
    setEditingId(next?.id);
    setDraft(cloneAbility(next ?? createEmptyAbility(damageSources)));
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

  const renderTargetFields = (effect: AbilityEffect) => {
    const targetError = validation.errors[`${effect.type}Target`];
    const countError = validation.errors[`${effect.type}TargetCount`];
    const areaHeightError = validation.errors[`${effect.type}AreaHeightPercent`];

    return (
      <>
        <label className={styles.field}>
          <span>Тип цели</span>
          <EditorSelect
            value={effect.target.type}
            aria-invalid={Boolean(targetError)}
            onChange={(event) => setDraft((current) => changeAbilityEffectTarget(
              current,
              effect.type,
              event.target.value as AbilityTargetType,
            ))}
          >
            {getAllowedTargets(effect.type).map((target) => (
              <option key={target} value={target}>{TARGET_LABELS[target]}</option>
            ))}
          </EditorSelect>
          {targetError && <small className={styles.fieldError}>{targetError}</small>}
        </label>

        {(effect.target.type === 'nearest-enemies' || effect.target.type === 'random-enemies') && (
          <label className={styles.field}>
            <span>Количество целей</span>
            <EditorInput
              type="number"
              min="1"
              step="1"
              value={effect.target.count ?? 1}
              aria-invalid={Boolean(countError)}
              onChange={(event) => setDraft((current) => ({
                ...current,
                effects: current.effects.map((item) => item.type === effect.type
                  ? {
                    ...item,
                    target: { ...item.target, count: inputNumber(event.target.value) },
                  }
                  : item),
              }))}
            />
            {countError && <small className={styles.fieldError}>{countError}</small>}
          </label>
        )}

        {effect.target.type === 'area-enemies' && (
          <label className={styles.field}>
            <span>Высота области, %</span>
            <EditorInput
              type="number"
              min="1"
              max="100"
              step="1"
              value={effect.target.areaHeightPercent ?? 50}
              aria-invalid={Boolean(areaHeightError)}
              onChange={(event) => setDraft((current) => ({
                ...current,
                effects: current.effects.map((item) => item.type === effect.type
                  ? {
                    ...item,
                    target: {
                      ...item.target,
                      areaHeightPercent: inputNumber(event.target.value),
                    },
                  }
                  : item),
              }))}
            />
            {areaHeightError && <small className={styles.fieldError}>{areaHeightError}</small>}
          </label>
        )}
      </>
    );
  };

  const hasEditor = isCreating || selectedAbility !== null;
  const previewColor = /^#[0-9a-fA-F]{6}$/.test(draft.color) ? draft.color : '#64748b';

  return (
    <main className={styles.screen}>
      <header className={styles.topbar}>
        <button className={styles.toolbarButton} type="button" onClick={onBackToMain}>Главное меню</button>
        <strong>Редактор способностей</strong>
        <button className={styles.toolbarButton} type="button" onClick={onBackToEditors}>Все редакторы</button>
      </header>

      <div className={styles.layout}>
        <aside className={styles.listPanel} aria-label="Способности">
          <div className={styles.listHeader}>
            <div>
              <h2>Способности</h2>
              <p>{abilities.length} в проекте</p>
            </div>
            <button
              className={styles.addButton}
              type="button"
              onClick={openCreate}
              aria-label="Добавить способность"
            >+</button>
          </div>

          <div className={styles.list}>
            {sortedAbilities.map((ability) => (
              <button
                key={ability.id}
                type="button"
                className={`${styles.listItem}${ability.id === selectedId && !isCreating ? ` ${styles.active}` : ''}`}
                onClick={() => selectAbility(ability)}
              >
                <span className={styles.listIcon} style={{ backgroundColor: ability.color }}>
                  {ability.image?.src ? <img src={ability.image.src} alt="" /> : getAbilityGlyph(ability)}
                </span>
                <span className={styles.listItemText}>
                  <strong>{ability.name || 'Без названия'}</strong>
                  <small>{getEffectLabel(ability)} · {ability.id}</small>
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
                  {draft.image?.src ? <img src={draft.image.src} alt="" /> : getAbilityGlyph(draft)}
                </div>
                <div className={styles.previewText}>
                  <span className={styles.kicker}>{getEffectLabel(draft)}</span>
                  <h1>{isCreating ? 'Новая способность' : draft.name || 'Без названия'}</h1>
                  <p>{draft.description || 'Настройте тип эффекта, цель и параметры способности.'}</p>
                </div>
              </div>

              <div className={styles.headerActions}>
                <label className={styles.fileButton}>
                  Загрузить картинку
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
                  <button className={styles.dangerButton} type="button" onClick={remove}>Удалить</button>
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
                    placeholder="fire"
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
                    placeholder="Огонь"
                  />
                  {validation.errors.name && <small className={styles.fieldError}>{validation.errors.name}</small>}
                </label>

                <label className={styles.field}>
                  <span>Цвет</span>
                  <div className={styles.colorRow}>
                    <EditorColorInput
                      value={previewColor}
                      onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))}
                    />
                    <EditorInput
                      value={draft.color}
                      aria-invalid={Boolean(validation.errors.color)}
                      onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))}
                      placeholder="#e9573f"
                      spellCheck={false}
                    />
                  </div>
                  {validation.errors.color && <small className={styles.fieldError}>{validation.errors.color}</small>}
                </label>

                <div className={styles.field}>
                  <span>Тип эффекта</span>
                  <details className={styles.multiSelect} aria-invalid={Boolean(validation.errors.effects)}>
                    <summary>{getEffectLabel(draft)}</summary>
                    <div className={styles.multiSelectMenu}>
                      {(Object.keys(EFFECT_TYPE_LABELS) as AbilityEffectType[]).map((type) => {
                        const checked = draft.effects.some((effect) => effect.type === type);
                        return (
                          <label key={type} className={styles.multiSelectOption}>
                            <EditorCheckbox
                              className={styles.multiSelectCheckbox}
                              checked={checked}
                              onChange={(event) => setDraft((current) => {
                                const selectedTypes = getEffectTypes(current);
                                const nextTypes = event.target.checked
                                  ? [...selectedTypes, type]
                                  : selectedTypes.filter((selectedType) => selectedType !== type);
                                return changeAbilityEffectTypes(current, nextTypes, damageSources);
                              })}
                            />
                            <span>{EFFECT_TYPE_LABELS[type]}</span>
                          </label>
                        );
                      })}
                    </div>
                  </details>
                  {validation.errors.effects && <small className={styles.fieldError}>{validation.errors.effects}</small>}
                </div>

                <label className={styles.field}>
                  <span>Визуальный эффект</span>
                  <EditorSelect
                    value={draft.visualEffect}
                    aria-invalid={Boolean(validation.errors.visualEffect)}
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      visualEffect: event.target.value as AbilityVisualEffect,
                    }))}
                  >
                    {(Object.keys(VISUAL_EFFECT_LABELS) as AbilityVisualEffect[]).map((visualEffect) => (
                      <option key={visualEffect} value={visualEffect}>
                        {VISUAL_EFFECT_LABELS[visualEffect]}
                      </option>
                    ))}
                  </EditorSelect>
                  {validation.errors.visualEffect && (
                    <small className={styles.fieldError}>{validation.errors.visualEffect}</small>
                  )}
                </label>

                <label className={`${styles.field} ${styles.fullRow}`}>
                  <span>Описание</span>
                  <EditorTextarea
                    value={draft.description ?? ''}
                    onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Что делает способность"
                  />
                </label>
              </div>
            </div>

            <div className={styles.formSection}>
              <h2>Параметры эффектов</h2>
              <div className={styles.effectBlocks}>
                {draft.effects.map((selectedEffect) => {
                  if (selectedEffect.type === 'damage') {
                    const effect = selectedEffect as DamageAbilityEffect;
                    return (
                      <div key="damage" className={styles.effectBlock}>
                        <h3>Урон</h3>
                        <div className={styles.formGrid}>
                          {renderTargetFields(effect)}
                          <label className={styles.field}>
                            <span>Урон</span>
                            <EditorInput
                              type="number"
                              min="0"
                              value={effect.amount}
                              aria-invalid={Boolean(validation.errors.damageAmount)}
                              onChange={(event) => setDraft((current) => ({
                                ...current,
                                effects: current.effects.map((item) => item.type === 'damage'
                                  ? { ...item, amount: inputNumber(event.target.value) }
                                  : item),
                              }))}
                            />
                            {validation.errors.damageAmount && <small className={styles.fieldError}>{validation.errors.damageAmount}</small>}
                          </label>

                          <label className={styles.field}>
                            <span>Источник урона</span>
                            <EditorSelect
                              value={effect.damageSourceId}
                              aria-invalid={Boolean(validation.errors.damageSourceId)}
                              onChange={(event) => setDraft((current) => ({
                                ...current,
                                effects: current.effects.map((item) => item.type === 'damage'
                                  ? { ...item, damageSourceId: event.target.value }
                                  : item),
                              }))}
                            >
                              {damageSources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
                            </EditorSelect>
                            {validation.errors.damageSourceId && <small className={styles.fieldError}>{validation.errors.damageSourceId}</small>}
                          </label>

                          <label className={styles.field}>
                            <span>Шанс крит. урона, %</span>
                            <EditorInput
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={effect.criticalChancePercent}
                              aria-invalid={Boolean(validation.errors.damageCriticalChancePercent)}
                              onChange={(event) => setDraft((current) => ({
                                ...current,
                                effects: current.effects.map((item) => item.type === 'damage'
                                  ? { ...item, criticalChancePercent: inputNumber(event.target.value) }
                                  : item),
                              }))}
                            />
                            {validation.errors.damageCriticalChancePercent && (
                              <small className={styles.fieldError}>{validation.errors.damageCriticalChancePercent}</small>
                            )}
                          </label>

                          <label className={styles.field}>
                            <span>Множитель крит. урона</span>
                            <EditorInput
                              type="number"
                              min="1"
                              step="0.1"
                              value={effect.criticalMultiplier}
                              aria-invalid={Boolean(validation.errors.damageCriticalMultiplier)}
                              onChange={(event) => setDraft((current) => ({
                                ...current,
                                effects: current.effects.map((item) => item.type === 'damage'
                                  ? { ...item, criticalMultiplier: inputNumber(event.target.value) }
                                  : item),
                              }))}
                            />
                            {validation.errors.damageCriticalMultiplier && (
                              <small className={styles.fieldError}>{validation.errors.damageCriticalMultiplier}</small>
                            )}
                          </label>
                        </div>
                      </div>
                    );
                  }

                  if (selectedEffect.type === 'periodic-damage') {
                    const effect = selectedEffect as PeriodicDamageAbilityEffect;
                    return (
                      <div key="periodic-damage" className={styles.effectBlock}>
                        <h3>Периодический урон</h3>
                        <div className={styles.formGrid}>
                          {renderTargetFields(effect)}
                          <label className={styles.field}>
                            <span>Шанс, %</span>
                            <EditorInput
                              type="number"
                              min="0"
                              max="100"
                              value={effect.chancePercent}
                              aria-invalid={Boolean(validation.errors.periodicDamageChancePercent)}
                              onChange={(event) => setDraft((current) => ({
                                ...current,
                                effects: current.effects.map((item) => item.type === 'periodic-damage'
                                  ? { ...item, chancePercent: inputNumber(event.target.value) }
                                  : item),
                              }))}
                            />
                            {validation.errors.periodicDamageChancePercent && (
                              <small className={styles.fieldError}>{validation.errors.periodicDamageChancePercent}</small>
                            )}
                          </label>

                          <label className={styles.field}>
                            <span>Урон</span>
                            <EditorInput
                              type="number"
                              min="0"
                              value={effect.amount}
                              aria-invalid={Boolean(validation.errors.periodicDamageAmount)}
                              onChange={(event) => setDraft((current) => ({
                                ...current,
                                effects: current.effects.map((item) => item.type === 'periodic-damage'
                                  ? { ...item, amount: inputNumber(event.target.value) }
                                  : item),
                              }))}
                            />
                            {validation.errors.periodicDamageAmount && (
                              <small className={styles.fieldError}>{validation.errors.periodicDamageAmount}</small>
                            )}
                          </label>

                          <label className={styles.field}>
                            <span>Длительность, сек.</span>
                            <EditorInput
                              type="number"
                              min="0.1"
                              step="0.1"
                              value={effect.duration}
                              aria-invalid={Boolean(validation.errors.periodicDamageDuration)}
                              onChange={(event) => setDraft((current) => ({
                                ...current,
                                effects: current.effects.map((item) => item.type === 'periodic-damage'
                                  ? { ...item, duration: inputNumber(event.target.value) }
                                  : item),
                              }))}
                            />
                            {validation.errors.periodicDamageDuration && (
                              <small className={styles.fieldError}>{validation.errors.periodicDamageDuration}</small>
                            )}
                          </label>


                          <label className={styles.field}>
                            <span>Шанс крит. урона, %</span>
                            <EditorInput
                              type="number"
                              min="0"
                              max="100"
                              value={effect.criticalChancePercent}
                              aria-invalid={Boolean(validation.errors.periodicDamageCriticalChancePercent)}
                              onChange={(event) => setDraft((current) => ({
                                ...current,
                                effects: current.effects.map((item) => item.type === 'periodic-damage'
                                  ? { ...item, criticalChancePercent: inputNumber(event.target.value) }
                                  : item),
                              }))}
                            />
                            {validation.errors.periodicDamageCriticalChancePercent && (
                              <small className={styles.fieldError}>{validation.errors.periodicDamageCriticalChancePercent}</small>
                            )}
                          </label>

                          <label className={styles.field}>
                            <span>Множитель крит. урона</span>
                            <EditorInput
                              type="number"
                              min="1"
                              step="0.1"
                              value={effect.criticalMultiplier}
                              aria-invalid={Boolean(validation.errors.periodicDamageCriticalMultiplier)}
                              onChange={(event) => setDraft((current) => ({
                                ...current,
                                effects: current.effects.map((item) => item.type === 'periodic-damage'
                                  ? { ...item, criticalMultiplier: inputNumber(event.target.value) }
                                  : item),
                              }))}
                            />
                            {validation.errors.periodicDamageCriticalMultiplier && (
                              <small className={styles.fieldError}>{validation.errors.periodicDamageCriticalMultiplier}</small>
                            )}
                          </label>

                          <label className={styles.field}>
                            <span>Цвет визуального эффекта</span>
                            <div className={styles.colorRow}>
                              <EditorColorInput
                                value={/^#[0-9a-fA-F]{6}$/.test(effect.visualColor) ? effect.visualColor : '#64748b'}
                                onChange={(event) => setDraft((current) => ({
                                  ...current,
                                  effects: current.effects.map((item) => item.type === 'periodic-damage'
                                    ? { ...item, visualColor: event.target.value }
                                    : item),
                                }))}
                              />
                              <EditorInput
                                value={effect.visualColor}
                                aria-invalid={Boolean(validation.errors.periodicDamageVisualColor)}
                                onChange={(event) => setDraft((current) => ({
                                  ...current,
                                  effects: current.effects.map((item) => item.type === 'periodic-damage'
                                    ? { ...item, visualColor: event.target.value }
                                    : item),
                                }))}
                                placeholder="#f97316"
                                spellCheck={false}
                              />
                            </div>
                            {validation.errors.periodicDamageVisualColor && (
                              <small className={styles.fieldError}>{validation.errors.periodicDamageVisualColor}</small>
                            )}
                          </label>
                        </div>
                      </div>
                    );
                  }

                  if (selectedEffect.type === 'slow') {
                    const effect = selectedEffect as SlowAbilityEffect;
                    return (
                      <div key="slow" className={styles.effectBlock}>
                        <h3>Замедление</h3>
                        <div className={styles.formGrid}>
                          {renderTargetFields(effect)}
                          <label className={styles.field}>
                            <span>Замедление, %</span>
                            <EditorInput
                              type="number"
                              min="0"
                              max="100"
                              value={effect.slowPercent}
                              aria-invalid={Boolean(validation.errors.slowPercent)}
                              onChange={(event) => setDraft((current) => ({
                                ...current,
                                effects: current.effects.map((item) => item.type === 'slow'
                                  ? { ...item, slowPercent: inputNumber(event.target.value) }
                                  : item),
                              }))}
                            />
                            {validation.errors.slowPercent && <small className={styles.fieldError}>{validation.errors.slowPercent}</small>}
                          </label>

                          <label className={styles.field}>
                            <span>Длительность, сек.</span>
                            <EditorInput
                              type="number"
                              min="0"
                              step="0.1"
                              value={effect.duration}
                              aria-invalid={Boolean(validation.errors.duration)}
                              onChange={(event) => setDraft((current) => ({
                                ...current,
                                effects: current.effects.map((item) => item.type === 'slow'
                                  ? { ...item, duration: inputNumber(event.target.value) }
                                  : item),
                              }))}
                            />
                            {validation.errors.duration && <small className={styles.fieldError}>{validation.errors.duration}</small>}
                          </label>
                        </div>
                      </div>
                    );
                  }

                  const effect = selectedEffect as HealAbilityEffect;
                  return (
                    <div key="heal" className={styles.effectBlock}>
                      <h3>Лечение</h3>
                      <div className={styles.formGrid}>
                        {renderTargetFields(effect)}
                        <label className={styles.field}>
                          <span>Лечение, HP</span>
                          <EditorInput
                            type="number"
                            min="0"
                            value={effect.amount}
                            aria-invalid={Boolean(validation.errors.healAmount)}
                            onChange={(event) => setDraft((current) => ({
                              ...current,
                              effects: current.effects.map((item) => item.type === 'heal'
                                ? { ...item, amount: inputNumber(event.target.value) }
                                : item),
                            }))}
                          />
                          {validation.errors.healAmount && <small className={styles.fieldError}>{validation.errors.healAmount}</small>}
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ) : (
          <section className={styles.emptyState}>
            <h1>Способностей пока нет</h1>
            <p>Добавьте способность — она станет доступна на поле 3-в-ряд.</p>
            <button className={styles.addEmptyButton} type="button" onClick={openCreate}>Добавить</button>
          </section>
        )}
      </div>
    </main>
  );
}
