import type { CSSProperties } from 'react';
import { TILE_KINDS, TILE_META } from '../../game/config';
import type { TileKind } from '../../game/types';
import { useGameStore } from '../../store/gameStore';
import styles from './GameHud.module.css';

interface GameHudProps {
  coveredByResult: boolean;
  onCast: (kind: TileKind) => void;
}

export function GameHud({ coveredByResult, onCast }: GameHudProps) {
  const wave = useGameStore((state) => state.wave);
  const totalWaves = useGameStore((state) => state.totalWaves);
  const castleHp = useGameStore((state) => state.castleHp);
  const castleMaxHp = useGameStore((state) => state.castleMaxHp);
  const coins = useGameStore((state) => state.coins);
  const charges = useGameStore((state) => state.charges);

  const rootClassName = coveredByResult ? `${styles.root} ${styles.covered}` : styles.root;

  return (
    <div className={rootClassName}>
      <header className={styles.header}>
        <div className={styles.wave}>Волна {wave}/{totalWaves}</div>
        <div className={styles.castle}>Замок {castleHp}/{castleMaxHp}</div>
        <div className={styles.coins}>🪙 {coins}</div>
      </header>

      <div className={styles.skills}>
        {TILE_KINDS.map((kind) => {
          const meta = TILE_META[kind];
          const color = `#${meta.color.toString(16).padStart(6, '0')}`;
          const style: CSSProperties = { borderColor: color, backgroundColor: `${color}33` };

          return (
            <button
              key={kind}
              className={styles.skillButton}
              style={style}
              type="button"
              aria-label={meta.label}
              onClick={() => onCast(kind)}
            >
              <span className={styles.skillIcon} aria-hidden="true">{meta.glyph}</span>
              <span className={styles.skillCount}>×{charges[kind]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
