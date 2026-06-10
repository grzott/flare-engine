# @flare-engine/iap-revenuecat

Concrete `IAPProvider` adapter for [@flare-engine/iap](../iap) backed by [RevenueCat](https://www.revenuecat.com/) (`react-native-purchases`).

## Install

```sh
bun add @flare-engine/iap-revenuecat react-native-purchases
```

## Usage

```tsx
import { createRevenueCatProvider } from '@flare-engine/iap-revenuecat';
import { IAPContext } from '@flare-engine/iap';

const provider = createRevenueCatProvider({
  apiKeyIos: 'appl_...',
  apiKeyAndroid: 'goog_...',
});

export function App() {
  return (
    <IAPContext.Provider value={provider}>
      {/* ... */}
    </IAPContext.Provider>
  );
}
```

`react-native-purchases` is a **peer dependency** and is never bundled into this package. The SDK is lazy-imported on first use, so platforms without it (e.g. web) are unaffected until `getProducts`, `purchase`, or `restore` is called.

## Recipe — env-var-gated lazy load

In production code, wrap the adapter behind an env-var gate so CI / unit tests / dev builds without RevenueCat keys fall back to `NoopIAPProvider` and never touch the SDK. See the [Lazy-SDK adapter recipe](https://github.com/grzott/flare-engine/blob/main/.claude/skills/flare-tier2-stubs/SKILL.md#lazy-sdk-adapter-recipe) for the full pattern; canonical implementation at [Pan Tvardowski's src/iap/provider.ts](https://github.com/grzott/Pan-Tvardowski/blob/main/src/iap/provider.ts).
