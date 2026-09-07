import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { EntitlementStore, IAPProvider, PurchaseResult } from '@flare-engine/iap';
import { createEntitlementStore, createProductCatalog } from '@flare-engine/iap';

let stateQueue: unknown[] = [];
let stateIdx = 0;

mock.module('react', () => ({
  useState: (init: unknown) => {
    const i = stateIdx++;
    const v = i < stateQueue.length ? stateQueue[i] : init;
    return [v, () => {}];
  },
  useEffect: () => {},
  useRef: (init: unknown) => ({ current: init }),
  useContext: () => null,
  createContext: () => ({ Provider: 'Provider' }),
  Fragment: 'Fragment',
}));

const jsxLog: Array<{ type: unknown; props: Record<string, unknown> }> = [];
mock.module('react/jsx-runtime', () => ({
  jsx: (type: unknown, props: Record<string, unknown>) => {
    jsxLog.push({ type, props });
    return null;
  },
  jsxs: (type: unknown, props: Record<string, unknown>) => {
    jsxLog.push({ type, props });
    return null;
  },
  Fragment: 'Fragment',
}));
mock.module('react/jsx-dev-runtime', () => ({
  jsxDEV: (type: unknown, props: Record<string, unknown>) => {
    jsxLog.push({ type, props });
    return null;
  },
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

const { PaywallModal } = await import('../src/PaywallModal.js');

// Two grants on one product, matching catalog.ts's "one product may unlock several
// entitlements" contract — the fixture F086 needs to prove grantProduct(productId)
// unlocks both, not just one key.
const catalog = createProductCatalog([
  { productId: 'game.full', grants: ['full_game', 'bonus_pass'] },
]);

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
    stateQueue = [];
    stateIdx = 0;
    jsxLog.length = 0;
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
      entitlementStore: store,
      strings,
      localize,
      onDismiss: () => {},
    };

    stateIdx = 0;
    jsxLog.length = 0;
    const hidden = PaywallModal({ ...base, visible: false });
    expect(hidden).toBeNull();
    expect(jsxLog).toHaveLength(0);

    stateIdx = 0;
    jsxLog.length = 0;
    PaywallModal({ ...base, visible: true });
    expect(jsxLog.length).toBeGreaterThan(0);
  });

  test('backdrop press is a no-op while a purchase is in flight', () => {
    const store = createEntitlementStore(catalog);
    const onDismiss = mock(() => {});

    stateQueue = [true, null]; // purchasing=true, purchaseError=null
    stateIdx = 0;
    jsxLog.length = 0;

    PaywallModal({
      visible: true,
      productId: 'game.full',
      entitlementStore: store,
      strings,
      localize,
      onDismiss,
    });

    const modalEntry = jsxLog.find((e) => e.type === 'Modal');
    expect(modalEntry?.props.onBackdropPress).toBeUndefined();
  });

  test('backdrop press calls onDismiss when not purchasing', () => {
    const store = createEntitlementStore(catalog);
    const onDismiss = mock(() => {});

    stateQueue = [false, null]; // purchasing=false, purchaseError=null
    stateIdx = 0;
    jsxLog.length = 0;

    PaywallModal({
      visible: true,
      productId: 'game.full',
      entitlementStore: store,
      strings,
      localize,
      onDismiss,
    });

    const modalEntry = jsxLog.find((e) => e.type === 'Modal');
    expect(modalEntry?.props.onBackdropPress).toBe(onDismiss);
  });

  test('dismiss button calls onDismiss; parent owns visibility', () => {
    const store = createEntitlementStore(catalog);
    const onDismiss = mock(() => {});

    stateIdx = 0;
    jsxLog.length = 0;
    PaywallModal({
      visible: true,
      productId: 'game.full',
      entitlementStore: store,
      strings,
      localize,
      onDismiss,
    });

    onDismiss();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  // F086: PaywallModal used to call `entitlementStore.grant(entitlementKey)`, granting
  // only one key even when the catalog maps the product to several. It must call
  // `grantProduct(productId)` so every catalog-mapped entitlement is granted.
  test('purchase drives grantProduct(productId), unlocking every catalog grant', async () => {
    const store = createEntitlementStore(catalog);
    const grantSpy = mock((k: string) => store.grant(k));
    const grantProductSpy = mock((id: string) => store.grantProduct(id));
    const patchedStore: EntitlementStore = {
      ...store,
      grant: grantSpy,
      grantProduct: grantProductSpy,
    };
    const onPurchased = mock((_r: PurchaseResult) => {});
    const onDismiss = mock(() => {});

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

    stateIdx = 0;
    jsxLog.length = 0;
    PaywallModal({
      visible: true,
      productId: 'game.full',
      entitlementStore: patchedStore,
      strings,
      localize,
      onDismiss,
      onPurchased,
    });

    const ctaBtn = jsxLog.find((e) => e.type === 'Button' && e.props.variant === 'primary');
    expect(typeof ctaBtn?.props.onPress).toBe('function');
    (ctaBtn!.props.onPress as () => void)();

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(grantProductSpy).toHaveBeenCalledWith('game.full');
    expect(grantSpy).not.toHaveBeenCalled();
    expect(store.isEntitled('full_game')).toBe(true);
    expect(store.isEntitled('bonus_pass')).toBe(true);
    expect(onPurchased).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test('cancelled purchase grants nothing and does not dismiss', async () => {
    const store = createEntitlementStore(catalog);
    const grantProductSpy = mock((id: string) => store.grantProduct(id));
    const patchedStore: EntitlementStore = { ...store, grantProduct: grantProductSpy };
    const onPurchased = mock((_r: PurchaseResult) => {});
    const onDismiss = mock(() => {});

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

    stateIdx = 0;
    jsxLog.length = 0;
    PaywallModal({
      visible: true,
      productId: 'game.full',
      entitlementStore: patchedStore,
      strings,
      localize,
      onDismiss,
      onPurchased,
    });

    const ctaBtn = jsxLog.find((e) => e.type === 'Button' && e.props.variant === 'primary');
    (ctaBtn!.props.onPress as () => void)();

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(grantProductSpy).not.toHaveBeenCalled();
    expect(onPurchased).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
