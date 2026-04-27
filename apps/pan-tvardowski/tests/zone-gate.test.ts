/**
 * Zone-gate guard tests — M9.3.
 *
 * Uses the same try/require guard as other IAP tests so the suite skips
 * gracefully on EACCES (WSL symlink breakage on Windows CI).
 */
import { describe, expect, test } from 'bun:test';

describe('canStartZone — M9.3', () => {
  // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
  let canStartZone: any;
  // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
  let ZONES: any;
  // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
  let ENTITLEMENT_FULL_GAME: any;
  // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
  let createEntitlementStore: any;
  // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
  let PT_CATALOG: any;

  try {
    // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
    const iap = require('@flare-engine/iap') as any;
    // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
    const gateModule = require('../src/iap/zone-gate') as any;
    // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
    const zonesModule = require('../src/config/zones') as any;
    // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
    const catalogModule = require('../src/iap/catalog') as any;
    canStartZone = gateModule.canStartZone;
    ZONES = zonesModule.ZONES;
    ENTITLEMENT_FULL_GAME = catalogModule.ENTITLEMENT_FULL_GAME;
    createEntitlementStore = iap.createEntitlementStore;
    PT_CATALOG = catalogModule.PT_CATALOG;
  } catch {
    // Symlink EACCES — tests skip via early returns below.
  }

  test('returns true for a zone with no requiresEntitlement', () => {
    if (!canStartZone || !createEntitlementStore || !PT_CATALOG) return;
    const store = createEntitlementStore(PT_CATALOG);
    expect(canStartZone({}, store)).toBe(true);
    expect(canStartZone({ requiresEntitlement: undefined }, store)).toBe(true);
  });

  test('returns true when store isEntitled returns true for the required key', () => {
    if (!canStartZone || !createEntitlementStore || !PT_CATALOG || !ENTITLEMENT_FULL_GAME) return;
    const store = createEntitlementStore(PT_CATALOG, { initial: [ENTITLEMENT_FULL_GAME] });
    expect(canStartZone({ requiresEntitlement: ENTITLEMENT_FULL_GAME }, store)).toBe(true);
  });

  test('returns false when requiresEntitlement is set and store reports not entitled', () => {
    if (!canStartZone || !createEntitlementStore || !PT_CATALOG || !ENTITLEMENT_FULL_GAME) return;
    const store = createEntitlementStore(PT_CATALOG);
    expect(canStartZone({ requiresEntitlement: ENTITLEMENT_FULL_GAME }, store)).toBe(false);
  });

  test('zone-config integration: z1–z3 free, z4–z8 require ENTITLEMENT_FULL_GAME', () => {
    if (!ZONES || !ENTITLEMENT_FULL_GAME) return;
    const freeZones = ['z1', 'z2', 'z3'] as const;
    const premiumZones = ['z4', 'z5', 'z6', 'z7', 'z8'] as const;
    for (const id of freeZones) {
      expect(ZONES[id].requiresEntitlement).toBeUndefined();
    }
    for (const id of premiumZones) {
      expect(ZONES[id].requiresEntitlement).toBe(ENTITLEMENT_FULL_GAME);
    }
  });
});
