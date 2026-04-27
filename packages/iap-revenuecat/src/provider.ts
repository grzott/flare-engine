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

  for (const ent of Object.values(info.entitlements?.all ?? {})) {
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

export function createRevenueCatProvider(config: RevenueCatConfig): IAPProvider {
  // Per-instance cache so multiple providers are independent (and tests are isolated).
  let sdkCache: RevenueCatPurchasesModule | null = null;
  let configured = false;

  // Lazy-import keeps react-native-purchases off the module graph on platforms
  // (e.g., web) where it is not installed or not needed.
  async function getSDK(): Promise<RevenueCatPurchasesModule> {
    if (sdkCache) return sdkCache;
    const mod = await import('react-native-purchases');
    sdkCache = (mod.default ?? mod) as RevenueCatPurchasesModule;
    return sdkCache;
  }

  async function ensureConfigured(): Promise<RevenueCatPurchasesModule> {
    const Purchases = await getSDK();
    if (!configured) {
      // react-native is also lazy-loaded so this module never hard-loads on web.
      const rn = await import('react-native');
      const apiKey = rn.Platform.OS === 'ios' ? config.apiKeyIos : config.apiKeyAndroid;
      Purchases.configure({ apiKey, appUserID: config.appUserId ?? null });
      configured = true;
    }
    return Purchases;
  }

  return {
    async getProducts(ids: readonly ProductId[]): Promise<readonly Product[]> {
      try {
        const Purchases = await ensureConfigured();
        const raw = await Purchases.getProducts([...ids]);
        return raw.map(mapProduct);
      } catch {
        return [];
      }
    },

    async purchase(id: ProductId): Promise<PurchaseResult> {
      // No-throw contract: all paths return PurchaseResult rather than throw.
      try {
        const Purchases = await ensureConfigured();
        const products = await Purchases.getProducts([id]);
        const product = products[0];
        if (!product) {
          return { status: 'failed', error: new Error(`Product not found: ${id}`) };
        }
        const { customerInfo } = await Purchases.purchaseStoreProduct(product);
        return {
          status: 'purchased',
          transaction: {
            id: customerInfo.originalPurchaseDate ?? String(Date.now()),
            productId: id,
            purchasedAt: Date.now(),
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
      } catch {
        return [];
      }
    },

    onTransaction(cb: (tx: Transaction) => void): Unsubscribe {
      let listener: ((info: RevenueCatCustomerInfo) => void) | null = null;

      getSDK()
        .then((Purchases) => {
          listener = (info: RevenueCatCustomerInfo) => {
            const entitlements = Object.values(info.entitlements?.all ?? {});
            const ent = entitlements[0];
            if (ent) {
              cb({
                id: ent.identifier,
                productId: ent.productIdentifier,
                purchasedAt: ent.purchaseDateMillis ?? Date.now(),
                raw: info,
              });
            }
          };
          Purchases.addCustomerInfoUpdateListener(listener);
        })
        .catch(() => {});

      return () => {
        if (listener !== null) {
          getSDK()
            .then((Purchases) => {
              Purchases.removeCustomerInfoUpdateListener(listener!);
            })
            .catch(() => {});
          listener = null;
        }
      };
    },
  };
}
