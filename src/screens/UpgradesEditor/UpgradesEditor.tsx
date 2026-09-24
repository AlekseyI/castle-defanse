import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { loadAbilities } from '../../editor/abilities/abilityStorage';
import {
  cloneUpgradeCard,
  createEmptyUpgradeCard,
  createEmptyUpgradeEffect,
  deleteUpgradeCard,
  getCompatibleUpgradeEffectTypes,
  getUpgradeEffectOption,
  normalizeUpgradeCard,
  saveUpgradeCard,
  validateUpgradeCard,
} from '../../editor/upgrades/upgradeLogic';
import { loadUpgrades, persistUpgrades } from '../../editor/upgrades/upgradeStorage';
import type { UpgradeCardDefinition, UpgradeEffectType, UpgradeRarity } from '../../editor/upgrades/types';
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

export function UpgradesEditor({ onBackToMain, onBackToEditors }: Props) {
  const [abilities] = useState(() => loadAbilities());
  const [cards, setCards] = useState<UpgradeCardDefinition[]>(() => loadUpgrades());
  const [selectedId, setSelectedId] = useState<string | null>(() => cards[0]?.id ?? null);
  const [editingId, setEditingId] = useState<string | undefined>(() => cards[0]?.id);
  const [draft, setDraft] = useState<UpgradeCardDefinition>(() => cloneUpgradeCard(cards[0] ?? createEmptyUpgradeCard(abilities)));
  const [isCreating, setIsCreating] = useState(cards.length === 0);

  const sortedCards = useMemo(
    () => [...cards].sort((a, b) => a.name.localeCompare(b.name, 'ru') || a.id.localeCompare(b.id)),
    [cards],
  );
  const selectedCard = cards.find((card) => card.id === selectedId) ?? null;
  const validation = useMemo(
    () => validateUpgradeCard(draft, cards, abilities, editingId),
    [abilities, cards, draft, editingId],
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
    setDraft(cloneUpgradeCard(card));
    setIsCreating(false);
  };

  const openCreate = () => {
    setSelectedId(null);
    setEditingId(undefined);
    setDraft(createEmptyUpgradeCard(abilities));
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
    setDraft(cloneUpgradeCard(next ?? createEmptyUpgradeCard(abilities)));
    setIsCreating(next === null);
  };

  const updateEffect = (index: number, patch: Partial<UpgradeCardDefinition['effects'][number]>) => {
    setDraft((current) => ({
      ...current,
      effects: current.effects.map((effect, effectIndex) => (
        effectIndex === index ? { ...effect, ...patch } : effect
      )),
    }));
  };

  const handleAbilityChange = (index: number, abilityId: string) => {
    const ability = abilities.find((item) => item.id === abilityId);
    const compatible = getCompatibleUpgradeEffectTypes(ability);
    const currentType = draft.effects[index]?.type;
    updateEffect(index, {
      abilityId,
      type: compatible.includes(currentType) ? currentType : (compatible[0] ?? 'ability-damage-percent'),
    });
  };

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    const src = await readFileAsDataUrl(file);
    setDraft((current) => ({ ...current, image: { name: file.name, src } }));
  };

  return (
    <main className={styles.screen}>
      <header className={styles.topbar}>
        <button className={styles.toolbarButton} type="button" onClick={onBackToMain}>Главное меню</button>
        <strong>Редактор карточек улучшений</strong>
        <button className={styles.toolbarButton} type="button" onClick={onBackToEditors}>Все редакторы</button>
      </header>

      <div className={styles.layout}>
        <aside className={styles.listPanel}>
          <div className={styles.listHeader}>
            <div><h2>Карточки</h2><p>{cards.length} в проекте</p></div>
            <button className={styles.addButton} type="button" onClick={openCreate}>+</button>
          </div>
          <div className={styles.list}>
            {sortedCards.map((card) => (
              <button key={card.id} className={`${styles.listItem}${card.id === selectedId && !isCreating ? ` ${styles.active}` : ''}`} type="button" onClick={() => selectCard(card)}>
                <span className={styles.listIcon} style={{ backgroundColor: card.color || '#334155' }}>
                  {card.image?.src ? <img src={card.image.src} alt="" /> : card.name.slice(0, 1).toUpperCase() || '•'}
                </span>
                <span className={styles.listItemText}><strong>{card.name}</strong><small>{card.id}</small></span>
              </button>
            ))}
          </div>
        </aside>

        <section className={styles.formPanel}>
          <div className={styles.formHeader}>
            <div>
              <span className={styles.kicker}>Карточка улучшения</span>
              <h1>{isCreating ? 'Новая карточка' : draft.name || 'Без названия'}</h1>
            </div>
            <div className={styles.headerActions}>
              <label className={styles.toolbarButton}>Картинка<input hidden type="file" accept="image/*,.svg" onChange={handleImageUpload} /></label>
              {draft.image && <button className={styles.toolbarButton} type="button" onClick={() => setDraft((current) => ({ ...current, image: undefined }))}>Убрать картинку</button>}
              {!isCreating && <button className={styles.dangerButton} type="button" onClick={remove}>Удалить</button>}
            </div>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.field}><span>ID</span><input value={draft.id} onChange={(e) => setDraft((c) => ({ ...c, id: e.target.value }))} />{validation.errors.id && <small>{validation.errors.id}</small>}</label>
            <label className={styles.field}><span>Название</span><input value={draft.name} onChange={(e) => setDraft((c) => ({ ...c, name: e.target.value }))} />{validation.errors.name && <small>{validation.errors.name}</small>}</label>
            <label className={styles.field}><span>Редкость</span><select value={draft.rarity} onChange={(e) => setDraft((c) => ({ ...c, rarity: e.target.value as UpgradeRarity }))}>{Object.entries(RARITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className={styles.field}><span>Вес выпадения</span><input type="number" min="0.01" step="1" value={Number.isFinite(draft.weight) ? draft.weight : ''} onChange={(e) => setDraft((c) => ({ ...c, weight: numberValue(e.target.value) }))} />{validation.errors.weight && <small>{validation.errors.weight}</small>}</label>
            <label className={styles.field}><span>maxCount</span><input type="number" min="1" step="1" value={Number.isFinite(draft.maxCount) ? draft.maxCount : ''} onChange={(e) => setDraft((c) => ({ ...c, maxCount: numberValue(e.target.value) }))} />{validation.errors.maxCount && <small>{validation.errors.maxCount}</small>}</label>
            <label className={styles.field}><span>Цвет</span><input type="color" value={draft.color || '#64748b'} onChange={(e) => setDraft((c) => ({ ...c, color: e.target.value }))} /></label>
            <label className={`${styles.field} ${styles.full}`}><span>Описание</span><textarea rows={3} value={draft.description} onChange={(e) => setDraft((c) => ({ ...c, description: e.target.value }))} /></label>
          </div>

          <div className={styles.effectsHeader}><h2>Эффекты</h2><button className={styles.toolbarButton} type="button" onClick={() => setDraft((c) => ({ ...c, effects: [...c.effects, createEmptyUpgradeEffect(abilities)] }))}>+ Добавить эффект</button></div>
          {validation.errors.effects && <small className={styles.error}>{validation.errors.effects}</small>}
          <div className={styles.effects}>
            {draft.effects.map((effect, index) => {
              const ability = abilities.find((item) => item.id === effect.abilityId);
              const compatible = getCompatibleUpgradeEffectTypes(ability);
              return (
                <div className={styles.effectCard} key={index}>
                  <label className={styles.field}><span>Способность</span><select value={effect.abilityId} onChange={(e) => handleAbilityChange(index, e.target.value)}><option value="">—</option>{abilities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{validation.errors[`effect.${index}.abilityId`] && <small>{validation.errors[`effect.${index}.abilityId`]}</small>}</label>
                  <label className={styles.field}><span>Параметр</span><select value={effect.type} onChange={(e) => updateEffect(index, { type: e.target.value as UpgradeEffectType })}>{compatible.map((type) => <option key={type} value={type}>{getUpgradeEffectOption(type)?.label}</option>)}</select>{validation.errors[`effect.${index}.type`] && <small>{validation.errors[`effect.${index}.type`]}</small>}</label>
                  <label className={styles.field}><span>Значение</span><input type="number" step="1" value={Number.isFinite(effect.value) ? effect.value : ''} onChange={(e) => updateEffect(index, { value: numberValue(e.target.value) })} />{validation.errors[`effect.${index}.value`] && <small>{validation.errors[`effect.${index}.value`]}</small>}</label>
                  <button className={styles.removeButton} type="button" onClick={() => setDraft((c) => ({ ...c, effects: c.effects.filter((_, i) => i !== index) }))}>Удалить</button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
