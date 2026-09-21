import { useGameStore } from '../../store/gameStore';
import styles from './AutoCastToggle.module.css';

interface AutoCastToggleProps {
  coveredByResult: boolean;
}

export function AutoCastToggle({ coveredByResult }: AutoCastToggleProps) {
  const autoCastMatches = useGameStore((state) => state.autoCastMatches);
  const setAutoCastMatches = useGameStore((state) => state.setAutoCastMatches);

  const className = coveredByResult ? `${styles.toggle} ${styles.covered}` : styles.toggle;

  return (
    <label className={className}>
      <input
        className={styles.checkbox}
        type="checkbox"
        checked={autoCastMatches}
        onChange={(event) => setAutoCastMatches(event.currentTarget.checked)}
      />
      <span>Сразу применять навык при совпадении</span>
    </label>
  );
}
