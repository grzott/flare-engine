import { describe, expect, test } from 'bun:test';
import { EventEmitter } from '@flare-engine/events';
import { type Tier2Providers, type Tier2Rule, createTier2Wiring } from '../src/tier2-wiring.js';

type Events = {
  'zone-start': (zone: string) => void;
  'zone-complete': (zone: string, score: number) => void;
  'miniboss-defeated': (zone: string) => void;
};

function makeProviders() {
  const analyticsCalls: Array<{
    event: string;
    props?: Record<string, unknown>;
  }> = [];
  const leaderboardCalls: Array<{ id: string; score: number }> = [];
  const achievementUnlocks: string[] = [];

  const providers: Tier2Providers = {
    analytics: {
      track(event, props) {
        analyticsCalls.push({ event, props });
      },
    },
    leaderboards: {
      submitScore(id, score) {
        leaderboardCalls.push({ id, score });
      },
    },
    achievements: {
      unlock(id) {
        achievementUnlocks.push(id);
      },
    },
  };

  return { providers, analyticsCalls, leaderboardCalls, achievementUnlocks };
}

describe('createTier2Wiring', () => {
  test('dispatches analytics / leaderboard / achievement per rule', () => {
    const emitter = new EventEmitter<Events>();
    const { providers, analyticsCalls, leaderboardCalls, achievementUnlocks } = makeProviders();

    const rules: readonly Tier2Rule[] = [
      {
        kind: 'analytics',
        event: 'zone-complete',
        map: (...args) => {
          const [zone, score] = args as [string, number];
          return { event: 'zone_complete', props: { zone, score } };
        },
      },
      {
        kind: 'leaderboard',
        event: 'zone-complete',
        map: (...args) => {
          const [zone, score] = args as [string, number];
          return { id: `zone_${zone}_high_score`, score };
        },
      },
      {
        kind: 'achievement',
        event: 'zone-complete',
        map: (...args) => {
          const [zone] = args as [string];
          if (zone === 'z1') return 'first_shard';
          if (zone === 'z8') return ['all_shards', 'complete'];
          return null;
        },
      },
    ];

    const unsub = createTier2Wiring({ events: emitter, providers, rules });

    emitter.emit('zone-complete', 'z1', 12_345);
    emitter.emit('zone-complete', 'z8', 99_999);
    emitter.emit('zone-complete', 'z4', 5_000);

    expect(analyticsCalls).toEqual([
      { event: 'zone_complete', props: { zone: 'z1', score: 12_345 } },
      { event: 'zone_complete', props: { zone: 'z8', score: 99_999 } },
      { event: 'zone_complete', props: { zone: 'z4', score: 5_000 } },
    ]);
    expect(leaderboardCalls).toEqual([
      { id: 'zone_z1_high_score', score: 12_345 },
      { id: 'zone_z8_high_score', score: 99_999 },
      { id: 'zone_z4_high_score', score: 5_000 },
    ]);
    expect(achievementUnlocks).toEqual(['first_shard', 'all_shards', 'complete']);

    unsub();
    emitter.emit('zone-complete', 'z2', 1);
    expect(analyticsCalls.length).toBe(3);
  });

  test('rule with null map is skipped', () => {
    const emitter = new EventEmitter<Events>();
    const { providers, analyticsCalls } = makeProviders();

    createTier2Wiring({
      events: emitter,
      providers,
      rules: [
        {
          kind: 'analytics',
          event: 'zone-start',
          map: () => null,
        },
      ],
    });
    emitter.emit('zone-start', 'z1');
    expect(analyticsCalls).toEqual([]);
  });

  test('missing provider quietly skips matching rules', () => {
    const emitter = new EventEmitter<Events>();
    const { providers, analyticsCalls } = makeProviders();
    const { analytics: _dropped, ...rest } = providers;

    createTier2Wiring({
      events: emitter,
      providers: rest,
      rules: [
        {
          kind: 'analytics',
          event: 'zone-start',
          map: (...args) => ({ event: 'x', props: { zone: args[0] } }),
        },
      ],
    });
    emitter.emit('zone-start', 'z1');
    expect(analyticsCalls).toEqual([]);
  });
});
