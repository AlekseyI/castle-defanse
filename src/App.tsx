import { DamageSourcesEditor } from './screens/DamageSourcesEditor/DamageSourcesEditor';
import { GameScreen } from './screens/GameScreen/GameScreen';
import styles from './App.module.css';

export default function App() {
  const isDamageSourcesEditor = new URLSearchParams(window.location.search).get('editor') === 'damage-sources';

  if (isDamageSourcesEditor) {
    return <DamageSourcesEditor />;
  }

  return (
    <div className={styles.app}>
      <GameScreen />
      <a className={styles.editorLink} href="?editor=damage-sources">Редактор</a>
    </div>
  );
}
