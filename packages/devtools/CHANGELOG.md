# @flare-engine/devtools

## 0.4.6

### Patch Changes

- @flare-engine/core@0.4.6
- @flare-engine/ecs@0.4.6

## 0.4.5

### Patch Changes

- 8814ec2: Public release: every `@flare-engine/*` package is public on npm from this version, published from
  CI with npm provenance. No code changes; npm visibility is retroactive, so earlier versions are
  public too.
- Updated dependencies [8814ec2]
  - @flare-engine/core@0.4.5
  - @flare-engine/ecs@0.4.5

## 0.4.4

### Patch Changes

- @flare-engine/core@0.4.4
- @flare-engine/ecs@0.4.4

## 0.4.3

### Patch Changes

- @flare-engine/core@0.4.3
- @flare-engine/ecs@0.4.3

## 0.4.2

### Patch Changes

- @flare-engine/core@0.4.2
- @flare-engine/ecs@0.4.2

## 0.4.1

### Patch Changes

- @flare-engine/core@0.4.1
- @flare-engine/ecs@0.4.1

## 0.4.0

### Patch Changes

- 98bf004: PF-8: settle the published surface of `iap-revenuecat`, `ui-shop`, `ui`, `leaderboards` and
  `devtools` before the 0.4.0 freeze. Per ADR-0004.

  - `iap-revenuecat`'s structural `RevenueCatEntitlement` type declared a `purchaseDateMillis` field
    the real SDK never sends on an entitlement (verified against `react-native-purchases`' own
    `.d.ts` — it only has `latestPurchaseDateMillis`), so `purchasedAt` on a restored or
    transaction-streamed entitlement was always `Date.now()`, never the real purchase date. The
    adapter now reads `latestPurchaseDateMillis`. Store-transaction `purchasedAt` was already correct
    at runtime (hybrid-common's mappers do emit `purchaseDateMillis` there); the local type now also
    declares the SDK's ISO `purchaseDate` string and falls back to `Date.parse(purchaseDate)` when
    the millis field is absent, folding a malformed date to `undefined` first so it can't leak `NaN`
    past the final `Date.now()` fallback.
  - `ui-shop`'s `PaywallModal` called `entitlementStore.grant(entitlementKey)` instead of
    `grantProduct(productId)`, so a multi-entitlement product (e.g. a season pass) bought through the
    paywall granted only one key — the rest appeared only after the next restore, so the same
    purchase yielded a different entitlement set depending on which `ui-shop` component performed it.
    `PaywallModal` now calls `grantProduct(productId)`, matching `ShopScreen` and
    `RestorePurchasesButton`; the now-redundant `entitlementKey` prop is removed from
    `PaywallModalProps`.
  - `ui`'s `List` treated a `{items.map(...)}` child sitting alongside JSX siblings as a single item
    (a manual `Array.isArray` split only unwraps one level), so mapped children shared one visual
    slot with no gap between them. `List` now flattens `children` with `Children.toArray`, which also
    drops `null`/`undefined`/boolean the same way the old manual filter did.
  - `ui`'s `ShopPanel`/`ShopItem` — a second, unrelated shop-list component with zero consumers
    anywhere in the repo (`ui-shop`'s `ShopScreen` is the catalog/entitlement-aware one actually used)
    — is removed. This was flagged and deliberately left undecided once before
    (`package-findings-2026-07.md`); this row is the decision: keep the IAP-wired `ui-shop` surface,
    drop the lower-tier duplicate.
  - `leaderboards`' `MemoryLeaderboards` was a type alias adding nothing over `LeaderboardsProvider`.
    `createMemoryLeaderboards` now returns `LeaderboardsProvider` directly; the alias and its
    `index.ts` export are gone.
  - `devtools`' `DevtoolsContextValue` exposed `pause()` / `step()` / `resume()` directly, alongside
    the `scrubber` it was built from and the `useTimeScrub()` hook wrapping that same `scrubber` —
    three routes to one set of controls, and the direct context methods had no consumer (`<DevtoolsHUD>`
    and `<DevtoolsPanel>` both already use `useTimeScrub()`). `pause`/`step`/`resume` are removed from
    `DevtoolsContextValue`; `scrubber` and `useTimeScrub()` are unchanged.

- Updated dependencies [9868562]
- Updated dependencies [fb5a0c5]
- Updated dependencies [0ef1aec]
  - @flare-engine/ecs@0.4.0
  - @flare-engine/core@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [1645606]
  - @flare-engine/ecs@0.3.1
  - @flare-engine/core@0.3.1

## 0.3.0

### Minor Changes

- db28882: render-web: `createPostFxSurface`'s composite blit now binds each pass's extra sampler children (the `color-grading-lut` LUT `SkImage`, wrapped as a shader) after the source shader before `makeShaderWithChildren`, so LUT color grading renders on the CanvasKit web backend instead of leaving the LUT sampler unbound. The reused children buffer is resized in place (no per-pass allocation) and each wrapped child shader is freed after the draw. Latent fix — no shipping consumer wires `color-grading-lut` into a web chain today.

  devtools: `TimeScrubber.resume()` restores the timescale captured at `pause()` instead of hardcoding `1`, so resuming an active slow-motion (e.g. 0.5×) returns to that rate. `pause()` only records a non-zero timescale, so a double pause (including the internal `pause()` in `rewind()`) can't store `0` and freeze the loop on resume. Mirrors `@flare-engine/debug`'s `TimeControl`.

- ff62507: Peer-dependency floor bump + Skia decoupling across the React-facing packages, plus a new web frame-renderer export. Floors move to `react >=19` and `react-native >=0.79` (Skia 2.x requires RN 0.79, not 0.78) wherever those peers are declared. `@shopify/react-native-skia` moves to `>=2.0.0` where it is still required (`react`, `engine`), is dropped entirely as a peer from `render` and `assets` (both already inject a structural `*Like` Skia module and never import Skia), and becomes an **optional, type-only** peer of `shapes` (used only for the `import type` in `draw.ts`) and an **optional, injected** peer of `postfx` (Skia is passed in at runtime; the floor moves from `>=1.0.0` to `>=2.0.0`). `react-native-gesture-handler` is dropped as a peer from `input`, `react`, and `engine` (no runtime usage). `engine` gains `react-native-safe-area-context >=4.0.0` as a required peer, matching `<GameView>`'s inset resolution.

  `@flare-engine/render-web` additionally ships `createWebFrameRenderer(kit: CanvasKit): FrameRenderer` — the web/CanvasKit analog of `@flare-engine/react`'s `createSkiaFrameRenderer`, a thin composition `createFrameRenderer(createWebSkiaModule(kit))`; presentation (replaying `endFrame()` onto a surface and flushing) stays the consumer's responsibility. Also fixes the `render-web` on-screen post-FX surface so `resize()` correctly rebuilds the WebGL onscreen surface (`postfx-surface.ts`), preventing a stale-size onscreen target after a canvas resize.

- 7c4f7cf: Packaging polish across all shipping manifests. Every package now declares `engines: { "node": ">=20" }`. Each package's `exports["."]` carries per-condition type declarations — ESM consumers (`import`) resolve `./dist/index.d.mts` and CommonJS consumers (`require`) resolve `./dist/index.d.ts`, so the declaration file always matches the resolved module format instead of an ESM import falling back to the CJS-flavored `.d.ts` (the `"."`-level `types` that previously shadowed the ESM condition is removed; the root `types` field is retained for legacy/`node10` resolution). The `@types/react` dev floor moves from `^18` to `^19` across the React-facing packages, matching the installed React 19 runtime. No runtime or public API surface changes.
- 376969a: Build toolchain modernized across all packages, with no runtime or public API changes. Every package is now bundled with `tsdown` (Rolldown-based, replacing the unmaintained `tsup`); dist output (`.js`/`.mjs`/`.d.ts`/`.d.mts` + sourcemaps) is byte-compatible, so `exports` maps and installed shape are unchanged. Lint runs on Biome 2, the TypeScript floor moves to 5.9 (with `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, and `moduleDetection: "force"` added as guards), and Bun ambient types are removed from the shipped-source typecheck. The `@flare-engine/engine` README now documents that the engine is architecture-agnostic and imposes no React Native New Architecture requirement of its own.
- abdb991: README truth pass (ui / integration / tooling tiers): every `ts`/`tsx` example now typechecks against the workspace (enforced by `bun run check:readme` — all 41 packages green) and api-specs links are absolute.

  - Snippets corrected to the real API: `ui` `Button` takes `label` (not children); `react` `<VirtualJoystick onStateChange={…}>` inside a component (the empty-arrow parse error is gone); `devtools` `DevtoolsProvider` requires `snapshot`/`world`/`loop` and `useEntityInspector` exposes `entities` (not `components`); `testing` demonstrates the utility without the unavailable `expect` global; `ui-shop`/`iap`/`achievements` declare their context/store/gate placeholders with the real exported types (`NoopIAPProvider`, `AchievementsStore`, `canAccessContent`).
  - `create-flare-app` (private) had its showcase link pointed at flareengine.dev.

  (Root `README.md`/`CONTRIBUTING.md` also updated — status block to the 0.3.0 lockstep/October public flip, restricted-npm section removed, lockstep versioning story, flarerpg.org disambiguation, stub→shipping honesty for the tier-2 + haptics rows — but those are repo-root docs, not shipped in any tarball.)

### Patch Changes

- 47ad74f: ecs: add `World.removeQuery`, `World.forEachEntity`, and `World.entityCount` — query disposal plus zero-alloc entity iteration, so consumers no longer need a private-field cast to enumerate entities.

  testing: `serializeScene` now memoizes its per-component queries per world (`WeakMap`) instead of registering N+1 permanent queries on every call, and drops the redundant all-components query.

  devtools: `useEntityInspector` enumerates entities through `World.forEachEntity` instead of casting the world to a private `nextId` and scanning the id range.

- Updated dependencies [47ad74f]
- Updated dependencies [076651e]
- Updated dependencies [65358b8]
- Updated dependencies [7c4f7cf]
- Updated dependencies [376969a]
- Updated dependencies [8696136]
- Updated dependencies [268f246]
- Updated dependencies [a3c2376]
  - @flare-engine/ecs@0.3.0
  - @flare-engine/core@0.3.0

## 0.2.1

### Patch Changes

- Remove phantom `@flare-engine/*` dependencies that were declared in `package.json` but never imported from source (packaging hygiene; no runtime or API change). A new `check:deps` CI guardrail enforces that declared dependencies match actual imports and that the graph stays strictly downward-only.

- Updated dependencies []:
  - @flare-engine/core@0.2.1
  - @flare-engine/ecs@0.2.1

## 0.2.0

### Minor Changes

- Add `isDevMode`, a cross-runtime `__DEV__` guard.

## 0.1.0

### Minor Changes

- Initial release.
