import { useCallback, useRef, useState } from 'react';
import { AutoCastToggle } from '../../components/AutoCastToggle/AutoCastToggle';
import { GameHud } from '../../components/GameHud/GameHud';
import { GameViewport } from '../../components/GameViewport/GameViewport';
import { MatchBoard } from '../../components/MatchBoard/MatchBoard';
import { UpgradeChoice } from '../../components/UpgradeChoice/UpgradeChoice';
import type { Game } from '../../game/Game';
import type { TileKind } from '../../game/types';
import { useGameStore } from '../../store/gameStore';
import styles from './GameScreen.module.css';

export function GameScreen() {
  const gameRef = useRef<Game | null>(null);
  const [gameReady, setGameReady] = useState(false);
  const phase = useGameStore((state) => state.phase);
  const coveredByResult = phase !== 'playing';

  const handleGameReady = useCallback((game: Game | null) => {
    gameRef.current = game;
    setGameReady(game !== null);
  }, []);

  const handleCast = useCallback((kind: TileKind) => {
    gameRef.current?.cast(kind);
  }, []);

  const handleMatch = useCallback((kind: TileKind, amount: number) => {
    gameRef.current?.handleBoardMatch(kind, amount);
  }, []);

  const handleAutoShuffle = useCallback(() => {
    gameRef.current?.notifyAutoShuffle();
  }, []);

  const handleUpgradeSelect = useCallback((cardId: string) => {
    if (!useGameStore.getState().selectUpgrade(cardId)) return;
    gameRef.current?.continueAfterUpgrade();
  }, []);

  return (
    <div className={styles.screen}>
      <GameHud coveredByResult={coveredByResult} onCast={handleCast} />
      <GameViewport onGameReady={handleGameReady} />
      <AutoCastToggle coveredByResult={coveredByResult} />
      <MatchBoard disabled={!gameReady} onMatch={handleMatch} onAutoShuffle={handleAutoShuffle} />
      {phase === 'upgrade-selection' && <UpgradeChoice onSelect={handleUpgradeSelect} />}
    </div>
  );
}
