import { useEffect, useState } from 'react';
import { gameState, stateChanged } from '../state';

export function useGameState(): typeof gameState {
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsub = stateChanged.add(() => setTick((t) => t + 1));
    return () => {
      unsub();
    };
  }, []);
  return gameState;
}
