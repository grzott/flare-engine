import { createElement, type ReactNode, useEffect, useMemo, useState } from 'react';
import { createFocusManager, type FocusManager } from './focus.js';
import { FocusContext, type FocusContextValue } from './focus-context.js';

export interface FocusProviderProps {
  manager?: FocusManager;
  /**
   * Opt-in initial focus: focus the tab-order first node once, at the commit
   * where this provider mounts. Off by default so a touch-first tree shows no
   * focus ring until a driver acts. This is mount-time only — it picks among the
   * nodes registered by that first commit and does not re-fire for children that
   * mount later (async/lazy sets). For a dynamic set drive focus explicitly
   * (a keyboard/gamepad driver, or manager.focusFirst()).
   */
  autoFocus?: boolean;
  children: ReactNode;
}

/**
 * Instantiates a FocusManager (or uses the one provided) and publishes
 * { manager, focusedId } as context state so consumers re-render on focus
 * moves.
 */
export function FocusProvider({ manager, autoFocus, children }: FocusProviderProps): ReactNode {
  const [mgr] = useState<FocusManager>(() => manager ?? createFocusManager());
  const [focusedId, setFocusedId] = useState<string | null>(() => mgr.getFocused());

  useEffect(() => {
    setFocusedId(mgr.getFocused());
    return mgr.subscribe((id) => {
      setFocusedId(id);
    });
  }, [mgr]);

  useEffect(() => {
    // Child register effects run before this parent effect, so every node is
    // registered here → focusFirst() picks the true tab-order first.
    if (autoFocus && mgr.getFocused() === null) mgr.focusFirst();
  }, [autoFocus, mgr]);

  const value = useMemo<FocusContextValue>(() => ({ manager: mgr, focusedId }), [mgr, focusedId]);

  return createElement(FocusContext.Provider, { value }, children);
}
