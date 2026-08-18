import { beforeEach, describe, expect, mock, test } from 'bun:test';

const configureMock = mock(() => {});
const getProductsMock = mock(async (_ids: string[], _category?: string) => [
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
/**
 * The RevenueCat customer-info shape these mocks stand in for. Declared explicitly because the
 * mocks' return types were otherwise inferred from whichever object literal happened to be written
 * first, which froze the entitlement keys of that one example (`premium`) and the empty
 * `nonSubscriptionTransactions` array into the contract — so a `mockImplementationOnce` using any
 * other entitlement id, or any transaction at all, failed to typecheck against a shape that was
 * never intended to be that narrow.
 */
type RcEntitlement = {
  identifier: string;
  productIdentifier: string;
  purchaseDateMillis: number;
  expirationDate: string | null;
};

type RcTransaction = {
  transactionIdentifier: string;
  productIdentifier: string;
  purchaseDateMillis: number;
};

type RcCustomerInfo = {
  originalPurchaseDate: string | null;
  entitlements: {
    active: Record<string, RcEntitlement>;
    all: Record<string, RcEntitlement>;
  };
  nonSubscriptionTransactions: RcTransaction[];
};

const purchaseMock = mock(
  async (_product: unknown): Promise<{ customerInfo: RcCustomerInfo }> => ({
    customerInfo: {
      originalPurchaseDate: '2024-01-01T00:00:00Z',
      entitlements: { all: {}, active: {} },
      nonSubscriptionTransactions: [],
    },
  }),
);
const restoreMock = mock(
  async (): Promise<RcCustomerInfo> => ({
    originalPurchaseDate: null,
    entitlements: {
      active: {
        premium: {
          identifier: 'premium',
          productIdentifier: 'x',
          purchaseDateMillis: 1700000000000,
          expirationDate: null,
        },
      },
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
  }),
);
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
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  StyleSheet: { create: (s: unknown) => s, absoluteFill: {} },
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
    expect(getProductsMock.mock.calls[0]![0]).toEqual(['x']);

    expect(products).toHaveLength(1);
    const p = products[0]!;
    expect(p.id).toBe('x');
    expect(p.title).toBe('X Title');
    expect(p.priceDisplay).toBe('$0.99');
    expect(p.priceMicros).toBeCloseTo(990000);
    expect(p.currency).toBe('USD');
    expect(p.type).toBe('consumable');
  });

  test('concurrent first getProducts+restore call configure exactly once', async () => {
    const provider = createRevenueCatProvider(testConfig);
    const [products, restored] = await Promise.all([
      provider.getProducts(['x']),
      provider.restore(),
    ]);

    expect(configureMock).toHaveBeenCalledTimes(1);
    expect(products).toHaveLength(1);
    expect(restored.map((r) => r.transaction?.productId)).toContain('x');
  });

  test('a failed configure is retried on the next call, not permanently poisoned', async () => {
    configureMock.mockImplementationOnce(() => {
      throw new Error('configure failed');
    });
    const onErrorSpy = mock((_err: unknown) => {});

    const provider = createRevenueCatProvider({ ...testConfig, onError: onErrorSpy });

    // First call: configure throws → no-throw contract surfaces [] via onError.
    const first = await provider.getProducts(['x']);
    expect(first).toEqual([]);
    expect(onErrorSpy).toHaveBeenCalledTimes(1);
    expect(configureMock).toHaveBeenCalledTimes(1);

    // Second call: memo was cleared → configure runs again and succeeds.
    const second = await provider.getProducts(['x']);
    expect(second).toHaveLength(1);
    expect(configureMock).toHaveBeenCalledTimes(2);
  });

  test('concurrent first callers share one rejected configure, then retry succeeds', async () => {
    configureMock.mockImplementationOnce(() => {
      throw new Error('configure failed');
    });
    const onErrorSpy = mock((_err: unknown) => {});
    const provider = createRevenueCatProvider({ ...testConfig, onError: onErrorSpy });

    // Both entrypoints share the one rejected configurePromise: no unhandled rejection,
    // each surfaces [] via its own onError, and configure ran exactly once for the pair.
    const [products, restored] = await Promise.all([
      provider.getProducts(['x']),
      provider.restore(),
    ]);
    expect(products).toEqual([]);
    expect(restored).toEqual([]);
    expect(configureMock).toHaveBeenCalledTimes(1);
    expect(onErrorSpy).toHaveBeenCalledTimes(2);

    // The shared failure cleared the memo exactly once → a later call retries and succeeds.
    const retry = await provider.getProducts(['x']);
    expect(retry).toHaveLength(1);
    expect(configureMock).toHaveBeenCalledTimes(2);
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

  test('productCategory is passed as second arg to getProducts', async () => {
    const provider = createRevenueCatProvider({ ...testConfig, productCategory: 'inapp' });
    await provider.getProducts(['x']);
    expect(getProductsMock.mock.calls[0]![1]).toBe('inapp');
  });

  test('expired entitlement is not re-granted on restore', async () => {
    restoreMock.mockImplementationOnce(async () => ({
      originalPurchaseDate: null,
      entitlements: {
        active: {
          ent_active: {
            identifier: 'ent_active',
            productIdentifier: 'x_active',
            purchaseDateMillis: 1700000000000,
            expirationDate: null,
          },
        },
        all: {
          ent_active: {
            identifier: 'ent_active',
            productIdentifier: 'x_active',
            purchaseDateMillis: 1700000000000,
            expirationDate: null,
          },
          ent_expired: {
            identifier: 'ent_expired',
            productIdentifier: 'x_expired',
            purchaseDateMillis: 1600000000000,
            expirationDate: '2021-01-01T00:00:00Z',
          },
        },
      },
      nonSubscriptionTransactions: [],
    }));

    const provider = createRevenueCatProvider(testConfig);
    const results = await provider.restore();

    const productIds = results.map((r) => r.transaction?.productId);
    expect(productIds).toContain('x_active');
    expect(productIds).not.toContain('x_expired');
  });

  test('onError is called when getProducts throws', async () => {
    const onErrorSpy = mock((_err: unknown) => {});
    getProductsMock.mockImplementationOnce(async () => {
      throw new Error('SDK error');
    });

    const provider = createRevenueCatProvider({ ...testConfig, onError: onErrorSpy });
    const result = await provider.getProducts(['x']);

    expect(result).toEqual([]);
    expect(onErrorSpy).toHaveBeenCalledTimes(1);
    expect(onErrorSpy.mock.calls[0]![0]).toBeInstanceOf(Error);
  });

  test('onError is called when restore throws', async () => {
    const onErrorSpy = mock((_err: unknown) => {});
    restoreMock.mockImplementationOnce(async () => {
      throw new Error('restore error');
    });

    const provider = createRevenueCatProvider({ ...testConfig, onError: onErrorSpy });
    const result = await provider.restore();

    expect(result).toEqual([]);
    expect(onErrorSpy).toHaveBeenCalledTimes(1);
    expect(onErrorSpy.mock.calls[0]![0]).toBeInstanceOf(Error);
  });

  test('purchase uses real transactionIdentifier from nonSubscriptionTransactions', async () => {
    purchaseMock.mockImplementationOnce(async () => ({
      customerInfo: {
        originalPurchaseDate: '2024-01-01T00:00:00Z',
        entitlements: { all: {}, active: {} },
        nonSubscriptionTransactions: [
          {
            transactionIdentifier: 'txn_real_123',
            productIdentifier: 'x',
            purchaseDateMillis: 1700000000000,
          },
        ],
      },
    }));

    const provider = createRevenueCatProvider(testConfig);
    const result = await provider.purchase('x');

    expect(result.status).toBe('purchased');
    expect(result.transaction!.id).toBe('txn_real_123');
    expect(result.transaction!.purchasedAt).toBe(1700000000000);
  });

  test('unsubscribe before SDK resolves prevents listener registration', async () => {
    const provider = createRevenueCatProvider(testConfig);
    const unsub = provider.onTransaction(() => {});
    unsub(); // synchronously, before any microtasks run

    await Promise.resolve();
    await Promise.resolve();

    expect(addListenerMock).not.toHaveBeenCalled();
    expect(removeListenerMock).not.toHaveBeenCalled();
  });

  test('double-unsubscribe is idempotent and removes listener exactly once', async () => {
    const provider = createRevenueCatProvider(testConfig);
    const unsub = provider.onTransaction(() => {});

    await Promise.resolve();
    await Promise.resolve();
    expect(addListenerMock).toHaveBeenCalledTimes(1);

    unsub();
    await Promise.resolve();
    await Promise.resolve();

    unsub(); // second call: registered is null → early return
    await Promise.resolve();
    await Promise.resolve();

    expect(removeListenerMock).toHaveBeenCalledTimes(1);
  });

  test('onTransaction listener emits all active entitlements per update', async () => {
    const received: string[] = [];
    const provider = createRevenueCatProvider(testConfig);
    provider.onTransaction((tx) => {
      received.push(tx.productId);
    });

    await Promise.resolve();
    await Promise.resolve();

    const listener = addListenerMock.mock.calls[0]![0] as (info: unknown) => void;
    listener({
      entitlements: {
        active: {
          ent1: {
            identifier: 'ent1',
            productIdentifier: 'prod1',
            purchaseDateMillis: 1700000000000,
          },
          ent2: {
            identifier: 'ent2',
            productIdentifier: 'prod2',
            purchaseDateMillis: 1700000001000,
          },
        },
      },
    });

    expect(received).toHaveLength(2);
    expect(received).toContain('prod1');
    expect(received).toContain('prod2');
  });
});
