# Shape atlas and per-sprite colour (#324)

Status: approved direction (owner, 2026-11-12). Implementation starts after 0.4.12 is published.

Issue #324 asked for two things:
- draw shape-built entities in one batched draw instead of one Skia draw per primitive;
- colour particles without allocating.

It also proposed react-native-skia v3's `ShapeBlob` as a fast path.

Two read-only audits on 2026-11-12 checked every premise at HEAD and read the published `@shopify/react-native-skia` 2.14.0, `react-native-skia` 3.10.0 and `canvaskit-wasm` 0.41/0.42 tarballs. This document records what they found and the plan that follows. It splits #324 into **A1** (per-sprite colour and alpha, #347) and **A2** (shape atlas bake, #348); **Part B** (v3 / ShapeBlob) is deferred to the tracking issue #349.

## Findings that shape the plan

**Per-sprite colour does not need v3.** Both backends already accept per-sprite colours in `drawAtlas`, and the renderer never passes them.
- **The renderer:** `DrawSurfaceLike.drawAtlas` types `blendMode` and `colors` as `undefined` and the docs say "the renderer never fills them" (`packages/render/src/frame-renderer.ts:168-180`). The only call passes four arguments (`:1143`). `render-web` hard-codes `null, null` (`packages/render-web/src/web-skia-module.ts:166`).
- **RN-Skia 2.14 native:** `drawAtlas(atlas, srcs, dsts, paint, blendMode?, colors?: SkColor[], sampling?)`. It reads each colour's properties `0`-`3` as 0-1 floats, so a pooled array of pooled `Float32Array(4)` costs no JS allocation. `colors.length` must equal the rect count, or it throws. The default blend mode is `kDstOver` (`cpp/api/JsiSkCanvas.h:422-479` in 2.14.0).
- **CanvasKit 0.42:** `colors?: ColorIntArray`. A reused `Uint32Array` is passed through and copied to the wasm heap with no JS garbage; a `Float32Array` allocates a new `Uint32Array` per call. The default blend is `SrcOver`. Its CHANGELOG names the flat `Uint32Array` as the fastest option.
- **Blend modes differ:** the two backends default differently, so the renderer must pass a blend mode explicitly. **Modulate** multiplies the sprite texel by the colour, alpha included.

**Fading particles already un-batch.** `alpha` is part of `SpriteBatch.flush()`'s run key (`packages/render/src/sprite-batch.ts:290-291`), and `drawParticles` passes a continuously interpolated alpha (`packages/particles/src/draw-particles.ts:114`, `:130`). A fading emitter is therefore about one `drawAtlas` per particle. Today per-particle colour also costs a `TintEffect` object per particle and a `ColorFilter.MakeBlend` per run, because effect identity is in the run key too.

**Nothing in the engine calls `drawShape` yet.** `packages/shapes/src/draw.ts` issues one Skia draw per fill, one per stroke, and one or two for a glow ring. Path kinds build a new Skia path per call, and `path` re-parses its SVG string per call. Only shapes' own code and tests call it. A2 is therefore a new API for shape-heavy scenes, not a fix to an existing engine draw path.

**v3 is a breaking platform move, not a library bump.**
- `Skia.ShapeBlob` / `canvas.drawShapes` exist only in the renamed, unscoped `react-native-skia` 3.10.0 (2026-11-10). There is no `@shopify` 3.x: the repository moved, and the rename is permanent.
- v3 requires Android API 26 with Vulkan 1.1 and iOS 15.1, and drops Expo Go. Expo 58 bundles `@shopify/react-native-skia` 2.14.0.
- Its API changes hit Flare: `Surface.Make` becomes `MakeRaster`; `MakeImageFromEncoded` becomes `MakeFromEncoded`; `makeNonTextureImage` becomes the async `makeRasterImage`; `encodeToBytes`/`encodeToBase64` go async, which would make `share`'s capture asynchronous.
- ShapeBlob itself is fill-only, with no per-shape rotation or scale, so it cannot replace a general shape path. Its web version is about 500 lines of MIT TypeScript on `MakeVertices`/`drawVertices`, and both of today's backends have those.

## Decisions (owner, 2026-11-12)

1. **No react-native-skia v3 now.** Revisit when an Expo SDK bundles `react-native-skia` 3.x. The move is breaking (a peer change, platform floors, async `share` capture), so it will need an accepted ADR and a minor, batched behind a deprecation window. A tracking issue holds it. If ShapeBlob-style vertex batching is ever wanted on 2.x, port upstream's MIT `JsiSkShapeBlob.ts` onto `MakeVertices`.
2. **Split #324 into A1 then A2.** A1 is the cheaper and wider win.
3. **Timing:** this document and the split issues land now. Code starts after 0.4.12 is published, and the next perf recapture covers it.
4. **A2 bake design:** the bake lives in `@flare-engine/shapes`. Colours are baked in. Animated specs stay on `drawShape`. Stroke and glow scale with the bake inside the re-raster band.

## A1: per-sprite colour and alpha through `drawAtlas`

**Goal:** a sprite can carry a colour multiplier, with alpha in its alpha channel, drawn through the batched `drawAtlas` path with no per-sprite or per-frame JS allocation in steady state. A fading or multi-coloured particle stream then draws in one run per image.

**Where colour lives, so nothing breaks.** `SpriteDrawCommand` is a published type, and every field on it is required (ADR-0006). Since the 2026-10-26 public launch, adding a required field would break anyone who constructs one, which means an ADR and a minor. A1 therefore does **not** add a field to `SpriteDrawCommand`:
- `SpriteBatch` keeps a grow-only `Uint32Array` of packed ARGB colours, parallel to its command list, defaulting to opaque white (`0xFFFFFFFF`).
- `draw()` / `drawRaw()` gain an **optional trailing** `color` argument (packed ARGB). Existing calls are unchanged.
- Within a coloured run, the per-sprite `alpha` folds into the colour's alpha, so sprites that differ only in alpha or colour share one run. Their `alpha` no longer splits the run key. Exactly how `alpha` and the coloured path interact in the key is an implementation detail for the A1 plan to pin with tests.

**Renderer contract (additive):**
- `FrameRenderer.drawAtlas(image, commands, colors?)` gains an optional `colors` view (packed ARGB, one per command). `SpriteBatch.flush` passes the run's slice of its colour buffer.
- `DrawSurfaceLike.drawAtlas`'s `blendMode` and `colors` slots widen from `undefined` to real types. The renderer passes an explicit Modulate blend whenever it passes colours, and stays on the four-argument call when it doesn't. Uncoloured draws are byte-for-byte unchanged.

**Per backend:**
- **Native (RN-Skia 2.14):** the canvas is passed through raw (`packages/react/src/skia-bridge.ts:158`). The renderer keeps a grow-only pool of `Float32Array(4)` colour objects plus a per-length cached array of them, the same trick as `getCachedSrcSlice` (`frame-renderer.ts:533-545`). It fills the pool from the packed buffer each run, so the length matches the rect count with no allocation.
- **Web (CanvasKit):** `web-skia-module.ts`'s `drawAtlas` forwards a cached `Uint32Array` view of the run's colours (per-length view cache, as #127 does for srcs/xforms) instead of `null`.

**Particles:** `drawParticles` passes each particle's colour and interpolated alpha through the new argument, replacing the per-particle `TintEffect` path for plain colour. Effects that are not plain colour (flash, outline, grayscale) stay effects.

**Done when:**
- An allocation test proves that a steady-state particle frame with per-particle colours and fading alpha allocates nothing on the JS heap.
- A batching test shows N particles with distinct colours and alphas drawing in one run per image, via `Renderer.stats.drawCalls`, which counts runs.
- A pixel test on each backend confirms Modulate tints as expected.
- `api-specs.md` documents the new argument and its blend.
- A `drawParticles` bench scenario is added; no existing suite covers particle drawing.

## A2: shape atlas bake

**Goal:** draw N shape-built entities in one `drawAtlas` run per atlas image, on today's Skia 2.x and CanvasKit.

**API sketch (in `@flare-engine/shapes`):**
- A bake function takes a set of `ShapeSpec`s and an explicit **raster scale**, and returns the atlas `{ image, sheet }` shape that `SpriteBatch` already draws, plus a frame per spec.
- The raster scale must be explicit: the frame renderer records in logical pixels and applies pixel density itself (`beginFrame`, `frame-renderer.ts:906-915`), and `DrawSurfaceLike` exposes no matrix, so the bake cannot infer device scale.
- Cell bounds come from `shapeBoundsBoxInto` (`packages/shapes/src/bounds.ts`), which already includes stroke and glow margins, plus padding against linear-sampling bleed. `createProceduralAtlas` defaults to 0 padding (`packages/assets/src/procedural-atlas.ts:104`).
- **Re-raster rule (borrowed from ShapeBlob):** re-bake only when the current device scale leaves 0.75-1.5× of the baked scale. Cap a cell at 2048 px.
- **Dependencies:** a new `shapes` → `assets` dependency, legal at tier 2, for the atlas and sheet types and the packing helper. `assets` must not gain a Skia peer, and `assets` → `render` would be a cycle.
- **Colours are baked in.** Each distinct spec is baked with its real fill, stroke and glow colours, for exact fidelity: a multi-colour spec cannot be tinted from white. A1's colour is available as an optional multiplier per instance.
- **Instances** draw through `SpriteBatch` with RSXform rotation and uniform scale. Non-uniform scale falls to the existing per-sprite stretch path, as for any sprite. Stroke and glow widths scale with the instance, which is accepted inside the re-raster band.
- **Animated specs stay on `drawShape`.** A spec whose parameters change per frame (an arc used as a cooldown, say) would re-bake every frame.
- **Web:** `render-web` has no `Surface.Make` binding today. A2 adds one, using CanvasKit's offscreen surface, so the bake runs on both backends. Native uses `Skia.Surface.Make`, as `createProceduralAtlas` already does.

**Done when:**
- N baked entities draw in one run per atlas image (`Renderer.stats.drawCalls`).
- A test covers the 0.75-1.5× re-raster band.
- The shapes, assets and render suites stay green.
- A shapes bench scenario is added.
- `api-specs.md` and the shapes README document the bake, its scale rule and its limits (animated specs, scaled strokes).

## Part B: deferred

ShapeBlob on react-native-skia v3 waits for decision 1. Its unique win, retained vertex buffers, matters less to Flare, which re-records a picture every frame. Its limits (fill only, no rotation or scale) make A2 the general path either way.
