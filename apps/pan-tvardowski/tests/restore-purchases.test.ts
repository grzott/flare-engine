/**
 * Restore-purchases tests — M9.3.
 *
 * Covers the three paths through EntitlementStore.restoreOnBoot:
 *   1. provider.restore() returns [] → no entitlements granted
 *   2. provider.restore() returns a purchased result → entitlement granted
 *   3. provider.restore() throws → no partial grants, store stays clean
 *
 * Uses the conditional require guard pattern (matches paywall-flow.test.ts)
 * so the suite skips gracefully on EACCES (WSL symlink breakage on Windows CI).
 */
import { describe, expect, test } from 'bun:test';

describe('restore purchases — M9.3', () => {
  // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
  let createEntitlementStore: any;
  // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
  let PT_CATALOG: any;
  // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
  let SKU_FULL_GAME: any;
  // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
  let ENTITLEMENT_FULL_GAME: any;

  try {
    // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
    const iap = require('@flare-engine/iap') as any;
    // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
    const catalogModule = require('../src/iap/catalog') as any;
    createEntitlementStore = iap.createEntitlementStore;
    PT_CATALOG = catalogModule.PT_CATALOG;
    SKU_FULL_GAME = catalogModule.SKU_FULL_GAME;
    ENTITLEMENT_FULL_GAME = catalogModule.ENTITLEMENT_FULL_GAME;
  } catch {
    // Symlink EACCES — tests skip via early returns below.
  }

  test('restore() returns [] → no entitlements granted', async () => {
    if (!createEntitlementStore || !PT_CATALOG || !ENTITLEMENT_FULL_GAME) return;
    const store = createEntitlementStore(PT_CATALOG);
    const provider = {
      restore: async () => [],
      onTransaction: () => () => {},
      getProducts: async () => [],
      purchase: async () => ({ status: 'cancelled' as const }),
    };
    await store.restoreOnBoot(provider);
    expect(store.isEntitled(ENTITLEMENT_FULL_GAME)).toBe(false);
  });

  test('restore() returns 1 purchased result → entitlement granted', async () => {
    if (!createEntitlementStore || !PT_CATALOG || !SKU_FULL_GAME || !ENTITLEMENT_FULL_GAME) return;
    const store = createEntitlementStore(PT_CATALOG);
    const provider = {
      restore: async () => [
        {
          status: 'purchased' as const,
          transaction: { id: 't1', productId: SKU_FULL_GAME, purchasedAt: 0 },
        },
      ],
      onTransaction: () => () => {},
      getProducts: async () => [],
      purchase: async () => ({ status: 'cancelled' as const }),
    };
    await store.restoreOnBoot(provider);
    expect(store.isEntitled(ENTITLEMENT_FULL_GAME)).toBe(true);
  });

  test('restore() throws → no partial grants, store stays clean', async () => {
    if (!createEntitlementStore || !PT_CATALOG || !ENTITLEMENT_FULL_GAME) return;
    const store = createEntitlementStore(PT_CATALOG);
    const provider = {
      restore: async (): Promise<never> => {
        throw new Error('network error');
      },
      onTransaction: () => () => {},
      getProducts: async () => [],
      purchase: async () => ({ status: 'cancelled' as const }),
    };
    await expect(store.restoreOnBoot(provider)).rejects.toThrow('network error');
    expect(store.isEntitled(ENTITLEMENT_FULL_GAME)).toBe(false);
  });
});
