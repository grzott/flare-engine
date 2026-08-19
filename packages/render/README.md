# @flare-engine/render

GPU sprite rendering on Skia — `Renderer` (canvas lifecycle), `SpriteBatch` (Atlas-backed batching), `Camera2D` (smooth follow + shake), sprite effects (`tint` / `flash` / `grayscale` / `outline` / `custom` shader, typed as `SpriteEffect` / `AnySpriteEffect`), bitmap font text, `createRenderSystem` for ECS integration.

## Install

```sh
bun add @flare-engine/render @shopify/react-native-skia
```

## Usage

```ts
import { Renderer, SpriteBatch, Camera2D, tint, type CanvasLike } from '@flare-engine/render';
import type { SkImageLike, SpriteFrame } from '@flare-engine/assets';

declare const canvas: CanvasLike;
declare const image: SkImageLike;
declare const frame: SpriteFrame;

const renderer = new Renderer();
const batch = new SpriteBatch();
const camera = new Camera2D();

camera.setViewport(800, 600);

renderer.setCanvas(canvas);
renderer.begin();
renderer.applyCamera(
  camera.effectiveX, camera.effectiveY,
  camera.zoom, camera.rotation,
  camera.viewportWidth, camera.viewportHeight,
);
batch.draw(image, frame, 100, 200, 64, 64, tint({ r: 1, g: 0, b: 0, a: 1 }, 0.5));
batch.flush((_img, _cmds) => { /* bridge calls Skia drawAtlas here */ }, renderer);
renderer.end();
```

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-enginerender--10kb-gzip).

## License

Apache-2.0
