# @flare-engine/render-web

## 0.4.18

### Patch Changes

- @flare-engine/math@0.4.18
- @flare-engine/postfx@0.4.18
- @flare-engine/render@0.4.18

## 0.4.17

### Patch Changes

- a9564a9: `loadCanvasKit` now rejects a later call that names a different `wasmUrl` instead of silently returning the kit loaded from the first URL.

  The loader keeps one CanvasKit per page. Before, once a load was in flight or had succeeded, every later call returned that load's promise whatever `wasmUrl` it passed, so a caller asking for another binary got the first one with no sign of it. Such a call now returns a promise that rejects with an `Error` naming both URLs:

  ```
  loadCanvasKit: CanvasKit is already loaded or loading from "<first url>"; cannot load it again from "<requested url>"
  ```

  `onProgress` is not called for the rejected call, and the first load and its promise are unaffected.

  A later call with the same `wasmUrl` behaves as before: it returns the same promise and calls `onProgress(1)`. The URLs are compared by exact string equality, so two spellings of one address (`/canvaskit.wasm` and `https://example.com/canvaskit.wasm`, say) count as different — pass the same string each time.

  A failed load is still not cached, so after a failure a call with any `wasmUrl` starts a new load.

- 95e5338: Document who owns canvas sizing. No behaviour change.

  The README gains a "Sizing" section, and the `createPostFxSurface` and `createWebSurface` JSDoc say the same: both surfaces take their size from `canvas.width` and `canvas.height` (device pixels) when they are created, and nothing in the package watches `devicePixelRatio` or the element's size. The caller sizes the backing store to the CSS size times `devicePixelRatio`, watches the element with a `ResizeObserver` and the ratio with a `matchMedia` resolution query, and calls `PostFxSurface.resize()` — or, for a `WebSurface`, which has no `resize()`, disposes it and creates a new one. The README carries a compiled example.

- Updated dependencies [a78517b]
  - @flare-engine/render@0.4.17
  - @flare-engine/math@0.4.17
  - @flare-engine/postfx@0.4.17

## 0.4.16

### Patch Changes

- @flare-engine/math@0.4.16
- @flare-engine/postfx@0.4.16
- @flare-engine/render@0.4.16

## 0.4.15

### Patch Changes

- Updated dependencies [12d1b36]
  - @flare-engine/render@0.4.15
  - @flare-engine/math@0.4.15
  - @flare-engine/postfx@0.4.15

## 0.4.14

### Patch Changes

- 2becbe8: `loadCanvasKit` no longer rejects with a bare non-`Error` value. When the load rejects with anything that is not an `Error` (the full CanvasKit glue rejected with the number `Infinity` when served the non-full binary), it now rejects with an `Error` whose message names the likely cause and the file to serve, `canvaskit-wasm/bin/full/canvaskit.wasm`, and whose `cause` is the original value. A rejection that is already an `Error` is unchanged.

  The README and the API spec now say that `wasmUrl` must serve the full binary, `canvaskit-wasm/bin/full/canvaskit.wasm`, and show the Vite `?url` import for it.

  - @flare-engine/math@0.4.14
  - @flare-engine/postfx@0.4.14
  - @flare-engine/render@0.4.14

## 0.4.13

### Patch Changes

- 968f114: `ShapeSpec`s can now be baked once into an atlas and drawn as sprites, so N shape-built entities are one `SpriteBatch` run instead of several Skia draws each.

  **`@flare-engine/shapes`.** `bakeShapeAtlas(Skia, specs, scale, options?)` draws each distinct spec object once, through `drawShape` and with its own fill, stroke and glow colours, into one image, and returns a `ShapeAtlas`: the `image` and `sheet` a `SpriteBatch` draws, plus `cells`, one `ShapeAtlasCell` per spec. `scale` is the raster scale in atlas pixels per spec unit and must be passed, because the bake cannot see the device scale. Cells are sized from `shapeBoundsBoxInto` and separated by `padding` (default 2 px); `maxWidth` (default 2048) is where rows wrap.

  `drawBakedShape(batch, atlas, index, x, y, rot?, scale?, color?, alpha?)` queues one instance with the spec's origin at `(x, y)`, rotated about it and scaled uniformly. `color` is the per-sprite colour multiplier `SpriteBatch.draw` takes. It allocates nothing.

  `shapeAtlasNeedsRebake(atlas, scale)` is `true` once `scale` is below 0.75x or above 1.5x of the scale the atlas was baked at. `rebakeShapeAtlas(Skia, atlas, scale)` returns the atlas it was given while `scale` is inside that band, and otherwise bakes the same specs at the new scale; cell indices are unchanged by a re-bake, and so are each spec's origin and drawn size; a cell's `width`/`height` and fractional anchors can differ by the rounding margin of either bake, because each cell is rounded up to whole pixels.

  A cell is never rasterized larger than `SHAPE_ATLAS_MAX_CELL` (2048 px) on its longer side. A spec that would need more is baked at a lower scale of its own, reported as `cell.scale`, and still draws at the same size. It does not throw.

  Limits: a spec whose parameters animate should stay on `drawShape`, since the bake is a snapshot. A baked instance's stroke and glow widths scale with the instance. `drawBakedShape` rotates the whole cell rigidly, where `drawShape`'s `rot` leaves each part's `ox`/`oy` unrotated. Colours are baked in, so `color` multiplies them and cannot recolour one part.

  The bake takes a `ShapeAtlasSkia`, a narrow interface that react-native-skia's `Skia` satisfies. The package now depends on `@flare-engine/assets`.

  **`@flare-engine/assets`.** `packAtlasRows(sizes, maxWidth, padding)` exports the row layout `createProceduralAtlas` already used, with its result types `AtlasRowLayout` and `AtlasRowPosition`. `createProceduralAtlas` is unchanged.

  **`@flare-engine/render-web`.** `createWebShapeSkia(kit)` returns a `WebShapeSkia`, a CanvasKit-backed `Skia` handle for `bakeShapeAtlas` and `drawShape`. Its surface factory makes CanvasKit's offscreen CPU surface, so the bake needs no WebGL context. It builds paths on CanvasKit's PathBuilder where there is one (0.41 and later) and on the mutable Path of 0.40 otherwise, and frees the paints and paths it created when a surface is disposed.

  Nothing changes for existing code.

- b12959f: A sprite can now carry its own colour through the batched `drawAtlas` path, and `drawParticles` can opt into it.

  **`@flare-engine/render`.** `SpriteBatch.draw` and `SpriteBatch.drawRaw` take an optional trailing `color`: a packed-ARGB multiplier (`0xAARRGGBB`) applied to every texel of that sprite, so `0xFFFFFFFF` changes nothing. A sprite drawn with a `color` has its `alpha` multiplied into the colour's alpha byte, and `alpha` then no longer splits batch runs: consecutive coloured sprites that share image, effect, stretch, blend and flip are one run whatever their colours and alphas. A coloured sprite and an uncoloured one never share a run. `SpriteBatch.flush`'s callback receives a third argument for a coloured run, `colors: Uint32Array` (`colors[i]` belongs to `commands[i]`; the buffer is reused and may be longer than `commands`), and `FrameRenderer.drawAtlas(image, commands, colors?)` accepts it, so `batch.flush(renderer.drawAtlas)` needs no change. The renderer draws a coloured run with Skia's Modulate blend, passed explicitly because the two backends default differently. `DrawSurfaceLike.drawAtlas`'s `blendMode` and `colors` parameters, previously typed `undefined`, are now `number` and `Float32Array[]`. `SpriteDrawCommand` is unchanged.

  Sprites drawn without a `color` are batched and drawn exactly as before, with the same surface call.

  Limits: on the stretch, flip and zone-background paths, which are not atlas draws, only the colour's alpha applies and its RGB is ignored.

  **`@flare-engine/render-web`.** `createWebSkiaModule`'s `drawAtlas` forwards a coloured run's colours to CanvasKit as a reused `Uint32Array` with `BlendMode.Modulate`. An uncoloured run still passes `null` for both.

  **`@flare-engine/particles`.** `drawParticles` takes a new option, `color` (default `false`). With `{ color: true }` it passes each particle's interpolated colour to `drawRaw` as that trailing `color` argument, with alpha still the separate `alpha` argument, so with a `SpriteBatch` the particles of one call form a single run per image instead of one run per distinct alpha, and an emitter's `startColor` / `endColor` tint the particles. Without the option, `drawParticles` makes exactly the call it made before. `ParticleBatchLike.drawRaw` declares the extra optional trailing parameters (`blend?`, `flipX?`, `flipY?`, `color?`).

  Nothing changes for existing code: coloured runs, the `colors` flush argument and the filled `blendMode` / `colors` surface parameters appear only when a caller passes a `color` to `SpriteBatch` or `color: true` to `drawParticles`. A custom `flush` callback or `DrawSurfaceLike` that opts in must read each sprite's opacity from `colors` for those runs. The `drawParticles` default is planned to flip to `true` in 0.5.0, behind an ADR.

- Updated dependencies [5fd35c2]
- Updated dependencies [28b1b40]
- Updated dependencies [b12959f]
  - @flare-engine/postfx@0.4.13
  - @flare-engine/render@0.4.13
  - @flare-engine/math@0.4.13

## 0.4.12

### Patch Changes

- c0c5f1a: `@flare-engine/math` now exports `argbToFloat4Into(out, argb)`, which unpacks a packed `0xAARRGGBB` colour int into a `Float32Array` as `[r, g, b, a]`, each 0-1, without allocating. Five packages each carried their own copy of the same four lines. They now call this one instead: shapes' `argbTo`, which stays exported and delegates, the frame renderer's `clear`, the web surface's `clear`, `renderShapesToImage`, and `createProceduralAtlas`. Colours come out the same as before. `@flare-engine/shapes`, `@flare-engine/assets` and `@flare-engine/render-web` now depend on `@flare-engine/math`.
- 05bdc71: Internal refactor: the frame renderer module and the postfx surface now share one CanvasKit `RuntimeEffect` wrapper, so each wrapped effect carries both `makeShader` with uniform reflection and `makeShaderWithChildren`; no change to the exported types or to the calls made to CanvasKit.
- 1469cb1: `createWebSkiaModule`'s `PictureRecorder().beginRecording()` now returns the same `DrawSurfaceLike`
  object on every call for a given recorder, re-pointed at the new recording's canvas, instead of
  building a new wrapper per recording. The object is valid only between `beginRecording` and the
  matching `finishRecordingAsPicture`: a reference kept across recordings draws into whichever
  recording that recorder began last. `createFrameRenderer` drops its reference at `endFrame`, so
  frame-renderer consumers are unaffected. `drawAtlas` now passes CanvasKit views cached per run
  length instead of cutting two new views per run; the cache is dropped when the scratch buffers grow.
- Updated dependencies [c0c5f1a]
- Updated dependencies [ee7781a]
- Updated dependencies [2b3c047]
- Updated dependencies [e0be221]
- Updated dependencies [e3474bc]
- Updated dependencies [636a8eb]
- Updated dependencies [d9a3bb5]
- Updated dependencies [98e0d23]
- Updated dependencies [14ea816]
- Updated dependencies [240fa90]
- Updated dependencies [e49f0fc]
- Updated dependencies [115ad3a]
- Updated dependencies [47dd32f]
- Updated dependencies [8f3b7c0]
- Updated dependencies [43f814f]
- Updated dependencies [2e9cc63]
  - @flare-engine/math@0.4.12
  - @flare-engine/render@0.4.12
  - @flare-engine/postfx@0.4.12

## 0.4.11

### Patch Changes

- @flare-engine/postfx@0.4.11
- @flare-engine/render@0.4.11

## 0.4.10

### Patch Changes

- d2339b2: A frame renderer can now set the texture sampling per image: `FrameRenderer.setImageSampling(image,
sampling)` takes `'nearest'` or `'linear'` (`ImageSampling`) and applies it to every draw of that
  image — an atlas or a texture — on both the atlas path and the stretch/flip path, so pixel art scaled
  through `drawAtlas` stops blurring. The last call wins; any other mode throws `RangeError`. An image
  with no setting draws exactly as before — linear on the atlas path, nearest on the stretch path — and
  its surface receives the same calls it did. For a surface implementing `DrawSurfaceLike`, `drawAtlas`
  now takes RN Skia's optional 5th–7th arguments (blend mode and colors, which the renderer always
  leaves `undefined`, then `SamplingOptionsLike`), and
  the optional `drawImageRectOptions` carries a sampled stretch draw, falling back to `drawImageRect`
  when the surface lacks it. `createWebSkiaModule` maps both onto CanvasKit's `drawAtlas` sampling
  argument and its `drawImageRectOptions`.
- Updated dependencies [30fba17]
- Updated dependencies [1d79926]
- Updated dependencies [d2339b2]
  - @flare-engine/render@0.4.10
  - @flare-engine/postfx@0.4.10

## 0.4.9

### Patch Changes

- @flare-engine/postfx@0.4.9
- @flare-engine/render@0.4.9

## 0.4.8

### Patch Changes

- 26af019: `loadCanvasKit` now downloads `canvaskit.wasm` once on `canvaskit-wasm` 0.41+: the bytes from the
  progress-reporting fetch reach the glue both as `wasmBinary` (read by ≤0.40) and through a Blob URL
  returned from `locateFile` (0.41+ ignores `wasmBinary` and fetches `locateFile()` itself), and the
  URL is revoked once init settles. Before, those glues fetched the 3.26 MB binary a second time after
  the progress bar had already reached 100%. If the Blob URL load fails (for example a CSP without
  `blob:` in `connect-src`), the loader still falls back to the network `wasmUrl` as before.
  - @flare-engine/postfx@0.4.8
  - @flare-engine/render@0.4.8

## 0.4.7

### Patch Changes

- @flare-engine/postfx@0.4.7
- @flare-engine/render@0.4.7

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
