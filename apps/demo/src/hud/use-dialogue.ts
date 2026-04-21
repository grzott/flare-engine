import { dialogueChanged, dialogueState } from '../scenes/dialogue';
import { useSignalState } from './use-signal-state';

export function useDialogueLine(): typeof dialogueState.current {
  return useSignalState(dialogueChanged, () => dialogueState.current);
}
