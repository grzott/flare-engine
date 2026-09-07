export interface RevenueCatConfig {
  apiKeyIos: string;
  apiKeyAndroid: string;
  appUserId?: string;
  /** Passed verbatim as the react-native-purchases getProducts category/type argument
   *  (e.g. 'subs'/'inapp' or your SDK's PRODUCT_CATEGORY constant). Undefined → SDK default. */
  productCategory?: string;
  /** Observe errors that getProducts/restore otherwise swallow into []. */
  onError?: (err: unknown) => void;
}

/** Minimal interface for the react-native-purchases SDK methods we call.
 * Defined here so we don't hard-depend on its types at compile time. */
export interface RevenueCatPurchasesModule {
  configure(params: { apiKey: string; appUserID: string | null }): void;
  getProducts(ids: string[], type?: string): Promise<RevenueCatStoreProduct[]>;
  purchaseStoreProduct(
    product: RevenueCatStoreProduct,
  ): Promise<{ customerInfo: RevenueCatCustomerInfo }>;
  restorePurchases(): Promise<RevenueCatCustomerInfo>;
  addCustomerInfoUpdateListener(listener: (info: RevenueCatCustomerInfo) => void): void;
  removeCustomerInfoUpdateListener(listener: (info: RevenueCatCustomerInfo) => void): void;
}

export interface RevenueCatStoreProduct {
  identifier: string;
  title: string;
  description: string;
  priceString: string;
  price: number;
  currencyCode: string;
  productCategory?: string;
  productType?: string;
}

export interface RevenueCatEntitlement {
  identifier: string;
  productIdentifier: string;
  // The real SDK field is `latestPurchaseDateMillis` — there is no bare `purchaseDateMillis`
  // on an entitlement (verified against react-native-purchases' own .d.ts; see provider.ts).
  latestPurchaseDateMillis?: number;
  expirationDate?: string | null;
  latestPurchaseDate?: string;
}

export interface RevenueCatNonSubscriptionTransaction {
  transactionIdentifier: string;
  productIdentifier: string;
  // hybrid-common's mappers emit this at runtime even though the SDK's own .d.ts only
  // declares the ISO `purchaseDate` string below — keep both and prefer the millis form.
  purchaseDateMillis?: number;
  purchaseDate?: string;
}

export interface RevenueCatCustomerInfo {
  originalPurchaseDate?: string | null;
  entitlements?: {
    all?: Record<string, RevenueCatEntitlement>;
    active?: Record<string, RevenueCatEntitlement>;
  };
  nonSubscriptionTransactions?: RevenueCatNonSubscriptionTransaction[];
}
