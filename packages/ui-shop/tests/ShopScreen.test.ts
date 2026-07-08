import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { EntitlementStore, IAPProvider, PurchaseResult } from '@flare-engine/iap';
import { createEntitlementStore, createProductCatalog } from '@flare-engine/iap';

const effects: Array<() => (() => void) | undefined> = [];

let stateQueue: unknown[] = [];
let stateIdx = 0;
const setters: Array<{ mock: { calls: unknown[][] } }> = [];

mock.module('react', () => ({
  useState: (init: unknown) => {
    const i = stateIdx++;
    const v = i < stateQueue.length ? stateQueue[i] : init;
    const setter = mock((_: unknown) => {});
    setters[i] = setter;
    return [v, setter];
  },
  useEffect: (fn: () => (() => void) | undefined) => {
    effects.push(fn);
  },
  useRef: (init: unknown) => ({ current: init }),
  useContext: () => null,
  createContext: () => ({ Provider: 'Provider', Consumer: 'Consumer' }),
  Fragment: 'Fragment',
}));

const jsxLog: Array<{ type: unknown; props: Record<string, unknown> }> = [];
const record = (type: unknown, props: Record<string, unknown>) => {
  jsxLog.push({ type, props });
  return null;
};
mock.module('react/jsx-runtime', () => ({ jsx: record, jsxs: record, Fragment: 'Fragment' }));
mock.module('react/jsx-dev-runtime', () => ({ jsxDEV: record, Fragment: 'Fragment' }));

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

const { ShopScreen } = await import('../src/ShopScreen.js');

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

const fakeProducts = [
  { id: 'game.full', title: 'Full Game', priceDisplay: '$4.99' },
  { id: 'game.cosmetic', title: 'Cosmetic', priceDisplay: '$0.99' },
];

describe('ShopScreen', () => {
  beforeEach(() => {
    stateQueue = [];
    stateIdx = 0;
    jsxLog.length = 0;
    effects.length = 0;
    setters.length = 0;
    getProductsMock.mockClear();
    purchaseMock.mockClear();
  });

  test('calls provider.getProducts exactly once on mount', async () => {
    const store = createEntitlementStore(catalog);
    stateIdx = 0;
    jsxLog.length = 0;
    ShopScreen({ catalog, entitlementStore: store, copy, strings, localize });

    for (const eff of effects) eff();

    await Promise.resolve();
    await Promise.resolve();

    expect(getProductsMock).toHaveBeenCalledTimes(1);
    expect(getProductsMock).toHaveBeenCalledWith(['game.full', 'game.cosmetic']);
  });

  test('owned product gets disabled ghost Button; available product gets primary Button', () => {
    const store = createEntitlementStore(catalog, { initial: ['full_game'] });

    stateQueue = [fakeProducts, null, null, 0];
    stateIdx = 0;
    jsxLog.length = 0;

    ShopScreen({ catalog, entitlementStore: store, copy, strings, localize });

    const buttons = jsxLog.filter((e) => e.type === 'Button');
    const ownedBtns = buttons.filter((e) => e.props.disabled === true);
    const availBtns = buttons.filter(
      (e) => e.props.variant === 'primary' && e.props.disabled !== true,
    );

    expect(ownedBtns).toHaveLength(1);
    expect(availBtns).toHaveLength(1);
    expect(ownedBtns[0]?.props.label).toBe('owned.full');
    expect(ownedBtns[0]?.props.variant).toBe('ghost');
    expect(availBtns[0]?.props.label).toBe('cta.cos');
  });

  test('CTA onPress: purchase → grantProduct on purchased status', async () => {
    const store = createEntitlementStore(catalog);
    const grantSpy = mock((id: string) => store.grantProduct(id));
    const patchedStore: EntitlementStore = { ...store, grantProduct: grantSpy };

    stateQueue = [fakeProducts, null, null, 0];
    stateIdx = 0;
    jsxLog.length = 0;

    ShopScreen({ catalog, entitlementStore: patchedStore, copy, strings, localize });

    const cosBtn = jsxLog.find((e) => e.type === 'Button' && e.props.label === 'cta.cos');
    expect(typeof cosBtn?.props.onPress).toBe('function');

    (cosBtn?.props.onPress as () => void)();

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(purchaseMock).toHaveBeenCalledWith('game.cosmetic');
    expect(grantSpy).toHaveBeenCalledWith('game.cosmetic');
    expect(store.isEntitled('palette.alt')).toBe(true);
  });

  test('entitlementStore.onChange subscription triggers entitlementTick setter', () => {
    const store = createEntitlementStore(catalog);
    stateIdx = 0;
    jsxLog.length = 0;

    ShopScreen({ catalog, entitlementStore: store, copy, strings, localize });

    // effects[1] is the onChange subscription effect
    const cleanup = effects[1]?.();

    store.grantProduct('game.full');

    expect(setters[3]?.mock.calls).toHaveLength(1);

    if (typeof cleanup === 'function') cleanup();
  });
});
