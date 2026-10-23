# @flare-engine/engine

## 0.4.3

### Patch Changes

- aa21b75: FREEZE-FIX-3: `react-native-audio-api` is now an optional peer of `@flare-engine/audio` and
  `@flare-engine/engine`. Per ADR-0010.

  Neither package imports it: `AudioManager` types the audio context structurally and the app passes
  one in. As a required peer, npm and bun installed it into every app that depends on
  `@flare-engine/engine`, all three starter templates included, and Expo autolinked and compiled it
  whether or not the app played a sound. On Windows that native build cannot complete with the stock
  Android toolchain (its object paths run past the 260-character limit), so a fresh scaffold could not
  build for Android there.

  If your app plays audio on native and relied on that automatic install, add the package yourself
  (`bun add react-native-audio-api`). Until you do, bundling fails with "Unable to resolve module
  react-native-audio-api". Apps that never used it drop an unused native module. No exported name,
  signature or type changes.

- Updated dependencies [aa21b75]
  - @flare-engine/audio@0.4.3
  - @flare-engine/animation@0.4.3
  - @flare-engine/assets@0.4.3
  - @flare-engine/core@0.4.3
  - @flare-engine/debug@0.4.3
  - @flare-engine/dynamics@0.4.3
  - @flare-engine/ecs@0.4.3
  - @flare-engine/events@0.4.3
  - @flare-engine/input@0.4.3
  - @flare-engine/math@0.4.3
  - @flare-engine/particles@0.4.3
  - @flare-engine/physics@0.4.3
  - @flare-engine/postfx@0.4.3
  - @flare-engine/react@0.4.3
  - @flare-engine/render@0.4.3
  - @flare-engine/scene@0.4.3
  - @flare-engine/tilemap@0.4.3

## 0.4.2

### Patch Changes

- Updated dependencies [785a3b2]
  - @flare-engine/render@0.4.2
  - @flare-engine/animation@0.4.2
  - @flare-engine/assets@0.4.2
  - @flare-engine/audio@0.4.2
  - @flare-engine/core@0.4.2
  - @flare-engine/debug@0.4.2
  - @flare-engine/dynamics@0.4.2
  - @flare-engine/ecs@0.4.2
  - @flare-engine/events@0.4.2
  - @flare-engine/input@0.4.2
  - @flare-engine/math@0.4.2
  - @flare-engine/particles@0.4.2
  - @flare-engine/physics@0.4.2
  - @flare-engine/postfx@0.4.2
  - @flare-engine/react@0.4.2
  - @flare-engine/scene@0.4.2
  - @flare-engine/tilemap@0.4.2

## 0.4.1

### Patch Changes

- @flare-engine/animation@0.4.1
- @flare-engine/assets@0.4.1
- @flare-engine/audio@0.4.1
- @flare-engine/core@0.4.1
- @flare-engine/debug@0.4.1
- @flare-engine/dynamics@0.4.1
- @flare-engine/ecs@0.4.1
- @flare-engine/events@0.4.1
- @flare-engine/input@0.4.1
- @flare-engine/math@0.4.1
- @flare-engine/particles@0.4.1
- @flare-engine/physics@0.4.1
- @flare-engine/postfx@0.4.1
- @flare-engine/react@0.4.1
- @flare-engine/render@0.4.1
- @flare-engine/scene@0.4.1
- @flare-engine/tilemap@0.4.1

## 0.4.0

### Minor Changes

- 599cd30: OSS-M10: additive blend, flipX/flipY, drawNineSlice, cullBounds — per ADR-0006.

  **Breaking (SpriteDrawCommand):** three new required fields — `blend: 'normal' | 'additive'`,
  `flipX: boolean`, `flipY: boolean` — have been added to `SpriteDrawCommand`. Code that
  constructs a `SpriteDrawCommand` literal must now provide all three. The scope is `restricted`
  with no public consumers, so the break is a controlled migration; it is the reason this ships as
  a `minor` and lands pre-freeze rather than post-flip.

  **Additive blend:** `SpriteData.blend?` / `SpriteBatch.draw()` / `SpriteBatch.drawRaw()` accept
  `'normal' | 'additive'`. The value is a batch-key field — sprites with different blend modes form
  separate runs. Additive uses Skia `BlendMode.Plus` (kPlus = 12). `PaintLike.setBlendMode?` is
  optional; mocks that omit it silently stay in SrcOver (the Skia default).

  **flipX / flipY:** `SpriteData.flipX? / .flipY?` mirror a sprite about its centre. Mirrored
  sprites are routed through `drawImageRect` with a canvas `scale(±1, ±1)` transform — one draw
  call per sprite (per-sprite cost, documented). Not compatible with rotation; combine only with
  `rotation = 0`. RSXform cannot express a one-axis mirror (negative-determinant transform);
  this path is the explicit workaround. flip + outline effect falls back to the plain stretch
  paint (outline's two-pass SRC_IN path is incompatible with the single-drawImageRect flip path).

  **drawNineSlice:** `drawNineSlice(batch, image, frame, x, y, w, h, inset, effect?, alpha?)`
  splits a source frame into a 3×3 grid and draws each non-degenerate slice via `drawImageRect`.
  Corners draw at natural size; edges and centre stretch. Reads `batch.cullBounds` for a coarse
  AABB precheck before drawing any slices.

  **SpriteBatch.cullBounds / setCullBounds / clearCullBounds:** opt-in viewport culling bounds on
  the batch. Read by `drawNineSlice`; set via `setCullBounds(minX, minY, maxX, maxY)` (zero-alloc
  in steady state — one object allocated on first call, mutated thereafter). Disabled with
  `clearCullBounds()`.

  <!-- symbols-ok: BlendMode.Plus -->
  <!-- reason: Skia's blend-mode enum member, named because additive blending maps onto it; not a
       Flare export. -->

- 7b4f56f: Dispatch the native scene capture through `scheduleOnUI` from `react-native-worklets` instead of
  Reanimated's deprecated, curried `runOnUI`. Per ADR-0002.

  Two things this fixes. `runOnUI` is deprecated in Reanimated 4 and the peer range was open-ended
  (`>=3.19.1`), so a consumer on a future Reanimated 5 would have satisfied the declared range and
  got a silent runtime break on the native render path. And `runOnUI(fn)` is curried, so it allocated
  a wrapper closure on every frame inside `onPreRender` — the one place `AGENTS.md` forbids
  allocation.

  **Breaking:** `@flare-engine/react` now peers `react-native-reanimated >=4.0.0` and
  `react-native-worklets >=0.7.0`, and Reanimated 4 is New-Architecture-only, so old-architecture
  apps are no longer supported. Every `@flare-engine/create` template already ships both packages at
  these versions, so scaffolded apps need no change.

  Dropping old-architecture support costs nothing testable: no `@flare-engine/create` template could ever
  produce such an app, because all three pin Expo 57 / RN 0.86 and `expo prebuild` silently overrides
  an `app.json` opt-out. The earlier `>=3.19.1` floor was chosen to keep those apps viable, but Flare
  was never run on one — so the engine was shipping a promise it could not verify. Both shipped
  READMEs now state the New-Architecture requirement outright.

### Patch Changes

- 1c4ece5: XR-12: declare the `react-native-reanimated` peer on the barrel. `@flare-engine/engine` re-exports `GameView`, which requires Reanimated since the UI-thread scene capture landed, but the peer was only declared on `@flare-engine/react` — so an npm/pnpm/yarn consumer of the barrel resolved without it and crashed on first render.
- Updated dependencies [63d7dad]
- Updated dependencies [3573ff6]
- Updated dependencies [88b6907]
- Updated dependencies [4ac7c58]
- Updated dependencies [599cd30]
- Updated dependencies [b5d0a97]
- Updated dependencies [2740004]
- Updated dependencies [ddd8116]
- Updated dependencies [da81c97]
- Updated dependencies [14b532e]
- Updated dependencies [9868562]
- Updated dependencies [fb5a0c5]
- Updated dependencies [c50c515]
- Updated dependencies [2afc6d9]
- Updated dependencies [84c6268]
- Updated dependencies [6d6668c]
- Updated dependencies [9ed4ac6]
- Updated dependencies [c5b8c01]
- Updated dependencies [7b4f56f]
- Updated dependencies [a630580]
- Updated dependencies [96f6893]
- Updated dependencies [0ef1aec]
  - @flare-engine/physics@0.4.0
  - @flare-engine/tilemap@0.4.0
  - @flare-engine/input@0.4.0
  - @flare-engine/render@0.4.0
  - @flare-engine/particles@0.4.0
  - @flare-engine/math@0.4.0
  - @flare-engine/ecs@0.4.0
  - @flare-engine/core@0.4.0
  - @flare-engine/postfx@0.4.0
  - @flare-engine/react@0.4.0
  - @flare-engine/scene@0.4.0
  - @flare-engine/animation@0.4.0
  - @flare-engine/assets@0.4.0
  - @flare-engine/audio@0.4.0
  - @flare-engine/debug@0.4.0
  - @flare-engine/dynamics@0.4.0
  - @flare-engine/events@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [8701b58]
- Updated dependencies [1645606]
- Updated dependencies [1645606]
- Updated dependencies [b617e49]
- Updated dependencies [1645606]
- Updated dependencies [9a58db7]
- Updated dependencies [1645606]
  - @flare-engine/dynamics@0.3.1
  - @flare-engine/ecs@0.3.1
  - @flare-engine/physics@0.3.1
  - @flare-engine/postfx@0.3.1
  - @flare-engine/render@0.3.1
  - @flare-engine/react@0.3.1
  - @flare-engine/scene@0.3.1
  - @flare-engine/animation@0.3.1
  - @flare-engine/assets@0.3.1
  - @flare-engine/audio@0.3.1
  - @flare-engine/core@0.3.1
  - @flare-engine/debug@0.3.1
  - @flare-engine/events@0.3.1
  - @flare-engine/input@0.3.1
  - @flare-engine/math@0.3.1
  - @flare-engine/particles@0.3.1
  - @flare-engine/tilemap@0.3.1

## 0.3.0

### Minor Changes

- d5286bc: New package `@flare-engine/dynamics`: 2D rigid bodies over oriented boxes — SAT plus reference/
  incident face clipping for 1-2 point contact manifolds, and a sequential-impulse solver with
  Coulomb friction, restitution, and Baumgarte de-penetration. Bodies are plain objects with mutable
  `position` / `velocity`; all per-step structures are pooled per world, so `step()` allocates
  nothing in steady state. Complements `@flare-engine/physics`, which stays collision detection only.

  `@flare-engine/engine` re-exports the six-name `dynamics` barrel (`createWorld`, `addBody`,
  `createBody`, `step`, plus `Body`/`World` aliased as `DynamicsBody`/`DynamicsWorld` to avoid
  colliding with the `ecs` `World` class already in the umbrella).

- ff62507: Peer-dependency floor bump + Skia decoupling across the React-facing packages, plus a new web frame-renderer export. Floors move to `react >=19` and `react-native >=0.79` (Skia 2.x requires RN 0.79, not 0.78) wherever those peers are declared. `@shopify/react-native-skia` moves to `>=2.0.0` where it is still required (`react`, `engine`), is dropped entirely as a peer from `render` and `assets` (both already inject a structural `*Like` Skia module and never import Skia), and becomes an **optional, type-only** peer of `shapes` (used only for the `import type` in `draw.ts`) and an **optional, injected** peer of `postfx` (Skia is passed in at runtime; the floor moves from `>=1.0.0` to `>=2.0.0`). `react-native-gesture-handler` is dropped as a peer from `input`, `react`, and `engine` (no runtime usage). `engine` gains `react-native-safe-area-context >=4.0.0` as a required peer, matching `<GameView>`'s inset resolution.

  `@flare-engine/render-web` additionally ships `createWebFrameRenderer(kit: CanvasKit): FrameRenderer` — the web/CanvasKit analog of `@flare-engine/react`'s `createSkiaFrameRenderer`, a thin composition `createFrameRenderer(createWebSkiaModule(kit))`; presentation (replaying `endFrame()` onto a surface and flushing) stays the consumer's responsibility. Also fixes the `render-web` on-screen post-FX surface so `resize()` correctly rebuilds the WebGL onscreen surface (`postfx-surface.ts`), preventing a stale-size onscreen target after a canvas resize.

- 7c4f7cf: Packaging polish across all shipping manifests. Every package now declares `engines: { "node": ">=20" }`. Each package's `exports["."]` carries per-condition type declarations — ESM consumers (`import`) resolve `./dist/index.d.mts` and CommonJS consumers (`require`) resolve `./dist/index.d.ts`, so the declaration file always matches the resolved module format instead of an ESM import falling back to the CJS-flavored `.d.ts` (the `"."`-level `types` that previously shadowed the ESM condition is removed; the root `types` field is retained for legacy/`node10` resolution). The `@types/react` dev floor moves from `^18` to `^19` across the React-facing packages, matching the installed React 19 runtime. No runtime or public API surface changes.
- 376969a: Build toolchain modernized across all packages, with no runtime or public API changes. Every package is now bundled with `tsdown` (Rolldown-based, replacing the unmaintained `tsup`); dist output (`.js`/`.mjs`/`.d.ts`/`.d.mts` + sourcemaps) is byte-compatible, so `exports` maps and installed shape are unchanged. Lint runs on Biome 2, the TypeScript floor moves to 5.9 (with `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, and `moduleDetection: "force"` added as guards), and Bun ambient types are removed from the shipped-source typecheck. The `@flare-engine/engine` README now documents that the engine is architecture-agnostic and imposes no React Native New Architecture requirement of its own.
- abdb991: README truth pass (ui / integration / tooling tiers): every `ts`/`tsx` example now typechecks against the workspace (enforced by `bun run check:readme` — all 41 packages green) and api-specs links are absolute.

  - Snippets corrected to the real API: `ui` `Button` takes `label` (not children); `react` `<VirtualJoystick onStateChange={…}>` inside a component (the empty-arrow parse error is gone); `devtools` `DevtoolsProvider` requires `snapshot`/`world`/`loop` and `useEntityInspector` exposes `entities` (not `components`); `testing` demonstrates the utility without the unavailable `expect` global; `ui-shop`/`iap`/`achievements` declare their context/store/gate placeholders with the real exported types (`NoopIAPProvider`, `AchievementsStore`, `canAccessContent`).
  - `create-flare-app` (private) had its showcase link pointed at flareengine.dev.

  (Root `README.md`/`CONTRIBUTING.md` also updated — status block to the 0.3.0 lockstep/October public flip, restricted-npm section removed, lockstep versioning story, flarerpg.org disambiguation, stub→shipping honesty for the tier-2 + haptics rows — but those are repo-root docs, not shipped in any tarball.)

- 360657d: Headless entry + barrel honesty. `@flare-engine/engine` gains a `./headless` subpath export (14 RN-free packages + `createGame` + tier2-wiring; no `@flare-engine/react`, no `@flare-engine/postfx`) for web-only and Node consumers. Root barrel is now an explicit curated set: `@flare-engine/postfx` added (with `CompiledShader` aliased as `PostFxCompiledShader` and `SkImageLike` as `PostFxSkImageLike` to avoid render/assets clashes); `export * from @flare-engine/react` replaced with named re-exports (`GameConfig` aliased as `GameViewConfig` to avoid clashing with `createGame`'s own `GameConfig`). Package description updated to reflect the curated set.

### Patch Changes

- b113ca3: engine-wide: scrub private-game vocabulary from shipping JSDoc. Doc comments in a11y (`bridge.ts`), assets (`procedural-atlas.ts`), engine (`tier2-wiring.ts`), iap (`catalog.ts`/`entitlements.ts`), shapes (`types.ts`), share (`screenshot-scene.ts`), and ui (`dialogue-panel.tsx`/`main-menu-kit.tsx`/`shop-panel.tsx`) are rewritten project-neutral, so no game name, private repo URL, or internal phase/session numbers reach the published `.d.ts`. Comment-only — no API or behavior change.
- Updated dependencies [d5286bc]
- Updated dependencies [6a10aa9]
- Updated dependencies [6d439f7]
- Updated dependencies [d032b4b]
- Updated dependencies [c2b1429]
- Updated dependencies [3f1986c]
- Updated dependencies [b3f4f08]
- Updated dependencies [cfa69ce]
- Updated dependencies [47ad74f]
- Updated dependencies [b113ca3]
- Updated dependencies [076651e]
- Updated dependencies [e271eb2]
- Updated dependencies [5aecfb6]
- Updated dependencies [d69c329]
- Updated dependencies [3ab5f93]
- Updated dependencies [c9325ac]
- Updated dependencies [65358b8]
- Updated dependencies [bee807c]
- Updated dependencies [ff62507]
- Updated dependencies [7c4f7cf]
- Updated dependencies [376969a]
- Updated dependencies [8696136]
- Updated dependencies [68d22b2]
- Updated dependencies [abdb991]
- Updated dependencies [84fd0a3]
- Updated dependencies [2736317]
- Updated dependencies [a920170]
- Updated dependencies [358a348]
- Updated dependencies [268f246]
- Updated dependencies [a3c2376]
- Updated dependencies [938ef11]
- Updated dependencies [a24ea87]
- Updated dependencies [8b05108]
- Updated dependencies [9d4bf5e]
  - @flare-engine/dynamics@0.3.0
  - @flare-engine/math@0.3.0
  - @flare-engine/events@0.3.0
  - @flare-engine/physics@0.3.0
  - @flare-engine/input@0.3.0
  - @flare-engine/react@0.3.0
  - @flare-engine/audio@0.3.0
  - @flare-engine/postfx@0.3.0
  - @flare-engine/ecs@0.3.0
  - @flare-engine/assets@0.3.0
  - @flare-engine/animation@0.3.0
  - @flare-engine/core@0.3.0
  - @flare-engine/render@0.3.0
  - @flare-engine/scene@0.3.0
  - @flare-engine/particles@0.3.0
  - @flare-engine/tilemap@0.3.0
  - @flare-engine/debug@0.3.0

## 0.2.1

### Patch Changes

- Updated dependencies []:
  - @flare-engine/assets@0.2.1
  - @flare-engine/audio@0.2.1
  - @flare-engine/debug@0.2.1
  - @flare-engine/input@0.2.1
  - @flare-engine/render@0.2.1
  - @flare-engine/scene@0.2.1
  - @flare-engine/animation@0.2.1
  - @flare-engine/core@0.2.1
  - @flare-engine/ecs@0.2.1
  - @flare-engine/events@0.2.1
  - @flare-engine/math@0.2.1
  - @flare-engine/particles@0.2.1
  - @flare-engine/physics@0.2.1
  - @flare-engine/react@0.2.1
  - @flare-engine/tilemap@0.2.1

## 0.2.0

### Minor Changes

- Version bumped as part of the 0.2.0 lockstep release.

## 0.1.0

### Minor Changes

- Initial release.
