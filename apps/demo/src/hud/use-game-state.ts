import { gameState, stateChanged } from '../state';
import { useSignalState } from './use-signal-state';

export function useGameState(): typeof gameState {
  return useSignalState(stateChanged, () => gameState);
}
