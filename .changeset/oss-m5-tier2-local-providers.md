---
"@flare-engine/leaderboards": minor
"@flare-engine/achievements": minor
"@flare-engine/analytics": minor
"@flare-engine/iap": patch
"@flare-engine/iap-revenuecat": patch
---

tier-2 packages ship local providers with a written adapter-author contract, replacing the interface-only stubs and the "adapters land at 0.2.0" promises.

- leaderboards adds `createMemoryLeaderboards(opts?)` — an in-memory `LeaderboardsProvider` (single local identity + `seed` competitors; best-score submit; descending ranking with insertion-order tie-break; sequential 1-based ranks).
- achievements adds `createMemoryAchievements()` and `createStorageAchievements(store, opts?)` over a structural `AchievementsStore` `{ get, set }` (no storage dep). Defines the contract: progress is clamped to `[0,1]` and monotonic (non-finite → 0), `unlock(id)` fully unlocks, unlock latches `unlockedAt` once, re-unlock is a no-op; the storage variant hydrates lazily, persists per mutation, and serializes writes.
- analytics adds `createMemoryAnalytics(opts?)` (bounded ring buffer with `getEvents`/`clear`, drop-oldest) and `createConsoleAnalytics(opts?)`, and wires the previously-dead `AnalyticsEvent` into a discriminated union (`track`/`identify`/`screen`) that the providers record. Note: `AnalyticsEvent`'s shape changed from the flat `{ name, props?, timestamp }` to the union — no runtime consumer existed at 0.2.1.
- iap: correct the `Product.priceMicros` JSDoc from "cents" to micros (millionths of a unit; e.g. $0.99 → 990000), matching the field name and the RevenueCat adapter.
- iap-revenuecat: strip the `.claude/skills` + private-repo recipe links from the README.
