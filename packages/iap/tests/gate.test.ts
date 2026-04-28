import { describe, expect, test } from 'bun:test';
import { canAccessContent, createEntitlementStore, createProductCatalog } from '../src/index.js';

const catalog = createProductCatalog([
  { productId: 'game.full', grants: ['zones.premium'], type: 'non-consumable' },
]);

describe('canAccessContent', () => {
  test('no requiresEntitlement → returns true', () => {
    const store = createEntitlementStore(catalog);
    expect(canAccessContent({}, store)).toBe(true);
  });

  test('entitled → returns true', () => {
    const store = createEntitlementStore(catalog, { initial: ['zones.premium'] });
    expect(canAccessContent({ requiresEntitlement: 'zones.premium' }, store)).toBe(true);
  });

  test('not entitled → returns false', () => {
    const store = createEntitlementStore(catalog);
    expect(canAccessContent({ requiresEntitlement: 'zones.premium' }, store)).toBe(false);
  });
});
