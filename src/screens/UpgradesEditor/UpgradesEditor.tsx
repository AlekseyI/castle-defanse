import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { EditorColorInput, EditorFileInput, EditorInput, EditorSelect, EditorTextarea } from '../../components/EditorControls';
import { getAllowedTargets } from '../../editor/abilities/abilityLogic';
import { loadAbilities } from '../../editor/abilities/abilityStorage';
import type { AbilityTargetType } from '../../editor/abilities/types';
import { loadDamageSources } from '../../editor/damageSources/damageSourceStorage';
import {
  changeAddedTargetType,
  changeUpgradeTargetType,
  cloneUpgradeCard,
  createEmptyUpgradeCard,
  createEmptyUpgradeEffect,
  deleteUpgradeCard,
  getCompatibleUpgradeEffectTypes,
  getDefaultUpgradeEffectValue,
  getUpgradeEffectOption,
  normalizeUpgradeCard,
  saveUpgradeCard,
  validateUpgradeCard,
} from '../../editor/upgrades/upgradeLogic';
import { loadUpgrades, persistUpgrades } from '../../editor/upgrades/upgradeStorage';
import type {
  UpgradeAddEffectValue,
  UpgradeAddedTarget,
  UpgradeCardDefinition,
  UpgradeEffect,
  UpgradeEffectType,
  UpgradeEffectValue,
  UpgradeRarity,
  UpgradeTargetValue,
} from '../../editor/upgrades/types';
import styles from './UpgradesEditor.module.css';

type Props = {
  onBackToMain: () => void;
  onBackToEditors: () => void;
};

const RARITY_LABELS: Record<UpgradeRarity, string> = {
  common: 'Обычная',
  rare: 'Редкая',
  epic: 'Эпическая',
  legendary: 'Легендарная',
};

const TARGET_LABELS: Record<AbilityTargetType, string> = {
  'nearest-enemies': 'Ближайшие враги',
  'random-enemies': 'Случайные враги',
  'area-enemies': 'Область по высоте',
  'all-enemies': 'Все враги',
  castle: 'Замок',
};

const PARAMETER_GROUPS: Array<{
  label: string;
  match: (type: UpgradeEffectType) => boolean;
}> = [
  {
    label: 'Основной урон',
    match: (type) => {
      const option = getUpgradeEffectOption(type);
      return option?.valueKind !== 'add-effect' && option?.abilityEffectType === 'damage';
    },
  },
  {
    label: 'Периодический урон',
    match: (type) => {
      const option = getUpgradeEffectOption(type);
      return option?.valueKind !== 'add-effect' && option?.abilityEffectType === 'periodic-damage';
    },
  },
  {
    label: 'Замедление',
    match: (type) => {
      const option = getUpgradeEffectOption(type);
      return option?.valueKind !== 'add-effect' && option?.abilityEffectType === 'slow';
    },
  },
  {
    label: 'Лечение',
    match: (type) => {
      const option = getUpgradeEffectOption(type);
      return option?.valueKind !== 'add-effect' && option?.abilityEffectType === 'heal';
    },
  },
  {
    label: 'Добавление',
    match: (type) => getUpgradeEffectOption(type)?.valueKind === 'add-effect',
  },
];

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

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

function numberValue(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value);
}

function zeroNumberValue(value: string): number {
  const parsed = value.trim() === '' ? 0 : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function applyDefaultDamageSource(
  type: UpgradeEffectType,
  value: UpgradeEffectValue,
  defaultDamageSourceId?: string,
): UpgradeEffectValue {
  if (!defaultDamageSourceId) return value;

  if (type === 'ability-damage-source') {
    return typeof value === 'string' && value ? value : defaultDamageSourceId;
  }

  if (type === 'ability-add-damage' && typeof value === 'object' && value && 'damageSourceId' in value) {
    return {
      ...value,
      damageSourceId: value.damageSourceId || defaultDamageSourceId,
    } as UpgradeAddEffectValue;
  }

  return value;
}

function prepareUpgradeCardForEditing(
  card: UpgradeCardDefinition,
  defaultDamageSourceId?: string,
): UpgradeCardDefinition {
  const prepared = cloneUpgradeCard(card);
  return {
    ...prepared,
    effects: prepared.effects.map((effect) => ({
      ...effect,
      value: applyDefaultDamageSource(effect.type, effect.value, defaultDamageSourceId),
    } as UpgradeEffect)),
  };
}

function createEditorUpgradeEffect(
  abilities: ReturnType<typeof loadAbilities>,
  defaultDamageSourceId?: string,
): UpgradeEffect {
  const effect = createEmptyUpgradeEffect(abilities);
  return {
    ...effect,
    value: applyDefaultDamageSource(effect.type, effect.value, defaultDamageSourceId),
  } as UpgradeEffect;
}

function createEditorUpgradeCard(
  abilities: ReturnType<typeof loadAbilities>,
  defaultDamageSourceId?: string,
): UpgradeCardDefinition {
  return prepareUpgradeCardForEditing(createEmptyUpgradeCard(abilities), defaultDamageSourceId);
}

type SignedNumberInputProps = {
  value: UpgradeCardDefinition['effects'][number]['value'];
  invalid?: boolean;
  onCommit: (value: number) => void;
};

function SignedNumberInput({ value, invalid, onCommit }: SignedNumberInputProps) {
  const committedText = typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
  const [text, setText] = useState(committedText);

  useEffect(() => {
    setText(committedText);
  }, [committedText]);

  const parse = (raw: string): number | undefined => {
    const normalized = raw.trim().replace(',', '.');
    if (!normalized || ['-', '+', '.', '-.', '+.'].includes(normalized) || normalized.endsWith('.')) {
      return undefined;
    }
    const next = Number(normalized);
    return Number.isFinite(next) ? next : undefined;
  };

  const commit = () => {
    const next = parse(text);
    if (next === undefined) {
      setText(committedText);
      return;
    }
    onCommit(next);
    setText(String(next));
  };

  return (
    <EditorInput
      type="text"
      inputMode="text"
      value={text}
      aria-invalid={Boolean(invalid)}
      onChange={(event) => {
        const nextText = event.target.value;
        setText(nextText);
        const next = parse(nextText);
        if (next !== undefined) onCommit(next);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
  );
}

export function UpgradesEditor({ onBackToMain, onBackToEditors }: Props) {
  const [abilities] = useState(() => loadAbilities());
  const [damageSources] = useState(() => loadDamageSources());
  const [cards, setCards] = useState<UpgradeCardDefinition[]>(() => loadUpgrades());
  const defaultDamageSourceId = damageSources[0]?.id;
  const [selectedId, setSelectedId] = useState<string | null>(() => cards[0]?.id ?? null);
  const [editingId, setEditingId] = useState<string | undefined>(() => cards[0]?.id);
  const [draft, setDraft] = useState<UpgradeCardDefinition>(() => (
    cards[0]
      ? prepareUpgradeCardForEditing(cards[0], defaultDamageSourceId)
      : createEditorUpgradeCard(abilities, defaultDamageSourceId)
  ));
  const [isCreating, setIsCreating] = useState(cards.length === 0);
  const sortedCards = useMemo(
    () => [...cards].sort((a, b) => a.name.localeCompare(b.name, 'ru') || a.id.localeCompare(b.id)),
    [cards],
  );

  const selectedCard = cards.find((card) => card.id === selectedId) ?? null;
  const validation = useMemo(
    () => validateUpgradeCard(draft, cards, abilities, editingId, damageSources),
    [abilities, cards, damageSources, draft, editingId],
  );

  const updateCards = (next: UpgradeCardDefinition[]) => {
    setCards(next);
    persistUpgrades(next);
  };

  useEffect(() => {
    if (!validation.valid) return;
    const normalized = normalizeUpgradeCard(draft);
    const current = editingId ? cards.find((card) => card.id === editingId) : undefined;
    if (current && JSON.stringify(current) === JSON.stringify(normalized)) return;

    const next = saveUpgradeCard(cards, normalized, editingId);
    updateCards(next);
    setSelectedId(normalized.id);
    setEditingId(normalized.id);
    setIsCreating(false);
  }, [cards, draft, editingId, validation.valid]);

  const selectCard = (card: UpgradeCardDefinition) => {
    setSelectedId(card.id);
    setEditingId(card.id);
    setDraft(prepareUpgradeCardForEditing(card, defaultDamageSourceId));
    setIsCreating(false);
  };

  const openCreate = () => {
    setSelectedId(null);
    setEditingId(undefined);
    setDraft(createEditorUpgradeCard(abilities, defaultDamageSourceId));
    setIsCreating(true);
  };

  const remove = () => {
    if (!selectedCard) return;
    if (!window.confirm(`Удалить карточку «${selectedCard.name}»?`)) return;

    const remaining = deleteUpgradeCard(cards, selectedCard.id);
    updateCards(remaining);
    const next = remaining[0] ?? null;
    setSelectedId(next?.id ?? null);
    setEditingId(next?.id);
    setDraft(next
      ? prepareUpgradeCardForEditing(next, defaultDamageSourceId)
      : createEditorUpgradeCard(abilities, defaultDamageSourceId));
    setIsCreating(next === null);
  };

  const updateEffect = (
    index: number,
    patch: { abilityId?: string; type?: UpgradeEffectType; value?: UpgradeEffectValue },
  ) => {
    setDraft((current) => ({
      ...current,
      effects: current.effects.map((effect, effectIndex) => (
        effectIndex === index ? { ...effect, ...patch } as UpgradeEffect : effect
      )),
    }));
  };

  const updateAddedValue = (index: number, value: UpgradeAddEffectValue) => {
    updateEffect(index, { value });
  };

  const updateAddedTarget = (
    index: number,
    value: UpgradeAddEffectValue,
    patch: Partial<UpgradeAddedTarget>,
  ) => {
    updateAddedValue(index, {
      ...value,
      target: { ...value.target, ...patch },
    } as UpgradeAddEffectValue);
  };

  const updateTargetValue = (
    index: number,
    value: UpgradeTargetValue,
    patch: Partial<UpgradeTargetValue>,
  ) => {
    updateEffect(index, { value: { ...value, ...patch } });
  };

  const handleAbilityChange = (index: number, abilityId: string) => {
    const ability = abilities.find((item) => item.id === abilityId);
    const compatible = getCompatibleUpgradeEffectTypes(ability);
    const currentEffect = draft.effects[index];
    const nextType = compatible.includes(currentEffect?.type)
      ? currentEffect.type
      : (compatible[0] ?? 'ability-damage-percent');
    updateEffect(index, {
      abilityId,
      type: nextType,
      value: currentEffect?.type === nextType
        ? currentEffect.value
        : applyDefaultDamageSource(
          nextType,
          getDefaultUpgradeEffectValue(nextType, ability),
          defaultDamageSourceId,
        ),
    });
  };

  const handleEffectTypeChange = (index: number, type: UpgradeEffectType) => {
    const ability = abilities.find((item) => item.id === draft.effects[index]?.abilityId);
    updateEffect(index, {
      type,
      value: applyDefaultDamageSource(
        type,
        getDefaultUpgradeEffectValue(type, ability),
        defaultDamageSourceId,
      ),
    });
  };

  const renderAddedTargetFields = (
    index: number,
    value: UpgradeAddEffectValue,
    effectType: 'damage' | 'periodic-damage' | 'slow' | 'heal',
  ) => (
    <>
      <label className={styles.field}>
        <span>Тип цели</span>
        <EditorSelect
          value={value.target.type}
          onChange={(event) => updateAddedValue(index, changeAddedTargetType(value, event.target.value as AbilityTargetType))}
        >
          {getAllowedTargets(effectType).map((target) => (
            <option key={target} value={target}>{TARGET_LABELS[target]}</option>
          ))}
        </EditorSelect>
      </label>

      {(value.target.type === 'nearest-enemies' || value.target.type === 'random-enemies') && (
        <label className={styles.field}>
          <span>Количество целей</span>
          <EditorInput
            type="number"
            min="1"
            step="1"
            value={value.target.count}
            onChange={(event) => updateAddedTarget(index, value, { count: zeroNumberValue(event.target.value) })}
          />
        </label>
      )}

      {value.target.type === 'area-enemies' && (
        <label className={styles.field}>
          <span>Высота области, %</span>
          <EditorInput
            type="number"
            min="1"
            max="100"
            step="1"
            value={value.target.areaHeightPercent}
            onChange={(event) => updateAddedTarget(index, value, { areaHeightPercent: zeroNumberValue(event.target.value) })}
          />
        </label>
      )}
    </>
  );

  const renderAddedEffectFields = (effect: UpgradeEffect, index: number) => {
    if (effect.type === 'ability-add-damage') {
      const value = effect.value;
      return (
        <>
          {renderAddedTargetFields(index, value, 'damage')}
          <label className={styles.field}>
            <span>Урон</span>
            <EditorInput type="number" min="0" value={value.amount} onChange={(event) => updateAddedValue(index, { ...value, amount: zeroNumberValue(event.target.value) })} />
          </label>
          <label className={styles.field}>
            <span>Источник урона</span>
            <EditorSelect value={value.damageSourceId} onChange={(event) => updateAddedValue(index, { ...value, damageSourceId: event.target.value })}>
              {damageSources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
            </EditorSelect>
          </label>
          <label className={styles.field}>
            <span>Шанс крит. урона, %</span>
            <EditorInput type="number" min="0" max="100" step="0.1" value={value.criticalChancePercent} onChange={(event) => updateAddedValue(index, { ...value, criticalChancePercent: zeroNumberValue(event.target.value) })} />
          </label>
          <label className={styles.field}>
            <span>Множитель крит. урона</span>
            <EditorInput type="number" min="0" step="0.1" value={value.criticalMultiplier} onChange={(event) => updateAddedValue(index, { ...value, criticalMultiplier: zeroNumberValue(event.target.value) })} />
          </label>
        </>
      );
    }

    if (effect.type === 'ability-add-periodic-damage') {
      const value = effect.value;
      const pickerColor = HEX_COLOR_PATTERN.test(value.visualColor) ? value.visualColor : '#000000';
      return (
        <>
          {renderAddedTargetFields(index, value, 'periodic-damage')}
          <label className={styles.field}>
            <span>Шанс, %</span>
            <EditorInput type="number" min="0" max="100" step="0.1" value={value.chancePercent} onChange={(event) => updateAddedValue(index, { ...value, chancePercent: zeroNumberValue(event.target.value) })} />
          </label>
          <label className={styles.field}>
            <span>Урон</span>
            <EditorInput type="number" min="0" value={value.amount} onChange={(event) => updateAddedValue(index, { ...value, amount: zeroNumberValue(event.target.value) })} />
          </label>
          <label className={styles.field}>
            <span>Длительность, сек.</span>
            <EditorInput type="number" min="0" step="0.1" value={value.duration} onChange={(event) => updateAddedValue(index, { ...value, duration: zeroNumberValue(event.target.value) })} />
          </label>
          <label className={styles.field}>
            <span>Шанс крит. урона, %</span>
            <EditorInput type="number" min="0" max="100" step="0.1" value={value.criticalChancePercent} onChange={(event) => updateAddedValue(index, { ...value, criticalChancePercent: zeroNumberValue(event.target.value) })} />
          </label>
          <label className={styles.field}>
            <span>Множитель крит. урона</span>
            <EditorInput type="number" min="0" step="0.1" value={value.criticalMultiplier} onChange={(event) => updateAddedValue(index, { ...value, criticalMultiplier: zeroNumberValue(event.target.value) })} />
          </label>
          <label className={styles.field}>
            <span>Цвет визуального эффекта</span>
            <div className={styles.colorRow}>
              <EditorColorInput value={pickerColor} onChange={(event) => updateAddedValue(index, { ...value, visualColor: event.target.value })} />
              <EditorInput
                value={value.visualColor}
                aria-invalid={Boolean(validation.errors[`effect.${index}.visualColor`])}
                placeholder="#000000"
                spellCheck={false}
                onChange={(event) => updateAddedValue(index, { ...value, visualColor: event.target.value })}
              />
            </div>
            {validation.errors[`effect.${index}.visualColor`] && (
              <small className={styles.fieldError}>{validation.errors[`effect.${index}.visualColor`]}</small>
            )}
          </label>
        </>
      );
    }

    if (effect.type === 'ability-add-slow') {
      const value = effect.value;
      return (
        <>
          {renderAddedTargetFields(index, value, 'slow')}
          <label className={styles.field}>
            <span>Замедление, %</span>
            <EditorInput type="number" min="0" max="100" step="0.1" value={value.slowPercent} onChange={(event) => updateAddedValue(index, { ...value, slowPercent: zeroNumberValue(event.target.value) })} />
          </label>
          <label className={styles.field}>
            <span>Длительность, сек.</span>
            <EditorInput type="number" min="0" step="0.1" value={value.duration} onChange={(event) => updateAddedValue(index, { ...value, duration: zeroNumberValue(event.target.value) })} />
          </label>
        </>
      );
    }

    if (effect.type === 'ability-add-heal') {
      const value = effect.value;
      return (
        <>
          {renderAddedTargetFields(index, value, 'heal')}
          <label className={styles.field}>
            <span>Лечение</span>
            <EditorInput type="number" min="0" value={value.amount} onChange={(event) => updateAddedValue(index, { ...value, amount: zeroNumberValue(event.target.value) })} />
          </label>
        </>
      );
    }

    return null;
  };

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    const src = await readFileAsDataUrl(file);
    setDraft((current) => ({ ...current, image: { name: file.name, src } }));
  };

  const previewColor = /^#[0-9a-fA-F]{6}$/.test(draft.color ?? '') ? draft.color : '#64748b';
  const previewLabel = draft.name.slice(0, 1).toUpperCase() || '•';

  return (
    <main className={styles.screen}>
      <header className={styles.topbar}>
        <button className={styles.toolbarButton} type="button" onClick={onBackToMain}>Главное меню</button>
        <strong>Редактор карточек улучшений</strong>
        <button className={styles.toolbarButton} type="button" onClick={onBackToEditors}>Все редакторы</button>
      </header>

      <div className={styles.layout}>
        <aside className={styles.listPanel} aria-label="Карточки улучшений">
          <div className={styles.listHeader}>
            <div>
              <h2>Карточки</h2>
              <p>{cards.length} в проекте</p>
            </div>
            <button className={styles.addButton} type="button" onClick={openCreate} aria-label="Добавить карточку">+</button>
          </div>

          <div className={styles.list}>
            {sortedCards.map((card) => (
              <button
                key={card.id}
                className={`${styles.listItem}${card.id === selectedId && !isCreating ? ` ${styles.active}` : ''}`}
                type="button"
                onClick={() => selectCard(card)}
              >
                <span className={styles.listIcon} style={{ backgroundColor: card.color || '#334155' }}>
                  {card.image?.src ? <img src={card.image.src} alt="" /> : card.name.slice(0, 1).toUpperCase() || '•'}
                </span>
                <span className={styles.listItemText}>
                  <strong>{card.name || 'Без названия'}</strong>
                  <small>{card.id}</small>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className={styles.formPanel}>
          <div className={styles.formHeader}>
            <div className={styles.previewCard}>
              <div className={styles.preview} style={{ backgroundColor: previewColor }}>
                {draft.image?.src ? <img src={draft.image.src} alt="" /> : previewLabel}
              </div>
              <div className={styles.previewText}>
                <span className={styles.kicker}>Карточка улучшения</span>
                <h1>{isCreating ? 'Новая карточка' : draft.name || 'Без названия'}</h1>
                <p>{RARITY_LABELS[draft.rarity]} · Эффектов: {draft.effects.length}</p>
              </div>
            </div>

            <div className={styles.headerActions}>
              <label className={styles.fileButton}>
                Загрузить картинку
                <EditorFileInput mode="overlay" accept="image/*,.svg" onChange={handleImageUpload} />
              </label>
              <button
                className={styles.toolbarButton}
                type="button"
                disabled={!draft.image}
                onClick={() => setDraft((current) => ({ ...current, image: undefined }))}
              >
                Убрать картинку
              </button>
              {!isCreating && <button className={styles.dangerButton} type="button" onClick={remove}>Удалить</button>}
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
                />
                {validation.errors.id && <small className={styles.fieldError}>{validation.errors.id}</small>}
              </label>

              <label className={styles.field}>
                <span>Название</span>
                <EditorInput
                  value={draft.name}
                  aria-invalid={Boolean(validation.errors.name)}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                />
                {validation.errors.name && <small className={styles.fieldError}>{validation.errors.name}</small>}
              </label>

              <label className={styles.field}>
                <span>Редкость</span>
                <EditorSelect
                  value={draft.rarity}
                  aria-invalid={Boolean(validation.errors.rarity)}
                  onChange={(event) => setDraft((current) => ({ ...current, rarity: event.target.value as UpgradeRarity }))}
                >
                  {Object.entries(RARITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </EditorSelect>
                {validation.errors.rarity && <small className={styles.fieldError}>{validation.errors.rarity}</small>}
              </label>

              <label className={styles.field}>
                <span>Вес выпадения</span>
                <EditorInput
                  type="number"
                  min="0.01"
                  step="1"
                  value={Number.isFinite(draft.weight) ? draft.weight : ''}
                  aria-invalid={Boolean(validation.errors.weight)}
                  onChange={(event) => setDraft((current) => ({ ...current, weight: numberValue(event.target.value) }))}
                />
                {validation.errors.weight && <small className={styles.fieldError}>{validation.errors.weight}</small>}
              </label>

              <label className={styles.field}>
                <span>Цвет</span>
                <div className={styles.colorRow}>
                  <EditorColorInput
                    value={previewColor}
                    onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))}
                  />
                  <EditorInput
                    value={draft.color ?? ''}
                    aria-invalid={Boolean(validation.errors.color)}
                    placeholder="#64748b"
                    spellCheck={false}
                    onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))}
                  />
                </div>
                {validation.errors.color && <small className={styles.fieldError}>{validation.errors.color}</small>}
              </label>

              <label className={`${styles.field} ${styles.fullRow}`}>
                <span>Описание</span>
                <EditorTextarea
                  rows={3}
                  value={draft.description}
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                />
              </label>
            </div>
          </div>

          <div className={styles.formSection}>
            <div className={styles.effectsHeader}>
              <div>
                <h2>Эффекты</h2>
                <p>Любой параметр доступен для любой способности: он может улучшить существующий эффект или создать отсутствующий. Для смены типа цели сразу задаются параметры новой цели.</p>
              </div>
              <button
                className={styles.primaryButton}
                type="button"
                onClick={() => setDraft((current) => ({
                  ...current,
                  effects: [...current.effects, createEditorUpgradeEffect(abilities, defaultDamageSourceId)],
                }))}
              >
                + Добавить эффект
              </button>
            </div>

            {validation.errors.effects && <small className={styles.fieldError}>{validation.errors.effects}</small>}

            <div className={styles.effects}>
              {draft.effects.map((effect, index) => {
                const ability = abilities.find((item) => item.id === effect.abilityId);
                const compatible = getCompatibleUpgradeEffectTypes(ability);
                return (
                  <div className={styles.effectCard} key={`${effect.abilityId}:${effect.type}:${index}`}>
                    <label className={styles.field}>
                      <span>Способность</span>
                      <EditorSelect
                        value={effect.abilityId}
                        aria-invalid={Boolean(validation.errors[`effect.${index}.abilityId`])}
                        onChange={(event) => handleAbilityChange(index, event.target.value)}
                      >
                        {abilities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </EditorSelect>
                      {validation.errors[`effect.${index}.abilityId`] && <small className={styles.fieldError}>{validation.errors[`effect.${index}.abilityId`]}</small>}
                    </label>

                    <label className={styles.field}>
                      <span>Параметр</span>
                      <EditorSelect
                        value={effect.type}
                        aria-invalid={Boolean(validation.errors[`effect.${index}.type`])}
                        onChange={(event) => handleEffectTypeChange(index, event.target.value as UpgradeEffectType)}
                      >
                        {PARAMETER_GROUPS.map((group) => {
                          const types = compatible.filter(group.match);
                          if (types.length === 0) return null;

                          return (
                            <optgroup key={group.label} label={group.label}>
                              {types.map((type) => (
                                <option key={type} value={type}>{getUpgradeEffectOption(type)?.label}</option>
                              ))}
                            </optgroup>
                          );
                        })}
                      </EditorSelect>
                      {validation.errors[`effect.${index}.type`] && <small className={styles.fieldError}>{validation.errors[`effect.${index}.type`]}</small>}
                    </label>

                    {getUpgradeEffectOption(effect.type)?.valueKind === 'add-effect' ? (
                      <div className={`${styles.formGrid} ${styles.fullRow}`}>
                        {renderAddedEffectFields(effect, index)}
                        {validation.errors[`effect.${index}.value`] && (
                          <small className={`${styles.fieldError} ${styles.fullRow}`}>
                            {validation.errors[`effect.${index}.value`]}
                          </small>
                        )}
                      </div>
                    ) : (
                      <label className={styles.field}>
                        <span>Значение</span>
                        {(() => {
                          const option = getUpgradeEffectOption(effect.type);
                          const valueError = Boolean(validation.errors[`effect.${index}.value`]);

                          if (option?.valueKind === 'target-type') {
                            const targetValue = typeof effect.value === 'object' && effect.value && !('target' in effect.value)
                              ? effect.value as UpgradeTargetValue
                              : getDefaultUpgradeEffectValue(effect.type, ability) as UpgradeTargetValue;

                            return (
                              <div className={styles.formGrid}>
                                <label className={styles.field}>
                                  <span>Тип цели</span>
                                  <EditorSelect
                                    value={targetValue.type}
                                    aria-invalid={valueError}
                                    onChange={(event) => updateEffect(index, {
                                      value: changeUpgradeTargetType(targetValue, event.target.value as AbilityTargetType),
                                    })}
                                  >
                                    {getAllowedTargets(option.abilityEffectType).map((target) => (
                                      <option key={target} value={target}>{TARGET_LABELS[target]}</option>
                                    ))}
                                  </EditorSelect>
                                </label>

                                {(targetValue.type === 'nearest-enemies' || targetValue.type === 'random-enemies') && (
                                  <label className={styles.field}>
                                    <span>Количество целей</span>
                                    <EditorInput
                                      type="number"
                                      min="1"
                                      step="1"
                                      value={targetValue.count}
                                      aria-invalid={valueError}
                                      onChange={(event) => updateTargetValue(index, targetValue, { count: zeroNumberValue(event.target.value) })}
                                    />
                                  </label>
                                )}

                                {targetValue.type === 'area-enemies' && (
                                  <label className={styles.field}>
                                    <span>Высота области, %</span>
                                    <EditorInput
                                      type="number"
                                      min="1"
                                      max="100"
                                      step="1"
                                      value={targetValue.areaHeightPercent}
                                      aria-invalid={valueError}
                                      onChange={(event) => updateTargetValue(index, targetValue, { areaHeightPercent: zeroNumberValue(event.target.value) })}
                                    />
                                  </label>
                                )}
                              </div>
                            );
                          }

                          if (option?.valueKind === 'damage-source') {
                            return (
                              <EditorSelect
                                value={typeof effect.value === 'string' ? effect.value : ''}
                                aria-invalid={valueError}
                                onChange={(event) => updateEffect(index, { value: event.target.value })}
                              >
                                {damageSources.map((source) => (
                                  <option key={source.id} value={source.id}>{source.name}</option>
                                ))}
                              </EditorSelect>
                            );
                          }

                          if (option?.valueKind === 'color') {
                            const color = typeof effect.value === 'string' && HEX_COLOR_PATTERN.test(effect.value)
                              ? effect.value
                              : '#64748b';
                            return (
                              <div className={styles.colorRow}>
                                <EditorColorInput
                                  value={color}
                                  onChange={(event) => updateEffect(index, { value: event.target.value })}
                                />
                                <EditorInput
                                  value={typeof effect.value === 'string' ? effect.value : ''}
                                  aria-invalid={valueError}
                                  placeholder="#64748b"
                                  spellCheck={false}
                                  onChange={(event) => updateEffect(index, { value: event.target.value })}
                                />
                              </div>
                            );
                          }

                          return (
                            <SignedNumberInput
                              value={effect.value}
                              invalid={valueError}
                              onCommit={(value) => updateEffect(index, { value })}
                            />
                          );
                        })()}
                        {validation.errors[`effect.${index}.value`] && <small className={styles.fieldError}>{validation.errors[`effect.${index}.value`]}</small>}
                      </label>
                    )}

                    <button
                      className={styles.removeButton}
                      type="button"
                      onClick={() => setDraft((current) => ({
                        ...current,
                        effects: current.effects.filter((_, effectIndex) => effectIndex !== index),
                      }))}
                    >
                      Удалить
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
