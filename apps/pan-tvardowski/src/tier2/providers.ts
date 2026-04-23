import { type AchievementsProvider, NoopAchievementsProvider } from '@flare-engine/achievements';
import { type AnalyticsProvider, NoopAnalyticsProvider } from '@flare-engine/analytics';
import { type IAPProvider, NoopIAPProvider } from '@flare-engine/iap';
import { type LeaderboardsProvider, NoopLeaderboardsProvider } from '@flare-engine/leaderboards';

/**
 * Tier-2 provider bundle. At 0.1.x Pan Tvardowski wires **noop** providers so
 * the interface surface ships + is exercised by the real runtime. Concrete
 * adapters (Game Center / Play Games / RevenueCat / PostHog) land in 0.2.0.
 */
export interface Tier2Providers {
  readonly analytics: AnalyticsProvider;
  readonly leaderboards: LeaderboardsProvider;
  readonly achievements: AchievementsProvider;
  readonly iap: IAPProvider;
}

let cached: Tier2Providers | null = null;

export function getTier2Providers(): Tier2Providers {
  if (!cached) {
    cached = {
      analytics: NoopAnalyticsProvider,
      leaderboards: NoopLeaderboardsProvider,
      achievements: NoopAchievementsProvider,
      iap: NoopIAPProvider,
    };
  }
  return cached;
}

/** Override providers (tests: inject recording fakes). */
export function setTier2Providers(providers: Tier2Providers): void {
  cached = providers;
}

/** Reset to the default noop bundle. */
export function resetTier2Providers(): void {
  cached = null;
}
