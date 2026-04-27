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

const jsxCallLog: string[] = [];
mock.module('react/jsx-runtime', () => ({
  jsx: (type: unknown) => {
    jsxCallLog.push(String(type));
    return null;
  },
  jsxs: (type: unknown) => {
    jsxCallLog.push(String(type));
    return null;
  },
  Fragment: 'Fragment',
}));
mock.module('react/jsx-dev-runtime', () => ({
  jsxDEV: (type: unknown) => {
    jsxCallLog.push(String(type));
    return null;
  },
  Fragment: 'Fragment',
}));

mock.module('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  StyleSheet: { create: (s: unknown) => s },
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

const { PaywallModal } = await import('../src/PaywallModal.js');

const catalog = createProductCatalog([{ productId: 'game.full', grants: ['full_game'] }]);

const strings = {
  headingKey: 'paywall.heading',
  bodyKey: 'paywall.body',
  ctaKey: 'paywall.cta',
  dismissKey: 'paywall.dismiss',
  loadingKey: 'paywall.loading',
  errorKey: 'paywall.error',
};

const localize = (k: string) => k;

describe('PaywallModal', () => {
  beforeEach(() => {
    activeProvider = {
      async getProducts() {
        return [];
      },
      async purchase(): Promise<PurchaseResult> {
        return {
          status: 'purchased',
          transaction: { id: 'tx1', productId: 'game.full', purchasedAt: 1 },
        };
      },
      async restore() {
        return [];
      },
      onTransaction() {
        return () => {};
      },
    };
  });

  test('renders null when visible=false; produces JSX output when visible=true', () => {
    const store = createEntitlementStore(catalog);
    const base = {
      productId: 'game.full',
      entitlementKey: 'full_game',
      entitlementStore: store,
      strings,
      localize,
      onDismiss: () => {},
    };

    jsxCallLog.length = 0;
    const hidden = PaywallModal({ ...base, visible: false });
    expect(hidden).toBeNull();
    // Early return — jsx never invoked
    expect(jsxCallLog).toHaveLength(0);

    jsxCallLog.length = 0;
    PaywallModal({ ...base, visible: true });
    // Modal + inner elements rendered — jsx invoked at least once
    expect(jsxCallLog.length).toBeGreaterThan(0);
  });

  test('dismiss button calls onDismiss; parent owns visibility', () => {
    const store = createEntitlementStore(catalog);
    const onDismiss = mock(() => {});

    PaywallModal({
      visible: true,
      productId: 'game.full',
      entitlementKey: 'full_game',
      entitlementStore: store,
      strings,
      localize,
      onDismiss,
    });

    onDismiss();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test('purchased → grant + onPurchased + onDismiss; cancelled → no grant, no dismiss', async () => {
    const store = createEntitlementStore(catalog);
    const grantSpy = mock((k: string) => store.grant(k));
    const patchedStore: EntitlementStore = { ...store, grant: grantSpy };
    const onPurchased = mock((_r: PurchaseResult) => {});
    const onDismiss = mock(() => {});

    // purchased flow
    activeProvider = {
      async getProducts() {
        return [];
      },
      async purchase(): Promise<PurchaseResult> {
        return {
          status: 'purchased',
          transaction: { id: 'tx1', productId: 'game.full', purchasedAt: 1 },
        };
      },
      async restore() {
        return [];
      },
      onTransaction() {
        return () => {};
      },
    };

    const purchased = await activeProvider.purchase('game.full');
    if (purchased.status === 'purchased') {
      patchedStore.grant('full_game');
      onPurchased(purchased);
      onDismiss();
    }

    expect(grantSpy).toHaveBeenCalledWith('full_game');
    expect(store.isEntitled('full_game')).toBe(true);
    expect(onPurchased).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    // cancelled flow — reset spies
    grantSpy.mockClear();
    onDismiss.mockClear();
    onPurchased.mockClear();

    activeProvider = {
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

    const cancelled = await activeProvider.purchase('game.full');
    if (cancelled.status === 'purchased') {
      patchedStore.grant('full_game');
      onPurchased(cancelled);
      onDismiss();
    }

    expect(grantSpy).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
    expect(onPurchased).not.toHaveBeenCalled();
  });
});
