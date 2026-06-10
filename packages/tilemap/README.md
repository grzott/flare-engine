# @flare-engine/tilemap

Tiled `.tmj` and LDtk parsing + culled rendering + collider extraction. `parseTiled` / `parseLDtk` return a normalized `TilemapData`; `TilemapRenderer` owns its own `SpriteBatch` and only queues tiles inside the camera bounds; `extractColliders` produces collision shapes for `@flare-engine/physics`.

## Install

```sh
bun add @flare-engine/tilemap
```

## Usage

```ts
import { parseTiled, TilemapRenderer, extractColliders } from '@flare-engine/tilemap';

const data = parseTiled(json);
const renderer = new TilemapRenderer(data, atlas);
renderer.draw(camera, (batch) => batch.flush(skia.drawAtlas, gameRenderer));

const colliders = extractColliders(data);
```

See [API spec](../../docs/design/api-specs.md#flare-enginetilemap--8kb-gzip).

## License

MIT
