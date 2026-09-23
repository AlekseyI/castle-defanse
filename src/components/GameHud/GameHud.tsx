import { useMemo, type CSSProperties } from 'react';
import { loadAbilities } from '../../editor/abilities/abilityStorage';
import type { AbilityDefinition } from '../../editor/abilities/types';
import type { TileKind } from '../../game/types';
import { useGameStore } from '../../store/gameStore';
import styles from './GameHud.module.css';

interface GameHudProps {
  coveredByResult: boolean;
  onCast: (kind: TileKind) => void;
}

const LEGACY_GLYPHS: Record<string, string> = {
  fire: '🔥',
  ice: '❄',
  lightning: '⚡',
  shield: '✚',
};

function getAbilityGlyph(ability: AbilityDefinition): string {
  return LEGACY_GLYPHS[ability.id] ?? (ability.name.slice(0, 1).toUpperCase() || '•');
}

function getAbilityColor(ability: AbilityDefinition): string {
  return /^#[0-9a-fA-F]{6}$/.test(ability.color) ? ability.color : '#64748b';
}

export function GameHud({ coveredByResult, onCast }: GameHudProps) {
  const wave = useGameStore((state) => state.wave);
  const totalWaves = useGameStore((state) => state.totalWaves);
  const castleHp = useGameStore((state) => state.castleHp);
  const castleMaxHp = useGameStore((state) => state.castleMaxHp);
  const coins = useGameStore((state) => state.coins);
  const charges = useGameStore((state) => state.charges);
  const abilities = useMemo(() => loadAbilities(), []);

  const rootClassName = coveredByResult ? `${styles.root} ${styles.covered}` : styles.root;

  return (
    <div className={rootClassName}>
      <header className={styles.header}>
        <div className={styles.wave}>Волна {wave}{totalWaves > 0 ? `/${totalWaves}` : ' ∞'}</div>
        <div className={styles.castle}>Замок {castleHp}/{castleMaxHp}</div>
        <div className={styles.coins}>🪙 {coins}</div>
      </header>

      <div className={styles.skills}>
        {abilities.map((ability) => {
          const color = getAbilityColor(ability);
          const style: CSSProperties = { borderColor: color, backgroundColor: `${color}33` };

          return (
            <button
              key={ability.id}
              className={styles.skillButton}
              style={style}
              type="button"
              aria-label={ability.name}
              onClick={() => onCast(ability.id)}
            >
              <span className={styles.skillIcon} aria-hidden="true">
                {ability.image?.src ? <img src={ability.image.src} alt="" /> : getAbilityGlyph(ability)}
              </span>
              <span className={styles.skillCount}>×{charges[ability.id] ?? 0}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
