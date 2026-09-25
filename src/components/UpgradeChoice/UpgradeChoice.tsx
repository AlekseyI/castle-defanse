import { useMemo } from 'react';
import { loadAbilities } from '../../editor/abilities/abilityStorage';
import { getUpgradeEffectOption } from '../../editor/upgrades/upgradeLogic';
import type { UpgradeEffect } from '../../editor/upgrades/types';
import { useGameStore } from '../../store/gameStore';
import styles from './UpgradeChoice.module.css';

interface UpgradeChoiceProps {
  onSelect: (cardId: string) => void;
  onRefresh: () => void;
  onDismiss: () => void;
}

const TARGET_LABELS: Record<string, string> = {
  'nearest-enemies': 'Ближайшие враги',
  'random-enemies': 'Случайные враги',
  'area-enemies': 'Область по высоте',
  'all-enemies': 'Все враги',
  castle: 'Замок',
};

function formatTarget(target: { type: string; count: number; areaHeightPercent: number }): string {
  const label = TARGET_LABELS[target.type] ?? target.type;
  if (target.type === 'nearest-enemies' || target.type === 'random-enemies') return `${label}, целей: ${target.count}`;
  if (target.type === 'area-enemies') return `${label}, высота: ${target.areaHeightPercent}%`;
  return label;
}

function formatValue(effect: UpgradeEffect): string {
  if (typeof effect.value === 'object') {
    if (!('target' in effect.value)) {
      return formatTarget(effect.value);
    }
    if (effect.type === 'ability-add-damage') {
      return `урон ${effect.value.amount}; источник ${effect.value.damageSourceId || '—'}; крит ${effect.value.criticalChancePercent}% ×${effect.value.criticalMultiplier}; ${formatTarget(effect.value.target)}`;
    }
    if (effect.type === 'ability-add-periodic-damage') {
      return `урон ${effect.value.amount}; шанс ${effect.value.chancePercent}%; ${effect.value.duration} сек.; крит ${effect.value.criticalChancePercent}% ×${effect.value.criticalMultiplier}; цвет ${effect.value.visualColor}; ${formatTarget(effect.value.target)}`;
    }
    if (effect.type === 'ability-add-slow') {
      return `замедление ${effect.value.slowPercent}%; ${effect.value.duration} сек.; ${formatTarget(effect.value.target)}`;
    }
    return `лечение ${effect.value.amount}; ${formatTarget(effect.value.target)}`;
  }

  if (typeof effect.value === 'string') {
    return effect.value;
  }

  const prefix = effect.value >= 0 ? '+' : '';
  if (
    effect.type.endsWith('-critical-chance') ||
    effect.type === 'ability-periodic-chance' ||
    effect.type === 'ability-slow-percent' ||
    effect.type.endsWith('-area-height')
  ) {
    return `${prefix}${effect.value}%`;
  }
  if (effect.type.endsWith('-percent')) return `${prefix}${effect.value}%`;
  if (effect.type.endsWith('-duration-flat')) return `${prefix}${effect.value} сек.`;
  return `${prefix}${effect.value}`;
}

export function UpgradeChoice({ onSelect, onRefresh, onDismiss }: UpgradeChoiceProps) {
  const choices = useGameStore((state) => state.upgradeChoices);
  const counts = useGameStore((state) => state.upgradeCounts);
  const maxCardReceives = useGameStore((state) => state.upgradeMaxCardReceives);
  const abilities = useMemo(() => loadAbilities(), []);
  const abilityNames = useMemo(
    () => new Map(abilities.map((ability) => [ability.id, ability.name])),
    [abilities],
  );

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Выбор улучшения">
      <div className={styles.panel}>
        <header className={styles.header}>
          <span>Награда за волну</span>
          <h2>Выберите улучшение</h2>
          <div className={styles.headerActions}>
            <button
              className={styles.dismissButton}
              type="button"
              onClick={onDismiss}
            >
              Отказаться
            </button>
            <button
              className={styles.refreshButton}
              type="button"
              aria-label="Обновить карточки"
              title="Обновить карточки"
              onClick={onRefresh}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 6v5h-5" />
                <path d="M4 18v-5h5" />
                <path d="M6.1 9A7 7 0 0 1 18.7 6.7L20 11" />
                <path d="M17.9 15A7 7 0 0 1 5.3 17.3L4 13" />
              </svg>
            </button>
          </div>
        </header>

        <div className={styles.cards}>
          {choices.map((card, choiceIndex) => (
            <button
              key={`${card.id}:${choiceIndex}`}
              className={styles.card}
              style={{ borderColor: card.color || '#64748b' }}
              type="button"
              onClick={() => onSelect(card.id)}
            >
              <div className={styles.image} style={{ backgroundColor: card.color || '#334155' }}>
                {card.image?.src ? <img src={card.image.src} alt="" /> : card.name.slice(0, 1).toUpperCase() || '•'}
              </div>
              <div className={styles.cardBody}>
                <small>{card.rarity}</small>
                <strong>{card.name}</strong>
                {card.description && <p>{card.description}</p>}
                <ul>
                  {card.effects.map((effect, index) => (
                    <li key={`${effect.type}:${effect.abilityId}:${index}`}>
                      {abilityNames.get(effect.abilityId) ?? effect.abilityId}: {getUpgradeEffectOption(effect.type)?.label ?? effect.type} {formatValue(effect)}
                    </li>
                  ))}
                </ul>
                <span className={styles.count}>Получено: {counts[card.id] ?? 0} / {maxCardReceives}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
