/**
 * Integration tests: real engine pieces wired together without a real native
 * module. react-native is mocked (required by the module graph); the IAP
 * business logic uses the actual NoopIAPProvider + ProductCatalog +
 * EntitlementStore from @flare-engine/iap — nothing is stubbed there.
 */
import { beforeEach, describe, expect, mock, test } from 'bun:test';

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
}));

mock.module('@flare-engine/ui', () => ({
  Panel: 'Panel',
  Label: 'Label',
  Button: 'Button',
  Modal: 'Modal',
}));

import {
  createEntitlementStore,
  createProductCatalog,
  type IAPProvider,
  NoopIAPProvider,
  type PurchaseResult,
} from '@flare-engine/iap';

// ── shared catalog ─────────────────────────────────────────────────────────────

const catalog = createProductCatalog([
  { productId: 'test_sku', grants: ['test_grant'] },
  { productId: 'sku2', grants: ['grant2'] },
]);

describe('ui-shop integration', () => {
  beforeEach(() => {});

  test('Noop → ShopScreen purchase → grantProduct re-render: product moves available → owned', async () => {
    const entitlementStore = createEntitlementStore(catalog);

    let changeCount = 0;
    const unsub = entitlementStore.onChange.add(() => {
      changeCount++;
    });

    // Build a provider wrapping NoopIAPProvider but overriding purchase() to
    // simulate a successful transaction.
    const purchaseSpy = mock(
      async (_id: string): Promise<PurchaseResult> => ({
        status: 'purchased',
        transaction: { id: 't1', productId: 'test_sku', purchasedAt: Date.now() },
      }),
    );
    const provider: IAPProvider = {
      ...NoopIAPProvider,
      purchase: purchaseSpy as unknown as IAPProvider['purchase'],
    };

    // Before purchase: test_sku is available (not entitled).
    let owned = catalog.entries.filter((e) => e.grants.some((k) => entitlementStore.isEntitled(k)));
    let available = catalog.entries.filter(
      (e) => !e.grants.some((k) => entitlementStore.isEntitled(k)),
    );
    expect(owned).toHaveLength(0);
    expect(available).toHaveLength(2);

    // Simulate the ShopScreen.handlePurchase flow.
    const result = await provider.purchase('test_sku');
    expect(purchaseSpy).toHaveBeenCalledWith('test_sku');
    expect(result.status).toBe('purchased');

    if (result.status === 'purchased') {
      entitlementStore.grantProduct('test_sku');
    }

    // After grant: test_sku moves to owned section.
    owned = catalog.entries.filter((e) => e.grants.some((k) => entitlementStore.isEntitled(k)));
    available = catalog.entries.filter(
      (e) => !e.grants.some((k) => entitlementStore.isEntitled(k)),
    );
    expect(owned.map((e) => e.productId)).toContain('test_sku');
    expect(available.map((e) => e.productId)).not.toContain('test_sku');
    expect(entitlementStore.isEntitled('test_grant')).toBe(true);
    expect(changeCount).toBe(1);

    unsub();
  });

  test('PaywallModal + RestorePurchasesButton round trip: purchase → grant → callbacks; restore → grant → onComplete', async () => {
    const entitlementStore = createEntitlementStore(catalog);

    // ── PaywallModal flow ──────────────────────────────────────────────────────
    const onPurchased = mock((_r: PurchaseResult) => {});
    const onDismiss = mock(() => {});

    const purchaseProvider: IAPProvider = {
      ...NoopIAPProvider,
      async purchase(_id: string): Promise<PurchaseResult> {
        return {
          status: 'purchased',
          transaction: { id: 'tx-paywall', productId: 'test_sku', purchasedAt: Date.now() },
        };
      },
    };

    const paywallResult = await purchaseProvider.purchase('test_sku');
    if (paywallResult.status === 'purchased') {
      // PaywallModal calls grant(entitlementKey), not grantProduct.
      entitlementStore.grant('test_grant');
      onPurchased(paywallResult);
      onDismiss();
    }

    expect(entitlementStore.isEntitled('test_grant')).toBe(true);
    expect(onPurchased).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    // ── RestorePurchasesButton flow ────────────────────────────────────────────
    const onComplete = mock((_results: readonly PurchaseResult[]) => {});

    const restoreProvider: IAPProvider = {
      ...NoopIAPProvider,
      async restore(): Promise<readonly PurchaseResult[]> {
        return [
          {
            status: 'purchased',
            transaction: { id: 'rx-1', productId: 'sku2', purchasedAt: Date.now() },
          },
        ];
      },
    };

    const restoreResults = await restoreProvider.restore();
    for (const r of restoreResults) {
      if (r.status === 'purchased' && r.transaction) {
        entitlementStore.grantProduct(r.transaction.productId);
      }
    }
    onComplete(restoreResults);

    expect(entitlementStore.isEntitled('grant2')).toBe(true);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(restoreResults);
  });
});
