/**
 * EntitlementStore — in-memory cache of owned entitlement keys.
 *
 * Games call `isEntitled(key)` to gate content (zones, palettes, ships).
 * Purchases / restores feed grants through `grantProduct(productId)` via the
 * catalog. `attachProvider(iap)` auto-subscribes to transactions.
 *
 * Zero-alloc on the hot path (`isEntitled`); the signal only fires on
 * grant/revoke.
 */

import { Signal } from '@flare-engine/events';
import type { EntitlementKey, ProductCatalog } from './catalog.js';
import { getGrantsForProduct } from './catalog.js';
import type { IAPProvider, ProductId, Transaction, Unsubscribe } from './provider.js';

export interface EntitlementStoreOptions {
  /** Seed the cache — e.g., when hydrating from persisted save. */
  readonly initial?: readonly EntitlementKey[];
}

export interface EntitlementStore {
  readonly onChange: Signal<void>;
  isEntitled(key: EntitlementKey): boolean;
  /** Grant a single entitlement key directly (bypasses catalog). */
  grant(key: EntitlementKey): void;
  /**
   * Grant every entitlement the catalog associates with `productId`. Unknown
   * products are silently ignored (catalog is the source of truth).
   */
  grantProduct(productId: ProductId): void;
  /** Revoke an entitlement. Intended for tests + refund handling. */
  revoke(key: EntitlementKey): void;
  /** Current entitlement set as a new sorted array. */
  snapshot(): readonly EntitlementKey[];
  /** Call `provider.restore()` and grant everything it returns. */
  restoreOnBoot(provider: IAPProvider): Promise<void>;
  /**
   * Subscribe to `provider.onTransaction` — auto-grants as purchases stream
   * in. Returns an unsubscribe fn.
   */
  attachProvider(provider: IAPProvider): Unsubscribe;
}

export function createEntitlementStore(
  catalog: ProductCatalog,
  options: EntitlementStoreOptions = {},
): EntitlementStore {
  const granted = new Set<EntitlementKey>(options.initial ?? []);
  const onChange = new Signal<void>();

  function grant(key: EntitlementKey): void {
    if (granted.has(key)) return;
    granted.add(key);
    onChange.emit();
  }

  function grantProduct(productId: ProductId): void {
    const keys = getGrantsForProduct(catalog, productId);
    if (keys.length === 0) return;
    let changed = false;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (k && !granted.has(k)) {
        granted.add(k);
        changed = true;
      }
    }
    if (changed) onChange.emit();
  }

  function revoke(key: EntitlementKey): void {
    if (!granted.has(key)) return;
    granted.delete(key);
    onChange.emit();
  }

  function snapshot(): readonly EntitlementKey[] {
    return Array.from(granted).sort();
  }

  async function restoreOnBoot(provider: IAPProvider): Promise<void> {
    const results = await provider.restore();
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r && r.status === 'purchased' && r.transaction) {
        grantProduct(r.transaction.productId);
      }
    }
  }

  function attachProvider(provider: IAPProvider): Unsubscribe {
    return provider.onTransaction((tx: Transaction) => {
      grantProduct(tx.productId);
    });
  }

  return {
    onChange,
    isEntitled(key) {
      return granted.has(key);
    },
    grant,
    grantProduct,
    revoke,
    snapshot,
    restoreOnBoot,
    attachProvider,
  };
}
