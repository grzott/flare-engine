import { createContext, useContext } from 'react';
import { type HapticsProvider, NoopHapticsProvider } from './provider.js';

/**
 * React context carrying the active `HapticsProvider`. Defaults to
 * `NoopHapticsProvider`.
 */
export const HapticsContext = createContext<HapticsProvider>(NoopHapticsProvider);

/** Hook returning the current `HapticsProvider`. */
export function useHaptics(): HapticsProvider {
  return useContext(HapticsContext);
}
