---
name: flare-iap-revenuecat
description: Deep knowledge of the @flare-engine/iap-revenuecat package — concrete RevenueCat IAPProvider adapter wrapping react-native-purchases (lazy-imported, peer dep). Use when wiring real iOS/Android in-app purchases to a Flare game via RevenueCat.
---

# `@flare-engine/iap-revenuecat`

Concrete `IAPProvider` adapter for [`@flare-engine/iap`](../flare-iap/SKILL.md) backed by [RevenueCat](https://www.revenuecat.com/) (`react-native-purchases`). Ships at 0.1.0 alongside the rest of the engine — the only Tier-2 adapter that landed before 0.2.0.

```ts
import {
  createRevenueCatProvider,
  type RevenueCatConfig,
  type RevenueCatPurchasesModule,
} from '@flare-engine/iap-revenuecat';
```

## Public surface

| Export                       | Shape                                                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `createRevenueCatProvider`   | `(config: RevenueCatConfig) => IAPProvider`. Lazy-configures the SDK on first `getProducts`/`purchase`.              |
| `RevenueCatConfig`           | `{ apiKeyIos: string; apiKeyAndroid: string; appUserId?: string }`.                                                  |
| `RevenueCatPurchasesModule`  | Minimal interface for the `react-native-purchases` SDK surface the adapter uses (declared locally, never imported).  |

## Wiring

```tsx
import { createRevenueCatProvider } from '@flare-engine/iap-revenuecat';
import { IAPContext } from '@flare-engine/iap';

const provider = createRevenueCatProvider({
  apiKeyIos: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS!,
  apiKeyAndroid: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID!,
});

export function App() {
  return (
    <IAPContext.Provider value={provider}>
      {/* …game tree, including <ShopPanel> / <PaywallModal> from @flare-engine/ui-shop… */}
    </IAPContext.Provider>
  );
}
```

## Rules

- **Peer dep, not bundled.** `react-native-purchases >=8` is an optional peer. The package is safe to install in web-only / SSR / unit-test projects — the SDK is loaded via lazy `await import('react-native-purchases')` on first call.
- **No-throw contract.** `purchase` and `restore` always resolve with a `PurchaseResult` (`status: 'purchased' | 'cancelled' | 'failed'`); the adapter never rejects so screens can render error banners deterministically.
- **Always env-gate.** In production, wrap behind the env-var-gated lazy-load pattern so CI / dev builds without keys fall back to `NoopIAPProvider`. See [.github/skills/flare-tier2-stubs/SKILL.md § Lazy-SDK adapter recipe](../flare-tier2-stubs/SKILL.md#lazy-sdk-adapter-recipe). Canonical implementation: [apps/pan-tvardowski/src/iap/provider.ts](../../../apps/pan-tvardowski/src/iap/provider.ts).
- **Pair with `EntitlementStore`.** Subscribe `entitlementStore.attachProvider(provider)` so successful purchases auto-grant catalogue entitlements; call `entitlementStore.restoreOnBoot(provider)` once at app start.
- **Mock in tests.** Use `bun:test`'s `mock.module('react-native-purchases', …)` — no native bridge needed.
