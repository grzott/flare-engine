import type { Query } from '@flare-engine/ecs';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { GameContext, type GameContextValue } from './game-context.js';

/**
 * useGame — returns the GameContextValue from the nearest <GameView>.
 * Throws if called outside a <GameView>.
 */
export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error('useGame must be used inside a <GameView>');
  }
  return ctx;
}

/**
 * useEntity — subscribes to an ECS Query and returns the current entity list.
 * Re-renders when entities are added to or removed from the query.
 *
 * @param query An active Query obtained from world.query(...)
 */
export function useEntity(query: Query): readonly number[] {
  const [entities, setEntities] = useState<readonly number[]>(() => Array.from(query));

  useEffect(() => {
    const refresh = () => setEntities(Array.from(query));

    const unsubAdd = query.onEntityAdded.add(refresh);
    const unsubRemove = query.onEntityRemoved.add(refresh);

    // Sync initial state (query may have changed between render and effect)
    refresh();

    return () => {
      unsubAdd();
      unsubRemove();
    };
  }, [query]);

  return entities;
}

/**
 * useGameLoop — registers a per-frame callback on the game loop's onUpdate signal.
 * The callback is called each frame with delta time in seconds.
 * Automatically unregisters on unmount.
 *
 * @param callback Function called each frame with dt in seconds.
 */
export function useGameLoop(callback: (dt: number) => void): void {
  const { loop } = useGame();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const stable = useCallback((dt: number) => {
    callbackRef.current(dt);
  }, []);

  useEffect(() => {
    const unsub = loop.onUpdate.add(stable);
    return () => {
      unsub();
    };
  }, [loop, stable]);
}
