import { uiChanged, uiState } from './ui-state';
import { useSignalState } from './use-signal-state';

export function useUiState(): typeof uiState {
  return useSignalState(uiChanged, () => uiState);
}
