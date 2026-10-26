# @flare-engine/deep-links

## 0.4.4

### Patch Changes

- @flare-engine/events@0.4.4

## 0.4.3

### Patch Changes

- @flare-engine/events@0.4.3

## 0.4.2

### Patch Changes

- @flare-engine/events@0.4.2

## 0.4.1

### Patch Changes

- @flare-engine/events@0.4.1

## 0.4.0

### Patch Changes

- 4ac7c58: OSS-B23b: harden URL and input parsing against inherited keys and non-finite values.

  `deep-links` builds its three URL-derived `Params` objects with `Object.create(null)`, so a link that never carried a `constructor` / `toString` key no longer answers those reads with an inherited value.

  `input` corrects out-of-contract configuration instead of propagating it: `updateJoystick` guards a zero distance and a `maxRadius` equal to `deadZone` (both divided by zero and wrote NaN into the reused state, which never recovered), and `applyDeadZone` clamps a dead zone outside `[0, 1)`. Invalid values are clamped and reported once via a `__DEV__`-only warning rather than throwing, since both run in the per-frame input path.

  - @flare-engine/events@0.4.0

## 0.3.1

### Patch Changes

- @flare-engine/events@0.3.1

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

- 8df30b4: deep-links: correct custom-scheme URL parsing.

  `parseUrl` treated the first token after `://` as the host for every scheme, so an RN-style deep link like `myapp://zone/4` parsed to host `zone` + segments `['4']` and could never match a `/zone/:id` route (`DeepLinkRouter.match` routes on segments only). Now only `http`/`https` extract an authority into `host`; any other scheme yields `host = ''` and treats the entire post-`://` remainder as the path, so `myapp://zone/4` → segments `['zone','4']` and matches `/zone/:id`.

  Also: a scheme-detection guard prevents a `://` inside a query value (e.g. `/redirect?to=http://x.com`) from being misread as a scheme; the `http`/`https` authority now stops at the first `/`, `?`, or `#` (a query-only universal link no longer folds its query into `host`). `host` is documented as tri-state — real authority (http/https) · `''` (custom scheme, no authority) · `null` (relative URL).

  Behavior change: custom-scheme route patterns must now account for the segment that was previously swallowed as host (e.g. register `/settings/profile`, not `/profile`, for `myapp://settings/profile`). The README example and 2-arg `DeepLinkManager` construction snippet are corrected.

- Updated dependencies [6d439f7]
- Updated dependencies [7c4f7cf]
- Updated dependencies [376969a]
- Updated dependencies [8696136]
  - @flare-engine/events@0.3.0

## 0.2.1

### Patch Changes

- Updated dependencies []:
  - @flare-engine/events@0.2.1

## 0.2.0

### Minor Changes

- Version bumped as part of the 0.2.0 lockstep release.

## 0.1.0

### Minor Changes

- Initial release.
