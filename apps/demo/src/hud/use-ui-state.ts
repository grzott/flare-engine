import { useEffect, useState } from 'react';
import { uiChanged, uiState } from './ui-state';

export function useUiState(): typeof uiState {
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsub = uiChanged.add(() => setTick((t) => t + 1));
    return () => {
      unsub();
    };
  }, []);
  return uiState;
}
