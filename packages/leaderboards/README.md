# @flare-engine/leaderboards

Typed `LeaderboardsProvider` interface + `NoopLeaderboardsProvider` + React context. Stub-only at 0.1.0; concrete adapters (Game Center, Google Play Games, Steam) land at 0.2.0.

## Install

```sh
bun add @flare-engine/leaderboards
```

## Usage

```tsx
import {
  LeaderboardsContext,
  useLeaderboards,
  NoopLeaderboardsProvider,
} from '@flare-engine/leaderboards';

export function App() {
  return (
    <LeaderboardsContext.Provider value={NoopLeaderboardsProvider}>
      {/* ... */}
    </LeaderboardsContext.Provider>
  );
}
```

`useLeaderboards()` returns the provider; call `submit(boardId, score)`, `fetch(boardId)`, etc. against the interface — swapping `NoopLeaderboardsProvider` for a real adapter at 0.2.0 requires no consumer changes.

## Recipe — env-var-gated lazy load

When 0.2.0 adapters land (e.g. `@flare-engine/leaderboards-gamecenter`), wrap them behind an env-var gate so CI / unit tests / dev builds without API keys fall back to `NoopLeaderboardsProvider` and never touch the native SDK. See the [Lazy-SDK adapter recipe](https://github.com/grzott/flare-engine/blob/main/.claude/skills/flare-tier2-stubs/SKILL.md#lazy-sdk-adapter-recipe) for the full pattern; canonical implementation at [Pan Tvardowski's src/iap/provider.ts](https://github.com/grzott/Pan-Tvardowski/blob/main/src/iap/provider.ts) (RevenueCat / IAP — same shape).
