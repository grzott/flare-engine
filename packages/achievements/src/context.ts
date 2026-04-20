import { createContext, useContext } from 'react';
import { type AchievementsProvider, NoopAchievementsProvider } from './provider.js';

/**
 * React context carrying the active `AchievementsProvider`. Defaults to
 * `NoopAchievementsProvider`.
 */
export const AchievementsContext = createContext<AchievementsProvider>(NoopAchievementsProvider);

/** Hook returning the current `AchievementsProvider`. */
export function useAchievements(): AchievementsProvider {
  return useContext(AchievementsContext);
}
