import { useEffect, useState } from 'react';
import { dialogueChanged, dialogueState } from '../scenes/dialogue';

export function useDialogueLine(): typeof dialogueState.current {
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsub = dialogueChanged.add(() => setTick((t) => t + 1));
    return () => {
      unsub();
    };
  }, []);
  return dialogueState.current;
}
