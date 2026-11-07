import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type {
  RevenueCatCustomerInfo,
  RevenueCatEntitlement,
  RevenueCatNonSubscriptionTransaction,
  RevenueCatStoreProduct,
} from '../src/index.js';

const configureMock = mock(() => {});
// The mocks are annotated with the package's exported SDK shapes. Left to inference, their return
// types froze whichever object literal was written first (one entitlement key, an empty
// `nonSubscriptionTransactions`) into the contract, so a `mockImplementationOnce` using any other
// entitlement id, or any transaction at all, failed to typecheck.
const getProductsMock = mock(
  async (_ids: string[], _category?: string): Promise<RevenueCatStoreProduct[]> => [
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
  ],
);
const purchaseMock = mock(
  async (_product: unknown): Promise<{ customerInfo: RevenueCatCustomerInfo }> => ({
    customerInfo: {
      originalPurchaseDate: '2024-01-01T00:00:00Z',
      entitlements: { all: {}, active: {} },
      nonSubscriptionTransactions: [],
    },
  }),
);
const restoreMock = mock(
  async (): Promise<RevenueCatCustomerInfo> => ({
    originalPurchaseDate: null,
    entitlements: {
      active: {
        premium: {
          identifier: 'premium',
          productIdentifier: 'x',
          latestPurchaseDateMillis: 1700000000000,
          expirationDate: null,
        },
      },
      all: {
        premium: {
          identifier: 'premium',
          productIdentifier: 'x',
          latestPurchaseDateMillis: 1700000000000,
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
  PixelRatio: { get: () => 1 },
}));

import { createRevenueCatProvider } from '../src/provider.js';

const testConfig = {
  apiKeyIos: 'ios-key',
  apiKeyAndroid: 'android-key',
};

/**
 * `onTransaction` registers its listener only after `await import('react-native-purchases')`, and
 * how many event-loop turns that import takes is a runtime detail: two microtasks were enough under
 * bun 1.3.11 and not under 1.4.4. Wait for the effect itself; the bound turns a regression into a
 * failed assertion instead of a hang.
 */
async function waitFor(done: () => boolean): Promise<void> {
  for (let turn = 0; turn < 100 && !done(); turn++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

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

  test('fakes typed as the exported RevenueCat SDK shapes map to Product and PurchaseResult', async () => {
    const product: RevenueCatStoreProduct = {
      identifier: 'typed_sku',
      title: 'Typed SKU',
      description: 'typed',
      priceString: '€2.50',
      price: 2.5,
      currencyCode: 'EUR',
      productType: 'NON_CONSUMABLE',
    };
    const entitlement: RevenueCatEntitlement = {
      identifier: 'typed_ent',
      productIdentifier: 'typed_sku',
      latestPurchaseDateMillis: 1700000000000,
    };
    const tx: RevenueCatNonSubscriptionTransaction = {
      transactionIdentifier: 'txn_typed',
      productIdentifier: 'typed_sku',
      purchaseDateMillis: 1700000001000,
    };
    const info: RevenueCatCustomerInfo = {
      entitlements: { active: { typed_ent: entitlement } },
      nonSubscriptionTransactions: [tx],
    };
    // getProducts is hit once directly and once inside purchase().
    getProductsMock.mockImplementationOnce(async () => [product]);
    getProductsMock.mockImplementationOnce(async () => [product]);
    purchaseMock.mockImplementationOnce(async () => ({ customerInfo: info }));
    restoreMock.mockImplementationOnce(async () => info);

    const provider = createRevenueCatProvider(testConfig);

    const products = await provider.getProducts(['typed_sku']);
    expect(products).toEqual([
      {
        id: 'typed_sku',
        title: 'Typed SKU',
        description: 'typed',
        priceDisplay: '€2.50',
        priceMicros: 2500000,
        currency: 'EUR',
        type: 'non-consumable',
      },
    ]);

    const purchased = await provider.purchase('typed_sku');
    expect(purchaseMock.mock.calls[0]![0]).toBe(product);
    expect(purchased.status).toBe('purchased');
    expect(purchased.transaction?.id).toBe('txn_typed');
    expect(purchased.transaction?.productId).toBe('typed_sku');
    expect(purchased.transaction?.purchasedAt).toBe(1700000001000);
    expect(purchased.transaction?.raw).toBe(info);

    const restored = await provider.restore();
    expect(restored.map((r) => [r.status, r.transaction?.id, r.transaction?.purchasedAt])).toEqual([
      ['purchased', 'typed_ent', 1700000000000],
      ['purchased', 'txn_typed', 1700000001000],
    ]);
    expect(restored[0]?.transaction?.raw).toBe(entitlement);
    expect(restored[1]?.transaction?.raw).toBe(tx);
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

    await waitFor(() => addListenerMock.mock.calls.length > 0);
    expect(addListenerMock).toHaveBeenCalledTimes(1);

    unsub();

    await waitFor(() => removeListenerMock.mock.calls.length > 0);
    expect(removeListenerMock).toHaveBeenCalledTimes(1);
    expect(removeListenerMock.mock.calls[0]![0]).toBe(addListenerMock.mock.calls[0]![0]);
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
            latestPurchaseDateMillis: 1700000000000,
            expirationDate: null,
          },
        },
        all: {
          ent_active: {
            identifier: 'ent_active',
            productIdentifier: 'x_active',
            latestPurchaseDateMillis: 1700000000000,
            expirationDate: null,
          },
          ent_expired: {
            identifier: 'ent_expired',
            productIdentifier: 'x_expired',
            latestPurchaseDateMillis: 1600000000000,
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

  // F085: the real SDK has no `purchaseDateMillis` on an entitlement — only
  // `latestPurchaseDateMillis`. This fixture uses the real field name, so it fails
  // against a reader that still looks for `purchaseDateMillis`.
  test('restore reads entitlement purchasedAt from latestPurchaseDateMillis', async () => {
    restoreMock.mockImplementationOnce(async () => ({
      originalPurchaseDate: null,
      entitlements: {
        active: {
          premium: {
            identifier: 'premium',
            productIdentifier: 'x',
            latestPurchaseDateMillis: 1650000000000,
            expirationDate: null,
          },
        },
        all: {},
      },
      nonSubscriptionTransactions: [],
    }));

    const provider = createRevenueCatProvider(testConfig);
    const results = await provider.restore();

    const purchased = results.find((r) => r.transaction?.productId === 'x');
    expect(purchased?.transaction?.purchasedAt).toBe(1650000000000);
  });

  // F085 hardening: hybrid-common's mappers emit `purchaseDateMillis` on a
  // StoreTransaction at runtime, but the SDK's own .d.ts only declares the ISO
  // `purchaseDate` string. When only the ISO form is present, fall back to it.
  test('purchase falls back to Date.parse(purchaseDate) when purchaseDateMillis is absent', async () => {
    purchaseMock.mockImplementationOnce(async () => ({
      customerInfo: {
        originalPurchaseDate: '2024-01-01T00:00:00Z',
        entitlements: { all: {}, active: {} },
        nonSubscriptionTransactions: [
          {
            transactionIdentifier: 'txn_iso_only',
            productIdentifier: 'x',
            purchaseDate: '2023-11-14T22:13:20.000Z',
          },
        ],
      },
    }));

    const provider = createRevenueCatProvider(testConfig);
    const result = await provider.purchase('x');

    expect(result.transaction!.id).toBe('txn_iso_only');
    expect(result.transaction!.purchasedAt).toBe(Date.parse('2023-11-14T22:13:20.000Z'));
  });

  // F085 hardening: `Date.parse` returns NaN for a malformed string, and `NaN ?? x`
  // is `NaN` (NaN is neither null nor undefined) — a bare `?? Date.parse(...)` chain
  // would let a malformed payload poison `purchasedAt` with NaN instead of falling
  // through to `Date.now()`.
  test('malformed purchaseDate does not leak NaN as purchasedAt', async () => {
    const before = Date.now();
    purchaseMock.mockImplementationOnce(async () => ({
      customerInfo: {
        originalPurchaseDate: null,
        entitlements: { all: {}, active: {} },
        nonSubscriptionTransactions: [
          {
            transactionIdentifier: 'txn_bad_date',
            productIdentifier: 'x',
            purchaseDate: 'not-a-date',
          },
        ],
      },
    }));

    const provider = createRevenueCatProvider(testConfig);
    const result = await provider.purchase('x');
    const after = Date.now();

    expect(Number.isNaN(result.transaction!.purchasedAt)).toBe(false);
    expect(result.transaction!.purchasedAt).toBeGreaterThanOrEqual(before);
    expect(result.transaction!.purchasedAt).toBeLessThanOrEqual(after);
  });

  test('unsubscribe before SDK resolves prevents listener registration', async () => {
    const provider = createRevenueCatProvider(testConfig);
    const cancelled: string[] = [];
    const later: string[] = [];
    const unsub = provider.onTransaction((tx) => cancelled.push(tx.productId));
    unsub(); // synchronously, before any microtasks run

    // The later subscription's SDK import resolves after the cancelled one's (imports settle in
    // call order), so once it has registered, the cancelled one has had its chance to.
    provider.onTransaction((tx) => later.push(tx.productId));
    await waitFor(() => addListenerMock.mock.calls.length > 0);

    const info = {
      entitlements: {
        active: { a: { identifier: 'a', productIdentifier: 'p', latestPurchaseDateMillis: 1 } },
      },
    };
    for (const [listener] of addListenerMock.mock.calls) {
      (listener as (info: unknown) => void)(info);
    }
    expect(later).toEqual(['p']);
    expect(cancelled).toEqual([]);
    expect(addListenerMock).toHaveBeenCalledTimes(1);
    expect(removeListenerMock).not.toHaveBeenCalled();
  });

  test('double-unsubscribe is idempotent and removes listener exactly once', async () => {
    const provider = createRevenueCatProvider(testConfig);
    const unsub = provider.onTransaction(() => {});

    await waitFor(() => addListenerMock.mock.calls.length > 0);
    expect(addListenerMock).toHaveBeenCalledTimes(1);

    unsub();
    await waitFor(() => removeListenerMock.mock.calls.length > 0);

    unsub(); // second call: registered is null → early return

    // A removal the second call scheduled would run before a subscription made after it.
    provider.onTransaction(() => {});
    await waitFor(() => addListenerMock.mock.calls.length > 1);
    expect(addListenerMock).toHaveBeenCalledTimes(2);

    expect(removeListenerMock).toHaveBeenCalledTimes(1);
  });

  test('onTransaction listener emits all active entitlements per update', async () => {
    const received: Array<{ productId: string; purchasedAt: number }> = [];
    const provider = createRevenueCatProvider(testConfig);
    provider.onTransaction((tx) => {
      received.push({ productId: tx.productId, purchasedAt: tx.purchasedAt });
    });

    await waitFor(() => addListenerMock.mock.calls.length > 0);

    const listener = addListenerMock.mock.calls[0]![0] as (info: unknown) => void;
    listener({
      entitlements: {
        active: {
          ent1: {
            identifier: 'ent1',
            productIdentifier: 'prod1',
            latestPurchaseDateMillis: 1700000000000,
          },
          ent2: {
            identifier: 'ent2',
            productIdentifier: 'prod2',
            latestPurchaseDateMillis: 1700000001000,
          },
        },
      },
    });

    expect(received).toHaveLength(2);
    const prod1 = received.find((r) => r.productId === 'prod1');
    const prod2 = received.find((r) => r.productId === 'prod2');
    expect(prod1?.purchasedAt).toBe(1700000000000);
    expect(prod2?.purchasedAt).toBe(1700000001000);
  });
});
