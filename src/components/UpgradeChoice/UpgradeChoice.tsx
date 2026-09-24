import { useMemo } from 'react';
import { loadAbilities } from '../../editor/abilities/abilityStorage';
import { getUpgradeEffectOption } from '../../editor/upgrades/upgradeLogic';
import type { UpgradeEffect } from '../../editor/upgrades/types';
import { useGameStore } from '../../store/gameStore';
import styles from './UpgradeChoice.module.css';

interface UpgradeChoiceProps {
  onSelect: (cardId: string) => void;
}

const TARGET_LABELS: Record<string, string> = {
  'nearest-enemies': 'Ближайшие враги',
  'random-enemies': 'Случайные враги',
  'area-enemies': 'Область по высоте',
  'all-enemies': 'Все враги',
  castle: 'Замок',
};

function formatValue(effect: UpgradeEffect): string {
  if (typeof effect.value === 'string') {
    if (effect.type.endsWith('-target-type')) return TARGET_LABELS[effect.value] ?? effect.value;
    return effect.value;
  }

  const prefix = effect.value >= 0 ? '+' : '';
  if (
    effect.type.endsWith('-critical-chance') ||
    effect.type === 'ability-periodic-chance' ||
    effect.type === 'ability-slow-percent' ||
    effect.type.endsWith('-area-height')
  ) {
    return `${prefix}${effect.value} процентных пунктов`;
  }
  if (effect.type.endsWith('-percent')) return `${prefix}${effect.value}%`;
  if (effect.type.endsWith('-duration-flat')) return `${prefix}${effect.value} сек.`;
  return `${prefix}${effect.value}`;
}

export function UpgradeChoice({ onSelect }: UpgradeChoiceProps) {
  const choices = useGameStore((state) => state.upgradeChoices);
  const counts = useGameStore((state) => state.upgradeCounts);
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
                <span className={styles.count}>Получено: {counts[card.id] ?? 0} / {card.maxCount}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
