import { beforeEach, describe, expect, mock, test } from 'bun:test';

// ── RC SDK mock ────────────────────────────────────────────────────────────────

const configureMock = mock(() => {});
const getProductsMock = mock(async (_ids: string[]) => [
  {
    identifier: 'test_sku',
    title: 'Test SKU',
    description: 'Test product',
    priceString: '$1.99',
    price: 1.99,
    currencyCode: 'USD',
    productCategory: 'NON_SUBSCRIPTION',
    productType: 'NON_CONSUMABLE',
  },
]);
const purchaseMock = mock(async (_product: unknown) => ({
  customerInfo: {
    originalPurchaseDate: '2024-01-01T00:00:00Z',
    entitlements: { all: {} },
    nonSubscriptionTransactions: [],
  },
}));
const restoreMock = mock(async () => ({
  originalPurchaseDate: '2024-01-01T00:00:00Z',
  entitlements: {
    all: {
      sku1_ent: {
        identifier: 'sku1_ent',
        productIdentifier: 'sku1',
        purchaseDateMillis: 1700000000000,
        expirationDate: null,
      },
      sku2_ent: {
        identifier: 'sku2_ent',
        productIdentifier: 'sku2',
        purchaseDateMillis: 1700000001000,
        expirationDate: null,
      },
    },
  },
  nonSubscriptionTransactions: [],
}));
const addListenerMock = mock((_listener: unknown) => {});
const removeListenerMock = mock((_listener: unknown) => {});

mock.module('react-native-purchases', () => ({
  default: {
    configure: configureMock,
    getProducts: getProductsMock,
    purchaseStoreProduct: purchaseMock,
    restorePurchases: restoreMock,
    addCustomerInfoUpdateListener: addListenerMock,
    removeCustomerInfoUpdateListener: removeListenerMock,
  },
}));

mock.module('react-native', () => ({
  Platform: { OS: 'android' },
}));

import { createEntitlementStore, createProductCatalog } from '@flare-engine/iap';
import { createRevenueCatProvider } from '../src/provider.js';

const testConfig = {
  apiKeyIos: 'ios-key',
  apiKeyAndroid: 'android-key',
};

describe('iap-revenuecat integration', () => {
  beforeEach(() => {
    configureMock.mockClear();
    getProductsMock.mockClear();
    purchaseMock.mockClear();
    restoreMock.mockClear();
    addListenerMock.mockClear();
    removeListenerMock.mockClear();
  });

  test('end-to-end purchase: provider.purchase → grantProduct → isEntitled + onChange fires once', async () => {
    const catalog = createProductCatalog([{ productId: 'test_sku', grants: ['test_grant'] }]);
    const entitlementStore = createEntitlementStore(catalog);

    let changeCount = 0;
    const unsub = entitlementStore.onChange.add(() => {
      changeCount++;
    });

    const provider = createRevenueCatProvider(testConfig);
    const result = await provider.purchase('test_sku');

    expect(result.status).toBe('purchased');
    expect(result.transaction).toBeDefined();
    expect(result.transaction!.productId).toBe('test_sku');

    // Caller grants after confirmed purchase (mirrors ShopPanel.handlePurchase).
    entitlementStore.grantProduct('test_sku');

    expect(entitlementStore.isEntitled('test_grant')).toBe(true);
    expect(changeCount).toBe(1);

    unsub();
  });

  test('restore-on-boot: 2 prior purchases → both entitled, onChange fires per new grant', async () => {
    // Catalog covers both skus returned by restoreMock.
    const catalog = createProductCatalog([
      { productId: 'sku1', grants: ['grant1'] },
      { productId: 'sku2', grants: ['grant2'] },
    ]);
    const entitlementStore = createEntitlementStore(catalog);

    let changeCount = 0;
    const unsub = entitlementStore.onChange.add(() => {
      changeCount++;
    });

    const provider = createRevenueCatProvider(testConfig);
    await entitlementStore.restoreOnBoot(provider);

    expect(entitlementStore.isEntitled('grant1')).toBe(true);
    expect(entitlementStore.isEntitled('grant2')).toBe(true);
    // Each distinct grantProduct call that adds new keys fires onChange once.
    expect(changeCount).toBeGreaterThanOrEqual(1);

    unsub();
  });
});
