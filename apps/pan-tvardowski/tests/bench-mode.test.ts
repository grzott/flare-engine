import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  _resetBenchModeForTest,
  activateBenchMode,
  deactivateBenchMode,
  getBenchScenarioId,
  isBenchActive,
  isBenchAudioMuted,
  isBenchDialogueBypassed,
  isBenchDone,
  isBenchSaveMuted,
  markBenchDone,
} from '../src/perf/bench-mode';

afterEach(() => {
  _resetBenchModeForTest();
});

// ---------------------------------------------------------------------------
// Activation / deactivation
// ---------------------------------------------------------------------------

describe('activateBenchMode', () => {
  test('sets active flag', () => {
    activateBenchMode('boot');
    expect(isBenchActive()).toBe(true);
  });

  test('stores scenario id', () => {
    activateBenchMode('boss-smok-full');
    expect(getBenchScenarioId()).toBe('boss-smok-full');
  });

  test('done flag starts false after activation', () => {
    activateBenchMode('boot');
    expect(isBenchDone()).toBe(false);
  });

  test('re-activation with new id resets done flag', () => {
    activateBenchMode('boot');
    markBenchDone();
    expect(isBenchDone()).toBe(true);
    activateBenchMode('boss-smok-full');
    expect(isBenchDone()).toBe(false);
    expect(getBenchScenarioId()).toBe('boss-smok-full');
  });
});

describe('deactivateBenchMode', () => {
  test('clears active flag', () => {
    activateBenchMode('boot');
    deactivateBenchMode();
    expect(isBenchActive()).toBe(false);
  });

  test('clears scenario id', () => {
    activateBenchMode('boot');
    deactivateBenchMode();
    expect(getBenchScenarioId()).toBe('');
  });

  test('no-op when already inactive', () => {
    deactivateBenchMode();
    expect(isBenchActive()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Math.random monkey-patch
// ---------------------------------------------------------------------------

describe('Math.random monkey-patch', () => {
  test('Math.random is replaced while bench is active', () => {
    const original = Math.random;
    activateBenchMode('boot', 1);
    expect(Math.random).not.toBe(original);
    deactivateBenchMode();
    expect(Math.random).toBe(original);
  });

  test('same seed produces same sequence', () => {
    activateBenchMode('seq-test', 42);
    const a0 = Math.random();
    const a1 = Math.random();
    const a2 = Math.random();
    deactivateBenchMode();

    activateBenchMode('seq-test', 42);
    const b0 = Math.random();
    const b1 = Math.random();
    const b2 = Math.random();
    deactivateBenchMode();

    expect(a0).toBe(b0);
    expect(a1).toBe(b1);
    expect(a2).toBe(b2);
  });

  test('different seeds produce different first values', () => {
    activateBenchMode('s1', 1);
    const v1 = Math.random();
    deactivateBenchMode();

    activateBenchMode('s2', 2);
    const v2 = Math.random();
    deactivateBenchMode();

    expect(v1).not.toBe(v2);
  });

  test('all values are in [0, 1)', () => {
    activateBenchMode('range-check', 99);
    let allInRange = true;
    for (let i = 0; i < 1000; i++) {
      const v = Math.random();
      if (v < 0 || v >= 1) {
        allInRange = false;
        break;
      }
    }
    expect(allInRange).toBe(true);
  });

  test('stable hash seed: same scenario id always produces same sequence', () => {
    activateBenchMode('boss-smok-full');
    const seq1 = [Math.random(), Math.random(), Math.random()];
    deactivateBenchMode();

    activateBenchMode('boss-smok-full');
    const seq2 = [Math.random(), Math.random(), Math.random()];
    deactivateBenchMode();

    expect(seq1).toEqual(seq2);
  });

  test('scenario-id hash differs between different ids', () => {
    activateBenchMode('scenario-a');
    const va = Math.random();
    deactivateBenchMode();

    activateBenchMode('scenario-b');
    const vb = Math.random();
    deactivateBenchMode();

    expect(va).not.toBe(vb);
  });

  test('Math.random is restored after deactivation even if called multiple times', () => {
    const original = Math.random;
    activateBenchMode('boot', 1);
    activateBenchMode('boot', 2);
    deactivateBenchMode();
    expect(Math.random).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// markBenchDone / isBenchDone
// ---------------------------------------------------------------------------

describe('markBenchDone', () => {
  test('sets done flag when active', () => {
    activateBenchMode('boot');
    markBenchDone();
    expect(isBenchDone()).toBe(true);
  });

  test('no-op when not active', () => {
    markBenchDone();
    expect(isBenchDone()).toBe(false);
  });

  test('done is reset on re-activation', () => {
    activateBenchMode('boot');
    markBenchDone();
    activateBenchMode('next');
    expect(isBenchDone()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Guard flags
// ---------------------------------------------------------------------------

describe('guard flags', () => {
  test('isBenchAudioMuted returns true while active', () => {
    activateBenchMode('boot');
    expect(isBenchAudioMuted()).toBe(true);
  });

  test('isBenchAudioMuted returns false while inactive', () => {
    expect(isBenchAudioMuted()).toBe(false);
  });

  test('isBenchSaveMuted returns true while active', () => {
    activateBenchMode('boot');
    expect(isBenchSaveMuted()).toBe(true);
  });

  test('isBenchSaveMuted returns false while inactive', () => {
    expect(isBenchSaveMuted()).toBe(false);
  });

  test('isBenchDialogueBypassed returns true while active', () => {
    activateBenchMode('boot');
    expect(isBenchDialogueBypassed()).toBe(true);
  });

  test('isBenchDialogueBypassed returns false while inactive', () => {
    expect(isBenchDialogueBypassed()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Deep-link bench route integration
// ---------------------------------------------------------------------------

describe('bench deep link', () => {
  beforeEach(() => {
    _resetBenchModeForTest();
  });

  test('pantvardowski://bench/boss-smok-full routes to onBenchRequest', async () => {
    const { createMemorySource, createPanTvardowskiDeepLinks } = await import(
      '../src/deep-links/router'
    );
    const source = createMemorySource();
    const received: string[] = [];
    const manager = createPanTvardowskiDeepLinks(source, {
      onZoneRequest: () => {},
      onBenchRequest: (id) => received.push(id),
    });
    await manager.start();
    source.push('pantvardowski://bench/boss-smok-full');
    expect(received).toEqual(['boss-smok-full']);
  });

  test('pantvardowski://bench/particle-storm routes correctly', async () => {
    const { createMemorySource, createPanTvardowskiDeepLinks } = await import(
      '../src/deep-links/router'
    );
    const source = createMemorySource();
    const received: string[] = [];
    const manager = createPanTvardowskiDeepLinks(source, {
      onZoneRequest: () => {},
      onBenchRequest: (id) => received.push(id),
    });
    await manager.start();
    source.push('pantvardowski://bench/particle-storm');
    expect(received).toEqual(['particle-storm']);
  });

  test('bench link does not fire onZoneRequest', async () => {
    const { createMemorySource, createPanTvardowskiDeepLinks } = await import(
      '../src/deep-links/router'
    );
    const source = createMemorySource();
    const zones: string[] = [];
    const manager = createPanTvardowskiDeepLinks(source, {
      onZoneRequest: (z) => zones.push(z),
      onBenchRequest: () => {},
    });
    await manager.start();
    source.push('pantvardowski://bench/boss-smok-full');
    expect(zones).toEqual([]);
  });

  test('zone link does not fire onBenchRequest', async () => {
    const { createMemorySource, createPanTvardowskiDeepLinks } = await import(
      '../src/deep-links/router'
    );
    const source = createMemorySource();
    const bench: string[] = [];
    const manager = createPanTvardowskiDeepLinks(source, {
      onZoneRequest: () => {},
      onBenchRequest: (id) => bench.push(id),
    });
    await manager.start();
    source.push('pantvardowski://zone/1');
    expect(bench).toEqual([]);
  });

  test('truly unknown host fires onUnmatched', async () => {
    const { createMemorySource, createPanTvardowskiDeepLinks } = await import(
      '../src/deep-links/router'
    );
    const source = createMemorySource();
    const unmatched: string[] = [];
    const manager = createPanTvardowskiDeepLinks(source, {
      onZoneRequest: () => {},
      onUnmatched: (url) => unmatched.push(url),
    });
    await manager.start();
    source.push('pantvardowski://shop/item');
    expect(unmatched.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Save store integration: introSeen bypassed in bench mode
// ---------------------------------------------------------------------------

describe('save store introSeen bypass', () => {
  test('introSeen returns true when bench is active', async () => {
    const { createSaveStore } = await import('../src/save/store');
    const { createMemoryAdapter } = await import('@flare-engine/storage');
    const store = createSaveStore(createMemoryAdapter());
    await store.load();
    expect(store.introSeen()).toBe(false);

    activateBenchMode('boot');
    expect(store.introSeen()).toBe(true);
  });

  test('save write is skipped when bench is active', async () => {
    const { createSaveStore } = await import('../src/save/store');
    const { createMemoryAdapter } = await import('@flare-engine/storage');
    const base = createMemoryAdapter();
    const sets: string[] = [];
    const spyAdapter = {
      get: (k: string) => base.get(k),
      set: async (k: string, v: string) => {
        sets.push(k);
        return base.set(k, v);
      },
      delete: (k: string) => base.delete(k),
      keys: () => base.keys(),
      clear: () => base.clear(),
    };
    const store = createSaveStore(spyAdapter);
    await store.load();
    sets.length = 0;

    activateBenchMode('boot');
    await store.persist();
    expect(sets).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Audio sfx integration: playSfx muted in bench mode
// ---------------------------------------------------------------------------

describe('audio sfx muted in bench mode', () => {
  test('playSfx skips when bench is active', async () => {
    const { playSfx } = await import('../src/audio/sfx');
    const played: string[] = [];
    const fakeHandles = {
      pool: {
        play: (key: string) => {
          played.push(key);
        },
      },
    } as Parameters<typeof playSfx>[0];

    activateBenchMode('boot');
    playSfx(fakeHandles, 'shoot');
    expect(played).toHaveLength(0);
  });

  test('playSfx works when bench is not active', async () => {
    const { playSfx } = await import('../src/audio/sfx');
    const played: string[] = [];
    const fakeHandles = {
      pool: {
        play: (key: string) => {
          played.push(key);
        },
      },
    } as Parameters<typeof playSfx>[0];

    playSfx(fakeHandles, 'shoot');
    expect(played).toHaveLength(1);
    expect(played[0]).toBe('shoot');
  });
});
