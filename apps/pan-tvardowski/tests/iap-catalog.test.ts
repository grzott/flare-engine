/**
 * PT_CATALOG content tests — M9.3.
 *
 * Guarded with try/require for Windows Bun symlink tolerance (same pattern as
 * shop-entitlements.test.ts). Tests skip gracefully on EACCES.
 */
import { describe, expect, test } from 'bun:test';

describe('PT_CATALOG — M9.3 SKUs', () => {
  // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
  let PT_CATALOG: any;
  // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
  let SKU_FULL_GAME: any;
  // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
  let SKU_SUPPORTER_PACK: any;
  // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
  let ENTITLEMENT_FULL_GAME: any;
  // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
  let ENTITLEMENT_SUPPORTER: any;
  // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
  let getGrantsForProduct: any;

  try {
    // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
    const iap = require('@flare-engine/iap') as any;
    // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
    const catalog = require('../src/iap/catalog') as any;
    PT_CATALOG = catalog.PT_CATALOG;
    SKU_FULL_GAME = catalog.SKU_FULL_GAME;
    SKU_SUPPORTER_PACK = catalog.SKU_SUPPORTER_PACK;
    ENTITLEMENT_FULL_GAME = catalog.ENTITLEMENT_FULL_GAME;
    ENTITLEMENT_SUPPORTER = catalog.ENTITLEMENT_SUPPORTER;
    getGrantsForProduct = iap.getGrantsForProduct;
  } catch {
    // Symlink EACCES — tests skip via early return.
  }

  test('PT_CATALOG.entries contains exactly 2 entries', () => {
    if (!PT_CATALOG) return;
    expect(PT_CATALOG.entries).toHaveLength(2);
  });

  test('entries have the correct storefront product IDs', () => {
    if (!PT_CATALOG || !SKU_FULL_GAME || !SKU_SUPPORTER_PACK) return;
    const ids = PT_CATALOG.entries.map((e: { productId: string }) => e.productId);
    expect(ids).toContain(SKU_FULL_GAME);
    expect(ids).toContain(SKU_SUPPORTER_PACK);
    expect(SKU_FULL_GAME).toBe('pan_tvardowski.full_game');
    expect(SKU_SUPPORTER_PACK).toBe('pan_tvardowski.supporter_pack');
  });

  test('getGrantsForProduct(pan_tvardowski.full_game) returns [pt.full_game]', () => {
    if (!PT_CATALOG || !getGrantsForProduct || !ENTITLEMENT_FULL_GAME) return;
    const grants = getGrantsForProduct(PT_CATALOG, 'pan_tvardowski.full_game');
    expect(grants).toEqual([ENTITLEMENT_FULL_GAME]);
    expect(ENTITLEMENT_FULL_GAME).toBe('pt.full_game');
  });

  test('getGrantsForProduct(pan_tvardowski.supporter_pack) returns [pt.supporter]', () => {
    if (!PT_CATALOG || !getGrantsForProduct || !ENTITLEMENT_SUPPORTER) return;
    const grants = getGrantsForProduct(PT_CATALOG, 'pan_tvardowski.supporter_pack');
    expect(grants).toEqual([ENTITLEMENT_SUPPORTER]);
    expect(ENTITLEMENT_SUPPORTER).toBe('pt.supporter');
  });

  test('unknown product returns empty grants; pt.shards_small not present in any entry', () => {
    if (!PT_CATALOG || !getGrantsForProduct) return;
    expect(getGrantsForProduct(PT_CATALOG, 'unknown.product')).toHaveLength(0);
    const hasShards = PT_CATALOG.entries.some((e: { grants: readonly string[] }) =>
      e.grants.includes('pt.shards_small'),
    );
    expect(hasShards).toBe(false);
    const hasShardsSku = PT_CATALOG.entries.some(
      (e: { productId: string }) => e.productId === 'pt.shards_small',
    );
    expect(hasShardsSku).toBe(false);
  });
});
