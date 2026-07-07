import { createContext, useContext } from 'react';
import type { FocusManager } from './focus.js';

export interface FocusContextValue {
  manager: FocusManager;
  focusedId: string | null;
}

export const FocusContext = createContext<FocusContextValue | null>(null);

export function useFocusManager(): FocusManager | null {
  const ctx = useContext(FocusContext);
  return ctx ? ctx.manager : null;
}

export function useFocusedId(): string | null {
  const ctx = useContext(FocusContext);
  return ctx ? ctx.focusedId : null;
}
