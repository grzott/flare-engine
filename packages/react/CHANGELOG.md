# @flare-engine/react

## 0.4.6

### Patch Changes

- @flare-engine/assets@0.4.6
- @flare-engine/audio@0.4.6
- @flare-engine/core@0.4.6
- @flare-engine/ecs@0.4.6
- @flare-engine/events@0.4.6
- @flare-engine/input@0.4.6
- @flare-engine/math@0.4.6
- @flare-engine/render@0.4.6
- @flare-engine/scene@0.4.6

## 0.4.5

### Patch Changes

- 8814ec2: Public release: every `@flare-engine/*` package is public on npm from this version, published from
  CI with npm provenance. No code changes; npm visibility is retroactive, so earlier versions are
  public too.
- Updated dependencies [8814ec2]
  - @flare-engine/assets@0.4.5
  - @flare-engine/audio@0.4.5
  - @flare-engine/core@0.4.5
  - @flare-engine/ecs@0.4.5
  - @flare-engine/events@0.4.5
  - @flare-engine/input@0.4.5
  - @flare-engine/math@0.4.5
  - @flare-engine/render@0.4.5
  - @flare-engine/scene@0.4.5

## 0.4.4

### Patch Changes

- FREEZE-FIX-4: `<VirtualJoystick>` follows its own finger on device, so the knob no longer jumps on
  Android or leaves its ring when you drag past the edge. Per ADR-0011.

  The component read each touch's `locationX`/`locationY` as if they were measured against the stick.
  Android measures them against whichever view is under the finger at that moment: the default knob
  while the finger is over it, or the game view once the finger passes the ring. It also reports
  another finger's touch on the event when that finger moves. The stick now takes its page origin at
  grant, follows the granting finger by `identifier` in page coordinates, and ignores other fingers.
  The default knob is no longer a touch target, matching the `base` and `thumb` slots. Web behaviour is
  unchanged. No exported name, signature or type changes.

  <!-- symbols-ok: locationX, locationY, identifier -->
  <!-- reason: React Native touch-event fields, named because the fix is which of them the component
       reads; none is a Flare export. -->

  - @flare-engine/assets@0.4.4
  - @flare-engine/audio@0.4.4
  - @flare-engine/core@0.4.4
  - @flare-engine/ecs@0.4.4
  - @flare-engine/events@0.4.4
  - @flare-engine/input@0.4.4
  - @flare-engine/math@0.4.4
  - @flare-engine/render@0.4.4
  - @flare-engine/scene@0.4.4

## 0.4.3

### Patch Changes

- Updated dependencies [aa21b75]
  - @flare-engine/audio@0.4.3
  - @flare-engine/assets@0.4.3
  - @flare-engine/core@0.4.3
  - @flare-engine/ecs@0.4.3
  - @flare-engine/events@0.4.3
  - @flare-engine/input@0.4.3
  - @flare-engine/math@0.4.3
  - @flare-engine/render@0.4.3
  - @flare-engine/scene@0.4.3

## 0.4.2

### Patch Changes

- Updated dependencies [785a3b2]
  - @flare-engine/render@0.4.2
  - @flare-engine/assets@0.4.2
  - @flare-engine/audio@0.4.2
  - @flare-engine/core@0.4.2
  - @flare-engine/ecs@0.4.2
  - @flare-engine/events@0.4.2
  - @flare-engine/input@0.4.2
  - @flare-engine/math@0.4.2
  - @flare-engine/scene@0.4.2

## 0.4.1

### Patch Changes

- @flare-engine/assets@0.4.1
- @flare-engine/audio@0.4.1
- @flare-engine/core@0.4.1
- @flare-engine/ecs@0.4.1
- @flare-engine/events@0.4.1
- @flare-engine/input@0.4.1
- @flare-engine/math@0.4.1
- @flare-engine/render@0.4.1
- @flare-engine/scene@0.4.1

## 0.4.0

### Minor Changes

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

- 6d6668c: PF-7: settle the published surface of `react`, `scene` and `storage` before the 0.4.0 freeze. Per ADR-0004.

  - `GameView`'s `safeArea` prop: the shipped JSDoc and API spec already promised a zero-insets
    fallback when no `<SafeAreaProvider>` ancestor is mounted, but the code called
    `useSafeAreaInsets()` unconditionally, which throws in that exact situation — so the fallback
    never existed and an app trusting the docs got a blank screen and a stack trace. `GameView` now
    reads `useContext(SafeAreaInsetsContext)` directly (still called unconditionally, per the hook
    rules) and falls back to `{ top: 0, right: 0, bottom: 0, left: 0 }` when it is `null` or when
    `safeArea` is supplied explicitly. `useSafeAreaInsets` is no longer called.
  - `SceneFactory` is now `(world: World, camera: Camera2D) => Scene` instead of `() => Scene`.
    `SceneManager` always overwrote `scene.world`/`scene.camera` after calling the factory, so a
    factory that returned a real, pre-populated `World` — the only shape the published `Scene`
    interface's required `world`/`camera` fields allow without a forbidden `null!` — silently lost
    it. The manager now passes the `World`/`Camera2D` it created into the factory instead. A
    zero-argument `() => Scene` factory remains assignable to `SceneFactory`, so existing factories
    that build their own world/camera are unaffected.
  - `DocumentStore.load()` never persists over a document it could not read. Previously, a stored
    version newer than the app's (store rollback, side-loaded APK, staged-rollout revert) or a
    throwing consumer migration fell into the same silent-fallback path as corrupt JSON — returning
    `parse(undefined)` **and writing it back to the adapter**, destroying a well-formed document that
    a newer build could otherwise have read. `load()` now persists the fallback only when the stored
    data was never a valid envelope to begin with (bad JSON, wrong shape); on a migration failure it
    returns the fallback for that call only and leaves the stored bytes untouched, so reinstalling a
    build that can read the document recovers it. `load()` still never throws. Two things this does
    NOT change, on purpose: the caller has no signal that its data survived versus was truly absent
    (a reason channel was considered and deferred — more design than this row holds), and
    `createStorage.loadSlot` still throws in the equivalent case, so the two stores now deliberately
    diverge; see `api-specs.md` for the documented split.

- 9ed4ac6: Two docstring corrections in the published type declarations: `SceneCaptureOptions` now says the
  native UI-thread capture runs through `scheduleOnUI` (it named `runOnUI`, which `GameView` stopped
  using when the worklets floor rose), and the shader-effect `children` field no longer refers to a
  private game's effect set. No behaviour change.
- c5b8c01: XR-1: declare react-native-reanimated peer, own shared-value scene capture
- a630580: XR-1c: build the native scene-capture surface on the UI thread. A surface created on the JS thread belongs to a different GL context than the on-screen canvas, so `<GameView>` rendered a black frame on device while the game loop ran normally. Web keeps its single-threaded capture path.
- 96f6893: Document `GameConfig.opaque` as recommended on Android, with the device measurement behind it: the
  default TextureView path logs RN-Skia's `LegacySurfaceTexture` / `updateAndRelease` pair 22,028
  times per 60s — 90% of all logcat output — where `opaque: true` logs it zero times. Rendering is
  correct either way and native memory is flat across a 6-minute soak on both paths, so this is log
  noise and TextureView overhead rather than a correctness fix.

  <!-- symbols-ok: LegacySurfaceTexture, updateAndRelease -->
  <!-- reason: both are @shopify/react-native-skia internals, not Flare exports. Named because the
       Android guidance is about behaviour originating in that dependency. -->

- Updated dependencies [3573ff6]
- Updated dependencies [4ac7c58]
- Updated dependencies [599cd30]
- Updated dependencies [da81c97]
- Updated dependencies [9868562]
- Updated dependencies [fb5a0c5]
- Updated dependencies [c50c515]
- Updated dependencies [2afc6d9]
- Updated dependencies [6d6668c]
- Updated dependencies [0ef1aec]
  - @flare-engine/input@0.4.0
  - @flare-engine/render@0.4.0
  - @flare-engine/math@0.4.0
  - @flare-engine/ecs@0.4.0
  - @flare-engine/core@0.4.0
  - @flare-engine/scene@0.4.0
  - @flare-engine/assets@0.4.0
  - @flare-engine/audio@0.4.0
  - @flare-engine/events@0.4.0

## 0.3.1

### Patch Changes

- 9a58db7: Fix simultaneous VirtualJoystick + VirtualButton use (PT-9.1 blocker). GameView routes all concurrent touches to InputManager using real pointer identifiers from `nativeEvent.changedTouches` instead of hardcoded id 0. VirtualJoystick adds `onResponderTerminationRequest={false}` so it retains its vector when a second finger touches the screen. VirtualButton switches from the single-owner responder system to raw `onTouchStart`/`onTouchEnd`/`onTouchCancel` events, which fire regardless of who holds the responder — enabling both controls to operate simultaneously without interference.
- Updated dependencies [1645606]
- Updated dependencies [1645606]
- Updated dependencies [1645606]
  - @flare-engine/ecs@0.3.1
  - @flare-engine/render@0.3.1
  - @flare-engine/scene@0.3.1
  - @flare-engine/assets@0.3.1
  - @flare-engine/audio@0.3.1
  - @flare-engine/core@0.3.1
  - @flare-engine/events@0.3.1
  - @flare-engine/input@0.3.1
  - @flare-engine/math@0.3.1

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
