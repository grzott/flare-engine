# @flare-engine/achievements

Typed `AchievementsProvider` interface + `NoopAchievementsProvider` + React context. Stub-only at 0.1.0; concrete adapters (Game Center, Google Play Games, Steam) land at 0.2.0.

## Install

```sh
bun add @flare-engine/achievements
```

## Usage

```tsx
import {
  AchievementsContext,
  useAchievements,
  NoopAchievementsProvider,
} from '@flare-engine/achievements';

export function App() {
  return (
    <AchievementsContext.Provider value={NoopAchievementsProvider}>
      {/* ... */}
    </AchievementsContext.Provider>
  );
}
```

`useAchievements()` returns the provider; call `unlock(id)`, `setProgress(id, n)`, etc. against the interface — swapping `NoopAchievementsProvider` for a real adapter at 0.2.0 requires no consumer changes.

## Recipe — env-var-gated lazy load

When 0.2.0 adapters land (e.g. `@flare-engine/achievements-gamecenter`), wrap them behind an env-var gate so CI / unit tests / dev builds without API keys fall back to `NoopAchievementsProvider` and never touch the native SDK. See the [Lazy-SDK adapter recipe](https://github.com/grzott/flare-engine/blob/main/.claude/skills/flare-tier2-stubs/SKILL.md#lazy-sdk-adapter-recipe) for the full pattern; canonical implementation at [Pan Tvardowski's src/iap/provider.ts](https://github.com/grzott/Pan-Tvardowski/blob/main/src/iap/provider.ts) (RevenueCat / IAP — same shape).
