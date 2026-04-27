import { type AchievementsProvider, NoopAchievementsProvider } from '@flare-engine/achievements';
import { type AnalyticsProvider, NoopAnalyticsProvider } from '@flare-engine/analytics';
import type { IAPProvider } from '@flare-engine/iap';
import { type LeaderboardsProvider, NoopLeaderboardsProvider } from '@flare-engine/leaderboards';
import { createGameIapProvider } from '../iap/provider';

/**
 * Tier-2 provider bundle. RevenueCat is live when the env-var API keys are
 * present (release builds); falls back to Noop for CI / unit tests.
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
      iap: createGameIapProvider(),
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
