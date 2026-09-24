import { loadAbilities } from '../../editor/abilities/abilityStorage';
import { loadDamageSources } from '../../editor/damageSources/damageSourceStorage';
import { loadUnits } from '../../editor/units/unitStorage';
import { loadMaps } from '../../editor/maps/mapStorage';
import { loadUpgrades } from '../../editor/upgrades/upgradeStorage';
import styles from './EditorsScreen.module.css';

type EditorsScreenProps = {
  onBack: () => void;
  onOpenDamageSources: () => void;
  onOpenAbilities: () => void;
  onOpenUnits: () => void;
  onOpenMaps: () => void;
  onOpenUpgrades: () => void;
};

export function EditorsScreen({ onBack, onOpenDamageSources, onOpenAbilities, onOpenUnits, onOpenMaps, onOpenUpgrades }: EditorsScreenProps) {
  const damageSourcesCount = loadDamageSources().length;
  const abilitiesCount = loadAbilities().length;
  const unitsCount = loadUnits().length;
  const mapsCount = loadMaps().length;
  const upgradesCount = loadUpgrades().length;

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

        <button className={styles.card} type="button" onClick={onOpenAbilities}>
          <span className={styles.cardIcon} aria-hidden="true">✨</span>
          <strong>Редактор способностей</strong>
          <span>Тип эффекта, цвет, изображение, цели и параметры способностей.</span>
          <small>Способностей: {abilitiesCount}</small>
        </button>

        <button className={styles.card} type="button" onClick={onOpenUnits}>
          <span className={styles.cardIcon} aria-hidden="true">👾</span>
          <strong>Редактор юнитов</strong>
          <span>ID, название, изображение, HP, скорость и урон юнитов.</span>
          <small>Юнитов: {unitsCount}</small>
        </button>


        <button className={styles.card} type="button" onClick={onOpenUpgrades}>
          <span className={styles.cardIcon} aria-hidden="true">🃏</span>
          <strong>Редактор карточек улучшений</strong>
          <span>Редкость, вес, лимит получений и набор эффектов способностей.</span>
          <small>Карточек: {upgradesCount}</small>
        </button>

        <button className={styles.card} type="button" onClick={onOpenMaps}>
          <span className={styles.cardIcon} aria-hidden="true">🗺️</span>
          <strong>Редактор карт и волн</strong>
          <span>Background canvas, последовательности спавна и бесконечный режим волн.</span>
          <small>Карт: {mapsCount}</small>
        </button>
      </section>
    </main>
  );
}
