# @flare-engine/render-web

## 0.4.6

### Patch Changes

- @flare-engine/postfx@0.4.6
- @flare-engine/render@0.4.6

## 0.4.5

### Patch Changes

- 8814ec2: Public release: every `@flare-engine/*` package is public on npm from this version, published from
  CI with npm provenance. No code changes; npm visibility is retroactive, so earlier versions are
  public too.
- Updated dependencies [8814ec2]
  - @flare-engine/postfx@0.4.5
  - @flare-engine/render@0.4.5

## 0.4.4

### Patch Changes

- @flare-engine/postfx@0.4.4
- @flare-engine/render@0.4.4

## 0.4.3

### Patch Changes

- @flare-engine/postfx@0.4.3
- @flare-engine/render@0.4.3

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

- Updated dependencies [785a3b2]
  - @flare-engine/render@0.4.2
  - @flare-engine/postfx@0.4.2

## 0.4.1

### Patch Changes

- @flare-engine/postfx@0.4.1
- @flare-engine/render@0.4.1

## 0.4.0

### Patch Changes

- 2afc6d9: PF-5: settle the render-web, postfx and render surface before the freeze. Per ADR-0004.

  `createWebSurface` now returns a `WebSurface` handle — `{ canvas, ckCanvas, flush(), dispose() }` — instead of a bare `CanvasLike`. The previous return hid the CanvasKit surface, so nothing drawn through it could be presented or freed; the README presentation example now goes through the function instead of around it.

  `PostFxSurface.composite(globalIntensity?)` takes its argument optionally and writes it into the chain only when given. Every frame it used to overwrite `chain.globalIntensity`, undoing a reduced-motion scale set through `PostFxController.setMotionScale` or the a11y bridge; the README recipe that taught `composite(1)` now calls `composite()`.

  `COMPOSITE_SKSL`'s clouds branch honours `weatherDirection` with the same rotated scroll as `WEATHER_CLOUDS_SKSL`; it had stayed on the X-only scroll when the standalone shader gained a direction. Rendering changes for anyone on the composite clouds path with a non-zero direction.

  `PostFxController.triggerTimed` is required on the interface (it was always implemented). `render` no longer exports `ColorLike`, an alias nothing referenced.

- Updated dependencies [599cd30]
- Updated dependencies [9868562]
- Updated dependencies [2afc6d9]
  - @flare-engine/render@0.4.0
  - @flare-engine/postfx@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [1645606]
  - @flare-engine/postfx@0.3.1
  - @flare-engine/render@0.3.1

## 0.3.0

### Minor Changes

- db28882: render-web: `createPostFxSurface`'s composite blit now binds each pass's extra sampler children (the `color-grading-lut` LUT `SkImage`, wrapped as a shader) after the source shader before `makeShaderWithChildren`, so LUT color grading renders on the CanvasKit web backend instead of leaving the LUT sampler unbound. The reused children buffer is resized in place (no per-pass allocation) and each wrapped child shader is freed after the draw. Latent fix — no shipping consumer wires `color-grading-lut` into a web chain today.

  devtools: `TimeScrubber.resume()` restores the timescale captured at `pause()` instead of hardcoding `1`, so resuming an active slow-motion (e.g. 0.5×) returns to that rate. `pause()` only records a non-zero timescale, so a double pause (including the internal `pause()` in `rewind()`) can't store `0` and freeze the loop on resume. Mirrors `@flare-engine/debug`'s `TimeControl`.

- ff62507: Peer-dependency floor bump + Skia decoupling across the React-facing packages, plus a new web frame-renderer export. Floors move to `react >=19` and `react-native >=0.79` (Skia 2.x requires RN 0.79, not 0.78) wherever those peers are declared. `@shopify/react-native-skia` moves to `>=2.0.0` where it is still required (`react`, `engine`), is dropped entirely as a peer from `render` and `assets` (both already inject a structural `*Like` Skia module and never import Skia), and becomes an **optional, type-only** peer of `shapes` (used only for the `import type` in `draw.ts`) and an **optional, injected** peer of `postfx` (Skia is passed in at runtime; the floor moves from `>=1.0.0` to `>=2.0.0`). `react-native-gesture-handler` is dropped as a peer from `input`, `react`, and `engine` (no runtime usage). `engine` gains `react-native-safe-area-context >=4.0.0` as a required peer, matching `<GameView>`'s inset resolution.

  `@flare-engine/render-web` additionally ships `createWebFrameRenderer(kit: CanvasKit): FrameRenderer` — the web/CanvasKit analog of `@flare-engine/react`'s `createSkiaFrameRenderer`, a thin composition `createFrameRenderer(createWebSkiaModule(kit))`; presentation (replaying `endFrame()` onto a surface and flushing) stays the consumer's responsibility. Also fixes the `render-web` on-screen post-FX surface so `resize()` correctly rebuilds the WebGL onscreen surface (`postfx-surface.ts`), preventing a stale-size onscreen target after a canvas resize.

- 7c4f7cf: Packaging polish across all shipping manifests. Every package now declares `engines: { "node": ">=20" }`. Each package's `exports["."]` carries per-condition type declarations — ESM consumers (`import`) resolve `./dist/index.d.mts` and CommonJS consumers (`require`) resolve `./dist/index.d.ts`, so the declaration file always matches the resolved module format instead of an ESM import falling back to the CJS-flavored `.d.ts` (the `"."`-level `types` that previously shadowed the ESM condition is removed; the root `types` field is retained for legacy/`node10` resolution). The `@types/react` dev floor moves from `^18` to `^19` across the React-facing packages, matching the installed React 19 runtime. No runtime or public API surface changes.
- 376969a: Build toolchain modernized across all packages, with no runtime or public API changes. Every package is now bundled with `tsdown` (Rolldown-based, replacing the unmaintained `tsup`); dist output (`.js`/`.mjs`/`.d.ts`/`.d.mts` + sourcemaps) is byte-compatible, so `exports` maps and installed shape are unchanged. Lint runs on Biome 2, the TypeScript floor moves to 5.9 (with `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, and `moduleDetection: "force"` added as guards), and Bun ambient types are removed from the shipped-source typecheck. The `@flare-engine/engine` README now documents that the engine is architecture-agnostic and imposes no React Native New Architecture requirement of its own.
- 8696136: README truth pass (foundation + runtime + systems tiers): every `ts`/`tsx` example now typechecks against the workspace (enforced by `bun run check:readme`), api-specs links are absolute (resolve on npmjs.com), and private-game references are removed.

  - Snippets corrected to the real API where they had drifted: `SeededRNG.float(min, max)`; `defineComponent(name, () => defaults)`; `postfx` `create*` factories are `(id, uniforms)`; `render` `drawSprite`/`SpriteColor`; `loadCanvasKit(wasmUrl)`; `CollisionPair.entityA/entityB` + `createCollider(shape, opts)`; `events` `EventMap`-satisfying maps; `audio` `AudioContextLike`.
  - `storage`: the migration example now preserves player data across a version bump (was discarding it); the native MMKV adapter is shown as a structural peer (no `react-native-mmkv` dependency claim).
  - `render-web`: presentation uses the real `kit.MakeWebGLCanvasSurface(...)` rather than a placeholder duck-type.

- c57f760: Take explicit ownership of the WebGL context so `dispose()` frees the `GrDirectContext` and the
  context handle instead of leaking one per surface; self-heal on `webglcontextlost` /
  `webglcontextrestored`; add `isLost()`; set `Src` blend on the composite blit so a pass cannot
  composite stale ping-pong content; and make `loadCanvasKit` retry after a failed load instead of
  caching the rejection, bounded by stall and deadline timers.

  `onscreenCanvas()` and `sceneCanvas()` now return `Canvas | null` — both are null while the WebGL
  context is lost.

### Patch Changes

- 3ab5f93: render: fix the camera-rotation unit. `Camera2D.rotation` is radians, but both Skia backends (RN-Skia `SkCanvas`, CanvasKit) take degrees, so a nonzero camera rotation was applied ~57× too small (radians treated as degrees). The `CanvasLike` / `DrawSurfaceLike` `rotate` contract is now **degrees**, forwarded verbatim everywhere; `Renderer.applyCamera` converts radians→degrees once at the single camera seam.

  render-web: the CanvasKit bridges (`createWebSurface`, `createWebSkiaModule`) forward `rotate` verbatim — now correct under the degrees contract; dropped the stale "dormant mismatch" comments.

- Updated dependencies [cfa69ce]
- Updated dependencies [e271eb2]
- Updated dependencies [5aecfb6]
- Updated dependencies [3ab5f93]
- Updated dependencies [ff62507]
- Updated dependencies [7c4f7cf]
- Updated dependencies [376969a]
- Updated dependencies [8696136]
- Updated dependencies [268f246]
- Updated dependencies [a3c2376]
- Updated dependencies [938ef11]
  - @flare-engine/postfx@0.3.0
  - @flare-engine/render@0.3.0

## 0.2.1

### Patch Changes

- Harden the CanvasKit web bridge: the per-frame composite path no longer round-trips uniforms through `Array.from`/`Float32Array.from` and reuses pre-allocated scratch buffers (zero-alloc), null offscreen surfaces are now guarded with a diagnostic warning instead of silently rendering blank, and the multi-pass ping-pong loop gained real behavioral + resource-leak tests. Adds a package README. Documented as the Layer-4 web-integration bridge (the web analog of `@flare-engine/react`).

- Updated dependencies []:
  - @flare-engine/render@0.2.1
  - @flare-engine/postfx@0.2.1

## 0.2.0

### Minor Changes

- Initial release — CanvasKit-backed web backend for the `@flare-engine/render` frame-renderer, plus the `createPostFxSurface` web bridge.
