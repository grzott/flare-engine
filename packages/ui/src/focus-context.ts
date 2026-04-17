import { createContext, useContext } from 'react';
import type { FocusManager } from './focus.js';

export const FocusContext = createContext<FocusManager | null>(null);

export function useFocusManager(): FocusManager | null {
  return useContext(FocusContext);
}
