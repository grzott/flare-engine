import type {
  IAPProvider,
  Product,
  ProductId,
  PurchaseResult,
  Transaction,
  Unsubscribe,
} from '@flare-engine/iap';
import type {
  RevenueCatConfig,
  RevenueCatCustomerInfo,
  RevenueCatNonSubscriptionTransaction,
  RevenueCatPurchasesModule,
  RevenueCatStoreProduct,
} from './types.js';

function mapProductType(category?: string, type?: string): Product['type'] {
  const typ = (type ?? '').toLowerCase();
  const cat = (category ?? '').toLowerCase();
  if (typ === 'consumable') return 'consumable';
  if (typ === 'non_consumable') return 'non-consumable';
  if (typ.includes('subscription') || cat === 'subscription') return 'subscription';
  if (cat === 'non_subscription') return 'non-consumable';
  return undefined;
}

function mapProduct(p: RevenueCatStoreProduct): Product {
  return {
    id: p.identifier,
    title: p.title,
    description: p.description,
    priceDisplay: p.priceString,
    priceMicros: p.price * 1e6,
    currency: p.currencyCode,
    type: mapProductType(p.productCategory, p.productType),
  };
}

function mapRestoreResults(info: RevenueCatCustomerInfo): readonly PurchaseResult[] {
  const results: PurchaseResult[] = [];

  for (const ent of Object.values(info.entitlements?.active ?? {})) {
    results.push({
      status: 'purchased',
      transaction: {
        id: ent.identifier,
        productId: ent.productIdentifier,
        purchasedAt: ent.purchaseDateMillis ?? Date.now(),
        raw: ent,
      },
    });
  }

  for (const tx of info.nonSubscriptionTransactions ?? []) {
    results.push({
      status: 'purchased',
      transaction: {
        id: tx.transactionIdentifier,
        productId: tx.productIdentifier,
        purchasedAt: tx.purchaseDateMillis ?? Date.now(),
        raw: tx,
      },
    });
  }

  return results;
}

function findPurchaseTx(
  info: RevenueCatCustomerInfo,
  productId: string,
): RevenueCatNonSubscriptionTransaction | undefined {
  const txs = info.nonSubscriptionTransactions ?? [];
  for (let i = txs.length - 1; i >= 0; i--) {
    if (txs[i]!.productIdentifier === productId) return txs[i];
  }
  return undefined;
}

export function createRevenueCatProvider(config: RevenueCatConfig): IAPProvider {
  // Per-instance cache so multiple providers are independent (and tests are isolated).
  let sdkCache: RevenueCatPurchasesModule | null = null;
  // Memoize the whole configure sequence, not a post-await boolean: a boolean flips
  // only after two awaits, so concurrent first callers (e.g. Promise.all([getProducts,
  // restore])) all pass the guard and double-call Purchases.configure (which RevenueCat
  // rejects). A shared promise makes configure run exactly once for all in-flight callers.
  let configurePromise: Promise<RevenueCatPurchasesModule> | null = null;

  // Lazy-import keeps react-native-purchases off the module graph on platforms
  // (e.g., web) where it is not installed or not needed.
  async function getSDK(): Promise<RevenueCatPurchasesModule> {
    if (sdkCache) return sdkCache;
    const mod = await import('react-native-purchases');
    sdkCache = (mod.default ?? mod) as RevenueCatPurchasesModule;
    return sdkCache;
  }

  async function ensureConfigured(): Promise<RevenueCatPurchasesModule> {
    if (configurePromise === null) {
      configurePromise = (async () => {
        const Purchases = await getSDK();
        // react-native is also lazy-loaded so this module never hard-loads on web.
        const rn = await import('react-native');
        const apiKey = rn.Platform.OS === 'ios' ? config.apiKeyIos : config.apiKeyAndroid;
        Purchases.configure({ apiKey, appUserID: config.appUserId ?? null });
        return Purchases;
      })();
    }
    const pending = configurePromise;
    try {
      return await pending;
    } catch (err) {
      // A failed configure must not poison every future call: clear the memo so a later
      // call retries (mirrors the old flag, which stayed false when configure threw).
      // Compare-and-clear: only null OUR attempt — a later caller may already have
      // installed a fresh promise, which must not be wiped out from under it.
      if (configurePromise === pending) configurePromise = null;
      throw err;
    }
  }

  return {
    async getProducts(ids: readonly ProductId[]): Promise<readonly Product[]> {
      try {
        const Purchases = await ensureConfigured();
        const raw = await Purchases.getProducts([...ids], config.productCategory);
        return raw.map(mapProduct);
      } catch (err) {
        config.onError?.(err);
        return [];
      }
    },

    async purchase(id: ProductId): Promise<PurchaseResult> {
      // No-throw contract: all paths return PurchaseResult rather than throw.
      try {
        const Purchases = await ensureConfigured();
        const products = await Purchases.getProducts([id], config.productCategory);
        const product = products[0];
        if (!product) {
          return { status: 'failed', error: new Error(`Product not found: ${id}`) };
        }
        const { customerInfo } = await Purchases.purchaseStoreProduct(product);
        const tx = findPurchaseTx(customerInfo, id);
        return {
          status: 'purchased',
          transaction: {
            // Prefer the store's real transaction id; the date fallback is a documented
            // best-effort only when the SDK surface exposes no transaction id (not a real id).
            id:
              tx?.transactionIdentifier ?? customerInfo.originalPurchaseDate ?? String(Date.now()),
            productId: id,
            purchasedAt: tx?.purchaseDateMillis ?? Date.now(),
            raw: customerInfo,
          },
        };
      } catch (err) {
        if (
          err !== null &&
          typeof err === 'object' &&
          'userCancelled' in err &&
          (err as { userCancelled: unknown }).userCancelled === true
        ) {
          return { status: 'cancelled' };
        }
        return {
          status: 'failed',
          error: err instanceof Error ? err : new Error(String(err)),
        };
      }
    },

    async restore(): Promise<readonly PurchaseResult[]> {
      try {
        const Purchases = await ensureConfigured();
        const info = await Purchases.restorePurchases();
        return mapRestoreResults(info);
      } catch (err) {
        config.onError?.(err);
        return [];
      }
    },

    onTransaction(cb: (tx: Transaction) => void): Unsubscribe {
      let cancelled = false;
      let registered: ((info: RevenueCatCustomerInfo) => void) | null = null;

      getSDK()
        .then((Purchases) => {
          if (cancelled) return; // pre-resolution unsubscribe → never register
          const listener = (info: RevenueCatCustomerInfo) => {
            for (const ent of Object.values(info.entitlements?.active ?? {})) {
              cb({
                id: ent.identifier,
                productId: ent.productIdentifier,
                purchasedAt: ent.purchaseDateMillis ?? Date.now(),
                raw: info,
              });
            }
          };
          registered = listener;
          Purchases.addCustomerInfoUpdateListener(listener);
        })
        .catch(() => {});

      return () => {
        cancelled = true;
        const listener = registered;
        if (listener === null) return; // not registered yet (suppressed above) or already removed → idempotent
        registered = null;
        getSDK()
          .then((Purchases) => {
            Purchases.removeCustomerInfoUpdateListener(listener);
          })
          .catch(() => {});
      };
    },
  };
}
