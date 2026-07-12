# @flare-engine/achievements

Typed `AchievementsProvider` interface + `NoopAchievementsProvider` + React context, plus `createMemoryAchievements` / `createStorageAchievements` — local providers with a defined unlock/progress contract, for tests, dev, and single-player games. Concrete platform adapters (Game Center, Google Play Games, Steam) are post-launch; wire your own at the app boundary until then.

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

`useAchievements()` returns the active provider. The `AchievementsProvider` surface is `unlock(id, progress?)`, `getState(id)`, and `getAll()` — all async. Progress is a partial `[0, 1]` value; omit it to fully unlock.

## Local providers + the unlock contract

`createMemoryAchievements()` keeps state in memory; `createStorageAchievements(store, opts?)` persists it through an injected `{ get, set }` store. Both share the same contract — the semantics adapter authors should preserve:

```ts
import { createStorageAchievements } from '@flare-engine/achievements';
import type { AchievementsStore } from '@flare-engine/achievements';

declare const myStore: AchievementsStore;

const achievements = createStorageAchievements(myStore); // { get, set }

await achievements.unlock('first_blood', 0.5); // progress 0.5
await achievements.unlock('first_blood', 0.2); // ignored — progress stays 0.5
await achievements.unlock('first_blood');      // full unlock, latches
await achievements.getState('first_blood');    // { unlocked: true, progress: 1, unlockedAt }
```

- **Clamped + monotonic:** progress is clamped to `[0, 1]` (non-finite → `0`) and never decreases — a lower requested value is ignored.
- **`unlock(id)` fully unlocks** (target progress `1`).
- **Latches:** reaching progress `1` sets `unlocked: true` and stamps `unlockedAt` once (via the injected `now`, default `Date.now`). Re-unlocking is a no-op — the original `unlockedAt` is kept.
- **Untracked ids** report `{ unlocked: false, progress: 0 }`.

`AchievementsStore` is a structural `{ get(key): Promise<string | null>; set(key, value): Promise<void> }` — the `get`/`set` subset of `@flare-engine/storage`'s `StorageAdapter`, so the storage provider adds no dependency and works with any async KV (AsyncStorage, an MMKV wrapper, a `localStorage` shim, …). It hydrates lazily from `store.get(key)` (default key `'flare.achievements'`), persists after every mutation, and serializes writes so concurrent unlocks can't lose an update.

## Env-gated fallback

In CI or dev builds without platform credentials, select `NoopAchievementsProvider` (or a local provider) behind your own env flag so nothing touches a native SDK until real credentials are present.
