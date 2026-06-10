# @flare-engine/analytics

Typed `AnalyticsProvider` interface + `NoopAnalyticsProvider` + React context. Stub-only at 0.1.0; concrete adapters (PostHog, Amplitude, Segment, Firebase) land at 0.2.0.

## Install

```sh
bun add @flare-engine/analytics
```

## Usage

```tsx
import {
  AnalyticsContext,
  useAnalytics,
  NoopAnalyticsProvider,
} from '@flare-engine/analytics';

export function App() {
  return (
    <AnalyticsContext.Provider value={NoopAnalyticsProvider}>
      {/* ... */}
    </AnalyticsContext.Provider>
  );
}
```

`useAnalytics()` returns the provider; call `track(event, props)`, `screen(name)`, `identify(userId, traits)` against the interface — swapping `NoopAnalyticsProvider` for a real adapter at 0.2.0 requires no consumer changes.

## Recipe — env-var-gated lazy load

When 0.2.0 adapters land (e.g. `@flare-engine/analytics-posthog`), wrap them behind an env-var gate so CI / unit tests / dev builds without API keys fall back to `NoopAnalyticsProvider` and never touch the native SDK. See the [Lazy-SDK adapter recipe](https://github.com/grzott/flare-engine/blob/main/.claude/skills/flare-tier2-stubs/SKILL.md#lazy-sdk-adapter-recipe) for the full pattern; canonical implementation at [Pan Tvardowski's src/iap/provider.ts](https://github.com/grzott/Pan-Tvardowski/blob/main/src/iap/provider.ts) (RevenueCat / IAP — same shape).
