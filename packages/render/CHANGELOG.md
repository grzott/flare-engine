# @flare-engine/render

## 0.4.2

### Patch Changes

- 785a3b2: FREEZE-FIX-2: `tint` and `flash` keep the sprite's alpha, so a frame's transparent padding stays
  transparent instead of being painted with the effect colour. Per ADR-0009.

  Both effects are a constant-colour filter on the sprite paint, and the filter runs on every pixel of
  the quad. It blended with Skia's SrcOver, which over a fully transparent texel yields the constant
  itself, so any frame whose art does not fill its quad tinted or flashed as a rectangle — at full
  flash intensity an opaque one. The filter now blends with SrcATop (r = s·da + d·(1−sa)): the result
  keeps the art's own alpha and lerps its colour by the effect's alpha. Fully opaque pixels are
  byte-identical to before; transparent pixels stay transparent; anti-aliased edges and glows keep
  their coverage instead of being filled toward the effect colour, so a soft edge under `tint` reads
  slightly thinner and a `flash` over a soft-edged sprite is fainter at its edges than it was.

  `@flare-engine/render-web`'s CanvasKit adapter maps the new mode to `BlendMode.SrcATop` in its
  `ColorFilter.MakeBlend`; before, every mode other than 3 and 5 fell back to SrcOver, which would have
  made the render change a silent no-op on web. A consumer-written `FrameRendererModule` adapter that
  maps numeric blend modes itself now receives 9 for these two effects and should map it to the
  platform's SrcATop. No exported name, signature or type changes.

  <!-- symbols-ok: BlendMode.SrcATop, ColorFilter.MakeBlend -->
  <!-- reason: a Skia blend-mode enum entry and the colour-filter factory member on the structural
       `FrameRendererModule`, named because the change is which Skia mode the engine passes; neither
       is a top-level Flare export. -->

  - @flare-engine/assets@0.4.2
  - @flare-engine/ecs@0.4.2
  - @flare-engine/math@0.4.2

## 0.4.1

### Patch Changes

- @flare-engine/assets@0.4.1
- @flare-engine/ecs@0.4.1
- @flare-engine/math@0.4.1

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

### Patch Changes

- 9868562: PF-2a: settle three `ecs` contracts before the freeze. Per ADR-0004.

  `Query.entities` is the zero-alloc walk — the live `readonly number[]` of matching ids, for an
  indexed loop. The built-in systems and the render system now use it; `for...of` stays as the
  convenience form, which allocates an iterator per loop and, on Hermes, a result object per entity.

  `QueryBuilder` takes the World's registration hook as a required constructor argument, so a bare
  `new QueryBuilder()` no longer compiles and `build()` always returns a query the world keeps
  populated. `world.queryBuilder()` is unchanged. The internal `_WorldQueryBuilder` subclass and
  `World._registerQuery` are gone.

  `definePrefab` documents that plain-object data is stored by reference and shared by every spawn
  (pass `() => T` for per-entity mutable state), and `Prefab.spawn(world)` drops the `overrides`
  parameter it never read.

- 2afc6d9: PF-5: settle the render-web, postfx and render surface before the freeze. Per ADR-0004.

  `createWebSurface` now returns a `WebSurface` handle — `{ canvas, ckCanvas, flush(), dispose() }` — instead of a bare `CanvasLike`. The previous return hid the CanvasKit surface, so nothing drawn through it could be presented or freed; the README presentation example now goes through the function instead of around it.

  `PostFxSurface.composite(globalIntensity?)` takes its argument optionally and writes it into the chain only when given. Every frame it used to overwrite `chain.globalIntensity`, undoing a reduced-motion scale set through `PostFxController.setMotionScale` or the a11y bridge; the README recipe that taught `composite(1)` now calls `composite()`.

  `COMPOSITE_SKSL`'s clouds branch honours `weatherDirection` with the same rotated scroll as `WEATHER_CLOUDS_SKSL`; it had stayed on the X-only scroll when the standalone shader gained a direction. Rendering changes for anyone on the composite clouds path with a non-zero direction.

  `PostFxController.triggerTimed` is required on the interface (it was always implemented). `render` no longer exports `ColorLike`, an alias nothing referenced.

- Updated dependencies [da81c97]
- Updated dependencies [9868562]
- Updated dependencies [fb5a0c5]
- Updated dependencies [0ef1aec]
  - @flare-engine/math@0.4.0
  - @flare-engine/ecs@0.4.0
  - @flare-engine/assets@0.4.0

## 0.3.1

### Patch Changes

- 1645606: Widen `makeShaderWithChildren` uniforms parameter to `Float32Array | number[]` in both `SkiaRuntimeEffectLike` (postfx) and `FrameRendererCompiledPass.shader` (render), making `PostFxRuntime` structurally assignable to `FrameRendererPostFxRuntime` without a type bridge.
- Updated dependencies [1645606]
  - @flare-engine/ecs@0.3.1
  - @flare-engine/assets@0.3.1
  - @flare-engine/math@0.3.1

## 0.3.0

### Minor Changes

- e271eb2: render: shader-effect + z-order correctness. water/fog/fire SkSL are now source-free procedural overlays fed real sprite resolution (previously declared an unbound `uniform shader src` child and hardcoded resolution 0 → could not render on a real backend); `SpriteBatch.flush` groups maximal consecutive runs keyed on `(image, effect, alpha, stretch)`, preserving global z-order across interleaved textures; the stretch draw path now applies sprite effects (was alpha-only) with an outline fall-back; `Camera2D` dead-zone follow no longer double-counts the target offset. `GameView` (react) now forwards the real `GameLoop.clock.elapsed` to `beginFrame` so time-driven shaders animate (was hardcoded 0).
- ff62507: Peer-dependency floor bump + Skia decoupling across the React-facing packages, plus a new web frame-renderer export. Floors move to `react >=19` and `react-native >=0.79` (Skia 2.x requires RN 0.79, not 0.78) wherever those peers are declared. `@shopify/react-native-skia` moves to `>=2.0.0` where it is still required (`react`, `engine`), is dropped entirely as a peer from `render` and `assets` (both already inject a structural `*Like` Skia module and never import Skia), and becomes an **optional, type-only** peer of `shapes` (used only for the `import type` in `draw.ts`) and an **optional, injected** peer of `postfx` (Skia is passed in at runtime; the floor moves from `>=1.0.0` to `>=2.0.0`). `react-native-gesture-handler` is dropped as a peer from `input`, `react`, and `engine` (no runtime usage). `engine` gains `react-native-safe-area-context >=4.0.0` as a required peer, matching `<GameView>`'s inset resolution.

  `@flare-engine/render-web` additionally ships `createWebFrameRenderer(kit: CanvasKit): FrameRenderer` — the web/CanvasKit analog of `@flare-engine/react`'s `createSkiaFrameRenderer`, a thin composition `createFrameRenderer(createWebSkiaModule(kit))`; presentation (replaying `endFrame()` onto a surface and flushing) stays the consumer's responsibility. Also fixes the `render-web` on-screen post-FX surface so `resize()` correctly rebuilds the WebGL onscreen surface (`postfx-surface.ts`), preventing a stale-size onscreen target after a canvas resize.

- 7c4f7cf: Packaging polish across all shipping manifests. Every package now declares `engines: { "node": ">=20" }`. Each package's `exports["."]` carries per-condition type declarations — ESM consumers (`import`) resolve `./dist/index.d.mts` and CommonJS consumers (`require`) resolve `./dist/index.d.ts`, so the declaration file always matches the resolved module format instead of an ESM import falling back to the CJS-flavored `.d.ts` (the `"."`-level `types` that previously shadowed the ESM condition is removed; the root `types` field is retained for legacy/`node10` resolution). The `@types/react` dev floor moves from `^18` to `^19` across the React-facing packages, matching the installed React 19 runtime. No runtime or public API surface changes.
- 376969a: Build toolchain modernized across all packages, with no runtime or public API changes. Every package is now bundled with `tsdown` (Rolldown-based, replacing the unmaintained `tsup`); dist output (`.js`/`.mjs`/`.d.ts`/`.d.mts` + sourcemaps) is byte-compatible, so `exports` maps and installed shape are unchanged. Lint runs on Biome 2, the TypeScript floor moves to 5.9 (with `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, and `moduleDetection: "force"` added as guards), and Bun ambient types are removed from the shipped-source typecheck. The `@flare-engine/engine` README now documents that the engine is architecture-agnostic and imposes no React Native New Architecture requirement of its own.
- 8696136: README truth pass (foundation + runtime + systems tiers): every `ts`/`tsx` example now typechecks against the workspace (enforced by `bun run check:readme`), api-specs links are absolute (resolve on npmjs.com), and private-game references are removed.

  - Snippets corrected to the real API where they had drifted: `SeededRNG.float(min, max)`; `defineComponent(name, () => defaults)`; `postfx` `create*` factories are `(id, uniforms)`; `render` `drawSprite`/`SpriteColor`; `loadCanvasKit(wasmUrl)`; `CollisionPair.entityA/entityB` + `createCollider(shape, opts)`; `events` `EventMap`-satisfying maps; `audio` `AudioContextLike`.
  - `storage`: the migration example now preserves player data across a version bump (was discarding it); the native MMKV adapter is shown as a structural peer (no `react-native-mmkv` dependency claim).
  - `render-web`: presentation uses the real `kit.MakeWebGLCanvasSurface(...)` rather than a placeholder duck-type.

- 268f246: perf-10: stop evaluating an unresolvable global in the per-item hot loops.

  JSC has no inline cache for an unresolvable global identifier, so `typeof __DEV__ !== 'undefined' && __DEV__` costs ~270 ns **per evaluation** wherever `__DEV__` is undeclared. Measured on one machine over 1e6 evaluations: undeclared 272.5 ns, declared-false 0.7 ns, declared-true 1.2 ns, and a `globalThis` property read of an absent property 0.46 ns.

  Two hot sites now read `globalThis.__DEV__` as a property instead:

  `createFrameRenderer` — `fillXforms` evaluated the guard once per sprite per transform pass, nine times over under an outline effect. `render.flush 1000 sprites / 1 atlas` in the undeclared configuration measured 412-450 µs before and 56-88 µs after, which is the same band the declared configuration occupies.

  `Pool.release()` — once per released object, so roughly 300 evaluations a frame in a particle-heavy scene. The `Pool` **constructor** keeps the identifier form deliberately: it runs once per pool, and it is the site a bundler can constant-fold for dead-code elimination.

  React Native always defines `__DEV__`, so **RN apps were never affected and see no change**. This is a win for web/CanvasKit bundles and for any Node or Bun consumer. Runtime toggling of `globalThis.__DEV__` behaves exactly as before, and the guards remain truthiness checks, so no value that enabled a dev check before disables one now. The one behavioural difference: a bundler `define` that substitutes a bare `__DEV__` identifier no longer reaches these two sites — set `globalThis.__DEV__`, which is the contract api-specs already documents for non-RN runtimes.

  No public API, signature, or type changed.

- a3c2376: perf-3: add observability counters for allocation and transform diagnostics.

  `Pool<T>`: add `get created(): number` — cumulative factory calls from `acquire()`/`tryAcquire()` only; `prewarm()` excluded. Delta across a frame asserts zero steady-state allocation.

  `ParticlePool`: add `get created(): number` forwarding the internal `Pool`'s counter (prewarm excluded).

  `SpriteBatch`: add `get allocCount(): number` — cumulative `SpriteDrawCommand` allocations on pool-miss; 0 in steady state after warm-up.

  `Renderer.stats.drawCalls`: document as SpriteBatch flush-run count, NOT raw canvas call count; one flush run fans into 9 `drawAtlas` calls (outline), n `drawImageRect` calls (stretch), or n `drawRect` calls (zone-bg); equal to `stats.batchCount` when `SpriteBatch.flush` is the only writer (`recordDrawCall()`/`recordBatch()` are public and can diverge them).

  `resetXformCounters()` / `getXformCounters()`: `__DEV__`-gated rotated/unrotated branch counters for the `fillXforms` path in `createFrameRenderer`; counts stay 0 when `__DEV__` is falsy; reset is unconditional. They count transform writes, not sprites — an outlined run passes through `fillXforms` 9 times — and are process-global across all `createFrameRenderer` instances.

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

### Patch Changes

- 3ab5f93: render: fix the camera-rotation unit. `Camera2D.rotation` is radians, but both Skia backends (RN-Skia `SkCanvas`, CanvasKit) take degrees, so a nonzero camera rotation was applied ~57× too small (radians treated as degrees). The `CanvasLike` / `DrawSurfaceLike` `rotate` contract is now **degrees**, forwarded verbatim everywhere; `Renderer.applyCamera` converts radians→degrees once at the single camera seam.

  render-web: the CanvasKit bridges (`createWebSurface`, `createWebSkiaModule`) forward `rotate` verbatim — now correct under the degrees contract; dropped the stale "dormant mismatch" comments.

- Updated dependencies [6a10aa9]
- Updated dependencies [47ad74f]
- Updated dependencies [b113ca3]
- Updated dependencies [ff62507]
- Updated dependencies [7c4f7cf]
- Updated dependencies [376969a]
- Updated dependencies [8696136]
- Updated dependencies [84fd0a3]
- Updated dependencies [a920170]
  - @flare-engine/math@0.3.0
  - @flare-engine/ecs@0.3.0
  - @flare-engine/assets@0.3.0

## 0.2.1

### Patch Changes

- Remove phantom `@flare-engine/*` dependencies that were declared in `package.json` but never imported from source (packaging hygiene; no runtime or API change). A new `check:deps` CI guardrail enforces that declared dependencies match actual imports and that the graph stays strictly downward-only.

- Remove per-frame allocations from the render hot path: zone-background draws now use a pre-allocated, grow-only rect pool instead of allocating a rect per sprite per frame, and `drawAtlas`/`drawOutlined` cache their exact-length atlas slices by count instead of re-slicing every frame.

- Updated dependencies []:
  - @flare-engine/assets@0.2.1
  - @flare-engine/ecs@0.2.1
  - @flare-engine/math@0.2.1

## 0.2.0

### Minor Changes

- Add the `DropShadowEffect` data type and `dropShadow` factory.

## 0.1.0

### Minor Changes

- Initial release.
