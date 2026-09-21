import { useEffect, useRef } from 'react';
import { Game } from '../../game/Game';
import styles from './GameViewport.module.css';

interface GameViewportProps {
  onGameReady: (game: Game | null) => void;
}

export function GameViewport({ onGameReady }: GameViewportProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const game = new Game(host);
    onGameReady(game);
    void game.start();

    return () => {
      onGameReady(null);
      game.destroy();
    };
  }, [onGameReady]);

  return <div ref={hostRef} className={styles.host} />;
}
