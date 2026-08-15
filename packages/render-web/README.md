# @flare-engine/render-web

CanvasKit-backed web renderer for `@flare-engine/render`. Provides a WebGL surface, a frame-renderer module wired to CanvasKit primitives, and a post-processing surface with a full ping-pong shader pipeline.

## Install

```sh
bun add @flare-engine/render-web canvaskit-wasm
```

`canvaskit-wasm` is an optional peer dependency — only required in web environments.

## Entry points

### `loadCanvasKit` — `loader.ts`

Loads the CanvasKit WASM binary and returns a ready `CanvasKit` instance. Takes the URL/path to the `canvaskit.wasm` binary (required), an optional `onProgress(fraction)` download callback, and an optional `LoadCanvasKitOptions` (`stallMs`, default 15000; `deadlineMs`, default 45000) bounding the load.

```ts
import { loadCanvasKit } from '@flare-engine/render-web';

const kit = await loadCanvasKit('/canvaskit.wasm', undefined, { stallMs: 10_000, deadlineMs: 30_000 });
```

A successful load is cached — later calls return the same instance. A **failed** load is not cached: a later call retries from scratch instead of being stranded on the earlier rejection.

### `createWebSurface` — `web-surface.ts`

Creates a WebGL-backed `CanvasKit` surface from an `HTMLCanvasElement`. Returns `null` when WebGL is unavailable.

```ts
import type { CanvasKit } from 'canvaskit-wasm';
import { createWebSurface } from '@flare-engine/render-web';

declare const kit: CanvasKit;
declare const canvasEl: HTMLCanvasElement;

const surface = createWebSurface(kit, canvasEl);
if (!surface) throw new Error('WebGL unavailable');
```

### `createWebSkiaModule` — `web-skia-module.ts`

Adapts a `CanvasKit` instance into the `FrameRendererModule` interface consumed by `@flare-engine/render`'s `createFrameRenderer`. Wraps `PictureRecorder`, `Paint`, `RSXform`, `XYWHRect`, and shader helpers.

```ts
import type { CanvasKit } from 'canvaskit-wasm';
import type { SkImageLike } from '@flare-engine/assets';
import type { SpriteDrawCommand } from '@flare-engine/render';
import { createWebSkiaModule } from '@flare-engine/render-web';
import { createFrameRenderer } from '@flare-engine/render';

declare const kit: CanvasKit;
declare const width: number;
declare const height: number;
declare const atlasImage: SkImageLike;
declare const commands: SpriteDrawCommand[];
declare const canvasEl: HTMLCanvasElement;

const mod = createWebSkiaModule(kit);
const renderer = createFrameRenderer(mod);

// Present onto a WebGL-backed CanvasKit surface.
const surface = kit.MakeWebGLCanvasSurface(canvasEl);
if (!surface) throw new Error('WebGL unavailable');
const canvas = surface.getCanvas();

renderer.beginFrame(width, height, 0, 1);
renderer.drawAtlas(atlasImage, commands);
const picture = renderer.endFrame();
// endFrame() returns the backend-neutral PictureLike; cast to CanvasKit's Picture to present.
if (picture) canvas.drawPicture(picture as Parameters<typeof canvas.drawPicture>[0]);
surface.flush();
```

### `createPostFxSurface` — `postfx-surface.ts`

Creates a `PostFxSurface` that owns an offscreen scene canvas, a ping-pong intermediate, and an onscreen WebGL surface. At `composite()` time it runs the caller-supplied `EffectChain` through compiled SkSL shaders and blits the result to screen.

```ts
import type { Canvas, CanvasKit } from 'canvaskit-wasm';
import { createPostFxSurface } from '@flare-engine/render-web';
import { EffectChain, createVignette, createBloom } from '@flare-engine/postfx';

declare const kit: CanvasKit;
declare const canvasEl: HTMLCanvasElement;
declare const newW: number;
declare const newH: number;
declare function drawHud(canvas: Canvas): void;

const chain = new EffectChain();
chain.add(createVignette('vig', { intensity: 0.6, radius: 0.8 }));
chain.add(createBloom('bloom', { threshold: 0.5, intensity: 0.9 }));

const surface = createPostFxSurface(kit, canvasEl, chain);
if (!surface) throw new Error('WebGL unavailable');

// Game loop:
surface.clear([0, 0, 0]);
// ...draw to surface.sceneCanvas()...
surface.composite(1);       // runs the shader chain, presents the scene to onscreenCanvas()

// Draw crisp overlays AFTER composite() but BEFORE flush(). Null while the context is lost.
const overlay = surface.onscreenCanvas();
if (overlay) drawHud(overlay);

surface.flush();            // present the frame

// On resize:
surface.resize(newW, newH);
surface.clear([0, 0, 0]);

// Teardown:
surface.dispose();
```

Pass an empty `new EffectChain()` for a zero-overhead passthrough (no shader compilation).

### Context loss and restore

`sceneCanvas()` and `onscreenCanvas()` return `Canvas | null` — both are `null` while the WebGL context is lost. `PostFxSurface` self-heals: on `webglcontextlost` it marks itself lost and stops touching GPU objects (`clear`/`fadeTrail`/`composite`/`flush` become no-ops); on `webglcontextrestored` it rebuilds the context and surfaces on the same canvas and re-clears to the last background. Poll `isLost()` to drive a host-side fallback while recovery is pending:

```ts
import type { PostFxSurface } from '@flare-engine/render-web';

declare const surface: PostFxSurface;
declare function showStaticFallback(): void;

if (surface.isLost()) showStaticFallback();
```

## Architecture notes

- `@flare-engine/postfx` is backend-neutral; `render-web` provides the CanvasKit shim (`SkiaPostFxModuleLike`) that routes `RuntimeEffect.Make` to CanvasKit.
- The ping-pong loop is allocation-free in the hot path: the children array and rect scratch buffer are pre-allocated at surface creation.
- `buildPass` is called every frame (no memoization) because `EffectChain` has no mutation signal; a future `buildPassInto` zero-alloc form in `@flare-engine/postfx` is the correct fix.

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md) and [architecture](https://github.com/grzott/flare-engine/blob/main/docs/design/architecture.md) for the full rendering pipeline.

## License

Apache-2.0
