import { type ReactNode, createElement, useEffect, useState } from 'react';
import { FocusContext } from './focus-context.js';
import { type FocusManager, createFocusManager } from './focus.js';

export interface FocusProviderProps {
  manager?: FocusManager;
  children: ReactNode;
}

/**
 * Instantiates a FocusManager (or uses the one provided) and exposes it
 * through `FocusContext`. Also triggers a re-render whenever focus moves,
 * so primitives that read `focusedId` update their focus ring.
 */
export function FocusProvider({ manager, children }: FocusProviderProps): ReactNode {
  const [mgr] = useState<FocusManager>(() => manager ?? createFocusManager());
  const [, force] = useState(0);

  useEffect(() => {
    return mgr.subscribe(() => {
      force((n) => n + 1);
    });
  }, [mgr]);

  return createElement(FocusContext.Provider, { value: mgr }, children);
}
