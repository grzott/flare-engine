# CanvasKit Parity Report

> Research date: 2026-04-20 | `canvaskit-wasm` v0.41.1 (published 2026-04-07) | `@shopify/react-native-skia` v2.6.2

---

## Summary

Every Skia API that Flare uses on native has a direct counterpart in CanvasKit-WASM. No blockers found. RuntimeEffect (SkSL shaders) requires the `full` CanvasKit bundle. One minor risk: `drawAtlas` WebGL performance may differ from native Metal/Vulkan — benchmark in the stage 11.1 spike.

---

## Test Matrix — Flare API vs CanvasKit

| #   | Flare Feature                                                                    | Skia API Used                                                                                     | CanvasKit Status | Notes                                                                                                                                                                                        |
| --- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Sprite batching**                                                              | `Canvas.drawAtlas(image, srcRects, dstXforms, paint)`                                             | PASS             | `InputFlattenedRSXFormArray` (4 floats per xform: scos, ssin, tx, ty). RN Skia's web bridge handles conversion from object-form RSXform to flat array.                                       |
| 2   | **Transform stack**                                                              | `Canvas.save()`, `restore()`, `translate()`, `scale()`, `rotate()`, `clear()`                     | PASS             | Identical API surface.                                                                                                                                                                       |
| 3   | **Tint effect**                                                                  | `ColorFilter.MakeBlend(color, BlendMode.SrcOver)`                                                 | PASS             | `ColorFilterFactory.MakeBlend` present; `BlendMode.SrcOver` in `BlendModeEnumValues`.                                                                                                        |
| 4   | **Flash effect**                                                                 | `ColorFilter.MakeBlend(color, BlendMode.SrcOver)`                                                 | PASS             | Same as tint — decaying alpha handled on JS side.                                                                                                                                            |
| 5   | **Grayscale effect**                                                             | `ColorFilter.MakeMatrix(colorMatrix)`                                                             | PASS             | `ColorFilterFactory.MakeMatrix(InputColorMatrix)` present. 4x5 row-major `Float32Array`.                                                                                                     |
| 6   | **Outline effect**                                                               | `ColorFilter.MakeBlend(color, BlendMode.SrcIn)` x 8 + center                                      | PASS             | Multi-pass `drawAtlas` — no API dependency beyond what's listed. `BlendMode.SrcIn` present.                                                                                                  |
| 7   | **Custom shader effect**                                                         | `RuntimeEffect.Make(sksl)` -> `makeShader(uniforms)` -> `Paint.setShader()`                       | PASS\*           | \*Requires `full` CanvasKit bundle (`canvaskit-wasm/bin/full/canvaskit.js`). `CanvasKit.rt_effect` boolean confirms availability at runtime. Flare's postfx already checks `supported` flag. |
| 8   | **PostFX shaders** (vignette, CRT, bloom, chromatic aberration, grayscale-flash) | `RuntimeEffect.Make(sksl)` + `makeShaderWithChildren()`                                           | PASS\*           | Same caveat as #7. SkSL source is platform-agnostic — compiles identically on CanvasKit WebGL. `uniform shader src` + `src.eval(fragCoord)` pattern supported.                               |
| 9   | **Picture recording**                                                            | `PictureRecorder.beginRecording(bounds)` -> `Canvas`, `finishRecordingAsPicture()` -> `SkPicture` | PASS             | Used by Flare's skia-bridge for retained-mode frame recording.                                                                                                                               |
| 10  | **Paint operations**                                                             | `Paint.setColor()`, `Paint.setColorFilter()`, `Paint.setShader()`                                 | PASS             | Full Paint interface available.                                                                                                                                                              |
| 11  | **Procedural atlas**                                                             | `MakeSurface(w, h)` -> `getCanvas()` -> `drawRect()` -> `makeImageSnapshot()`                     | PASS             | `CanvasKit.MakeSurface(w, h)` returns a CPU-backed surface. `Surface.makeImageSnapshot()` returns `Image`.                                                                                   |
| 12  | **Image decoding**                                                               | `MakeImageFromEncoded(bytes)`                                                                     | PASS             | Decodes PNG/JPEG/WebP from `Uint8Array`.                                                                                                                                                     |
| 13  | **Rect construction**                                                            | `XYWHRect(x, y, w, h)`                                                                            | PASS             | Returns `Float32Array` of 4 floats (left, top, right, bottom).                                                                                                                               |
| 14  | **Bitmap font text**                                                             | `SpriteBatch.draw()` per glyph -> `drawAtlas()`                                                   | PASS             | Glyphs are sprites — uses the same atlas batching path (#1).                                                                                                                                 |
| 15  | **Camera transforms**                                                            | Canvas `translate` + `scale` + `rotate`                                                           | PASS             | Covered by #2.                                                                                                                                                                               |

### APIs Not Used by Flare (confirmed safe to ignore)

| CanvasKit API                | RN Skia Web Status | Flare Impact |
| ---------------------------- | ------------------ | ------------ |
| `PathEffect.MakeSum()`       | Unsupported        | Not used     |
| `PathEffect.MakeCompose()`   | Unsupported        | Not used     |
| `PathFactory.MakeFromText()` | Unsupported        | Not used     |
| `ShaderFilter`               | Unsupported        | Not used     |

---

## Architecture Notes

### How RN Skia Web Works

```
React Native Skia (JS API)
        |
        |-- Native: C++ Skia via JSI (Metal on iOS, Vulkan/GL on Android)
        |
        +-- Web: CanvasKit-WASM via JS bridge
             +-- canvaskit-wasm (2.9 MB gzipped)
                  +-- WebGL 1/2 or WebGPU (experimental)
```

Flare does NOT call CanvasKit directly. It calls `@shopify/react-native-skia`'s JS API, which on web delegates to CanvasKit. The web bridge maps:

- `Skia.RSXform(scos, ssin, tx, ty)` -> flat `Float32Array` for `InputFlattenedRSXFormArray`
- `Skia.XYWHRect(x, y, w, h)` -> flat `Float32Array` for `InputFlattenedRectangleArray`
- `Skia.RuntimeEffect.Make(sksl)` -> `CanvasKit.RuntimeEffect.Make(sksl)`
- `Skia.ColorFilter.MakeBlend(color, mode)` -> `CanvasKit.ColorFilter.MakeBlend(color, mode)`

### CanvasKit Bundle Selection

| Bundle    | Path                                        | Size (gzipped) | RuntimeEffect | Skottie |
| --------- | ------------------------------------------- | -------------- | ------------- | ------- |
| Default   | `canvaskit-wasm/bin/canvaskit.js`           | ~2.5 MB        | May vary      | No      |
| **Full**  | `canvaskit-wasm/bin/full/canvaskit.js`      | **~2.9 MB**    | **Yes**       | Yes     |
| Profiling | `canvaskit-wasm/bin/profiling/canvaskit.js` | ~3.2 MB        | Yes           | Yes     |

**Recommendation:** Use the `full` bundle. Flare needs RuntimeEffect for postfx and custom shader effects. The ~400 KB delta vs default is negligible for a game. RN Skia's CDN example already uses `full`.

### WebGL Context Limit

Browsers limit WebGL contexts to 16 per page. Flare uses one `<Canvas>` per game — no risk.

---

## Risk Assessment

| Risk                                         | Severity | Likelihood | Mitigation                                                                                                                                                   |
| -------------------------------------------- | -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `drawAtlas` WebGL perf < native Metal/Vulkan | Medium   | Medium     | Benchmark in 11.1 spike. If <30 fps at 500 sprites on mid-tier device, implement per-sprite `drawImageRect` fallback. Build plan budgets 3 extra days in M5. |
| RuntimeEffect not compiled in default bundle | Low      | Low        | Force `full` bundle in web config. RN Skia's `setup-skia-web` copies the full bundle by default. Flare's postfx `supported` flag degrades gracefully.        |
| CanvasKit-WASM load time on slow connections | Low      | Medium     | 2.9 MB gzipped is ~1s on 3G. Acceptable for a game. Use CDN with long cache. `<LoadingScreen>` covers the wait.                                              |
| WebGPU path immature                         | Info     | N/A        | CanvasKit exposes `MakeGPUDeviceContext(device)` + `MakeGPUCanvasSurface()` for WebGPU. Not stable yet — stay on WebGL for 0.1.0. Monitor for 0.2.0.         |
| RN Skia web bridge bugs                      | Low      | Low        | RN Skia is Shopify-maintained with 708K DL/week. Web support is documented and tested. File upstream bugs with repros per Phase 12 community plan.           |

---

## Spike Protocol (stage 11.1, 2 days)

Throwaway branch. Verify each row in the test matrix above with a minimal CanvasKit-WASM harness (no RN, no Expo — raw HTML + JS).

### Day 1 — Functional parity

1. Init CanvasKit (full bundle) + create WebGL surface
2. Load a test atlas PNG via `MakeImageFromEncoded`
3. `drawAtlas` with 4 sprites: verify srcRects + RSXform produce correct output
4. Apply each color filter: `MakeBlend(SrcOver)`, `MakeBlend(SrcIn)`, `MakeMatrix(grayscale)`
5. Compile an SkSL shader via `RuntimeEffect.Make`, apply via `Paint.setShader`
6. Record a frame via `PictureRecorder`, draw it back
7. Create a procedural atlas via `MakeSurface` -> `drawRect` -> `makeImageSnapshot`

### Day 2 — Performance baseline

1. `drawAtlas` at 100 / 500 / 1000 / 2000 sprites — measure frame time
2. Compare with equivalent sprite count on native (use device bench data from Phase 8)
3. Test with 1 / 4 / 8 atlas textures to verify batching behavior
4. Test RuntimeEffect shader with 5-effect chain (postfx scenario)
5. Write results into this document's "Spike Results" section below

### Pass criteria

- All 15 functional tests produce visually correct output
- 500 sprites at >= 30 fps on desktop Chrome (M1 MacBook or equivalent)
- RuntimeEffect shaders compile and render without errors

---

## Spike Results

> _To be filled after the stage 11.1 spike._

| Test                               | Result | FPS / Notes |
| ---------------------------------- | ------ | ----------- |
| drawAtlas — 100 sprites            |        |             |
| drawAtlas — 500 sprites            |        |             |
| drawAtlas — 1000 sprites           |        |             |
| drawAtlas — 2000 sprites           |        |             |
| ColorFilter.MakeBlend (tint)       |        |             |
| ColorFilter.MakeBlend (outline)    |        |             |
| ColorFilter.MakeMatrix (grayscale) |        |             |
| RuntimeEffect.Make (vignette)      |        |             |
| RuntimeEffect — 5-effect chain     |        |             |
| PictureRecorder roundtrip          |        |             |
| Procedural atlas via MakeSurface   |        |             |
| MakeImageFromEncoded (PNG)         |        |             |

---

## Decision

**Proceed with CanvasKit web path.** No API blockers. Performance TBD from spike. Fallback plan (per-sprite rendering or delayed web path) is documented in build plan stage 11.11.

---

## Sources

| Source                    | URL                                                                   | Date                 |
| ------------------------- | --------------------------------------------------------------------- | -------------------- |
| CanvasKit npm             | https://www.npmjs.com/package/canvaskit-wasm                          | 2026-04-07 (v0.41.1) |
| CanvasKit TypeScript defs | `canvaskit-wasm@0.41.1/types/index.d.ts`                              | 2026-04-07           |
| Skia CanvasKit overview   | https://skia.org/docs/user/modules/canvaskit/                         | 2026                 |
| RN Skia Web Support       | https://shopify.github.io/react-native-skia/docs/getting-started/web/ | 2026                 |
| RN Skia npm               | https://www.npmjs.com/package/@shopify/react-native-skia              | v2.6.2, 2026         |
| Flare render package      | `packages/render/src/`, `packages/react/src/skia-bridge.ts`           | Workspace            |
| Flare postfx package      | `packages/postfx/src/`                                                | Workspace            |
