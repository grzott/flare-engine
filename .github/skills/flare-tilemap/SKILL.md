---
name: flare-tilemap
description: Deep knowledge of the @flare-engine/tilemap package — parseTiled, parseLDtk, TilemapRenderer, extractColliders. Use when loading Tiled .tmj / LDtk maps, rendering culled tilemaps, or extracting tile collision shapes for physics.
---

# `@flare-engine/tilemap`

Layer 3. Parsers are pure; renderer owns its own `SpriteBatch` + culling.

## Exports

```ts
import {
  parseTiled,
  parseLDtk,
  TilemapRenderer,
  extractColliders,
  type TileCollider,
  type TilemapData,
} from "@flare-engine/tilemap";
```

## Usage sketch

```ts
const data = parseTiled(tmjJson);
const renderer = new TilemapRenderer(data, atlasImage);
const colliders = extractColliders(data);
for (const c of colliders) collisions.add(entity(), AABB(c.w, c.h), c.x, c.y);

// per frame:
renderer.draw(camera, (batch) => batch.flush(drawAtlas));
```

## Rules

- `TilemapRenderer.draw(camera, flush)` — the renderer calls `flush(this.batch)` once; the caller owns the Skia draw.
- Only orthogonal maps are supported (Tiled) plus LDtk levels + entity layers. Isometric maps aren't shipping at 0.1.0.
- Collider extraction reads custom properties (`solid`, `layer`, `mask`) from the parsed tile data.

Spec: [docs/design/api-specs.md § @flare-engine/tilemap](../../../docs/design/api-specs.md).
