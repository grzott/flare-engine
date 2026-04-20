import { createContext, useContext } from 'react';
import { type AnalyticsProvider, NoopAnalyticsProvider } from './provider.js';

/**
 * React context carrying the active `AnalyticsProvider`. Defaults to
 * `NoopAnalyticsProvider`.
 */
export const AnalyticsContext = createContext<AnalyticsProvider>(NoopAnalyticsProvider);

/** Hook returning the current `AnalyticsProvider`. */
export function useAnalytics(): AnalyticsProvider {
  return useContext(AnalyticsContext);
}
