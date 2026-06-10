---
name: flare-tier2-stubs
description: Knowledge of the Tier-2 platform-integration packages — @flare-engine/leaderboards, @flare-engine/achievements, @flare-engine/iap, @flare-engine/analytics. Each ships a typed interface + NoopProvider + React context. Leaderboards / achievements / analytics are interface-only at 0.1.0 (concrete adapters land at 0.2.0). IAP additionally ships ProductCatalog + EntitlementStore + content gates, plus a concrete RevenueCat adapter in @flare-engine/iap-revenuecat at 0.1.0. Use when integrating a third-party provider (Game Center / Play Games / RevenueCat / PostHog / etc.) or when documenting the interface contract before 0.2.0 adapters land.
---

# Tier-2 Stubs

Four packages ship at 0.1.0. Three are interface-only; IAP ships interface + catalog + entitlements + content gates, plus a concrete RevenueCat adapter (`@flare-engine/iap-revenuecat`) — the rest of the native adapters (StoreKit / Play Billing / Game Center / Play Games / PostHog / Amplitude) land at 0.2.0.

| Package                      | Status at 0.1.0                                          |
| ---------------------------- | -------------------------------------------------------- |
| `@flare-engine/leaderboards` | Typed leaderboard submission + fetch interface (stub)    |
| `@flare-engine/achievements` | Unlock / progress / listing interface (stub)             |
| `@flare-engine/iap`          | Interface + `ProductCatalog` + `EntitlementStore` + gates (concrete RevenueCat adapter ships in [`@flare-engine/iap-revenuecat`](../flare-iap-revenuecat/SKILL.md)) |
| `@flare-engine/analytics`    | Track / screen / identify interface (stub)               |

## Shape (identical across all four)

Each package exports:

- A typed `XxxProvider` interface describing the methods (e.g. `submit`, `unlock`, `purchase`, `track`)
- `createNoopProvider()` — safe default that resolves everything with `{ ok: false, reason: 'noop' }`
- `XxxContext` + `useXxx()` — React context wiring

```ts
import {
  AnalyticsContext,
  useAnalytics,
  createNoopProvider,
} from "@flare-engine/analytics";
```

## Rules

- These stubs exist so consumers can wire the interface today and swap in a real adapter later without refactoring.
- Don't add concrete SDKs here — those live in separate 0.2.0 adapter packages (`@flare-engine/analytics-posthog`, etc.).
- The interface contract is the source of truth — adapters must conform, not extend.

## Lazy-SDK adapter recipe

Adapter packages depend on native SDKs (`react-native-purchases`, `posthog-react-native`, etc.) as **optional peer dependencies**. CI and unit-test environments don't install them. To stop module-load from crashing in those environments, wrap the adapter behind:

1. **Env-var gate.** Read API keys at startup; if absent → return the package's `Noop*Provider` directly. No SDK touched.
2. **Lazy import on first call.** Defer `await import('@flare-engine/<adapter>')` to the first interface method call. Cache the resolved provider after first load.
3. **Interface proxy.** Implement the typed provider interface yourself; each method awaits `lazyLoad()` then delegates.

```ts
import { type IAPProvider, NoopIAPProvider } from '@flare-engine/iap';

export function createGameIapProvider(): IAPProvider {
  const apiKeyIos = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS ?? '';
  const apiKeyAndroid = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID ?? '';
  if (!apiKeyIos && !apiKeyAndroid) return NoopIAPProvider;

  let resolved: IAPProvider | null = null;
  const lazyLoad = async (): Promise<IAPProvider> => {
    if (resolved) return resolved;
    const { createRevenueCatProvider } = await import('@flare-engine/iap-revenuecat');
    resolved = createRevenueCatProvider({ apiKeyIos, apiKeyAndroid });
    return resolved;
  };

  return {
    async getProducts(ids) { return (await lazyLoad()).getProducts(ids); },
    async purchase(id) { return (await lazyLoad()).purchase(id); },
    async restore() { return (await lazyLoad()).restore(); },
    onTransaction(cb) {
      let unsub: (() => void) | null = null;
      let stopped = false;
      lazyLoad().then((p) => { if (!stopped) unsub = p.onTransaction(cb); }).catch(() => {});
      return () => { stopped = true; unsub?.(); };
    },
  };
}
```

Reference implementation: [src/iap/provider.ts in the Pan Tvardowski repo](https://github.com/grzott/Pan-Tvardowski/blob/main/src/iap/provider.ts) (RevenueCat).

The same shape applies to leaderboards / achievements / analytics — read env vars, return `Noop*Provider` if absent, otherwise return a proxy that lazy-loads the adapter on first call.

Adapter rollout plan: [docs/plans/roadmap.md](../../../docs/plans/roadmap.md) (0.2.0 adapter rows).
