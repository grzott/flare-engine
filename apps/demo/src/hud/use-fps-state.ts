import { useEffect, useState } from 'react';
import { fpsChanged, fpsState, showFpsChanged, showFpsState } from './fps-state';

export function useFpsLine(): string {
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsub = fpsChanged.add(() => setTick((t) => t + 1));
    return () => {
      unsub();
    };
  }, []);
  return fpsState.line;
}

export function useShowFps(): boolean {
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsub = showFpsChanged.add(() => setTick((t) => t + 1));
    return () => {
      unsub();
    };
  }, []);
  return showFpsState.show;
}
