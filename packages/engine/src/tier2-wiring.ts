/**
 * createTier2Wiring — small, structurally-typed bridge from a game's event
 * bus to Tier-2 providers (analytics / leaderboards / achievements).
 *
 * Stays decoupled from the concrete Tier-2 packages (`@flare-engine/analytics`,
 * `@flare-engine/leaderboards`, `@flare-engine/achievements`) by using
 * structural interfaces — any provider that exposes `track` / `submitScore` /
 * `unlock` in the expected shape plugs in, including the shipped NoopProviders.
 *
 * IAP is not wired here — the IAP adapter is subscribed to directly via
 * `EntitlementStore.attachProvider`.
 */

export interface Tier2AnalyticsLike {
  track(event: string, props?: Record<string, unknown>): void | Promise<void>;
}

export interface Tier2LeaderboardsLike {
  submitScore(id: string, score: number): void | Promise<void>;
}

export interface Tier2AchievementsLike {
  unlock(id: string): void | Promise<void>;
}

export interface Tier2Providers {
  readonly analytics?: Tier2AnalyticsLike;
  readonly leaderboards?: Tier2LeaderboardsLike;
  readonly achievements?: Tier2AchievementsLike;
}

/** Event source: any object exposing `on(event, handler): () => void`. */
export interface Tier2EventSource {
  on(event: string, handler: (...args: readonly unknown[]) => void): () => void;
}

/** Dispatch an analytics event whenever the source emits the named event. */
export interface AnalyticsRule {
  readonly kind: 'analytics';
  readonly event: string;
  /**
   * Returns the analytics payload, or `null` to skip dispatch.
   */
  readonly map: (...args: readonly unknown[]) => {
    readonly event: string;
    readonly props?: Record<string, unknown>;
  } | null;
}

/** Submit a leaderboard score whenever the source emits the named event. */
export interface LeaderboardRule {
  readonly kind: 'leaderboard';
  readonly event: string;
  readonly map: (
    ...args: readonly unknown[]
  ) => { readonly id: string; readonly score: number } | null;
}

/** Unlock one or more achievements whenever the source emits the named event. */
export interface AchievementRule {
  readonly kind: 'achievement';
  readonly event: string;
  readonly map: (...args: readonly unknown[]) => string | readonly string[] | null;
}

export type Tier2Rule = AnalyticsRule | LeaderboardRule | AchievementRule;

export interface Tier2WiringOptions {
  readonly events: Tier2EventSource;
  readonly providers: Tier2Providers;
  readonly rules: readonly Tier2Rule[];
}

/**
 * Subscribe every rule to the event source. Returns an unsubscribe function
 * that tears down every listener.
 */
export function createTier2Wiring(options: Tier2WiringOptions): () => void {
  const { events, providers, rules } = options;
  const unsubs: Array<() => void> = [];

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (!rule) continue;
    const handler = buildHandler(rule, providers);
    if (!handler) continue;
    unsubs.push(events.on(rule.event, handler));
  }

  return () => {
    for (let i = 0; i < unsubs.length; i++) unsubs[i]?.();
  };
}

function buildHandler(
  rule: Tier2Rule,
  providers: Tier2Providers,
): ((...args: readonly unknown[]) => void) | null {
  switch (rule.kind) {
    case 'analytics': {
      const p = providers.analytics;
      if (!p) return null;
      return (...args: readonly unknown[]) => {
        const payload = rule.map(...args);
        if (!payload) return;
        void p.track(payload.event, payload.props);
      };
    }
    case 'leaderboard': {
      const p = providers.leaderboards;
      if (!p) return null;
      return (...args: readonly unknown[]) => {
        const payload = rule.map(...args);
        if (!payload) return;
        void p.submitScore(payload.id, payload.score);
      };
    }
    case 'achievement': {
      const p = providers.achievements;
      if (!p) return null;
      return (...args: readonly unknown[]) => {
        const payload = rule.map(...args);
        if (payload === null) return;
        if (typeof payload === 'string') {
          void p.unlock(payload);
          return;
        }
        for (let i = 0; i < payload.length; i++) {
          const id = payload[i];
          if (typeof id === 'string') void p.unlock(id);
        }
      };
    }
  }
}
