# @flare-engine/analytics

Typed `AnalyticsProvider` interface + `NoopAnalyticsProvider` + React context, plus `createMemoryAnalytics` / `createConsoleAnalytics` — local providers for tests and dev. Concrete platform adapters (PostHog, Amplitude, Segment, Firebase) are post-launch; wire your own at the app boundary until then.

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

`useAnalytics()` returns the active provider. The `AnalyticsProvider` surface is `track(event, props?)`, `identify(userId, traits?)`, `screen(name, props?)`, and `flush()` — all async. Swapping `NoopAnalyticsProvider` for another provider requires no consumer changes.

## Local providers

`createMemoryAnalytics(opts?)` captures events into a bounded ring buffer you can inspect — ideal for asserting behavior in tests:

```ts
import { createMemoryAnalytics } from '@flare-engine/analytics';

const analytics = createMemoryAnalytics({ capacity: 100 });
await analytics.track('level_start', { zone: 1 });
await analytics.screen('hud');
analytics.getEvents();
// [{ type: 'track', name: 'level_start', props: { zone: 1 }, timestamp },
//  { type: 'screen', name: 'hud', timestamp }]
```

- Each call records the matching `AnalyticsEvent` variant. When the buffer is full (`capacity`, default `256`, clamped to `>= 1`) the oldest event is dropped.
- `getEvents()` returns a defensive copy, oldest → newest; `clear()` empties it. Timestamps come from the injected `now` (default `Date.now`). `flush()` is a no-op.

`createConsoleAnalytics(opts?)` logs each event to an injected sink (default `console.log`) as `log('[analytics]', event)` — a zero-setup provider for local runs.

`AnalyticsEvent` is a discriminated union on `type` (`'track'` / `'identify'` / `'screen'`) — the event shape both local providers record.

## Env-gated fallback

In CI or dev builds without platform credentials, select `NoopAnalyticsProvider` (or a local provider) behind your own env flag so nothing touches a native SDK until real credentials are present.
