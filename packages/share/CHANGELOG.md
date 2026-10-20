# @flare-engine/share

## 0.4.2

## 0.4.1

## 0.4.0

## 0.3.1

## 0.3.0

### Minor Changes

- e590c89: share + deep-links: platform-adapter correctness.

  share: the native transport reported `dispatched` via `res.action !== 'dismissed'`, but React Native's `Share.share` resolves to `Share.sharedAction` (`'sharedAction'`) or `Share.dismissedAction` (`'dismissedAction'`) — never a bare `'dismissed'` — so an iOS Cancel was misreported as `dispatched: true`. Now checks `res.action === 'sharedAction'`.

  deep-links: `createWebSource` added one shared `onPop` closure per subscriber, but the DOM dedupes identical `(type, listener, capture)` registrations, so the first `removeEventListener` killed `popstate` navigation for every remaining subscriber. The DOM listener is now ref-counted (added on the first subscriber, removed on the last). Both `onPop` and `notify` now snapshot the listener set (`[...listeners]`) before dispatching, so a handler that subscribes or unsubscribes mid-dispatch no longer changes who receives that dispatch.

- 7c4f7cf: Packaging polish across all shipping manifests. Every package now declares `engines: { "node": ">=20" }`. Each package's `exports["."]` carries per-condition type declarations — ESM consumers (`import`) resolve `./dist/index.d.mts` and CommonJS consumers (`require`) resolve `./dist/index.d.ts`, so the declaration file always matches the resolved module format instead of an ESM import falling back to the CJS-flavored `.d.ts` (the `"."`-level `types` that previously shadowed the ESM condition is removed; the root `types` field is retained for legacy/`node10` resolution). The `@types/react` dev floor moves from `^18` to `^19` across the React-facing packages, matching the installed React 19 runtime. No runtime or public API surface changes.
- 376969a: Build toolchain modernized across all packages, with no runtime or public API changes. Every package is now bundled with `tsdown` (Rolldown-based, replacing the unmaintained `tsup`); dist output (`.js`/`.mjs`/`.d.ts`/`.d.mts` + sourcemaps) is byte-compatible, so `exports` maps and installed shape are unchanged. Lint runs on Biome 2, the TypeScript floor moves to 5.9 (with `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, and `moduleDetection: "force"` added as guards), and Bun ambient types are removed from the shipped-source typecheck. The `@flare-engine/engine` README now documents that the engine is architecture-agnostic and imposes no React Native New Architecture requirement of its own.
- 68d22b2: README truth pass (features + platform tiers): every `ts`/`tsx` example now typechecks against the workspace (enforced by `bun run check:readme`) and api-specs links are absolute (resolve on npmjs.com).

  - Snippets corrected to the real API where they had drifted: `animation` imports easings from `@flare-engine/math` (not `@flare-engine/animation`); `particles` uses `Color` objects, `speed`/`speedMax`, `direction`, config `gravityY`, and single-arg `update(dt)` (opacity fades via `start`/`endAlpha`, not `Color.a`); `pathfinding` `findPathJPS(grid, sx, sy, ex, ey)` returning `PathResult | null` with `path`/`cost`/`explored`; `dialogue` `createDialogueGraph`/`createDialogueRunner`/`createTextReveal` signatures + `ActionHandler(key)`; `debug` `StatsTracker` + `FpsWidget.update(stats)` + `TimeControl(clock)`; `errors` zero-arg `createConsoleTransport()`; `localization` real manager options; `scene` `Scene` requires `name`/`world`/`camera`.
  - Placeholders declared with real types; `haptics` marks its `expo-haptics` example `no-check` (uninstalled peer); `deep-links`/`share` import `Linking`/`Share` from `react-native`.

### Patch Changes

- b113ca3: engine-wide: scrub private-game vocabulary from shipping JSDoc. Doc comments in a11y (`bridge.ts`), assets (`procedural-atlas.ts`), engine (`tier2-wiring.ts`), iap (`catalog.ts`/`entitlements.ts`), shapes (`types.ts`), share (`screenshot-scene.ts`), and ui (`dialogue-panel.tsx`/`main-menu-kit.tsx`/`shop-panel.tsx`) are rewritten project-neutral, so no game name, private repo URL, or internal phase/session numbers reach the published `.d.ts`. Comment-only — no API or behavior change.
- 6078b5a: share: fix screenshot format codes. `FORMAT_CODES` now matches RN-Skia's `ImageFormat` enum (`{ png: 4, jpeg: 3 }`) — the old `{ png: 3, jpeg: 2 }` made `png` silently emit JPEG bytes and `jpeg` emit nothing (an invalid code). Locked by a contract test that reads the installed `@shopify/react-native-skia` type declaration. `canShare` now derives the shared filename's extension from the screenshot format instead of always using `.png`, matching `share()`.

## 0.2.1

## 0.2.0

### Minor Changes

- Version bumped as part of the 0.2.0 lockstep release.

## 0.1.0

### Minor Changes

- Initial release.
