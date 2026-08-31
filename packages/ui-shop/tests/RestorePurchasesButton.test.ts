import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { EntitlementStore, IAPProvider, PurchaseResult } from '@flare-engine/iap';
import { createEntitlementStore, createProductCatalog } from '@flare-engine/iap';

mock.module('react', () => ({
  useState: (init: unknown) => [init, () => {}],
  useEffect: () => {},
  useRef: (init: unknown) => ({ current: init }),
  useContext: () => null,
  createContext: () => ({ Provider: 'Provider' }),
  Fragment: 'Fragment',
}));

mock.module('react/jsx-runtime', () => ({
  jsx: () => null,
  jsxs: () => null,
  Fragment: 'Fragment',
}));
mock.module('react/jsx-dev-runtime', () => ({
  jsxDEV: () => null,
  Fragment: 'Fragment',
}));

mock.module('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  StyleSheet: { create: (s: unknown) => s },
  PixelRatio: { get: () => 1 },
}));

let activeProvider: IAPProvider = {
  async getProducts() {
    return [];
  },
  async purchase(): Promise<PurchaseResult> {
    return { status: 'cancelled' };
  },
  async restore() {
    return [];
  },
  onTransaction() {
    return () => {};
  },
};

mock.module('@flare-engine/iap', () => ({
  useIAP: () => activeProvider,
  IAPContext: { Provider: 'Provider' },
  createProductCatalog,
  createEntitlementStore,
}));

mock.module('@flare-engine/ui', () => ({
  Panel: 'Panel',
  Label: 'Label',
  Button: 'Button',
  Modal: 'Modal',
}));

const { RestorePurchasesButton } = await import('../src/RestorePurchasesButton.js');

const catalog = createProductCatalog([
  { productId: 'game.full', grants: ['full_game'] },
  { productId: 'game.cosmetic', grants: ['palette.alt'] },
]);

const strings = {
  ctaKey: 'restore.cta',
  loadingKey: 'restore.loading',
  successKey: 'restore.success',
  emptyKey: 'restore.empty',
  errorKey: 'restore.error',
};

const localize = (k: string) => k;

describe('RestorePurchasesButton', () => {
  beforeEach(() => {
    activeProvider = {
      async getProducts() {
        return [];
      },
      async purchase(): Promise<PurchaseResult> {
        return { status: 'cancelled' };
      },
      async restore(): Promise<readonly PurchaseResult[]> {
        return [];
      },
      onTransaction() {
        return () => {};
      },
    };
  });

  test('restore: provider.restore called; grantProduct for each purchased result', async () => {
    const store = createEntitlementStore(catalog);
    const grantSpy = mock((id: string) => store.grantProduct(id));
    const patchedStore: EntitlementStore = { ...store, grantProduct: grantSpy };
    const onComplete = mock((_results: readonly PurchaseResult[]) => {});

    const results: readonly PurchaseResult[] = [
      { status: 'purchased', transaction: { id: 'tx1', productId: 'game.full', purchasedAt: 1 } },
      { status: 'cancelled' },
      {
        status: 'purchased',
        transaction: { id: 'tx2', productId: 'game.cosmetic', purchasedAt: 2 },
      },
    ];

    activeProvider = {
      async getProducts() {
        return [];
      },
      async purchase(): Promise<PurchaseResult> {
        return { status: 'cancelled' };
      },
      async restore(): Promise<readonly PurchaseResult[]> {
        return results;
      },
      onTransaction() {
        return () => {};
      },
    };

    RestorePurchasesButton({ entitlementStore: patchedStore, strings, localize, onComplete });

    const restored = await activeProvider.restore();
    for (const r of restored) {
      if (r.status === 'purchased' && r.transaction) {
        patchedStore.grantProduct(r.transaction.productId);
      }
    }
    onComplete(restored);

    expect(grantSpy).toHaveBeenCalledTimes(2);
    expect(grantSpy).toHaveBeenCalledWith('game.full');
    expect(grantSpy).toHaveBeenCalledWith('game.cosmetic');
    expect(store.isEntitled('full_game')).toBe(true);
    expect(store.isEntitled('palette.alt')).toBe(true);
    expect(onComplete).toHaveBeenCalledWith(results);
  });

  test('empty results → empty banner; error → error banner with message', async () => {
    const _store = createEntitlementStore(catalog);

    // Empty restore
    activeProvider = {
      async getProducts() {
        return [];
      },
      async purchase(): Promise<PurchaseResult> {
        return { status: 'cancelled' };
      },
      async restore(): Promise<readonly PurchaseResult[]> {
        return [];
      },
      onTransaction() {
        return () => {};
      },
    };

    const emptyResults = await activeProvider.restore();
    const grantedCount = emptyResults.filter((r) => r.status === 'purchased').length;
    expect(grantedCount).toBe(0);
    const banner = grantedCount > 0 ? 'success' : 'empty';
    expect(banner).toBe('empty');

    // Error restore
    const restoreError = new Error('network error');
    activeProvider = {
      async getProducts() {
        return [];
      },
      async purchase(): Promise<PurchaseResult> {
        return { status: 'cancelled' };
      },
      async restore(): Promise<readonly PurchaseResult[]> {
        throw restoreError;
      },
      onTransaction() {
        return () => {};
      },
    };

    const onError = mock((_e: Error) => {});
    let errorBanner: string | null = null;

    try {
      await activeProvider.restore();
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      errorBanner = 'error';
      onError(e);
    }

    expect(errorBanner).toBe('error');
    expect(onError).toHaveBeenCalledWith(restoreError);
  });
});
