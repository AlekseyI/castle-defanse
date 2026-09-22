import { loadDamageSources } from '../../editor/damageSources/damageSourceStorage';
import { loadUnits } from '../../editor/units/unitStorage';
import styles from './EditorsScreen.module.css';

type EditorsScreenProps = {
  onBack: () => void;
  onOpenDamageSources: () => void;
  onOpenUnits: () => void;
};

export function EditorsScreen({ onBack, onOpenDamageSources, onOpenUnits }: EditorsScreenProps) {
  const damageSourcesCount = loadDamageSources().length;
  const unitsCount = loadUnits().length;

  return (
    <main className={styles.screen}>
      <section className={styles.hero}>
        <div>
          <span className={styles.kicker}>Редакторы</span>
          <h1>Выбор редактора</h1>
          <p>Выберите раздел данных игры, который нужно изменить.</p>
        </div>
        <button className={styles.toolbarButton} type="button" onClick={onBack}>
          Главное меню
        </button>
      </section>

      <section className={styles.cards} aria-label="Список редакторов">
        <button className={styles.card} type="button" onClick={onOpenDamageSources}>
          <span className={styles.cardIcon} aria-hidden="true">🔥</span>
          <strong>Редактор источников урона</strong>
          <span>ID, название, описание, изображение и цвет источников урона.</span>
          <small>Источников: {damageSourcesCount}</small>
        </button>

        <button className={styles.card} type="button" onClick={onOpenUnits}>
          <span className={styles.cardIcon} aria-hidden="true">👾</span>
          <strong>Редактор юнитов</strong>
          <span>ID, название, изображение, HP, скорость и урон юнитов.</span>
          <small>Юнитов: {unitsCount}</small>
        </button>
      </section>
    </main>
  );
}
