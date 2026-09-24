import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { loadAbilities } from '../../editor/abilities/abilityStorage';
import type { AbilityDefinition } from '../../editor/abilities/types';
import { BOARD_SIZE } from '../../game/config';
import { BOARD_FALL_ANIMATION_MS, BOARD_SWAP_ANIMATION_MS, Board } from '../../game/board/Board';
import { areAdjacent } from '../../game/board/boardLogic';
import type { GridPoint, TileKind } from '../../game/types';
import { useGameStore } from '../../store/gameStore';
import styles from './MatchBoard.module.css';

interface MatchBoardProps {
  disabled?: boolean;
  onMatch: (kind: TileKind, amount: number) => void;
  onAutoShuffle: () => void;
}

interface SwipeStart {
  point: GridPoint;
  pointerId: number;
  x: number;
  y: number;
}

interface SwapAnimation {
  from: GridPoint;
  to: GridPoint;
}

const SWIPE_THRESHOLD = 18;
const LEGACY_GLYPHS: Record<string, string> = {
  fire: '🔥',
  ice: '❄',
  lightning: '⚡',
  shield: '✚',
};

function samePoint(a: GridPoint, b: GridPoint) {
  return a.row === b.row && a.col === b.col;
}

function getSwipeTarget(from: GridPoint, dx: number, dy: number): GridPoint | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return null;

  const target = Math.abs(dx) >= Math.abs(dy)
    ? { row: from.row, col: from.col + (dx > 0 ? 1 : -1) }
    : { row: from.row + (dy > 0 ? 1 : -1), col: from.col };

  if (target.row < 0 || target.row >= BOARD_SIZE || target.col < 0 || target.col >= BOARD_SIZE) {
    return null;
  }

  return target;
}

function getSwapOffset(from: GridPoint, to: GridPoint) {
  const colDelta = to.col - from.col;
  const rowDelta = to.row - from.row;

  return {
    '--swap-x': colDelta === 0
      ? '0px'
      : colDelta > 0
        ? 'calc(100% + var(--board-gap))'
        : 'calc(-100% - var(--board-gap))',
    '--swap-y': rowDelta === 0
      ? '0px'
      : rowDelta > 0
        ? 'calc(100% + var(--board-gap))'
        : 'calc(-100% - var(--board-gap))',
  } as CSSProperties;
}

function getFallOffset(distance: number) {
  if (distance <= 0) return undefined;

  const gaps = Array.from({ length: distance }, () => 'var(--board-gap)').join(' - ');
  return `calc(-${distance * 100}% - ${gaps})`;
}

function getAbilityGlyph(ability: AbilityDefinition): string {
  return LEGACY_GLYPHS[ability.id] ?? (ability.name.slice(0, 1).toUpperCase() || '•');
}

function getAbilityColor(ability: AbilityDefinition): string {
  return /^#[0-9a-fA-F]{6}$/.test(ability.color) ? ability.color : '#64748b';
}

export function MatchBoard({ disabled = false, onMatch, onAutoShuffle }: MatchBoardProps) {
  const phase = useGameStore((state) => state.phase);
  const setBoardBusy = useGameStore((state) => state.setBoardBusy);
  const previousPhase = useRef(phase);
  const swipeStart = useRef<SwipeStart | null>(null);
  const suppressClickUntil = useRef(0);
  const swapTimer = useRef<number | null>(null);
  const [swapAnimation, setSwapAnimation] = useState<SwapAnimation | null>(null);
  const abilities = useMemo(() => loadAbilities(), []);
  const abilityById = useMemo(
    () => new Map(abilities.map((ability) => [ability.id, ability])),
    [abilities],
  );
  const abilityIds = useMemo(() => abilities.map((ability) => ability.id), [abilities]);
  const board = useMemo(
    () => new Board({ tileKinds: abilityIds, onCharge: onMatch, onAutoShuffle }),
    [abilityIds, onAutoShuffle, onMatch],
  );
  const snapshot = useSyncExternalStore(board.subscribe, board.getSnapshot, board.getSnapshot);
  const inactive = disabled || phase !== 'playing' || abilities.length === 0;

  useEffect(() => () => {
    if (swapTimer.current !== null) window.clearTimeout(swapTimer.current);
    board.destroy();
    setBoardBusy(false);
  }, [board, setBoardBusy]);

  useEffect(() => {
    if (phase === 'playing' && (previousPhase.current === 'victory' || previousPhase.current === 'defeat')) board.reset();
    previousPhase.current = phase;
  }, [board, phase]);

  const animateSwap = useCallback((from: GridPoint, to: GridPoint) => {
    if (inactive || snapshot.locked || swapAnimation || !areAdjacent(from, to)) return;

    setBoardBusy(true);
    setSwapAnimation({ from, to });
    swapTimer.current = window.setTimeout(() => {
      swapTimer.current = null;
      setSwapAnimation(null);
      void board.swap(from, to).finally(() => setBoardBusy(false));
    }, BOARD_SWAP_ANIMATION_MS);
  }, [board, inactive, setBoardBusy, snapshot.locked, swapAnimation]);

  const handleClick = useCallback((point: GridPoint) => {
    if (Date.now() < suppressClickUntil.current || swapAnimation) return;

    if (snapshot.selected && areAdjacent(snapshot.selected, point)) {
      animateSwap(snapshot.selected, point);
      return;
    }

    void board.tap(point);
  }, [animateSwap, board, snapshot.selected, swapAnimation]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>, point: GridPoint) => {
    if (inactive || snapshot.locked || swapAnimation) return;

    swipeStart.current = {
      point,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [inactive, snapshot.locked, swapAnimation]);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || start.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const target = getSwipeTarget(start.point, event.clientX - start.x, event.clientY - start.y);
    if (!target) return;

    suppressClickUntil.current = Date.now() + 400;
    animateSwap(start.point, target);
  }, [animateSwap]);

  const handlePointerCancel = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (swipeStart.current?.pointerId === event.pointerId) swipeStart.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  return (
    <div className={styles.wrap}>
      <div
        className={styles.board}
        style={{
          '--board-size': BOARD_SIZE,
          '--fall-duration': `${BOARD_FALL_ANIMATION_MS}ms`,
        } as CSSProperties}
        aria-disabled={inactive || snapshot.locked}
      >
        {snapshot.grid.flatMap((row, rowIndex) =>
          row.map((kind, colIndex) => {
            if (!kind) {
              return <span key={`${rowIndex}:${colIndex}`} className={styles.emptyCell} />;
            }

            const ability = abilityById.get(kind);
            if (!ability) {
              return <span key={`${rowIndex}:${colIndex}`} className={styles.emptyCell} />;
            }

            const point = { row: rowIndex, col: colIndex };
            const selected = snapshot.selected?.row === rowIndex && snapshot.selected?.col === colIndex;
            const color = getAbilityColor(ability);
            const activeSwap = swapAnimation ?? snapshot.rollbackSwap;
            const swappingFrom = Boolean(activeSwap && samePoint(activeSwap.from, point));
            const swappingTo = Boolean(activeSwap && samePoint(activeSwap.to, point));
            const swapStyle = swappingFrom && activeSwap
              ? getSwapOffset(activeSwap.from, activeSwap.to)
              : swappingTo && activeSwap
                ? getSwapOffset(activeSwap.to, activeSwap.from)
                : undefined;
            const fallDistance = snapshot.fallDistances?.[rowIndex]?.[colIndex] ?? 0;
            const fallOffset = getFallOffset(fallDistance);
            const falling = fallDistance > 0;

            return (
              <button
                key={`${rowIndex}:${colIndex}:${falling ? snapshot.fallRevision : 'static'}`}
                type="button"
                className={[
                  styles.tile,
                  selected ? styles.selected : '',
                  swappingFrom ? styles.swappingFrom : '',
                  swappingTo ? styles.swappingTo : '',
                  falling ? styles.falling : '',
                ].filter(Boolean).join(' ')}
                style={{
                  backgroundColor: `${color}e0`,
                  borderColor: selected ? '#ffffff' : '#18213a',
                  ...(fallOffset ? { '--fall-y': fallOffset } : {}),
                  ...swapStyle,
                } as CSSProperties}
                disabled={inactive || snapshot.locked}
                aria-label={ability.name}
                onClick={() => handleClick(point)}
                onPointerDown={(event) => handlePointerDown(event, point)}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
              >
                {ability.image?.src ? (
                  <img className={styles.tileImage} src={ability.image.src} alt="" />
                ) : (
                  getAbilityGlyph(ability)
                )}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
