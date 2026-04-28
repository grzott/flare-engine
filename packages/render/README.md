# @flare-engine/render

GPU sprite rendering on Skia — `Renderer` (canvas lifecycle), `SpriteBatch` (Atlas-backed batching), `Camera2D` (smooth follow + shake), `SpriteEffects` (tint / flash / grayscale / outline / custom shader), bitmap font text, `createRenderSystem` for ECS integration.

## Install

```sh
bun add @flare-engine/render @shopify/react-native-skia
```

## Usage

```ts
import { Renderer, SpriteBatch, Camera2D, tint } from '@flare-engine/render';

const renderer = new Renderer();
const batch = new SpriteBatch();
const camera = new Camera2D();

renderer.setCanvas(skiaCanvas);
renderer.begin();
renderer.applyCamera(camera);
batch.draw(image, frame, x, y, w, h, tint(0xff_ff_00_00, 0.5));
batch.flush(skia.drawAtlas, renderer);
renderer.end();
```

See [API spec](../../docs/design/api-specs.md#flare-enginerender--10kb-gzip) and [skill reference](../../.github/skills/flare-render/SKILL.md).

## License

MIT
