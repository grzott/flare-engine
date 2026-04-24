import { describe, expect, test } from 'bun:test';
import {
  type IAPProvider,
  type PurchaseResult,
  type Transaction,
  createEntitlementStore,
  createProductCatalog,
  getCatalogEntry,
  getGrantsForProduct,
} from '../src/index.js';

const catalog = createProductCatalog([
  {
    productId: 'game.full',
    grants: ['full_game', 'zones.4-8'],
    type: 'non-consumable',
  },
  {
    productId: 'game.cosmetic',
    grants: ['palette.alt'],
    type: 'non-consumable',
  },
  { productId: 'game.shards_small', grants: [], type: 'consumable' },
]);

describe('ProductCatalog', () => {
  test('getGrantsForProduct returns the entry grants', () => {
    expect(getGrantsForProduct(catalog, 'game.full')).toEqual(['full_game', 'zones.4-8']);
    expect(getGrantsForProduct(catalog, 'game.cosmetic')).toEqual(['palette.alt']);
  });

  test('getGrantsForProduct returns empty for unknown product', () => {
    expect(getGrantsForProduct(catalog, 'nonexistent')).toEqual([]);
  });

  test('getCatalogEntry returns the entry or undefined', () => {
    expect(getCatalogEntry(catalog, 'game.full')?.type).toBe('non-consumable');
    expect(getCatalogEntry(catalog, 'missing')).toBeUndefined();
  });
});

describe('EntitlementStore', () => {
  test('isEntitled reflects granted keys', () => {
    const store = createEntitlementStore(catalog);
    expect(store.isEntitled('full_game')).toBe(false);
    store.grant('full_game');
    expect(store.isEntitled('full_game')).toBe(true);
  });

  test('grantProduct expands catalog grants', () => {
    const store = createEntitlementStore(catalog);
    store.grantProduct('game.full');
    expect(store.isEntitled('full_game')).toBe(true);
    expect(store.isEntitled('zones.4-8')).toBe(true);
    expect(store.isEntitled('palette.alt')).toBe(false);
  });

  test('grantProduct with unknown product is a no-op', () => {
    const store = createEntitlementStore(catalog);
    let changes = 0;
    store.onChange.add(() => changes++);
    store.grantProduct('nope');
    expect(changes).toBe(0);
    expect(store.snapshot()).toEqual([]);
  });

  test('onChange fires once per new grant bundle', () => {
    const store = createEntitlementStore(catalog);
    let changes = 0;
    store.onChange.add(() => changes++);

    store.grantProduct('game.full'); // +2 keys, 1 signal
    expect(changes).toBe(1);

    store.grantProduct('game.full'); // already granted, no signal
    expect(changes).toBe(1);

    store.grant('custom'); // +1, 1 signal
    expect(changes).toBe(2);
  });

  test('revoke removes the key and fires onChange', () => {
    const store = createEntitlementStore(catalog, { initial: ['palette.alt'] });
    let changes = 0;
    store.onChange.add(() => changes++);

    store.revoke('palette.alt');
    expect(store.isEntitled('palette.alt')).toBe(false);
    expect(changes).toBe(1);

    store.revoke('palette.alt'); // idempotent
    expect(changes).toBe(1);
  });

  test('snapshot returns a sorted copy', () => {
    const store = createEntitlementStore(catalog);
    store.grantProduct('game.full');
    store.grant('palette.alt');
    expect(store.snapshot()).toEqual(['full_game', 'palette.alt', 'zones.4-8']);
  });

  test('initial seeds entitlements', () => {
    const store = createEntitlementStore(catalog, { initial: ['saved_key'] });
    expect(store.isEntitled('saved_key')).toBe(true);
  });

  test('restoreOnBoot grants entitlements from successful restores', async () => {
    const tx: Transaction = {
      id: 't1',
      productId: 'game.full',
      purchasedAt: 1,
    };
    const provider: IAPProvider = {
      async getProducts() {
        return [];
      },
      async purchase(): Promise<PurchaseResult> {
        return { status: 'cancelled' };
      },
      async restore(): Promise<readonly PurchaseResult[]> {
        return [
          { status: 'purchased', transaction: tx },
          { status: 'cancelled' },
          {
            status: 'purchased',
            transaction: {
              id: 't2',
              productId: 'game.cosmetic',
              purchasedAt: 2,
            },
          },
        ];
      },
      onTransaction() {
        return () => undefined;
      },
    };
    const store = createEntitlementStore(catalog);
    await store.restoreOnBoot(provider);
    expect(store.snapshot()).toEqual(['full_game', 'palette.alt', 'zones.4-8']);
  });

  test('attachProvider grants on transaction + unsubscribes cleanly', () => {
    let listener: ((tx: Transaction) => void) | null = null;
    const provider: IAPProvider = {
      async getProducts() {
        return [];
      },
      async purchase(): Promise<PurchaseResult> {
        return { status: 'cancelled' };
      },
      async restore() {
        return [];
      },
      onTransaction(cb) {
        listener = cb;
        return () => {
          listener = null;
        };
      },
    };
    const store = createEntitlementStore(catalog);
    const unsub = store.attachProvider(provider);
    expect(listener).not.toBeNull();

    listener?.({ id: 't', productId: 'game.full', purchasedAt: 1 });
    expect(store.isEntitled('full_game')).toBe(true);

    unsub();
    expect(listener).toBeNull();
  });
});
