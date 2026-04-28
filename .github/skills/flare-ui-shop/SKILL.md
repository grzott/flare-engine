---
name: flare-ui-shop
description: Deep knowledge of the @flare-engine/ui-shop package — reusable React Native shop UI primitives (ShopPanel, PaywallModal, RestorePurchasesButton) that consume IAPContext + EntitlementStore + ProductCatalog and render through @flare-engine/ui. Use when adding paid content, paywalls, or restore-purchase flows to a Flare game.
---

# `@flare-engine/ui-shop`

Reusable React Native UI primitives for in-app-purchase flows. Three smart components share the same wiring — they read the active `IAPProvider` via `useIAP()`, drive an `EntitlementStore`, and render through `@flare-engine/ui` (`Panel`, `Button`, `Label`, `Modal`). All visible text comes from a host-supplied `LocalizeFn` so the package depends on no i18n framework.

```ts
import {
  ShopPanel,
  type ShopPanelProps,
  PaywallModal,
  type PaywallModalProps,
  RestorePurchasesButton,
  type RestorePurchasesButtonProps,
  type ShopItemCopy,
  type ShopPanelStrings,
  type PaywallStrings,
  type RestoreStrings,
  type LocalizeFn,
} from '@flare-engine/ui-shop';
```

## Public surface

| Export                                  | Purpose                                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `<ShopPanel>` / `ShopPanelProps`        | Smart panel. Fetches products on mount, splits into owned/available by `EntitlementStore`, calls `grantProduct` on success. |
| `<PaywallModal>` / `PaywallModalProps`  | Soft-dismissible single-product modal. Parent owns `visible`. Calls `entitlementStore.grant(entitlementKey)` + `onPurchased` on success. |
| `<RestorePurchasesButton>` / `RestorePurchasesButtonProps` | One-tap restore. Re-grants entitlements via `EntitlementStore.grantProduct` per restored result. |
| `ShopItemCopy`                          | `{ titleKey, descriptionKey, ctaKey, ownedLabelKey }`. Per-product copy passed to `localize`.                            |
| `ShopPanelStrings` / `PaywallStrings` / `RestoreStrings` | Panel-level localization keys (heading, empty, loading, error, owned/available section, …).        |
| `LocalizeFn`                            | `(key: string) => string`. Host supplies the translation lookup.                                                         |

## Wiring

```tsx
import { IAPContext, createEntitlementStore, createProductCatalog } from '@flare-engine/iap';
import { ShopPanel, PaywallModal, RestorePurchasesButton } from '@flare-engine/ui-shop';

const catalog = createProductCatalog([
  { productId: 'game.full', grants: ['full_game'], type: 'non-consumable' },
]);
const store = createEntitlementStore(catalog);

<IAPContext.Provider value={provider}>
  <ShopPanel
    catalog={catalog}
    entitlementStore={store}
    copy={{ 'game.full': { titleKey: 'p.full.title', descriptionKey: 'p.full.desc', ctaKey: 'p.full.cta', ownedLabelKey: 'p.full.owned' } }}
    strings={shopStrings}
    localize={(key) => t(key)}
    onPurchase={(id, result) => console.log(id, result.status)}
  />

  <PaywallModal
    visible={paywallOpen}
    productId="game.full"
    entitlementKey="full_game"
    entitlementStore={store}
    strings={paywallStrings}
    localize={(key) => t(key)}
    onDismiss={() => setPaywallOpen(false)}
  />

  <RestorePurchasesButton
    entitlementStore={store}
    strings={restoreStrings}
    localize={(key) => t(key)}
  />
</IAPContext.Provider>
```

## Rules

- **Localizer-as-prop.** No i18n library import — every visible string is `localize(key)`. Pair with `@flare-engine/localization` or any other system in the app layer.
- **`EntitlementStore.onChange` drives reactivity.** No manual `getProducts` refresh after purchase — the panel re-renders when entitlements change.
- **Parent owns `visible`.** `PaywallModal` does not toggle itself. Avoids double-close races with navigation stacks.
- **Smart, not headless.** These components fetch + dispatch on their own. For headless control (custom layout, custom buttons), drop down to `@flare-engine/iap` directly — `useIAP()` plus `EntitlementStore.grantProduct` covers any UI shape.
- **Build a concrete `IAPProvider` first.** Pair with `@flare-engine/iap-revenuecat` for production or `NoopIAPProvider` for tests/dev.
- **Tests are export-checks.** RN runtime is unavailable under bun-test; component tests verify export shape only — heavy logic lives in `@flare-engine/iap` (catalog + entitlement gating) and is unit-tested there.
