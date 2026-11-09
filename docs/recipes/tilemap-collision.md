# Tilemap collision

How to load a Tiled map, draw it under the sprites, and move a body against its solid tiles with `@flare-engine/tilemap` and `@flare-engine/physics` — the path the `topdown` template from `@flare-engine/create` takes.

---

## Parse the map

`parseTiled` takes the parsed JSON of a Tiled `.tmj` and returns a `TilemapData`. The map must be orthogonal, tile layers must use the CSV format, and tilesets must be embedded; anything else throws `TilemapParseError` naming the Tiled setting to change. A tile is solid when its tileset entry carries a bool custom property `solid` (or `collision`) set to `true`, or has type/class `solid`.

```ts
import { parseTiled } from '@flare-engine/tilemap';

const TILE_SIZE = 16;
const GRASS = 1;
const WALL = 2;

// The shape Tiled writes: orthogonal, one CSV tile layer, one embedded tileset.
// A 4x3 room — a ring of walls around two grass cells.
const mapJson = {
  width: 4,
  height: 3,
  tilewidth: TILE_SIZE,
  tileheight: TILE_SIZE,
  orientation: 'orthogonal',
  layers: [
    {
      type: 'tilelayer',
      name: 'ground',
      width: 4,
      height: 3,
      data: [WALL, WALL, WALL, WALL, WALL, GRASS, GRASS, WALL, WALL, WALL, WALL, WALL],
      visible: true,
      opacity: 1,
    },
  ],
  tilesets: [
    {
      firstgid: 1,
      name: 'tiles',
      tilewidth: TILE_SIZE,
      tileheight: TILE_SIZE,
      columns: 2,
      tilecount: 2,
      image: 'tiles.png',
      imagewidth: 32,
      imageheight: 16,
      // Local id = gid - firstgid. Only the wall is solid.
      tiles: [{ id: WALL - 1, properties: [{ name: 'solid', type: 'bool', value: true }] }],
    },
  ],
};

export const map = parseTiled(mapJson);
```

With an editor-made map, export from Tiled as JSON, save it with a `.json` extension so the bundler loads it as a JSON module (`.tmj` is the same format), and pass the import to `parseTiled`. The `topdown` template has no editor file: its `src/map.ts` builds this JSON shape from ASCII art in `buildTiledMapJson` and parses it in `loadMap()`, so swapping in an exported map is a one-line change there.

---

## Draw it under the sprites

`TilemapRenderer` draws the tile layers with viewport culling. It needs one image per tileset, keyed by the tileset's `name`, and queues tiles into the batch you hand it without flushing. Queue from `GameConfig.onRenderBackground`: `GameView` calls that hook after the camera transform and before the sprite render system, then flushes the batch once — so the tiles land under the sprites in the same draw.

```tsx
import { createProceduralAtlas } from '@flare-engine/assets';
import type { GameConfig, GameContextValue } from '@flare-engine/react';
import { GameView, skiaAtlasModule } from '@flare-engine/react';
import { TilemapRenderer, type TilemapData } from '@flare-engine/tilemap';
import { useMemo, useRef } from 'react';

declare const map: TilemapData;

const TILE_SIZE = 16;

export function App() {
  const tilemapRef = useRef<TilemapRenderer | null>(null);

  // GameView reads `config` once on mount: keep the object stable and reach
  // mutable state through a ref.
  const config = useMemo<GameConfig>(
    () => ({
      onRenderBackground: (ctx) => {
        tilemapRef.current?.drawInto(ctx.camera, ctx.batch);
      },
    }),
    [],
  );

  const handleReady = (ctx: GameContextValue): void => {
    // Frame order must follow local tile id: grass is gid 1 (local 0), wall gid 2 (local 1).
    const atlas = createProceduralAtlas(skiaAtlasModule, [
      { name: 'grass', w: TILE_SIZE, h: TILE_SIZE, color: 0xff3a7d44 },
      { name: 'wall', w: TILE_SIZE, h: TILE_SIZE, color: 0xff5a5a66 },
    ]);
    const tilemap = new TilemapRenderer(map);
    tilemap.setTilesetImage('tiles', atlas.image);
    tilemapRef.current = tilemap;
    ctx.camera.zoom = 2;
  };

  return <GameView config={config} onReady={handleReady} />;
}
```

The renderer reads a tile's source rect from the tileset's `columns` and tile size: local id `n` is column `n % columns`, row `floor(n / columns)`. `createProceduralAtlas` row-packs its frames left to right in the order given, so listing the frames in local-id order makes the atlas line up with the tileset. With real art, pass the tileset PNG's `SkImageLike` instead — for example the `image` of a `Texture` loaded through `ctx.assets`.

---

## Collide against it

`extractColliders(map)` lists every solid tile as a `TileCollider` with its `row` and `col`; `buildSolidGrid` turns that list into a `SolidGrid` — a `Uint8Array` with one cell per tile. Build it once per map load. Each frame, `moveAndSlideInto` applies the x and y moves separately against the grid, drops the blocked axis so diagonal input slides along walls, and writes the result into the `out` object. Pass the entity's own `Position` object as `out` and it moves in place with no allocation.

```ts
import { Position } from '@flare-engine/ecs';
import { buildSolidGrid, moveAndSlideInto } from '@flare-engine/physics';
import type { GameContextValue } from '@flare-engine/react';
import { Sprite, type SpriteData } from '@flare-engine/render';
import { extractColliders, type TilemapData } from '@flare-engine/tilemap';

declare const map: TilemapData;
declare const ctx: GameContextValue;
declare const playerSprite: SpriteData;
/** Joystick direction, written by the overlay's onStateChange. */
declare const dir: { x: number; y: number };

const SPEED = 96;
const PLAYER_HALF = 6;

// Once per map load. TileCollider[] is structurally a SolidTile[] ({ row, col }),
// so physics needs no tilemap import. Square tiles: the grid takes one tile size.
const grid = buildSolidGrid(map.width, map.height, map.tileWidth, extractColliders(map));

const player = ctx.world.spawn();
const pos = { x: 24, y: 24 };
ctx.world.add(player, Position, pos);
ctx.world.add(player, Sprite, playerSprite);
ctx.camera.follow(pos);

ctx.loop.onUpdate.add((dt) => {
  const dx = dir.x * SPEED * dt;
  const dy = dir.y * SPEED * dt;
  moveAndSlideInto(grid, pos.x, pos.y, dx, dy, PLAYER_HALF, PLAYER_HALF, pos);
});
```

`isBlockedAABB(grid, x, y, halfW, halfH)` is the underlying test when you need a yes/no answer for a box. The map edge counts as a wall by default; build the grid with `{ outside: 'open' }` to let bodies leave it, for seams between adjacent maps.

---

## Flip a cell at runtime

A door, a crumbling wall, a bridge: both the collision cell and the drawn tile are plain cells in arrays the engine already owns. `SolidGrid.solid` and `TileLayer.tiles` hold a fixed reference, but their cells are writable, so a flip is two index writes — no grid rebuild, no allocation, idempotent.

```ts
import type { SolidGrid } from '@flare-engine/physics';
import type { TileLayer, TilemapData } from '@flare-engine/tilemap';

// The 4x3 room and its grid from the sections above.
declare const map: TilemapData;
declare const grid: SolidGrid;

// Open the east wall at row 1, col 3 into floor.
const DOOR_ROW = 1;
const DOOR_COL = 3;
/** Gid drawn once the door is open: grass. A real tileset would have an open-door frame. */
const TILE_DOOR_OPEN = 1;

export function openDoor(layer: TileLayer, solid: SolidGrid): void {
  const idx = DOOR_ROW * solid.width + DOOR_COL;
  solid.solid[idx] = 0;
  layer.tiles[idx] = TILE_DOOR_OPEN;
}

// Narrow to the tile layer once, up front; openDoor wants its `tiles` array.
const ground = map.layers[0];
if (ground === undefined || ground.type !== 'tile') throw new Error('expected a tile layer');

openDoor(ground, grid);
```

This is the `topdown` template's `openDoor` in `src/map.ts`. Its `App.tsx` triggers it from `onUpdate`: when the door cell is still solid and the player's box at the intended (pre-collision) position overlaps the door tile, the door opens, and the same frame's `moveAndSlideInto` already passes through. The renderer reads `layer.tiles` every frame, so the open frame shows at once.

---

## Test it headless

Everything above except the renderer and the atlas is pure data, so it runs under `bun test` with no Skia and no React Native. The `topdown` template's `tests/tilemap.test.ts` covers the parse, the colliders, the door flip and the slide this way.

```ts no-check
import { expect, test } from 'bun:test';
import { buildSolidGrid, isBlockedAABB, moveAndSlideInto } from '@flare-engine/physics';
import { extractColliders, type TilemapData } from '@flare-engine/tilemap';

// The 4x3 room from "Parse the map".
declare const map: TilemapData;

test('walls block, the floor does not', () => {
  const grid = buildSolidGrid(map.width, map.height, map.tileWidth, extractColliders(map));

  expect(isBlockedAABB(grid, 8, 8, 6, 6)).toBe(true); // wall at row 0, col 0
  expect(isBlockedAABB(grid, 24, 24, 6, 6)).toBe(false); // grass at row 1, col 1

  const out = { x: 24, y: 24 };
  moveAndSlideInto(grid, 24, 24, 0, -10, 6, 6, out);
  expect(out.y).toBe(24); // the top wall stops the move
});
```

Real-world reference: the `topdown` template (`npm create @flare-engine my-game -- --template topdown`) ships this path in `src/map.ts`, `src/App.tsx` and `tests/tilemap.test.ts`.
