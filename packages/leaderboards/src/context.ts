import { createContext, useContext } from 'react';
import { type LeaderboardsProvider, NoopLeaderboardsProvider } from './provider.js';

/**
 * React context carrying the active `LeaderboardsProvider`. Defaults to
 * `NoopLeaderboardsProvider` so `useLeaderboards()` never throws on a bare
 * tree — consumers wrap their app in a `<LeaderboardsContext.Provider>` with
 * a real adapter when they need one.
 */
export const LeaderboardsContext = createContext<LeaderboardsProvider>(NoopLeaderboardsProvider);

/** Hook returning the current `LeaderboardsProvider`. */
export function useLeaderboards(): LeaderboardsProvider {
  return useContext(LeaderboardsContext);
}
