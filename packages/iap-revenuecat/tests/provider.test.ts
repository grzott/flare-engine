import { beforeEach, describe, expect, mock, test } from 'bun:test';

const configureMock = mock(() => {});
const getProductsMock = mock(async (_ids: string[]) => [
  {
    identifier: 'x',
    title: 'X Title',
    description: 'X Desc',
    priceString: '$0.99',
    price: 0.99,
    currencyCode: 'USD',
    productCategory: 'NON_SUBSCRIPTION',
    productType: 'CONSUMABLE',
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
  originalPurchaseDate: null,
  entitlements: {
    all: {
      premium: {
        identifier: 'premium',
        productIdentifier: 'x',
        purchaseDateMillis: 1700000000000,
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

import { createRevenueCatProvider } from '../src/provider.js';

const testConfig = {
  apiKeyIos: 'ios-key',
  apiKeyAndroid: 'android-key',
};

describe('createRevenueCatProvider', () => {
  beforeEach(() => {
    configureMock.mockClear();
    getProductsMock.mockClear();
    purchaseMock.mockClear();
    restoreMock.mockClear();
    addListenerMock.mockClear();
    removeListenerMock.mockClear();
  });

  test('returns an object with all 4 IAPProvider methods', () => {
    const provider = createRevenueCatProvider(testConfig);
    expect(typeof provider.getProducts).toBe('function');
    expect(typeof provider.purchase).toBe('function');
    expect(typeof provider.restore).toBe('function');
    expect(typeof provider.onTransaction).toBe('function');
    expect(provider.getProducts.length).toBe(1);
    expect(provider.purchase.length).toBe(1);
    expect(provider.restore.length).toBe(0);
    expect(provider.onTransaction.length).toBe(1);
  });

  test('getProducts calls configure once on first invocation and maps products', async () => {
    const provider = createRevenueCatProvider(testConfig);
    const products = await provider.getProducts(['x']);

    expect(configureMock).toHaveBeenCalledTimes(1);
    expect(configureMock).toHaveBeenCalledWith({
      apiKey: 'android-key',
      appUserID: null,
    });
    expect(getProductsMock).toHaveBeenCalledTimes(1);
    expect(getProductsMock).toHaveBeenCalledWith(['x']);

    expect(products).toHaveLength(1);
    const p = products[0]!;
    expect(p.id).toBe('x');
    expect(p.title).toBe('X Title');
    expect(p.priceDisplay).toBe('$0.99');
    expect(p.priceMicros).toBeCloseTo(990000);
    expect(p.currency).toBe('USD');
    expect(p.type).toBe('consumable');
  });

  test('purchase returns { status: purchased, transaction } on success', async () => {
    const provider = createRevenueCatProvider(testConfig);
    const result = await provider.purchase('x');

    expect(result.status).toBe('purchased');
    expect(result.transaction).toBeDefined();
    expect(result.transaction!.productId).toBe('x');
    expect(typeof result.transaction!.purchasedAt).toBe('number');
  });

  test('purchase returns { status: cancelled } when userCancelled is true', async () => {
    purchaseMock.mockImplementationOnce(async () => {
      const err = Object.assign(new Error('User cancelled'), { userCancelled: true });
      throw err;
    });

    const provider = createRevenueCatProvider(testConfig);
    const result = await provider.purchase('x');

    expect(result.status).toBe('cancelled');
    expect(result.transaction).toBeUndefined();
  });

  test('purchase returns { status: failed, error } on SDK error and does not throw', async () => {
    purchaseMock.mockImplementationOnce(async () => {
      throw new Error('network timeout');
    });

    const provider = createRevenueCatProvider(testConfig);
    // No-throw contract: must resolve (not reject) even on SDK error.
    const result = await provider.purchase('x');
    expect(result.status).toBe('failed');
    expect(result.error).toBeInstanceOf(Error);
    expect(result.transaction).toBeUndefined();
  });

  test('onTransaction registers listener and unsubscribe removes it', async () => {
    const provider = createRevenueCatProvider(testConfig);
    const unsub = provider.onTransaction(() => {});

    await Promise.resolve();
    await Promise.resolve();

    expect(addListenerMock).toHaveBeenCalledTimes(1);

    unsub();

    await Promise.resolve();
    await Promise.resolve();

    expect(removeListenerMock).toHaveBeenCalledTimes(1);
  });
});
