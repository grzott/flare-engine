# @flare-engine/tilemap

Tiled `.tmj` and LDtk parsing + culled rendering + collider extraction. `parseTiled` / `parseLDtk` return a normalized `TilemapData`; `TilemapRenderer` owns its own `SpriteBatch` and only queues tiles inside the camera bounds; `drawInto(camera, batch)` queues into a caller-owned batch for single-flush z-ordering with sprites; `extractColliders` produces collision shapes for `@flare-engine/physics`.

## Install

```sh
bun add @flare-engine/tilemap
```

## Usage

```ts
import { parseTiled, TilemapRenderer, extractColliders } from '@flare-engine/tilemap';
import type { SkImageLike } from '@flare-engine/assets';
import { Camera2D } from '@flare-engine/render';

declare const rawMap: unknown;
declare const tilesetImage: SkImageLike;

const data = parseTiled(rawMap);

// renderer takes only the map; images are registered per tileset name
const renderer = new TilemapRenderer(data);
renderer.setTilesetImage('terrain', tilesetImage);

const camera = new Camera2D();
camera.setViewport(800, 600);

// draw culls to camera bounds; flush owns the actual draw calls
renderer.draw(camera, (batch) =>
  batch.flush((image, commands) => {
    // hand off image + commands to your Skia drawAtlas bridge
  }),
);

const colliders = extractColliders(data);
```

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-enginetilemap--8kb-gzip).

## License

Apache-2.0
