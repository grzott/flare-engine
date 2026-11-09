---
'@flare-engine/achievements': patch
'@flare-engine/storage': patch
---

`createStorageAchievements` no longer caches a failed hydration: when `store.get` rejects, that
call rejects and the next call reads again, so a transient read error no longer strands every later
`unlock` / `getState` / `getAll` on the stale rejection. A failed read writes nothing, so it cannot
lead to the stored array being overwritten. `createIndexedDbAdapter` likewise retries
a failed `indexedDB.open` on the next call instead of returning the same rejection forever.
