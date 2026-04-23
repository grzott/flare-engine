import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type {
  AchievementId,
  AchievementState,
  AchievementsProvider,
} from '@flare-engine/achievements';
import type { AnalyticsProps, AnalyticsProvider } from '@flare-engine/analytics';
import type { IAPProvider, Product, PurchaseResult, Unsubscribe } from '@flare-engine/iap';
import type { LeaderboardId, LeaderboardsProvider, ScoreEntry } from '@flare-engine/leaderboards';
import { gameEvents } from '../src/events';
import { resetTier2Providers, setTier2Providers } from '../src/tier2/providers';
import { mountTier2Wiring } from '../src/tier2/wiring';

interface TrackCall {
  event: string;
  props: AnalyticsProps | undefined;
}

const recordingAnalytics = (): AnalyticsProvider & { tracks: TrackCall[] } => {
  const tracks: TrackCall[] = [];
  return {
    tracks,
    async track(event: string, props?: AnalyticsProps) {
      tracks.push({ event, props });
    },
    async identify() {},
    async screen() {},
    async flush() {},
  };
};

const recordingLeaderboards = (): LeaderboardsProvider & {
  submissions: Array<{ id: LeaderboardId; score: number }>;
} => {
  const submissions: Array<{ id: LeaderboardId; score: number }> = [];
  return {
    submissions,
    async submitScore(id: LeaderboardId, score: number) {
      submissions.push({ id, score });
    },
    async getTopN(): Promise<readonly ScoreEntry[]> {
      return [];
    },
    async getPlayerRank() {
      return null;
    },
  };
};

const recordingAchievements = (): AchievementsProvider & {
  unlocks: AchievementId[];
} => {
  const unlocks: AchievementId[] = [];
  return {
    unlocks,
    async unlock(id: AchievementId) {
      if (!unlocks.includes(id)) unlocks.push(id);
    },
    async getState(id: AchievementId): Promise<AchievementState> {
      return { id, unlocked: unlocks.includes(id), progress: 0 };
    },
    async getAll(): Promise<readonly AchievementState[]> {
      return [];
    },
  };
};

const noopIAP = (): IAPProvider => ({
  async getProducts(): Promise<readonly Product[]> {
    return [];
  },
  async purchase(): Promise<PurchaseResult> {
    return { status: 'cancelled' };
  },
  async restore(): Promise<readonly PurchaseResult[]> {
    return [];
  },
  onTransaction(): Unsubscribe {
    return () => {};
  },
});

let analytics: ReturnType<typeof recordingAnalytics>;
let leaderboards: ReturnType<typeof recordingLeaderboards>;
let achievements: ReturnType<typeof recordingAchievements>;
let unmount: () => void;

beforeEach(() => {
  analytics = recordingAnalytics();
  leaderboards = recordingLeaderboards();
  achievements = recordingAchievements();
  setTier2Providers({ analytics, leaderboards, achievements, iap: noopIAP() });
  unmount = mountTier2Wiring();
});

afterEach(() => {
  unmount();
  resetTier2Providers();
});

describe('tier-2 wiring', () => {
  test('zone-start emits analytics event', () => {
    gameEvents.emit('zone-start', 'z1');
    expect(analytics.tracks).toHaveLength(1);
    expect(analytics.tracks[0]?.event).toBe('zone_start');
    expect(analytics.tracks[0]?.props).toEqual({ zone: 'z1' });
  });

  test('zone-complete submits leaderboard score and unlocks first_shard on z1', () => {
    gameEvents.emit('zone-complete', 'z1', 4200);
    expect(leaderboards.submissions).toEqual([{ id: 'zone_z1_high_score', score: 4200 }]);
    expect(achievements.unlocks).toContain('first_shard');
    expect(analytics.tracks.find((t) => t.event === 'zone_complete')).toBeDefined();
  });

  test('zone 8 complete unlocks all_shards', () => {
    gameEvents.emit('zone-complete', 'z8', 99999);
    expect(leaderboards.submissions).toEqual([{ id: 'zone_z8_high_score', score: 99999 }]);
    expect(achievements.unlocks).toContain('all_shards');
  });

  test('achievement unlocks dedupe in the recording provider', () => {
    gameEvents.emit('zone-complete', 'z1', 100);
    gameEvents.emit('zone-complete', 'z1', 200);
    expect(achievements.unlocks.filter((id) => id === 'first_shard')).toHaveLength(1);
  });

  test('miniboss-defeated + boss-phase-change dispatch analytics', () => {
    gameEvents.emit('miniboss-defeated', 'z2');
    gameEvents.emit('boss-phase-change', 'z5', 'phase2');
    const events = analytics.tracks.map((t) => t.event);
    expect(events).toContain('miniboss_defeated');
    expect(events).toContain('boss_phase_change');
  });
});
