# @flare-engine/tilemap

Tiled `.tmj` and LDtk parsing + culled rendering + collider extraction. `parseTiled` / `parseLDtk` return a normalized `TilemapData`; `TilemapRenderer` owns its own `SpriteBatch` and only queues tiles inside the camera bounds; `drawInto(camera, batch, opts?)` queues into a caller-owned batch for single-flush z-ordering with sprites, honouring each layer's `opacity` and taking an optional shared `effect` / `alphaScale`; `extractColliders` produces collision shapes for `@flare-engine/physics`.

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

## Animated tiles

Tiled per-tile animations are parsed onto `TilesetRef.animations` (local tile id → `TileAnimation` with `frames`, cumulative `ends` in seconds and `duration`). They play when you pass `time` in seconds — e.g. your clock's elapsed — in the `drawInto` / `draw` opts; without it every tile draws as authored. LDtk has no tile animation. Colliders and `getTileAt` always see the authored tile.

```ts
// elapsed: seconds since the scene started, advanced by your game clock
renderer.drawInto(camera, batch, { time: elapsed });
```

## License

Apache-2.0
