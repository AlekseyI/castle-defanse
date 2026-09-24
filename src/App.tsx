import { useState } from 'react';
import { AbilitiesEditor } from './screens/AbilitiesEditor/AbilitiesEditor';
import { DamageSourcesEditor } from './screens/DamageSourcesEditor/DamageSourcesEditor';
import { EditorsScreen } from './screens/EditorsScreen/EditorsScreen';
import { GameScreen } from './screens/GameScreen/GameScreen';
import { MapsEditor } from './screens/MapsEditor/MapsEditor';
import { UnitsEditor } from './screens/UnitsEditor/UnitsEditor';
import { UpgradesEditor } from './screens/UpgradesEditor/UpgradesEditor';
import styles from './App.module.css';

type AppScreen = 'main' | 'game' | 'editors' | 'damage-sources' | 'abilities' | 'units' | 'maps' | 'upgrades';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('main');

  if (screen === 'game') {
    return (
      <div className={styles.gameShell}>
        <GameScreen />
        <button className={styles.gameMenuButton} type="button" onClick={() => setScreen('main')}>
          Главное меню
        </button>
      </div>
    );
  }

  if (screen === 'editors') {
    return (
      <EditorsScreen
        onBack={() => setScreen('main')}
        onOpenDamageSources={() => setScreen('damage-sources')}
        onOpenAbilities={() => setScreen('abilities')}
        onOpenUnits={() => setScreen('units')}
        onOpenMaps={() => setScreen('maps')}
        onOpenUpgrades={() => setScreen('upgrades')}
      />
    );
  }

  if (screen === 'damage-sources') {
    return (
      <DamageSourcesEditor
        onBackToMain={() => setScreen('main')}
        onBackToEditors={() => setScreen('editors')}
      />
    );
  }

  if (screen === 'abilities') {
    return (
      <AbilitiesEditor
        onBackToMain={() => setScreen('main')}
        onBackToEditors={() => setScreen('editors')}
      />
    );
  }

  if (screen === 'units') {
    return (
      <UnitsEditor
        onBackToMain={() => setScreen('main')}
        onBackToEditors={() => setScreen('editors')}
      />
    );
  }

  if (screen === 'upgrades') {
    return (
      <UpgradesEditor
        onBackToMain={() => setScreen('main')}
        onBackToEditors={() => setScreen('editors')}
      />
    );
  }

  if (screen === 'maps') {
    return (
      <MapsEditor
        onBackToMain={() => setScreen('main')}
        onBackToEditors={() => setScreen('editors')}
      />
    );
  }

  return (
    <main className={styles.startScreen}>
      <section className={styles.startPanel}>
        <span className={styles.startKicker}>MATCH DEFENSE</span>
        <h1>Игра</h1>
        <div className={styles.startActions}>
          <button className={styles.primaryButton} type="button" onClick={() => setScreen('game')}>
            Играть
          </button>
          <button className={styles.secondaryButton} type="button" onClick={() => setScreen('editors')}>
            Редакторы
          </button>
        </div>
      </section>
    </main>
  );
}
