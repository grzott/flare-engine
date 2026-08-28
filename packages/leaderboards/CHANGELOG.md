# @flare-engine/leaderboards

## 0.3.1

## 0.3.0

### Minor Changes

- ff62507: Peer-dependency floor bump + Skia decoupling across the React-facing packages, plus a new web frame-renderer export. Floors move to `react >=19` and `react-native >=0.79` (Skia 2.x requires RN 0.79, not 0.78) wherever those peers are declared. `@shopify/react-native-skia` moves to `>=2.0.0` where it is still required (`react`, `engine`), is dropped entirely as a peer from `render` and `assets` (both already inject a structural `*Like` Skia module and never import Skia), and becomes an **optional, type-only** peer of `shapes` (used only for the `import type` in `draw.ts`) and an **optional, injected** peer of `postfx` (Skia is passed in at runtime; the floor moves from `>=1.0.0` to `>=2.0.0`). `react-native-gesture-handler` is dropped as a peer from `input`, `react`, and `engine` (no runtime usage). `engine` gains `react-native-safe-area-context >=4.0.0` as a required peer, matching `<GameView>`'s inset resolution.

  `@flare-engine/render-web` additionally ships `createWebFrameRenderer(kit: CanvasKit): FrameRenderer` — the web/CanvasKit analog of `@flare-engine/react`'s `createSkiaFrameRenderer`, a thin composition `createFrameRenderer(createWebSkiaModule(kit))`; presentation (replaying `endFrame()` onto a surface and flushing) stays the consumer's responsibility. Also fixes the `render-web` on-screen post-FX surface so `resize()` correctly rebuilds the WebGL onscreen surface (`postfx-surface.ts`), preventing a stale-size onscreen target after a canvas resize.

- 7c4f7cf: Packaging polish across all shipping manifests. Every package now declares `engines: { "node": ">=20" }`. Each package's `exports["."]` carries per-condition type declarations — ESM consumers (`import`) resolve `./dist/index.d.mts` and CommonJS consumers (`require`) resolve `./dist/index.d.ts`, so the declaration file always matches the resolved module format instead of an ESM import falling back to the CJS-flavored `.d.ts` (the `"."`-level `types` that previously shadowed the ESM condition is removed; the root `types` field is retained for legacy/`node10` resolution). The `@types/react` dev floor moves from `^18` to `^19` across the React-facing packages, matching the installed React 19 runtime. No runtime or public API surface changes.
- 376969a: Build toolchain modernized across all packages, with no runtime or public API changes. Every package is now bundled with `tsdown` (Rolldown-based, replacing the unmaintained `tsup`); dist output (`.js`/`.mjs`/`.d.ts`/`.d.mts` + sourcemaps) is byte-compatible, so `exports` maps and installed shape are unchanged. Lint runs on Biome 2, the TypeScript floor moves to 5.9 (with `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, and `moduleDetection: "force"` added as guards), and Bun ambient types are removed from the shipped-source typecheck. The `@flare-engine/engine` README now documents that the engine is architecture-agnostic and imposes no React Native New Architecture requirement of its own.
- 8128b8b: tier-2 packages ship local providers with a written adapter-author contract, replacing the interface-only stubs and the "adapters land at 0.2.0" promises.

  - leaderboards adds `createMemoryLeaderboards(opts?)` — an in-memory `LeaderboardsProvider` (single local identity + `seed` competitors; best-score submit; descending ranking with insertion-order tie-break; sequential 1-based ranks).
  - achievements adds `createMemoryAchievements()` and `createStorageAchievements(store, opts?)` over a structural `AchievementsStore` `{ get, set }` (no storage dep). Defines the contract: progress is clamped to `[0,1]` and monotonic (non-finite → 0), `unlock(id)` fully unlocks, unlock latches `unlockedAt` once, re-unlock is a no-op; the storage variant hydrates lazily, persists per mutation, and serializes writes.
  - analytics adds `createMemoryAnalytics(opts?)` (bounded ring buffer with `getEvents`/`clear`, drop-oldest) and `createConsoleAnalytics(opts?)`, and wires the previously-dead `AnalyticsEvent` into a discriminated union (`track`/`identify`/`screen`) that the providers record. Note: `AnalyticsEvent`'s shape changed from the flat `{ name, props?, timestamp }` to the union — no runtime consumer existed at 0.2.1.
  - iap: correct the `Product.priceMicros` JSDoc from "cents" to micros (millionths of a unit; e.g. $0.99 → 990000), matching the field name and the RevenueCat adapter.
  - iap-revenuecat: strip the `.claude/skills` + private-repo recipe links from the README.

## 0.2.1

## 0.2.0

### Minor Changes

- Version bumped as part of the 0.2.0 lockstep release.

## 0.1.0

### Minor Changes

- Initial release.
