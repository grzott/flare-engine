# @flare-engine/iap-revenuecat

## 0.3.0

### Minor Changes

- b8bd067: restore maps active entitlements only (no re-granting expired); onTransaction listener lifecycle is leak-free + idempotent and emits every active entitlement; honest transaction id from the store transaction with a documented date fallback; getProducts takes an optional productCategory (fixes Android one-time empty catalog) + an onError hook on both getProducts/restore; peer deps drop phantom react and declare react-native >=0.79.0.
- 55d00a0: iap-revenuecat: configure exactly once under concurrent first calls.

  `ensureConfigured` gated on a boolean that flips only after two awaits (`getSDK()` +
  `import('react-native')`), so concurrent first callers — e.g. `Promise.all([getProducts(),
restore()])` — all passed the guard and each called `Purchases.configure`, which RevenueCat
  rejects as a double-configure. The boolean is replaced by a memoized `configurePromise`
  awaited by every entrypoint, so `configure` runs exactly once for all in-flight callers. A
  failed configure clears the memo so a later call retries (preserving the old flag's
  stay-unset-on-throw behavior). No API-surface change.

- 7c4f7cf: Packaging polish across all shipping manifests. Every package now declares `engines: { "node": ">=20" }`. Each package's `exports["."]` carries per-condition type declarations — ESM consumers (`import`) resolve `./dist/index.d.mts` and CommonJS consumers (`require`) resolve `./dist/index.d.ts`, so the declaration file always matches the resolved module format instead of an ESM import falling back to the CJS-flavored `.d.ts` (the `"."`-level `types` that previously shadowed the ESM condition is removed; the root `types` field is retained for legacy/`node10` resolution). The `@types/react` dev floor moves from `^18` to `^19` across the React-facing packages, matching the installed React 19 runtime. No runtime or public API surface changes.
- 376969a: Build toolchain modernized across all packages, with no runtime or public API changes. Every package is now bundled with `tsdown` (Rolldown-based, replacing the unmaintained `tsup`); dist output (`.js`/`.mjs`/`.d.ts`/`.d.mts` + sourcemaps) is byte-compatible, so `exports` maps and installed shape are unchanged. Lint runs on Biome 2, the TypeScript floor moves to 5.9 (with `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, and `moduleDetection: "force"` added as guards), and Bun ambient types are removed from the shipped-source typecheck. The `@flare-engine/engine` README now documents that the engine is architecture-agnostic and imposes no React Native New Architecture requirement of its own.

### Patch Changes

- 8128b8b: tier-2 packages ship local providers with a written adapter-author contract, replacing the interface-only stubs and the "adapters land at 0.2.0" promises.

  - leaderboards adds `createMemoryLeaderboards(opts?)` — an in-memory `LeaderboardsProvider` (single local identity + `seed` competitors; best-score submit; descending ranking with insertion-order tie-break; sequential 1-based ranks).
  - achievements adds `createMemoryAchievements()` and `createStorageAchievements(store, opts?)` over a structural `AchievementsStore` `{ get, set }` (no storage dep). Defines the contract: progress is clamped to `[0,1]` and monotonic (non-finite → 0), `unlock(id)` fully unlocks, unlock latches `unlockedAt` once, re-unlock is a no-op; the storage variant hydrates lazily, persists per mutation, and serializes writes.
  - analytics adds `createMemoryAnalytics(opts?)` (bounded ring buffer with `getEvents`/`clear`, drop-oldest) and `createConsoleAnalytics(opts?)`, and wires the previously-dead `AnalyticsEvent` into a discriminated union (`track`/`identify`/`screen`) that the providers record. Note: `AnalyticsEvent`'s shape changed from the flat `{ name, props?, timestamp }` to the union — no runtime consumer existed at 0.2.1.
  - iap: correct the `Product.priceMicros` JSDoc from "cents" to micros (millionths of a unit; e.g. $0.99 → 990000), matching the field name and the RevenueCat adapter.
  - iap-revenuecat: strip the `.claude/skills` + private-repo recipe links from the README.

- Updated dependencies [b113ca3]
- Updated dependencies [ff62507]
- Updated dependencies [7c4f7cf]
- Updated dependencies [376969a]
- Updated dependencies [abdb991]
- Updated dependencies [8128b8b]
  - @flare-engine/iap@0.3.0

## 0.2.1

### Patch Changes

- Remove phantom `@flare-engine/*` dependencies that were declared in `package.json` but never imported from source (packaging hygiene; no runtime or API change). A new `check:deps` CI guardrail enforces that declared dependencies match actual imports and that the graph stays strictly downward-only.

- Updated dependencies []:
  - @flare-engine/iap@0.2.1

## 0.2.0

### Minor Changes

- Version bumped as part of the 0.2.0 lockstep release.

## 0.1.0

### Minor Changes

- Initial release.
