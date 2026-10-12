# @flare-engine/postfx

## 0.4.0

### Patch Changes

- 2afc6d9: PF-5: settle the render-web, postfx and render surface before the freeze. Per ADR-0004.

  `createWebSurface` now returns a `WebSurface` handle — `{ canvas, ckCanvas, flush(), dispose() }` — instead of a bare `CanvasLike`. The previous return hid the CanvasKit surface, so nothing drawn through it could be presented or freed; the README presentation example now goes through the function instead of around it.

  `PostFxSurface.composite(globalIntensity?)` takes its argument optionally and writes it into the chain only when given. Every frame it used to overwrite `chain.globalIntensity`, undoing a reduced-motion scale set through `PostFxController.setMotionScale` or the a11y bridge; the README recipe that taught `composite(1)` now calls `composite()`.

  `COMPOSITE_SKSL`'s clouds branch honours `weatherDirection` with the same rotated scroll as `WEATHER_CLOUDS_SKSL`; it had stayed on the X-only scroll when the standalone shader gained a direction. Rendering changes for anyone on the composite clouds path with a non-zero direction.

  `PostFxController.triggerTimed` is required on the interface (it was always implemented). `render` no longer exports `ColorLike`, an alias nothing referenced.

## 0.3.1

### Patch Changes

- 1645606: Widen `makeShaderWithChildren` uniforms parameter to `Float32Array | number[]` in both `SkiaRuntimeEffectLike` (postfx) and `FrameRendererCompiledPass.shader` (render), making `PostFxRuntime` structurally assignable to `FrameRendererPostFxRuntime` without a type bridge.

## 0.3.0

### Minor Changes

- cfa69ce: postfx: correctness slivers + public-surface scrub. `SkiaRuntimeEffectLike.makeShaderWithChildren` now types its uniforms parameter as `Float32Array` (was `ArrayLike<number>`), closing the type hole that let a caller pass a plain `number[]` that some CanvasKit builds silently truncate past index 4 — full-length uniform arrays (god-rays' 12 floats, etc.) now reach the shader by construction. Weather clouds gain a real `direction`: `WEATHER_CLOUDS_SKSL` takes a `direction` uniform and scrolls the cloud field along the rotated axis (`direction=0` reproduces the previous pure-horizontal scroll), and `direction` is packed into the effect's uniform buffer. The dead `speed` field is removed from `WeatherRainUniforms` and `WeatherCloudsUniforms` (and both factories) — it was declared but never reached any shader; per-frame phase advance stays a caller responsibility (`scrollOffset*`). `createPostFxRuntime` gains an optional second argument `{ verbose?: boolean }`; the first-compile diagnostic `console.info` is now gated behind `verbose` (compile-failure `console.warn` is unchanged), so a released build is silent by default. Shipped doc comments in `controller.ts` are rewritten project-neutral (no game/session/phase vocabulary in the public `.d.ts`).
- 5aecfb6: postfx: align `createColorGradingLut` to the `create*(id, uniforms)` parameter order shared by the 11 sibling effect factories (was `(uniforms, id?)`). Because `uniforms.lut` is required the `uniforms` argument cannot carry a default, so `id` leads and is now required — callers pass an explicit id (e.g. `createColorGradingLut('color-grading-lut', { lut })`). Behavior-preserving; the returned `Effect` is unchanged.
- ff62507: Peer-dependency floor bump + Skia decoupling across the React-facing packages, plus a new web frame-renderer export. Floors move to `react >=19` and `react-native >=0.79` (Skia 2.x requires RN 0.79, not 0.78) wherever those peers are declared. `@shopify/react-native-skia` moves to `>=2.0.0` where it is still required (`react`, `engine`), is dropped entirely as a peer from `render` and `assets` (both already inject a structural `*Like` Skia module and never import Skia), and becomes an **optional, type-only** peer of `shapes` (used only for the `import type` in `draw.ts`) and an **optional, injected** peer of `postfx` (Skia is passed in at runtime; the floor moves from `>=1.0.0` to `>=2.0.0`). `react-native-gesture-handler` is dropped as a peer from `input`, `react`, and `engine` (no runtime usage). `engine` gains `react-native-safe-area-context >=4.0.0` as a required peer, matching `<GameView>`'s inset resolution.

  `@flare-engine/render-web` additionally ships `createWebFrameRenderer(kit: CanvasKit): FrameRenderer` — the web/CanvasKit analog of `@flare-engine/react`'s `createSkiaFrameRenderer`, a thin composition `createFrameRenderer(createWebSkiaModule(kit))`; presentation (replaying `endFrame()` onto a surface and flushing) stays the consumer's responsibility. Also fixes the `render-web` on-screen post-FX surface so `resize()` correctly rebuilds the WebGL onscreen surface (`postfx-surface.ts`), preventing a stale-size onscreen target after a canvas resize.

- 7c4f7cf: Packaging polish across all shipping manifests. Every package now declares `engines: { "node": ">=20" }`. Each package's `exports["."]` carries per-condition type declarations — ESM consumers (`import`) resolve `./dist/index.d.mts` and CommonJS consumers (`require`) resolve `./dist/index.d.ts`, so the declaration file always matches the resolved module format instead of an ESM import falling back to the CJS-flavored `.d.ts` (the `"."`-level `types` that previously shadowed the ESM condition is removed; the root `types` field is retained for legacy/`node10` resolution). The `@types/react` dev floor moves from `^18` to `^19` across the React-facing packages, matching the installed React 19 runtime. No runtime or public API surface changes.
- 376969a: Build toolchain modernized across all packages, with no runtime or public API changes. Every package is now bundled with `tsdown` (Rolldown-based, replacing the unmaintained `tsup`); dist output (`.js`/`.mjs`/`.d.ts`/`.d.mts` + sourcemaps) is byte-compatible, so `exports` maps and installed shape are unchanged. Lint runs on Biome 2, the TypeScript floor moves to 5.9 (with `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, and `moduleDetection: "force"` added as guards), and Bun ambient types are removed from the shipped-source typecheck. The `@flare-engine/engine` README now documents that the engine is architecture-agnostic and imposes no React Native New Architecture requirement of its own.
- 8696136: README truth pass (foundation + runtime + systems tiers): every `ts`/`tsx` example now typechecks against the workspace (enforced by `bun run check:readme`), api-specs links are absolute (resolve on npmjs.com), and private-game references are removed.

  - Snippets corrected to the real API where they had drifted: `SeededRNG.float(min, max)`; `defineComponent(name, () => defaults)`; `postfx` `create*` factories are `(id, uniforms)`; `render` `drawSprite`/`SpriteColor`; `loadCanvasKit(wasmUrl)`; `CollisionPair.entityA/entityB` + `createCollider(shape, opts)`; `events` `EventMap`-satisfying maps; `audio` `AudioContextLike`.
  - `storage`: the migration example now preserves player data across a version bump (was discarding it); the native MMKV adapter is shown as a structural peer (no `react-native-mmkv` dependency claim).
  - `render-web`: presentation uses the real `kit.MakeWebGLCanvasSurface(...)` rather than a placeholder duck-type.

## 0.2.1

### Patch Changes

- Mark the `@shopify/react-native-skia` peer dependency optional — the runtime is backend-neutral (via `SkiaPostFxModuleLike`) and never imports Skia, so web-only consumers of `@flare-engine/render-web` are no longer forced to install a native React Native peer. Also widen `SkiaRuntimeEffectLike.makeShaderWithChildren` uniforms to `ArrayLike<number>` so callers can pass a `Float32Array` without conversion.

## 0.2.0

### Minor Changes

- Version bumped as part of the 0.2.0 lockstep release.

## 0.1.0

### Minor Changes

- Initial release.
