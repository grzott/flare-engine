# @flare-engine/ui

## 0.4.5

### Patch Changes

- 8814ec2: Public release: every `@flare-engine/*` package is public on npm from this version, published from
  CI with npm provenance. No code changes; npm visibility is retroactive, so earlier versions are
  public too.

## 0.4.4

## 0.4.3

## 0.4.2

## 0.4.1

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

## 0.3.1

### Patch Changes

- e7947fe: Add `numberOfLines`, `ellipsizeMode`, `adjustsFontSizeToFit`, `minimumFontScale` to `LabelProps` and forward them to the underlying RN `Text`. `ellipsizeMode` is typed via `TextProps['ellipsizeMode']` so it tracks the `react-native >=0.79.0` peer floor automatically. Omitting any prop preserves existing rendered output.
- e7947fe: Widen `style` from `ViewStyle` to `StyleProp<ViewStyle>` (and `TextStyle` to `StyleProp<TextStyle>` on `Label`) across all eight component prop interfaces in `@flare-engine/ui`. Source-compatible for every caller passing a plain object; only code that reads the prop type observes this change (e.g. wrapper components that forward a style array).

## 0.3.0

### Minor Changes

- b8bf766: Reactive focus: `FocusProvider` now publishes `{ manager, focusedId }` as context state so `Button` and other consumers re-render on focus moves (the old provider-only force-render never repainted focus rings). Adds the `useFocusedId` hook and `FocusContextValue` type; `useFocusManager()` is unchanged. `FocusContext`'s value generic widens from `FocusManager | null` to `FocusContextValue | null` (only affects code reading the context directly rather than via `FocusProvider`).
- 7b43158: ui + ui-shop: remove the focus auto-select side-effect and refetch the shop on provider change.

  **ui — `FocusManager.register()` no longer focuses.** Registering a node used to auto-focus
  the first enabled registrant, so on a touch-first tree the first `Button` painted a permanent
  focus ring with no input, and it picked mount order over the documented tab order. `register()`
  is now side-effect-free; `focusedId` stays `null` until a driver acts. Initial focus is opt-in:
  a new `FocusManager.focusFirst()` selects the tab-order first node, and `FocusProvider` gains an
  `autoFocus?: boolean` prop that calls it once children register. Both additions are additive.

  **ui-shop — `ShopScreen` refetches when the catalog or IAP provider identity changes.** A
  once-for-life `fetched` ref meant a Noop→concrete provider swap never refetched products. The
  fetch effect is now keyed to `[catalog, provider]` (resetting to the loading state and dropping
  a stale in-flight response via a cancelled flag); `onError` is read through a latest-ref so a
  fresh inline callback identity cannot trigger a refetch.

- ff62507: Peer-dependency floor bump + Skia decoupling across the React-facing packages, plus a new web frame-renderer export. Floors move to `react >=19` and `react-native >=0.79` (Skia 2.x requires RN 0.79, not 0.78) wherever those peers are declared. `@shopify/react-native-skia` moves to `>=2.0.0` where it is still required (`react`, `engine`), is dropped entirely as a peer from `render` and `assets` (both already inject a structural `*Like` Skia module and never import Skia), and becomes an **optional, type-only** peer of `shapes` (used only for the `import type` in `draw.ts`) and an **optional, injected** peer of `postfx` (Skia is passed in at runtime; the floor moves from `>=1.0.0` to `>=2.0.0`). `react-native-gesture-handler` is dropped as a peer from `input`, `react`, and `engine` (no runtime usage). `engine` gains `react-native-safe-area-context >=4.0.0` as a required peer, matching `<GameView>`'s inset resolution.

  `@flare-engine/render-web` additionally ships `createWebFrameRenderer(kit: CanvasKit): FrameRenderer` — the web/CanvasKit analog of `@flare-engine/react`'s `createSkiaFrameRenderer`, a thin composition `createFrameRenderer(createWebSkiaModule(kit))`; presentation (replaying `endFrame()` onto a surface and flushing) stays the consumer's responsibility. Also fixes the `render-web` on-screen post-FX surface so `resize()` correctly rebuilds the WebGL onscreen surface (`postfx-surface.ts`), preventing a stale-size onscreen target after a canvas resize.

- 7c4f7cf: Packaging polish across all shipping manifests. Every package now declares `engines: { "node": ">=20" }`. Each package's `exports["."]` carries per-condition type declarations — ESM consumers (`import`) resolve `./dist/index.d.mts` and CommonJS consumers (`require`) resolve `./dist/index.d.ts`, so the declaration file always matches the resolved module format instead of an ESM import falling back to the CJS-flavored `.d.ts` (the `"."`-level `types` that previously shadowed the ESM condition is removed; the root `types` field is retained for legacy/`node10` resolution). The `@types/react` dev floor moves from `^18` to `^19` across the React-facing packages, matching the installed React 19 runtime. No runtime or public API surface changes.
- 376969a: Build toolchain modernized across all packages, with no runtime or public API changes. Every package is now bundled with `tsdown` (Rolldown-based, replacing the unmaintained `tsup`); dist output (`.js`/`.mjs`/`.d.ts`/`.d.mts` + sourcemaps) is byte-compatible, so `exports` maps and installed shape are unchanged. Lint runs on Biome 2, the TypeScript floor moves to 5.9 (with `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, and `moduleDetection: "force"` added as guards), and Bun ambient types are removed from the shipped-source typecheck. The `@flare-engine/engine` README now documents that the engine is architecture-agnostic and imposes no React Native New Architecture requirement of its own.
- abdb991: README truth pass (ui / integration / tooling tiers): every `ts`/`tsx` example now typechecks against the workspace (enforced by `bun run check:readme` — all 41 packages green) and api-specs links are absolute.

  - Snippets corrected to the real API: `ui` `Button` takes `label` (not children); `react` `<VirtualJoystick onStateChange={…}>` inside a component (the empty-arrow parse error is gone); `devtools` `DevtoolsProvider` requires `snapshot`/`world`/`loop` and `useEntityInspector` exposes `entities` (not `components`); `testing` demonstrates the utility without the unavailable `expect` global; `ui-shop`/`iap`/`achievements` declare their context/store/gate placeholders with the real exported types (`NoopIAPProvider`, `AchievementsStore`, `canAccessContent`).
  - `create-flare-app` (private) had its showcase link pointed at flareengine.dev.

  (Root `README.md`/`CONTRIBUTING.md` also updated — status block to the 0.3.0 lockstep/October public flip, restricted-npm section removed, lockstep versioning story, flarerpg.org disambiguation, stub→shipping honesty for the tier-2 + haptics rows — but those are repo-root docs, not shipped in any tarball.)

- 2736317: Keyboard input + UI focus driver. `@flare-engine/input` adds `createKeyboard` / `attachKeyboardListeners` (buffered `isDown`/`wasPressed`/`wasReleased` edges, blur clears held keys) + a `KeyBindings` action resolver; keyboard state + binding are platform-neutral (mobile + web) with `keyDown`/`keyUp` injection. `@flare-engine/ui` adds `createFocusKeyboardDriver` — arrows/Tab move focus, Enter/Space activate, via the reactive FocusManager.

### Patch Changes

- b113ca3: engine-wide: scrub private-game vocabulary from shipping JSDoc. Doc comments in a11y (`bridge.ts`), assets (`procedural-atlas.ts`), engine (`tier2-wiring.ts`), iap (`catalog.ts`/`entitlements.ts`), shapes (`types.ts`), share (`screenshot-scene.ts`), and ui (`dialogue-panel.tsx`/`main-menu-kit.tsx`/`shop-panel.tsx`) are rewritten project-neutral, so no game name, private repo URL, or internal phase/session numbers reach the published `.d.ts`. Comment-only — no API or behavior change.

## 0.2.1

## 0.2.0

### Minor Changes

- Version bumped as part of the 0.2.0 lockstep release.

## 0.1.0

### Minor Changes

- Initial release.
