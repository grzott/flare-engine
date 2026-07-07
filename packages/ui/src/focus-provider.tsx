import { type ReactNode, createElement, useEffect, useMemo, useState } from 'react';
import { FocusContext, type FocusContextValue } from './focus-context.js';
import { type FocusManager, createFocusManager } from './focus.js';

export interface FocusProviderProps {
  manager?: FocusManager;
  children: ReactNode;
}

/**
 * Instantiates a FocusManager (or uses the one provided) and publishes
 * { manager, focusedId } as context state so consumers re-render on focus
 * moves.
 */
export function FocusProvider({ manager, children }: FocusProviderProps): ReactNode {
  const [mgr] = useState<FocusManager>(() => manager ?? createFocusManager());
  const [focusedId, setFocusedId] = useState<string | null>(() => mgr.getFocused());

  useEffect(() => {
    setFocusedId(mgr.getFocused());
    return mgr.subscribe((id) => {
      setFocusedId(id);
    });
  }, [mgr]);

  const value = useMemo<FocusContextValue>(() => ({ manager: mgr, focusedId }), [mgr, focusedId]);

  return createElement(FocusContext.Provider, { value }, children);
}
