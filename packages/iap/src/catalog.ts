/**
 * ProductCatalog — declarative mapping of store product IDs to
 * entitlement keys the game checks at runtime.
 *
 * Games that ship with gated content define a catalog once; the engine
 * treats a missing catalog as "all free".
 */

import type { Product, ProductId } from './provider.js';

export type EntitlementKey = string;

export interface CatalogEntry {
  readonly productId: ProductId;
  /**
   * Entitlement keys granted when this product is owned. A single product
   * may unlock multiple entitlements (e.g., season pass).
   */
  readonly grants: readonly EntitlementKey[];
  // Derived from `Product.type` rather than a named alias: an alias both interfaces
  // mention would have to be exported from the entry, i.e. a new public symbol.
  /** Product type — hint for UI rendering; not used for entitlement logic. */
  readonly type?: NonNullable<Product['type']>;
  /** Optional free-form label (localization key or display string). */
  readonly label?: string;
}

export interface ProductCatalog {
  readonly entries: readonly CatalogEntry[];
}

export function createProductCatalog(entries: readonly CatalogEntry[]): ProductCatalog {
  return { entries };
}

/** Return the entitlement keys granted by a given product, or `[]` if unknown. */
export function getGrantsForProduct(
  catalog: ProductCatalog,
  productId: ProductId,
): readonly EntitlementKey[] {
  return getCatalogEntry(catalog, productId)?.grants ?? EMPTY;
}

/** Return the catalog entry for a product, or `undefined` if unknown. */
export function getCatalogEntry(
  catalog: ProductCatalog,
  productId: ProductId,
): CatalogEntry | undefined {
  for (let i = 0; i < catalog.entries.length; i++) {
    const e = catalog.entries[i];
    if (e && e.productId === productId) return e;
  }
  return undefined;
}

const EMPTY: readonly EntitlementKey[] = Object.freeze([]);
