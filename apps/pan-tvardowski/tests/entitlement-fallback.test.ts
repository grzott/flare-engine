import { beforeEach, describe, expect, it } from 'bun:test';
import enLocale from '../locales/en.json';
import plLocale from '../locales/pl.json';
import type { ZoneId } from '../src/events';
import { type EntitlementHealth, createEntitlementFallback } from '../src/iap/fallback';
import type { SlotData } from '../src/save/schema';
import type { SaveStore } from '../src/save/store';
import { gameState } from '../src/state';

function makeSlot(zoneReached: ZoneId): SlotData {
  return {
    index: 0,
    runs: 0,
    bestScore: 0,
    lastScore: 0,
    bossDefeated: false,
    savedAt: 0,
    zoneReached,
    zoneStats: {},
  };
}

function makeStore(slot: SlotData | null): SaveStore {
  return {
    getSlot: () => slot,
    load: async () => {},
    persist: async () => {},
    selectSlot: async () => {},
    createSlot: async () => {},
    commitRun: async () => {},
    activeSlot: () => 0,
    introSeen: () => false,
    markIntroSeen: async () => {},
    codexUnlocked: () => [],
    unlockCodexEntry: async () => {},
    entitlements: () => [],
    grantEntitlement: async () => {},
    zoneStats: () => ({ deaths: 0, bestTimeMs: null, noHit: false }),
    recordZoneOutcome: async () => {},
    unlockedAchievements: () => [],
    unlockAchievement: async () => {},
    privacy: () => ({ analyticsOptIn: false, crashOptIn: false }),
    setPrivacy: async () => {},
  } as unknown as SaveStore;
}

describe('entitlement fallback — shouldAllowStaleAccess', () => {
  beforeEach(() => {
    gameState.entitlementHealth = 'ok';
    gameState.activeSlot = 0;
  });

  it('returns false when slot is null', () => {
    const fb = createEntitlementFallback();
    expect(fb.shouldAllowStaleAccess('z4' as ZoneId, makeStore(null))).toBe(false);
  });

  it('returns false when zoneReached < requested zone', () => {
    const fb = createEntitlementFallback();
    expect(fb.shouldAllowStaleAccess('z5' as ZoneId, makeStore(makeSlot('z3' as ZoneId)))).toBe(
      false,
    );
  });

  it('returns true when zoneReached > requested zone', () => {
    const fb = createEntitlementFallback();
    expect(fb.shouldAllowStaleAccess('z4' as ZoneId, makeStore(makeSlot('z6' as ZoneId)))).toBe(
      true,
    );
  });

  it('returns true when zoneReached === requested zone', () => {
    const fb = createEntitlementFallback();
    expect(fb.shouldAllowStaleAccess('z5' as ZoneId, makeStore(makeSlot('z5' as ZoneId)))).toBe(
      true,
    );
  });

  it('sets gameState.entitlementHealth = "stale" when allowed', () => {
    const fb = createEntitlementFallback();
    fb.shouldAllowStaleAccess('z4' as ZoneId, makeStore(makeSlot('z6' as ZoneId)));
    expect(gameState.entitlementHealth).toBe('stale');
  });

  it('does not mutate entitlementHealth when not allowed', () => {
    const fb = createEntitlementFallback();
    gameState.entitlementHealth = 'ok';
    fb.shouldAllowStaleAccess('z5' as ZoneId, makeStore(makeSlot('z3' as ZoneId)));
    expect(gameState.entitlementHealth).toBe('ok');
  });

  it('reset() sets entitlementHealth back to "ok"', () => {
    const fb = createEntitlementFallback();
    gameState.entitlementHealth = 'stale';
    fb.reset();
    const after = gameState.entitlementHealth as EntitlementHealth;
    expect(after).toBe('ok');
  });
});

describe('entitlement fallback — locale parity', () => {
  it('all 5 iap.entitlement_check_failed.* keys present in EN and PL', () => {
    const keys = [
      'iap.entitlement_check_failed.notice',
      'iap.entitlement_check_failed.title',
      'iap.entitlement_check_failed.body',
      'iap.entitlement_check_failed.return_menu',
      'iap.entitlement_check_failed.retry',
    ];
    const en = enLocale as Record<string, string>;
    const pl = plLocale as Record<string, string>;
    for (const key of keys) {
      expect(en[key]).toBeTypeOf('string');
      expect(en[key]?.length).toBeGreaterThan(0);
      expect(pl[key]).toBeTypeOf('string');
      expect(pl[key]?.length).toBeGreaterThan(0);
    }
  });
});
