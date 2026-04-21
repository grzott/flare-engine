import { fpsChanged, fpsState, showFpsChanged, showFpsState } from './fps-state';
import { useSignalState } from './use-signal-state';

export function useFpsLine(): string {
  return useSignalState(fpsChanged, () => fpsState.line);
}

export function useShowFps(): boolean {
  return useSignalState(showFpsChanged, () => showFpsState.show);
}
