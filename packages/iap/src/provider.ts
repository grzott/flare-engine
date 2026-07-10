/** Store product identifier — adapter-defined (e.g., "com.app.gems_100"). */
export type ProductId = string;

/** A purchasable product as described by the store. */
export interface Product {
  id: ProductId;
  title: string;
  description: string;
  /** Formatted, localized price string ready for display (e.g., "$0.99"). */
  priceDisplay: string;
  /**
   * Numeric price in micros — millionths of one unit of `currency` (e.g. $0.99
   * -> 990000). May be `null` when the store doesn't report it.
   */
  priceMicros?: number | null;
  currency?: string;
  type?: 'consumable' | 'non-consumable' | 'subscription';
}

/** A store transaction as reported by the platform. */
export interface Transaction {
  id: string;
  productId: ProductId;
  purchasedAt: number;
  /** Opaque adapter-specific payload (e.g., receipt id). */
  raw?: unknown;
}

/** Outcome of a `purchase()` or `restore()` call. */
export interface PurchaseResult {
  status: 'purchased' | 'cancelled' | 'failed';
  transaction?: Transaction;
  error?: Error;
}

/** Subscription teardown handle returned by `onTransaction`. */
export type Unsubscribe = () => void;

/**
 * IAP provider interface. Consumers supply a concrete adapter (RevenueCat,
 * StoreKit, Google Play Billing) at the app boundary. Receipt validation is
 * adapter-local — the interface does not expose receipt bytes at 0.1.0.
 */
export interface IAPProvider {
  getProducts(ids: readonly ProductId[]): Promise<readonly Product[]>;
  purchase(id: ProductId): Promise<PurchaseResult>;
  restore(): Promise<readonly PurchaseResult[]>;
  onTransaction(cb: (tx: Transaction) => void): Unsubscribe;
}

/** Default no-op provider. Returns empty/cancelled results; never emits. */
export const NoopIAPProvider: IAPProvider = {
  async getProducts(): Promise<readonly Product[]> {
    return [];
  },
  async purchase(): Promise<PurchaseResult> {
    return { status: 'cancelled' };
  },
  async restore(): Promise<readonly PurchaseResult[]> {
    return [];
  },
  onTransaction(): Unsubscribe {
    return () => {
      // no-op
    };
  },
};
