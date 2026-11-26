---
'@flare-engine/leaderboards': patch
'@flare-engine/achievements': patch
'@flare-engine/analytics': patch
'@flare-engine/haptics': patch
'@flare-engine/iap': patch
---

Importing only a React-free export from these five packages no longer pulls `react` into the bundle
(#506). Each package was published as a single `dist/index.mjs` that imported `react` and created
its context (`LeaderboardsContext`, `AchievementsContext`, `AnalyticsContext`, `HapticsContext`,
`IAPContext`) with an unannotated top-level `createContext` call, so that call and the `react`
import stayed in a consumer's bundle even when the context was unused.

Two changes:

- The `createContext` call is annotated `/* @__PURE__ */`. On its own this removed the call from the
  bundle but left the `react` import behind.
- The packages are now built one output file per source module (`dist/context.mjs`,
  `dist/provider.mjs`, … next to `dist/index.mjs`, and the same for CJS and the type declarations),
  so the module that imports `react` can be dropped as a whole.

Checked with Bun's bundler against each package's built `dist/index.mjs`, with `react` external: a
bundle importing only `createMemoryLeaderboards`, `createMemoryAchievements`,
`createMemoryAnalytics`, `createWebVibrationProvider` or `createEntitlementStore` now has no `react`
import and no `createContext` call. Other bundlers were not tested. A test in each package keeps it
that way.

The entry points in each package's `exports` map are unchanged; the extra files under `dist/` are
not exported subpaths. No exported symbol or signature changes.

<!-- React's function, named for context; not a Flare export. -->
<!-- symbols-ok: createContext -->
