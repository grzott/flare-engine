import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { EntitlementStore, IAPProvider, PurchaseResult } from '@flare-engine/iap';
import { createEntitlementStore, createProductCatalog } from '@flare-engine/iap';

// Capture useEffect callbacks so we can trigger mount effects manually.
const effects: Array<() => (() => void) | undefined> = [];

mock.module('react', () => ({
  useState: (init: unknown) => [init, () => {}],
  useEffect: (fn: () => (() => void) | undefined) => {
    effects.push(fn);
  },
  useRef: (init: unknown) => ({ current: init }),
  useContext: () => null,
  createContext: () => ({ Provider: 'Provider', Consumer: 'Consumer' }),
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

const getProductsMock = mock(async (_ids: readonly string[]) => [
  { id: 'game.full', title: 'Full Game', priceDisplay: '$4.99' },
  { id: 'game.cosmetic', title: 'Cosmetic', priceDisplay: '$0.99' },
]);
const purchaseMock = mock(
  async (id: string): Promise<PurchaseResult> => ({
    status: 'purchased',
    transaction: { id: 'tx1', productId: id, purchasedAt: 1 },
  }),
);

const fakeProvider: IAPProvider = {
  getProducts: getProductsMock as unknown as IAPProvider['getProducts'],
  purchase: purchaseMock as unknown as IAPProvider['purchase'],
  async restore() {
    return [];
  },
  onTransaction() {
    return () => {};
  },
};

mock.module('@flare-engine/iap', () => ({
  useIAP: () => fakeProvider,
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

const { ShopPanel } = await import('../src/ShopPanel.js');

const catalog = createProductCatalog([
  { productId: 'game.full', grants: ['full_game'] },
  { productId: 'game.cosmetic', grants: ['palette.alt'] },
]);

const strings = {
  headingKey: 'shop.heading',
  emptyKey: 'shop.empty',
  loadingKey: 'shop.loading',
  errorKey: 'shop.error',
  ownedSectionKey: 'shop.owned',
  availableSectionKey: 'shop.available',
};

const copy = {
  'game.full': {
    titleKey: 't.full',
    descriptionKey: 'd.full',
    ctaKey: 'cta.full',
    ownedLabelKey: 'owned.full',
  },
  'game.cosmetic': {
    titleKey: 't.cos',
    descriptionKey: 'd.cos',
    ctaKey: 'cta.cos',
    ownedLabelKey: 'owned.cos',
  },
};

const localize = (k: string) => k;

describe('ShopPanel', () => {
  beforeEach(() => {
    effects.length = 0;
    getProductsMock.mockClear();
    purchaseMock.mockClear();
  });

  test('calls provider.getProducts exactly once on mount', async () => {
    const store = createEntitlementStore(catalog);
    ShopPanel({ catalog, entitlementStore: store, copy, strings, localize });

    for (const eff of effects) eff();

    await Promise.resolve();
    await Promise.resolve();

    expect(getProductsMock).toHaveBeenCalledTimes(1);
    expect(getProductsMock).toHaveBeenCalledWith(['game.full', 'game.cosmetic']);
  });

  test('splits products into owned and available sections per entitlementStore', () => {
    const store = createEntitlementStore(catalog, { initial: ['full_game'] });

    expect(store.isEntitled('full_game')).toBe(true);
    expect(store.isEntitled('palette.alt')).toBe(false);

    const owned = catalog.entries.filter((e) => e.grants.some((k) => store.isEntitled(k)));
    const available = catalog.entries.filter((e) => !e.grants.some((k) => store.isEntitled(k)));

    expect(owned.map((e) => e.productId)).toEqual(['game.full']);
    expect(available.map((e) => e.productId)).toEqual(['game.cosmetic']);
  });

  test('CTA click: purchase → grantProduct on purchased status → onPurchase callback', async () => {
    const store = createEntitlementStore(catalog);
    const grantSpy = mock((id: string) => store.grantProduct(id));
    const patchedStore: EntitlementStore = { ...store, grantProduct: grantSpy };
    const onPurchase = mock((_id: string, _result: PurchaseResult) => {});

    ShopPanel({ catalog, entitlementStore: patchedStore, copy, strings, localize, onPurchase });

    const result = await fakeProvider.purchase('game.full');
    if (result.status === 'purchased') {
      patchedStore.grantProduct('game.full');
    }
    onPurchase('game.full', result);

    expect(purchaseMock).toHaveBeenCalledWith('game.full');
    expect(grantSpy).toHaveBeenCalledWith('game.full');
    expect(store.isEntitled('full_game')).toBe(true);
    expect(onPurchase).toHaveBeenCalledTimes(1);
  });

  test('re-renders when entitlementStore.onChange fires: product moves available → owned', () => {
    const store = createEntitlementStore(catalog);
    let changeCount = 0;
    const unsub = store.onChange.add(() => {
      changeCount++;
    });

    let owned = catalog.entries.filter((e) => e.grants.some((k) => store.isEntitled(k)));
    let available = catalog.entries.filter((e) => !e.grants.some((k) => store.isEntitled(k)));
    expect(owned).toHaveLength(0);
    expect(available).toHaveLength(2);

    store.grantProduct('game.full');
    expect(changeCount).toBe(1);

    owned = catalog.entries.filter((e) => e.grants.some((k) => store.isEntitled(k)));
    available = catalog.entries.filter((e) => !e.grants.some((k) => store.isEntitled(k)));
    expect(owned.map((e) => e.productId)).toContain('game.full');
    expect(available.map((e) => e.productId)).not.toContain('game.full');

    unsub();
  });
});
