---
name: flare-iap
description: Deep knowledge of the @flare-engine/iap package — typed in-app-purchase provider interface, purchase/restore/listProducts, NoopProvider, IAPContext, useIAP. Use when wiring an IAP provider (RevenueCat / StoreKit / Play Billing) to a Flare game. Concrete adapters ship in 0.2.0.
---

# `@flare-engine/iap`

Tier-2 stub. Interface-only at 0.1.0.

```ts
import {
  type IAPProvider,
  createNoopProvider,
  IAPContext,
  useIAP,
} from "@flare-engine/iap";
```

## Interface

```ts
interface IAPProvider {
  listProducts(ids: string[]): Promise<Product[]>;
  purchase(id: string): Promise<PurchaseResult>;
  restore(): Promise<PurchaseResult[]>;
}
```

Wire a real adapter by replacing `createNoopProvider()` in `IAPContext.Provider`. Adapters ship 0.2.0. See [flare-tier2-stubs](../flare-tier2-stubs/SKILL.md).

## `ProductCatalog` + `EntitlementStore` (Phase 11.14)

Powers the freemium / buy-once / 100 %-free shipping modes without code branching. Games declare a catalog mapping product ids to entitlement keys; the engine treats a missing catalog as "all free".

```ts
import {
  createProductCatalog,
  createEntitlementStore,
  getCatalogEntry,
  getGrantsForProduct,
} from "@flare-engine/iap";

const catalog = createProductCatalog([
  {
    productId: "pan_tvardowski.full_game",
    type: "non-consumable",
    grants: ["zones_4_8", "all_endings"],
  },
  {
    productId: "pan_tvardowski.supporter_pack",
    type: "non-consumable",
    grants: ["alt_palettes", "credits_billing"],
  },
]);

const entitlements = createEntitlementStore(catalog, {
  initial: persistedEntitlements, // hydrate from save
});

// gate content:
if (entitlements.isEntitled("zones_4_8")) {
  showZone4Button();
}

// auto-grant on transactions + restore at boot:
const off = entitlements.attachProvider(iapProvider);
await entitlements.restoreOnBoot(iapProvider);

// react to grants/revokes:
entitlements.onChange.add(() => persist(entitlements.snapshot()));
```

`isEntitled` is zero-alloc on the hot path (Set lookup). `onChange` only fires when the entitlement set actually changes. Unknown product ids are silently ignored — the catalog is the source of truth. `EntitlementStore` adds a new dep on `@flare-engine/events` for the `Signal`.

## Rules

- Tests for `EntitlementStore` import from `../src/entitlements.js` — same as other Tier-2 stubs.
- A game with no paid content can skip the catalog entirely — `isEntitled` then always returns `false`, and gating code that requires entitlement keys naturally treats everything as locked. For "100 % free" games, simply don't call `isEntitled`.
- Persist `snapshot()` to save; rehydrate via `initial`. Don't rely solely on `restoreOnBoot` — offline starts must succeed.
