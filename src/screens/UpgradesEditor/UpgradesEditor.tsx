import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  EditorCheckbox,
  EditorColorInput,
  EditorFileInput,
  EditorInput,
  EditorSelect,
  EditorTextarea,
} from '../../components/EditorControls';
import { getAllowedTargets } from '../../editor/abilities/abilityLogic';
import { loadAbilities } from '../../editor/abilities/abilityStorage';
import type { AbilityEffectType, AbilityTargetType } from '../../editor/abilities/types';
import { loadDamageSources } from '../../editor/damageSources/damageSourceStorage';
import {
  UPGRADE_EFFECT_OPTIONS,
  calculateUpgradeCardChancePercent,
  changeUpgradeTargetType,
  cloneUpgradeCard,
  createEmptyUpgradeCard,
  createEmptyUpgradeEffect,
  deleteUpgradeCard,
  getCompatibleUpgradeEffectTypes,
  getDefaultUpgradeEffectValue,
  getUpgradeEffectOption,
  saveUpgradeCard,
  validateUpgradeCard,
} from '../../editor/upgrades/upgradeLogic';
import {
  loadUpgradeCards,
  loadUpgradeGenerationConfig,
  persistUpgradeCards,
  persistUpgradeGenerationConfig,
} from '../../editor/upgrades/upgradeStorage';
import type {
  UpgradeAddEffectGenerationRule,
  UpgradeAddEffectType,
  UpgradeAddEffectValue,
  UpgradeAddedDamageValue,
  UpgradeAddedHealValue,
  UpgradeAddedPeriodicDamageValue,
  UpgradeAddedSlowValue,
  UpgradeCardDefinition,
  UpgradeEffect,
  UpgradeEffectType,
  UpgradeGenerationConfig,
  UpgradeNumberRange,
  UpgradeRarity,
  UpgradeTargetValue,
} from '../../editor/upgrades/types';
import { generateUpgradeChoices } from '../../game/upgrades/upgradeGenerator';
import styles from './UpgradesEditor.module.css';

type Props = {
  onBackToMain: () => void;
  onBackToEditors: () => void;
};

type EditorTab = 'cards' | 'generator';

const RARITIES: UpgradeRarity[] = ['common', 'rare', 'epic', 'legendary'];
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
    match: (type) => getUpgradeEffectOption(type)?.abilityEffectType === 'damage' && !type.startsWith('ability-add-'),
  },
  {
    label: 'Периодический урон',
    match: (type) => getUpgradeEffectOption(type)?.abilityEffectType === 'periodic-damage' && !type.startsWith('ability-add-'),
  },
  {
    label: 'Замедление',
    match: (type) => getUpgradeEffectOption(type)?.abilityEffectType === 'slow' && !type.startsWith('ability-add-'),
  },
  {
    label: 'Лечение',
    match: (type) => getUpgradeEffectOption(type)?.abilityEffectType === 'heal' && !type.startsWith('ability-add-'),
  },
  {
    label: 'Добавление новых эффектов',
    match: (type) => type.startsWith('ability-add-'),
  },
];

type AddRangeKey =
  | 'amount'
  | 'chancePercent'
  | 'duration'
  | 'criticalChancePercent'
  | 'criticalMultiplier'
  | 'slowPercent'
  | 'targetCount'
  | 'areaHeightPercent';

const ADD_RANGE_LABELS: Record<AddRangeKey, string> = {
  amount: 'Значение',
  chancePercent: 'Шанс, %',
  duration: 'Длительность, сек.',
  criticalChancePercent: 'Шанс крита, %',
  criticalMultiplier: 'Множитель крита',
  slowPercent: 'Замедление, %',
  targetCount: 'Количество целей',
  areaHeightPercent: 'Высота области, %',
};

const ADD_RANGE_FIELDS: Record<UpgradeAddEffectType, AddRangeKey[]> = {
  'ability-add-damage': ['amount', 'criticalChancePercent', 'criticalMultiplier', 'targetCount', 'areaHeightPercent'],
  'ability-add-periodic-damage': ['chancePercent', 'amount', 'duration', 'criticalChancePercent', 'criticalMultiplier', 'targetCount', 'areaHeightPercent'],
  'ability-add-slow': ['slowPercent', 'duration', 'targetCount', 'areaHeightPercent'],
  'ability-add-heal': ['amount'],
};

function numericValue(value: string, fallback = 0): number {
  if (value.trim() === '') return fallback;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function rarityChance(config: UpgradeGenerationConfig, rarity: UpgradeRarity): number {
  const total = RARITIES.reduce((sum, item) => sum + Math.max(0, config.rarityWeights[item]), 0);
  return total > 0 ? (Math.max(0, config.rarityWeights[rarity]) / total) * 100 : 0;
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

function formatPreviewEffect(effect: UpgradeEffect): string {
  const option = getUpgradeEffectOption(effect.type);
  const prefix = option?.label ?? effect.type;
  const value = effect.value;
  if (typeof value === 'number') return `${prefix}: ${value}`;
  if (typeof value === 'string') return `${prefix}: ${value}`;
  if ('target' in value) {
    if ('amount' in value) return `${prefix}: ${value.amount}`;
    if ('slowPercent' in value) return `${prefix}: ${value.slowPercent}%`;
  }
  return `${prefix}: ${TARGET_LABELS[value.type] ?? value.type}`;
}

function targetUsesCount(type: AbilityTargetType): boolean {
  return type === 'nearest-enemies' || type === 'random-enemies';
}

export function UpgradesEditor({ onBackToMain, onBackToEditors }: Props) {
  const [abilities] = useState(() => loadAbilities());
  const [damageSources] = useState(() => loadDamageSources());
  const [activeTab, setActiveTab] = useState<EditorTab>('cards');

  const [cards, setCards] = useState<UpgradeCardDefinition[]>(() => loadUpgradeCards());
  const sortedCards = useMemo(
    () => [...cards].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [cards],
  );
  const [selectedId, setSelectedId] = useState<string | null>(() => sortedCards[0]?.id ?? null);
  const [editingId, setEditingId] = useState<string | undefined>(() => sortedCards[0]?.id);
  const [draft, setDraft] = useState<UpgradeCardDefinition>(() => cloneUpgradeCard(
    sortedCards[0] ?? createEmptyUpgradeCard(abilities),
  ));
  const [isCreating, setIsCreating] = useState(sortedCards.length === 0);

  const [config, setConfig] = useState<UpgradeGenerationConfig>(() => loadUpgradeGenerationConfig());
  const [preview, setPreview] = useState<UpgradeCardDefinition[]>([]);

  useEffect(() => {
    persistUpgradeGenerationConfig(config);
  }, [config]);

  const validation = useMemo(
    () => validateUpgradeCard(draft, cards, abilities, editingId, damageSources),
    [draft, cards, abilities, editingId, damageSources],
  );

  const enabledParameterCount = useMemo(
    () => (Object.values(config.parameters) as UpgradeGenerationConfig['parameters'][UpgradeEffectType][]).filter((rule) => rule.enabled).length,
    [config.parameters],
  );

  const selectedCard = cards.find((card) => card.id === selectedId) ?? null;

  const updateCards = (next: UpgradeCardDefinition[]) => {
    setCards(next);
    persistUpgradeCards(next);
  };

  const selectCard = (card: UpgradeCardDefinition) => {
    setSelectedId(card.id);
    setEditingId(card.id);
    setDraft(cloneUpgradeCard(card));
    setIsCreating(false);
  };

  const openCreate = () => {
    setSelectedId(null);
    setEditingId(undefined);
    setDraft(createEmptyUpgradeCard(abilities));
    setIsCreating(true);
  };

  const cancelCreate = () => {
    const next = sortedCards[0] ?? null;
    setSelectedId(next?.id ?? null);
    setEditingId(next?.id);
    setDraft(cloneUpgradeCard(next ?? createEmptyUpgradeCard(abilities)));
    setIsCreating(!next);
  };

  const saveManualCard = () => {
    if (!validation.valid) return;
    const next = saveUpgradeCard(cards, draft, editingId);
    const savedId = editingId
      ? (next.find((card) => card.id === draft.id)?.id ?? draft.id.trim().toLowerCase())
      : draft.id.trim().toLowerCase();
    updateCards(next);
    const saved = next.find((card) => card.id === savedId) ?? next[next.length - 1];
    if (saved) selectCard(saved);
  };

  const removeManualCard = () => {
    if (!selectedCard) return;
    if (!window.confirm(`Удалить карточку «${selectedCard.name}»?`)) return;
    const next = deleteUpgradeCard(cards, selectedCard.id);
    updateCards(next);
    const fallback = next[0] ?? null;
    setSelectedId(fallback?.id ?? null);
    setEditingId(fallback?.id);
    setDraft(cloneUpgradeCard(fallback ?? createEmptyUpgradeCard(abilities)));
    setIsCreating(!fallback);
  };

  const handleCardImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      const src = await readFileAsDataUrl(file);
      setDraft((current) => ({ ...current, image: { name: file.name, src } }));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Не удалось загрузить изображение.');
    }
  };

  const patchEffect = (index: number, patch: (effect: UpgradeEffect) => UpgradeEffect) => {
    setDraft((current) => ({
      ...current,
      effects: current.effects.map((effect, effectIndex) => effectIndex === index ? patch(effect) : effect),
    }));
  };

  const changeEffectAbility = (index: number, abilityId: string) => {
    const ability = abilities.find((item) => item.id === abilityId);
    if (!ability) return;
    patchEffect(index, (effect) => {
      const compatible = getCompatibleUpgradeEffectTypes(ability);
      const type = compatible.includes(effect.type) ? effect.type : compatible[0];
      if (!type) return { ...effect, abilityId };
      return {
        type,
        abilityId,
        value: getDefaultUpgradeEffectValue(type, ability),
      } as UpgradeEffect;
    });
  };

  const changeEffectType = (index: number, type: UpgradeEffectType) => {
    patchEffect(index, (effect) => {
      const ability = abilities.find((item) => item.id === effect.abilityId);
      return {
        type,
        abilityId: effect.abilityId,
        value: getDefaultUpgradeEffectValue(type, ability),
      } as UpgradeEffect;
    });
  };

  const addManualEffect = () => {
    setDraft((current) => ({ ...current, effects: [...current.effects, createEmptyUpgradeEffect(abilities)] }));
  };

  const removeManualEffect = (index: number) => {
    setDraft((current) => ({ ...current, effects: current.effects.filter((_, effectIndex) => effectIndex !== index) }));
  };

  const renderTargetEditor = (
    target: UpgradeTargetValue,
    effectType: AbilityEffectType,
    onChange: (target: UpgradeTargetValue) => void,
  ) => (
    <div className={styles.targetGrid}>
      <label className={styles.field}>
        <span>Тип цели</span>
        <EditorSelect
          value={target.type}
          onChange={(event) => onChange(changeUpgradeTargetType(target, event.target.value as AbilityTargetType))}
        >
          {getAllowedTargets(effectType).map((type) => (
            <option key={type} value={type}>{TARGET_LABELS[type]}</option>
          ))}
        </EditorSelect>
      </label>
      {targetUsesCount(target.type) && (
        <label className={styles.field}>
          <span>Количество целей</span>
          <EditorInput
            type="number"
            min="1"
            step="1"
            value={target.count}
            onChange={(event) => onChange({ ...target, count: Math.max(1, Math.floor(numericValue(event.target.value, 1))) })}
          />
        </label>
      )}
      {target.type === 'area-enemies' && (
        <label className={styles.field}>
          <span>Высота области, %</span>
          <EditorInput
            type="number"
            min="1"
            max="100"
            value={target.areaHeightPercent}
            onChange={(event) => onChange({ ...target, areaHeightPercent: numericValue(event.target.value) })}
          />
        </label>
      )}
    </div>
  );

  const renderManualEffectValue = (effect: UpgradeEffect, index: number) => {
    const option = getUpgradeEffectOption(effect.type);
    if (!option) return null;

    if (option.valueKind === 'number') {
      return (
        <label className={styles.field}>
          <span>Значение</span>
          <EditorInput
            type="number"
            step="any"
            value={effect.value as number}
            onChange={(event) => patchEffect(index, (current) => ({
              ...current,
              value: numericValue(event.target.value),
            } as UpgradeEffect))}
          />
        </label>
      );
    }

    if (option.valueKind === 'damage-source') {
      return (
        <label className={styles.field}>
          <span>Источник урона</span>
          <EditorSelect
            value={effect.value as string}
            onChange={(event) => patchEffect(index, (current) => ({ ...current, value: event.target.value } as UpgradeEffect))}
          >
            <option value="">Выберите источник</option>
            {damageSources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
          </EditorSelect>
        </label>
      );
    }

    if (option.valueKind === 'color') {
      return (
        <label className={styles.field}>
          <span>Цвет эффекта</span>
          <EditorColorInput
            value={effect.value as string}
            onChange={(event) => patchEffect(index, (current) => ({ ...current, value: event.target.value } as UpgradeEffect))}
          />
        </label>
      );
    }

    if (option.valueKind === 'target-type') {
      const target = effect.value as UpgradeTargetValue;
      return renderTargetEditor(target, option.abilityEffectType, (nextTarget) => {
        patchEffect(index, (current) => ({ ...current, value: nextTarget } as UpgradeEffect));
      });
    }

    const setAddedValue = (value: UpgradeAddEffectValue) => {
      patchEffect(index, (current) => ({ ...current, value } as UpgradeEffect));
    };
    const value = effect.value as UpgradeAddEffectValue;
    const targetEditor = renderTargetEditor(value.target, option.abilityEffectType, (target) => {
      setAddedValue({ ...value, target } as UpgradeAddEffectValue);
    });

    if (effect.type === 'ability-add-damage') {
      const added = value as UpgradeAddedDamageValue;
      return (
        <div className={styles.addedEffectGrid}>
          <label className={styles.field}><span>Урон</span><EditorInput type="number" step="any" value={added.amount} onChange={(event) => setAddedValue({ ...added, amount: numericValue(event.target.value) })} /></label>
          <label className={styles.field}><span>Источник урона</span><EditorSelect value={added.damageSourceId} onChange={(event) => setAddedValue({ ...added, damageSourceId: event.target.value })}><option value="">Выберите источник</option>{damageSources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</EditorSelect></label>
          <label className={styles.field}><span>Шанс крита, %</span><EditorInput type="number" step="any" value={added.criticalChancePercent} onChange={(event) => setAddedValue({ ...added, criticalChancePercent: numericValue(event.target.value) })} /></label>
          <label className={styles.field}><span>Множитель крита</span><EditorInput type="number" step="any" value={added.criticalMultiplier} onChange={(event) => setAddedValue({ ...added, criticalMultiplier: numericValue(event.target.value) })} /></label>
          {targetEditor}
        </div>
      );
    }

    if (effect.type === 'ability-add-periodic-damage') {
      const added = value as UpgradeAddedPeriodicDamageValue;
      return (
        <div className={styles.addedEffectGrid}>
          <label className={styles.field}><span>Шанс, %</span><EditorInput type="number" step="any" value={added.chancePercent} onChange={(event) => setAddedValue({ ...added, chancePercent: numericValue(event.target.value) })} /></label>
          <label className={styles.field}><span>Урон</span><EditorInput type="number" step="any" value={added.amount} onChange={(event) => setAddedValue({ ...added, amount: numericValue(event.target.value) })} /></label>
          <label className={styles.field}><span>Длительность, сек.</span><EditorInput type="number" step="any" value={added.duration} onChange={(event) => setAddedValue({ ...added, duration: numericValue(event.target.value) })} /></label>
          <label className={styles.field}><span>Шанс крита, %</span><EditorInput type="number" step="any" value={added.criticalChancePercent} onChange={(event) => setAddedValue({ ...added, criticalChancePercent: numericValue(event.target.value) })} /></label>
          <label className={styles.field}><span>Множитель крита</span><EditorInput type="number" step="any" value={added.criticalMultiplier} onChange={(event) => setAddedValue({ ...added, criticalMultiplier: numericValue(event.target.value) })} /></label>
          <label className={styles.field}><span>Цвет</span><EditorColorInput value={added.visualColor} onChange={(event) => setAddedValue({ ...added, visualColor: event.target.value })} /></label>
          {targetEditor}
        </div>
      );
    }

    if (effect.type === 'ability-add-slow') {
      const added = value as UpgradeAddedSlowValue;
      return (
        <div className={styles.addedEffectGrid}>
          <label className={styles.field}><span>Замедление, %</span><EditorInput type="number" step="any" value={added.slowPercent} onChange={(event) => setAddedValue({ ...added, slowPercent: numericValue(event.target.value) })} /></label>
          <label className={styles.field}><span>Длительность, сек.</span><EditorInput type="number" step="any" value={added.duration} onChange={(event) => setAddedValue({ ...added, duration: numericValue(event.target.value) })} /></label>
          {targetEditor}
        </div>
      );
    }

    const added = value as UpgradeAddedHealValue;
    return (
      <div className={styles.addedEffectGrid}>
        <label className={styles.field}><span>Лечение</span><EditorInput type="number" step="any" value={added.amount} onChange={(event) => setAddedValue({ ...added, amount: numericValue(event.target.value) })} /></label>
        {targetEditor}
      </div>
    );
  };

  const patchConfig = (mutate: (next: UpgradeGenerationConfig) => void) => {
    setConfig((current) => {
      const next = structuredClone(current);
      mutate(next);
      return next;
    });
  };

  const setRangeValue = (
    type: UpgradeEffectType,
    rarity: UpgradeRarity,
    key: keyof UpgradeNumberRange,
    value: number,
    addField?: AddRangeKey,
  ) => {
    patchConfig((next) => {
      const rule = next.parameters[type];
      if (rule.kind === 'number') {
        rule.ranges[rarity][key] = value;
        return;
      }
      if (rule.kind === 'add-effect' && addField) {
        const ranges = rule.settings[addField];
        if (ranges) ranges[rarity][key] = value;
      }
    });
  };

  const toggleOptionValue = (type: UpgradeEffectType, value: string, checked: boolean) => {
    patchConfig((next) => {
      const rule = next.parameters[type];
      if (rule.kind !== 'option') return;
      rule.values = checked
        ? Array.from(new Set([...rule.values, value]))
        : rule.values.filter((item) => item !== value);
    });
  };

  const toggleAddTarget = (type: UpgradeAddEffectType, value: AbilityTargetType, checked: boolean) => {
    patchConfig((next) => {
      const rule = next.parameters[type];
      if (rule.kind !== 'add-effect') return;
      rule.settings.targetTypes = checked
        ? Array.from(new Set([...rule.settings.targetTypes, value]))
        : rule.settings.targetTypes.filter((item) => item !== value);
    });
  };

  const toggleAddSource = (type: UpgradeAddEffectType, value: string, checked: boolean) => {
    patchConfig((next) => {
      const rule = next.parameters[type];
      if (rule.kind !== 'add-effect') return;
      const current = rule.settings.damageSourceIds ?? [];
      rule.settings.damageSourceIds = checked
        ? Array.from(new Set([...current, value]))
        : current.filter((item) => item !== value);
    });
  };

  const renderRangeTable = (
    type: UpgradeEffectType,
    getRange: (rarity: UpgradeRarity) => UpgradeNumberRange,
    addField?: AddRangeKey,
  ) => (
    <div className={styles.rangeBlock}>
      <strong className={styles.rangeTitle}>Диапазоны генерации по редкости — MIN / MAX / STEP</strong>
      <div className={styles.rangeTable}>
        <div className={styles.rangeHead}>Редкость</div>
        <div className={styles.rangeHead}>MIN</div>
        <div className={styles.rangeHead}>MAX</div>
        <div className={styles.rangeHead}>STEP</div>
        {RARITIES.map((rarity) => {
          const range = getRange(rarity);
          return (
            <div className={styles.rangeRow} key={`${type}:${addField ?? 'value'}:${rarity}`}>
              <strong>{RARITY_LABELS[rarity]}</strong>
              <EditorInput
                type="number"
                step="any"
                value={range.min}
                onChange={(event) => setRangeValue(type, rarity, 'min', numericValue(event.target.value), addField)}
              />
              <EditorInput
                type="number"
                step="any"
                value={range.max}
                onChange={(event) => setRangeValue(type, rarity, 'max', numericValue(event.target.value), addField)}
              />
              <EditorInput
                type="number"
                min="0.000001"
                step="any"
                value={range.step}
                onChange={(event) => setRangeValue(type, rarity, 'step', Math.max(0.000001, numericValue(event.target.value, 1)), addField)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderOptionRule = (type: UpgradeEffectType) => {
    const rule = config.parameters[type];
    if (rule.kind !== 'option') return null;
    const option = getUpgradeEffectOption(type);

    if (option?.valueKind === 'damage-source') {
      return (
        <div className={styles.optionGrid}>
          {damageSources.map((source) => (
            <label className={styles.checkLine} key={source.id}>
              <EditorCheckbox checked={rule.values.includes(source.id)} onChange={(event) => toggleOptionValue(type, source.id, event.target.checked)} />
              <span>{source.name} <small>{source.id}</small></span>
            </label>
          ))}
        </div>
      );
    }

    if (option?.valueKind === 'target-type') {
      return (
        <div className={styles.optionGrid}>
          {getAllowedTargets(option.abilityEffectType).map((target) => (
            <label className={styles.checkLine} key={target}>
              <EditorCheckbox checked={rule.values.includes(target)} onChange={(event) => toggleOptionValue(type, target, event.target.checked)} />
              <span>{TARGET_LABELS[target]}</span>
            </label>
          ))}
        </div>
      );
    }

    return (
      <label className={styles.field}>
        <span>Допустимые цвета через запятую</span>
        <EditorInput
          value={rule.values.join(', ')}
          onChange={(event) => patchConfig((next) => {
            const current = next.parameters[type];
            if (current.kind === 'option') current.values = event.target.value.split(',').map((item) => item.trim()).filter(Boolean);
          })}
        />
      </label>
    );
  };

  const renderAddRule = (type: UpgradeAddEffectType, rule: UpgradeAddEffectGenerationRule) => {
    const option = getUpgradeEffectOption(type);
    if (!option) return null;
    return (
      <div className={styles.addRule}>
        <div>
          <h4>Допустимые цели</h4>
          <div className={styles.optionGrid}>
            {getAllowedTargets(option.abilityEffectType).map((target) => (
              <label className={styles.checkLine} key={target}>
                <EditorCheckbox checked={rule.settings.targetTypes.includes(target)} onChange={(event) => toggleAddTarget(type, target, event.target.checked)} />
                <span>{TARGET_LABELS[target]}</span>
              </label>
            ))}
          </div>
        </div>

        {type === 'ability-add-damage' && (
          <div>
            <h4>Источники урона</h4>
            <div className={styles.optionGrid}>
              {damageSources.map((source) => (
                <label className={styles.checkLine} key={source.id}>
                  <EditorCheckbox checked={(rule.settings.damageSourceIds ?? []).includes(source.id)} onChange={(event) => toggleAddSource(type, source.id, event.target.checked)} />
                  <span>{source.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {type === 'ability-add-periodic-damage' && (
          <label className={styles.field}>
            <span>Допустимые цвета через запятую</span>
            <EditorInput
              value={(rule.settings.visualColors ?? []).join(', ')}
              onChange={(event) => patchConfig((next) => {
                const current = next.parameters[type];
                if (current.kind === 'add-effect') current.settings.visualColors = event.target.value.split(',').map((item) => item.trim()).filter(Boolean);
              })}
            />
          </label>
        )}

        {ADD_RANGE_FIELDS[type].map((field) => {
          const ranges = rule.settings[field];
          if (!ranges) return null;
          return (
            <section className={styles.subRange} key={field}>
              <h4>{ADD_RANGE_LABELS[field]}</h4>
              {renderRangeTable(type, (rarity) => ranges[rarity], field)}
            </section>
          );
        })}
      </div>
    );
  };

  const createPreview = () => {
    setPreview(generateUpgradeChoices(
      config,
      abilities,
      damageSources,
      {},
      config.previewCardCount,
      Number.MAX_SAFE_INTEGER,
    ));
  };

  const renderManualCards = () => (
    <>
      <section className={styles.hero}>
        <span className={styles.kicker}>Ручные карточки</span>
        <h1>Карточки улучшений</h1>
        <p>Создавайте карточки вручную. В одной карточке можно добавить несколько параметров/эффектов.</p>
      </section>

      <section className={styles.manualLayout}>
        <aside className={styles.cardListPanel}>
          <div className={styles.cardListHeader}>
            <div><strong>Карточки</strong><small>Всего: {cards.length}</small></div>
            <button className={styles.primaryButton} type="button" onClick={openCreate}>+ Создать</button>
          </div>
          <div className={styles.cardList}>
            {sortedCards.length === 0 && <p className={styles.emptyPreview}>Ручных карточек пока нет.</p>}
            {sortedCards.map((card) => (
              <button
                className={`${styles.cardListItem} ${selectedId === card.id ? styles.cardListItemActive : ''}`}
                type="button"
                key={card.id}
                onClick={() => selectCard(card)}
              >
                <strong>{card.name || card.id}</strong>
                <span>{RARITY_LABELS[card.rarity]} · параметров: {card.effects.length}</span>
                <small>{card.id}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className={styles.formSection}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>{isCreating ? 'Новая карточка' : 'Редактирование карточки'}</h2>
              <p>Ручные карточки сохраняются отдельно от правил автоматической генерации.</p>
            </div>
            <span className={styles.counter}>Шанс по весу: {calculateUpgradeCardChancePercent(draft, cards, editingId).toFixed(1)}%</span>
          </div>

          <div className={styles.manualFormGrid}>
            <label className={styles.field}>
              <span>ID</span>
              <EditorInput value={draft.id} onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))} />
              {validation.errors.id && <small className={styles.fieldError}>{validation.errors.id}</small>}
            </label>
            <label className={styles.field}>
              <span>Название</span>
              <EditorInput value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
              {validation.errors.name && <small className={styles.fieldError}>{validation.errors.name}</small>}
            </label>
            <label className={styles.field}>
              <span>Редкость</span>
              <EditorSelect value={draft.rarity} onChange={(event) => setDraft((current) => ({ ...current, rarity: event.target.value as UpgradeRarity }))}>
                {RARITIES.map((rarity) => <option key={rarity} value={rarity}>{RARITY_LABELS[rarity]}</option>)}
              </EditorSelect>
            </label>
            <label className={styles.field}>
              <span>Вес</span>
              <EditorInput type="number" min="0.000001" step="any" value={draft.weight} onChange={(event) => setDraft((current) => ({ ...current, weight: numericValue(event.target.value) }))} />
              {validation.errors.weight && <small className={styles.fieldError}>{validation.errors.weight}</small>}
            </label>
            <label className={styles.field}>
              <span>Цвет карточки</span>
              <EditorColorInput value={draft.color ?? '#64748b'} onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))} />
              {validation.errors.color && <small className={styles.fieldError}>{validation.errors.color}</small>}
            </label>
            <label className={styles.field}>
              <span>Изображение</span>
              <span className={styles.fileButton}>Выбрать файл<EditorFileInput accept="image/*" mode="overlay" onChange={handleCardImageUpload} /></span>
              {draft.image && <small>{draft.image.name}</small>}
            </label>
            <label className={`${styles.field} ${styles.fullWidth}`}>
              <span>Описание</span>
              <EditorTextarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
            </label>
          </div>

          <div className={styles.effectsHeader}>
            <div><h3>Параметры карточки</h3><p>Можно добавить один или несколько параметров.</p></div>
            <button className={styles.toolbarButton} type="button" onClick={addManualEffect}>+ Добавить параметр</button>
          </div>
          {validation.errors.effects && <p className={styles.fieldError}>{validation.errors.effects}</p>}

          <div className={styles.manualEffects}>
            {draft.effects.map((effect, index) => {
              const ability = abilities.find((item) => item.id === effect.abilityId);
              const compatibleTypes = getCompatibleUpgradeEffectTypes(ability);
              const effectOption = getUpgradeEffectOption(effect.type);
              return (
                <article className={styles.manualEffectCard} key={`${index}:${effect.type}:${effect.abilityId}`}>
                  <div className={styles.effectTopline}>
                    <strong>Параметр {index + 1}</strong>
                    <button className={styles.dangerButton} type="button" onClick={() => removeManualEffect(index)}>Удалить</button>
                  </div>
                  <div className={styles.manualFormGrid}>
                    <label className={styles.field}>
                      <span>Способность</span>
                      <EditorSelect value={effect.abilityId} onChange={(event) => changeEffectAbility(index, event.target.value)}>
                        <option value="">Выберите способность</option>
                        {abilities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </EditorSelect>
                      {validation.errors[`effect.${index}.abilityId`] && <small className={styles.fieldError}>{validation.errors[`effect.${index}.abilityId`]}</small>}
                    </label>
                    <label className={styles.field}>
                      <span>Параметр</span>
                      <EditorSelect value={effect.type} onChange={(event) => changeEffectType(index, event.target.value as UpgradeEffectType)}>
                        {compatibleTypes.map((type) => <option key={type} value={type}>{getUpgradeEffectOption(type)?.label ?? type}</option>)}
                      </EditorSelect>
                      {validation.errors[`effect.${index}.type`] && <small className={styles.fieldError}>{validation.errors[`effect.${index}.type`]}</small>}
                    </label>
                  </div>
                  {effectOption && renderManualEffectValue(effect, index)}
                  {validation.errors[`effect.${index}.value`] && <small className={styles.fieldError}>{validation.errors[`effect.${index}.value`]}</small>}
                  {validation.errors[`effect.${index}.visualColor`] && <small className={styles.fieldError}>{validation.errors[`effect.${index}.visualColor`]}</small>}
                </article>
              );
            })}
          </div>

          <div className={styles.formActions}>
            <button className={styles.primaryButton} type="button" disabled={!validation.valid} onClick={saveManualCard}>Сохранить карточку</button>
            {isCreating ? (
              <button className={styles.toolbarButton} type="button" onClick={cancelCreate}>Отмена</button>
            ) : (
              <button className={styles.dangerButton} type="button" onClick={removeManualCard}>Удалить карточку</button>
            )}
          </div>
        </section>
      </section>
    </>
  );

  const renderGenerator = () => (
    <>
      <section className={styles.hero}>
        <span className={styles.kicker}>Генератор</span>
        <h1>Правила генерации карточек</h1>
        <p>
          Карточки создаются автоматически только из параметров, которые одновременно включены здесь
          и разрешены у конкретной способности в «Параметрах карточек улучшений».
        </p>
      </section>

      <section className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <div><h2>Общие настройки</h2><p>Настройки применяются ко всем автоматически создаваемым карточкам.</p></div>
          <span className={styles.counter}>Активных параметров: {enabledParameterCount}</span>
        </div>

        <div className={styles.settingsGrid}>
          <label className={styles.toggleCard}>
            <EditorCheckbox checked={config.enabled} onChange={(event) => patchConfig((next) => { next.enabled = event.target.checked; })} />
            <span><strong>Автоматическая генерация</strong><small>Если выключено, ручные карточки всё равно продолжают работать.</small></span>
          </label>
          <label className={styles.toggleCard}>
            <EditorCheckbox checked={config.allowDuplicateParameters} onChange={(event) => patchConfig((next) => { next.allowDuplicateParameters = event.target.checked; })} />
            <span><strong>Повтор одинакового параметра</strong><small>Разрешить один тип параметра в разных карточках одного выбора.</small></span>
          </label>
          <label className={styles.toggleCard}>
            <EditorCheckbox checked={config.allowSameAbility} onChange={(event) => patchConfig((next) => { next.allowSameAbility = event.target.checked; })} />
            <span><strong>Несколько карточек одной способности</strong><small>Разрешить несколько вариантов одной способности за генерацию.</small></span>
          </label>
          <label className={styles.field}>
            <span>Количество карточек в предпросмотре</span>
            <EditorInput type="number" min="1" max="50" value={config.previewCardCount} onChange={(event) => patchConfig((next) => { next.previewCardCount = Math.min(50, Math.max(1, Math.floor(numericValue(event.target.value, 1)))); })} />
          </label>
          <div className={styles.parameterCountCard}>
            <div><strong>Количество параметров в одной карточке</strong><small>Генератор выберет случайное количество от MIN до MAX. Все параметры одной карточки относятся к одной способности.</small></div>
            <label className={styles.field}>
              <span>MIN</span>
              <EditorInput type="number" min="1" max="10" step="1" value={config.minParametersPerCard} onChange={(event) => patchConfig((next) => {
                const value = Math.min(10, Math.max(1, Math.floor(numericValue(event.target.value, 1))));
                next.minParametersPerCard = value;
                if (next.maxParametersPerCard < value) next.maxParametersPerCard = value;
              })} />
            </label>
            <label className={styles.field}>
              <span>MAX</span>
              <EditorInput type="number" min={config.minParametersPerCard} max="10" step="1" value={config.maxParametersPerCard} onChange={(event) => patchConfig((next) => {
                next.maxParametersPerCard = Math.min(10, Math.max(next.minParametersPerCard, Math.floor(numericValue(event.target.value, next.minParametersPerCard))));
              })} />
            </label>
          </div>
        </div>
      </section>

      <section className={styles.formSection}>
        <div className={styles.sectionHeader}><div><h2>Шансы редкости</h2><p>Редкость выбирается по весам. Рядом показан расчётный процент.</p></div></div>
        <div className={styles.rarityGrid}>
          {RARITIES.map((rarity) => (
            <label className={styles.rarityCard} key={rarity}>
              <span>{RARITY_LABELS[rarity]}</span>
              <EditorInput type="number" min="0" step="1" value={config.rarityWeights[rarity]} onChange={(event) => patchConfig((next) => { next.rarityWeights[rarity] = Math.max(0, numericValue(event.target.value)); })} />
              <small>≈ {rarityChance(config, rarity).toFixed(1)}%</small>
            </label>
          ))}
        </div>
      </section>

      <section className={styles.rangeNotice}>
        <strong>Где задаются MIN / MAX / STEP?</strong>
        <span>Откройте нужный параметр ниже. Для каждого числового параметра внутри есть отдельная таблица диапазонов по каждой редкости.</span>
      </section>

      {PARAMETER_GROUPS.map((group) => {
        const options = UPGRADE_EFFECT_OPTIONS.filter((option) => group.match(option.type));
        if (options.length === 0) return null;
        return (
          <section className={styles.formSection} key={group.label}>
            <div className={styles.sectionHeader}><div><h2>{group.label}</h2><p>Включите параметры и настройте их вес и допустимые значения.</p></div></div>
            <div className={styles.parameters}>
              {options.map((option) => {
                const rule = config.parameters[option.type];
                return (
                  <details className={styles.parameterCard} key={option.type}>
                    <summary>
                      <span className={styles.parameterToggle} onClick={(event) => event.stopPropagation()}>
                        <EditorCheckbox checked={rule.enabled} onChange={(event) => patchConfig((next) => { next.parameters[option.type].enabled = event.target.checked; })} />
                      </span>
                      <span className={styles.parameterTitle}>
                        <strong>{option.label}</strong>
                        <small>{option.type}</small>
                        {(rule.kind === 'number' || rule.kind === 'add-effect') && <em>Настройка MIN / MAX / STEP внутри</em>}
                      </span>
                      <label className={styles.weightField} onClick={(event) => event.stopPropagation()}>
                        <span>Вес</span>
                        <EditorInput type="number" min="0" value={rule.weight} onChange={(event) => patchConfig((next) => { next.parameters[option.type].weight = Math.max(0, numericValue(event.target.value)); })} />
                      </label>
                    </summary>
                    <div className={styles.parameterBody}>
                      {rule.kind === 'number' && renderRangeTable(option.type, (rarity) => rule.ranges[rarity])}
                      {rule.kind === 'option' && renderOptionRule(option.type)}
                      {rule.kind === 'add-effect' && renderAddRule(option.type as UpgradeAddEffectType, rule)}
                    </div>
                  </details>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <div><h2>Предпросмотр генерации</h2><p>Пример карточек по текущим настройкам. Предпросмотр ничего не сохраняет в игровой прогресс.</p></div>
          <button className={styles.primaryButton} type="button" onClick={createPreview}>Сгенерировать {config.previewCardCount}</button>
        </div>
        {preview.length === 0 ? (
          <p className={styles.emptyPreview}>Нажмите кнопку генерации. Если список останется пустым, проверьте включённые параметры, диапазоны и разрешения способностей.</p>
        ) : (
          <div className={styles.previewGrid}>
            {preview.map((card) => (
              <article className={styles.previewCard} key={card.id} style={{ borderColor: card.color ?? undefined }}>
                <small>{RARITY_LABELS[card.rarity]} · параметров: {card.effects.length}</small>
                <strong>{card.name}</strong>
                {card.effects.map((effect, index) => <span key={`${effect.type}:${index}`}>{formatPreviewEffect(effect)}</span>)}
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );

  return (
    <main className={styles.screen}>
      <header className={styles.topbar}>
        <button className={styles.toolbarButton} type="button" onClick={onBackToMain}>Главное меню</button>
        <button className={styles.toolbarButton} type="button" onClick={onBackToEditors}>Редакторы</button>
        <strong>Редактор карточек улучшений</strong>
      </header>

      <div className={styles.content}>
        <nav className={styles.tabs}>
          <button className={activeTab === 'cards' ? styles.tabActive : styles.tab} type="button" onClick={() => setActiveTab('cards')}>Карточки вручную ({cards.length})</button>
          <button className={activeTab === 'generator' ? styles.tabActive : styles.tab} type="button" onClick={() => setActiveTab('generator')}>Правила генерации</button>
        </nav>
        {activeTab === 'cards' ? renderManualCards() : renderGenerator()}
      </div>
    </main>
  );
}
