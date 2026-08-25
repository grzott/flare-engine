# @flare-engine/react

## 0.3.0

### Minor Changes

- c2b1429: add `skiaAtlasModule` — a typed adapter exposing the RN-Skia module as the engine's structural `SkiaAtlasModuleLike`, so `createProceduralAtlas` callers no longer need an `as unknown as` cast at the boundary (the single boundary assertion now lives in one tested engine file). Consumed by the shmup + topdown starter templates.
- ff62507: Peer-dependency floor bump + Skia decoupling across the React-facing packages, plus a new web frame-renderer export. Floors move to `react >=19` and `react-native >=0.79` (Skia 2.x requires RN 0.79, not 0.78) wherever those peers are declared. `@shopify/react-native-skia` moves to `>=2.0.0` where it is still required (`react`, `engine`), is dropped entirely as a peer from `render` and `assets` (both already inject a structural `*Like` Skia module and never import Skia), and becomes an **optional, type-only** peer of `shapes` (used only for the `import type` in `draw.ts`) and an **optional, injected** peer of `postfx` (Skia is passed in at runtime; the floor moves from `>=1.0.0` to `>=2.0.0`). `react-native-gesture-handler` is dropped as a peer from `input`, `react`, and `engine` (no runtime usage). `engine` gains `react-native-safe-area-context >=4.0.0` as a required peer, matching `<GameView>`'s inset resolution.

  `@flare-engine/render-web` additionally ships `createWebFrameRenderer(kit: CanvasKit): FrameRenderer` — the web/CanvasKit analog of `@flare-engine/react`'s `createSkiaFrameRenderer`, a thin composition `createFrameRenderer(createWebSkiaModule(kit))`; presentation (replaying `endFrame()` onto a surface and flushing) stays the consumer's responsibility. Also fixes the `render-web` on-screen post-FX surface so `resize()` correctly rebuilds the WebGL onscreen surface (`postfx-surface.ts`), preventing a stale-size onscreen target after a canvas resize.

- 7c4f7cf: Packaging polish across all shipping manifests. Every package now declares `engines: { "node": ">=20" }`. Each package's `exports["."]` carries per-condition type declarations — ESM consumers (`import`) resolve `./dist/index.d.mts` and CommonJS consumers (`require`) resolve `./dist/index.d.ts`, so the declaration file always matches the resolved module format instead of an ESM import falling back to the CJS-flavored `.d.ts` (the `"."`-level `types` that previously shadowed the ESM condition is removed; the root `types` field is retained for legacy/`node10` resolution). The `@types/react` dev floor moves from `^18` to `^19` across the React-facing packages, matching the installed React 19 runtime. No runtime or public API surface changes.
- 376969a: Build toolchain modernized across all packages, with no runtime or public API changes. Every package is now bundled with `tsdown` (Rolldown-based, replacing the unmaintained `tsup`); dist output (`.js`/`.mjs`/`.d.ts`/`.d.mts` + sourcemaps) is byte-compatible, so `exports` maps and installed shape are unchanged. Lint runs on Biome 2, the TypeScript floor moves to 5.9 (with `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, and `moduleDetection: "force"` added as guards), and Bun ambient types are removed from the shipped-source typecheck. The `@flare-engine/engine` README now documents that the engine is architecture-agnostic and imposes no React Native New Architecture requirement of its own.
- abdb991: README truth pass (ui / integration / tooling tiers): every `ts`/`tsx` example now typechecks against the workspace (enforced by `bun run check:readme` — all 41 packages green) and api-specs links are absolute.

  - Snippets corrected to the real API: `ui` `Button` takes `label` (not children); `react` `<VirtualJoystick onStateChange={…}>` inside a component (the empty-arrow parse error is gone); `devtools` `DevtoolsProvider` requires `snapshot`/`world`/`loop` and `useEntityInspector` exposes `entities` (not `components`); `testing` demonstrates the utility without the unavailable `expect` global; `ui-shop`/`iap`/`achievements` declare their context/store/gate placeholders with the real exported types (`NoopIAPProvider`, `AchievementsStore`, `canAccessContent`).
  - `create-flare-app` (private) had its showcase link pointed at flareengine.dev.

  (Root `README.md`/`CONTRIBUTING.md` also updated — status block to the 0.3.0 lockstep/October public flip, restricted-npm section removed, lockstep versioning story, flarerpg.org disambiguation, stub→shipping honesty for the tier-2 + haptics rows — but those are repo-root docs, not shipped in any tarball.)

- 938ef11: Fix unconditional web postfx warn and stale version literal (WEB-7).

  **Defect 1 — unconditional warn.** `GameView` emitted `"postfx chain skipped"` on every web load
  regardless of whether a postfx binding actually existed. The blank scaffolder template configures no
  chain and still logged the warning on every load.

  **Defect 2 — stale version literal.** The warning hardcoded `"RN-Skia 2.4.18"` while the
  templates ship RN-Skia 2.6.0, so it named a version the consumer does not have.

  **Fix — `hasPostFxBinding()` predicate (`@flare-engine/render`).** `FrameRenderer` gains a new
  method `hasPostFxBinding(): boolean`. It returns `true` only when a runtime is bound, its
  `supported` flag is truthy, its `buildPass` method is present, and a chain is also bound. Crucially,
  it never calls `runtime.buildPass` — `buildPass` is the call that throws `"Not implemented on React
Native Web"` in RN-Skia's `Skia.RuntimeShaderBuilder` and
  `ImageFilter.MakeRuntimeShaderWithChildren`. The predicate is therefore safe to call on web.

  **Fix — gated warn (`@flare-engine/react`).** `GameView`'s web branch now fires the
  `console.warn` only when `bridge.hasPostFxBinding()` is true. A template with no chain loads
  silently.

  **Fix — no version literal.** The warning message no longer contains a version number. It names
  both throwing call sites — `Skia.RuntimeShaderBuilder` and
  `ImageFilter.MakeRuntimeShaderWithChildren` — and the thrown message `"Not implemented on React
Native Web"`. Those are facts the code can stand behind; the version is not.

  **Behaviour change — per-instance warn-once.** The warn-once flag moved from a module-level
  variable to a `useRef` inside `<GameView>`. The observable difference: a page that mounts two
  `<GameView>` instances each with a postfx chain will now see two warnings (one per instance) rather
  than one. This is the intended behaviour: each instance is independently informative.

- a24ea87: Fix web scene capture blank-canvas regression and gate postfx on web.

  **Scene capture (WEB-3 F1).** The single-slot frame-image release introduced at WEB-2 was too
  aggressive: RN-Skia's web `<Canvas>` paints on its own rAF, which fires _after_ the capture, so
  releasing the image on the next capture frees an object the canvas is still painting. Measured at
  2560×1215: hold=1 and hold=2 both produce a blank canvas with a per-frame
  `BindingError: Cannot pass deleted object as a pointer of type Image const*`; hold=3 renders 1378
  frames with zero errors. `createSceneCapture` now uses a FIFO retention ring of depth 3 — the
  measured minimum.

  **PostFx gate (WEB-3 F2).** `Skia.RuntimeShaderBuilder` and
  `ImageFilter.MakeRuntimeShaderWithChildren` both throw `Not implemented on React Native Web` in
  RN-Skia 2.4.18, so any `<GameView>` with a non-empty postfx chain would throw on every frame on
  web. `GameView` now skips `buildPostFxPasses` and `setPasses` entirely when
  `Platform.OS === 'web'`, and emits a one-time `console.warn` naming the reason. Native behaviour is
  byte-for-byte unchanged.

- 8b05108: Move web scene capture from a passive effect into the frame callback.

  **The bug.** `onPreRender` called `setPicture(pic)` → React re-rendered →
  `useEffect` keyed on `[picture]` fired → `capture()` ran → `setImage` →
  React re-rendered again. That setState-in-a-passive-effect cascade trips
  React's `NESTED_PASSIVE_UPDATE_LIMIT` (50) and logs
  `Maximum update depth exceeded` in the browser console on every web page
  load containing a `<GameView>`. It also cost two React renders per frame
  and delayed the captured scene image by one extra hop before it was painted.

  **The fix.** `useWebSceneTexture` is now imperative: it returns a
  `capture(picture, width, height)` callback instead of subscribing to a
  picture prop through a reactive effect. `GameView`'s `onPreRender` handler
  calls `captureWebScene(pic, w * pd, h * pd)` directly — `GameLoop` schedules
  via `requestAnimationFrame`, so this is an ordinary root update that never
  touches the passive-update counter. This halves the React renders per web
  frame and removes one hop of latency between capture and paint.

  Native is unchanged: the `else` branch of the new platform split still calls
  `setPicture(pic)`, and the `usePictureAsTexture` + `useWebSceneTexture` hook
  pair continues to run unconditionally on both platforms so hook order never
  varies.

- 9d4bf5e: Fix `<GameView>` painting nothing on web. RN-Skia's web `MakeOffscreen` builds a fresh
  `OffscreenCanvas` and WebGL context per call and releases neither, and `GameView` pushes a new
  picture every frame — so the per-frame `usePictureAsTexture` allocation crossed Chrome's
  16-live-WebGL-context cap within ~16 frames, the on-screen `<Canvas>` was evicted as the oldest
  context, and the game loop kept running while nothing rendered.

  Scene capture is now platform-branched inside the package. Web captures into a single offscreen
  surface reused across frames — reallocated only when the viewport size changes — and detaches each
  snapshot with `makeNonTextureImage()`. Native keeps RN-Skia's `usePictureAsTexture` unchanged. Both
  hooks run on both platforms, each made inert by a null picture, so hook order never varies. Postfx
  composition is untouched and identical on both platforms.

  `react-native-web` and `canvaskit-wasm` are declared as optional peer dependencies. No new exported
  API.

### Patch Changes

- 3f1986c: GameView no longer churns postfx state every frame. `setPasses` is now gated on a shallow pass signature (length + per-pass `id` + shader ref + child-image refs + uniform values), an empty chain collapses to a shared `EMPTY_PASSES` constant, and the `RuntimeShader` element array, the four responder handlers, and the container style are memoized. Animated effects (hit-flash decay, timed triggers) still propagate because uniform values are part of the signature; a postfx-free or steady chain now triggers zero re-renders from passes after the first frame. No API change.
- e271eb2: render: shader-effect + z-order correctness. water/fog/fire SkSL are now source-free procedural overlays fed real sprite resolution (previously declared an unbound `uniform shader src` child and hardcoded resolution 0 → could not render on a real backend); `SpriteBatch.flush` groups maximal consecutive runs keyed on `(image, effect, alpha, stretch)`, preserving global z-order across interleaved textures; the stretch draw path now applies sprite effects (was alpha-only) with an outline fall-back; `Camera2D` dead-zone follow no longer double-counts the target offset. `GameView` (react) now forwards the real `GameLoop.clock.elapsed` to `beginFrame` so time-driven shaders animate (was hardcoded 0).
- Updated dependencies [6a10aa9]
- Updated dependencies [6d439f7]
- Updated dependencies [d032b4b]
- Updated dependencies [b3f4f08]
- Updated dependencies [47ad74f]
- Updated dependencies [b113ca3]
- Updated dependencies [076651e]
- Updated dependencies [e271eb2]
- Updated dependencies [3ab5f93]
- Updated dependencies [c9325ac]
- Updated dependencies [65358b8]
- Updated dependencies [ff62507]
- Updated dependencies [7c4f7cf]
- Updated dependencies [376969a]
- Updated dependencies [8696136]
- Updated dependencies [68d22b2]
- Updated dependencies [84fd0a3]
- Updated dependencies [2736317]
- Updated dependencies [a920170]
- Updated dependencies [268f246]
- Updated dependencies [a3c2376]
- Updated dependencies [938ef11]
  - @flare-engine/math@0.3.0
  - @flare-engine/events@0.3.0
  - @flare-engine/input@0.3.0
  - @flare-engine/audio@0.3.0
  - @flare-engine/ecs@0.3.0
  - @flare-engine/assets@0.3.0
  - @flare-engine/core@0.3.0
  - @flare-engine/render@0.3.0
  - @flare-engine/scene@0.3.0

## 0.2.1

### Patch Changes

- Updated dependencies []:
  - @flare-engine/assets@0.2.1
  - @flare-engine/audio@0.2.1
  - @flare-engine/input@0.2.1
  - @flare-engine/render@0.2.1
  - @flare-engine/scene@0.2.1
  - @flare-engine/core@0.2.1
  - @flare-engine/ecs@0.2.1
  - @flare-engine/events@0.2.1
  - @flare-engine/math@0.2.1

## 0.2.0

### Minor Changes

- Add `useOverlayFade`, `useCountUp`, and `useSignalState` hooks.

- Apply `DropShadowEffect` via a reused `MakeDropShadow` paint.

## 0.1.0

### Minor Changes

- Initial release.
