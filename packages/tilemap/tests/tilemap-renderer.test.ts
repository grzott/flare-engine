import { describe, expect, mock, test } from 'bun:test';
import type { TileLayer, TilemapData, TilesetRef } from '../src/tilemap-data.js';

// Restore real @flare-engine/ecs FIRST — render/dist/index.mjs has a static
// `import { defineComponent } from "@flare-engine/ecs"`.  If the ecs cache
// holds the stripped mock { World, Position } (set by game-view.test.ts),
// Bun throws SyntaxError when any code path loads @flare-engine/render dist.
const _realEcs = await import('@flare-engine/ecs');
mock.module('@flare-engine/ecs', () => ({ ..._realEcs }));

// Restore real @flare-engine/render before loading TilemapRenderer.
// game-view.test.ts and virtual-controls.test.ts mock @flare-engine/render
// with stub Camera2D classes that lack getBoundsInto / setViewport.
const _realRender = await import('@flare-engine/render');
mock.module('@flare-engine/render', () => ({ ..._realRender }));
const { Camera2D, SpriteBatch } = await import('@flare-engine/render');

// Dynamically import TilemapRenderer AFTER mocks are restored — tilemap-renderer.ts
// imports SpriteBatch from '@flare-engine/render' (package name → dist), which
// in turn imports { defineComponent } from '@flare-engine/ecs'.  Loading it
// statically would trigger that chain before mock.module() runs.
const { TilemapRenderer } = await import('../src/tilemap-renderer.js');

function mockImage() {
  return {
    width: () => 160,
    height: () => 160,
    readPixels: (): Uint8Array | null => null,
  };
}

function makeMap(): TilemapData {
  const tiles = new Array(10 * 10).fill(0) as number[];
  // Fill with tile 1
  for (let i = 0; i < tiles.length; i++) {
    tiles[i] = 1;
  }

  const layer: TileLayer = {
    type: 'tile',
    name: 'ground',
    width: 10,
    height: 10,
    tiles,
    visible: true,
    opacity: 1,
    offsetX: 0,
    offsetY: 0,
    properties: {},
  };

  const tileset: TilesetRef = {
    firstGid: 1,
    name: 'terrain',
    tileWidth: 16,
    tileHeight: 16,
    columns: 10,
    tileCount: 100,
    image: 'terrain.png',
    imageWidth: 160,
    imageHeight: 160,
    tileProperties: new Map(),
    solidTiles: new Set(),
  };

  return {
    width: 10,
    height: 10,
    tileWidth: 16,
    tileHeight: 16,
    layers: [layer],
    tilesets: [tileset],
    properties: {},
  };
}

describe('TilemapRenderer', () => {
  test('creates a renderer with a map', () => {
    const map = makeMap();
    const renderer = new TilemapRenderer(map);
    expect(renderer.map).toBe(map);
    expect(renderer.batch.count).toBe(0);
  });

  test('draws tiles within camera bounds', () => {
    const map = makeMap();
    const renderer = new TilemapRenderer(map);
    const image = mockImage();
    renderer.setTilesetImage('terrain', image);

    const camera = new Camera2D();
    camera.setViewport(64, 64); // 4x4 tiles visible
    camera.x = 32; // center at (32, 32)
    camera.y = 32;

    let flushed = false;
    renderer.draw(camera, (batch) => {
      // Visible area: (0, 0) to (64, 64) → cols 0..3, rows 0..3 → 4*4 = 16 tiles, but
      // camera bounds = center - half viewport → (0, 0) to (64, 64)
      // startCol = floor((0-0)/16) = 0, endCol = floor((64-0)/16) = 4 → 0..4 = 5 cols
      // Similarly 5 rows → 5*5 = 25 tiles... actually let's just check count > 0
      expect(batch.count).toBeGreaterThan(0);
      flushed = true;
    });
    expect(flushed).toBe(true);
  });

  test('culls tiles outside camera bounds', () => {
    const map = makeMap();
    const renderer = new TilemapRenderer(map);
    const image = mockImage();
    renderer.setTilesetImage('terrain', image);

    const camera = new Camera2D();
    camera.setViewport(32, 32); // 2x2 tiles viewport
    camera.x = 16; // center at (16, 16) → world (0,0) to (32,32)
    camera.y = 16;

    renderer.draw(camera, (batch) => {
      // Should only draw tiles in the visible region, not all 100
      expect(batch.count).toBeLessThan(100);
      expect(batch.count).toBeGreaterThan(0);
    });
  });

  test('skips invisible layers', () => {
    const map = makeMap();
    (map.layers[0]! as TileLayer).visible = false;
    const renderer = new TilemapRenderer(map);
    const image = mockImage();
    renderer.setTilesetImage('terrain', image);

    const camera = new Camera2D();
    camera.setViewport(160, 160);
    camera.x = 80;
    camera.y = 80;

    renderer.draw(camera, (batch) => {
      expect(batch.count).toBe(0);
    });
  });

  test('skips tiles with no tileset image', () => {
    const map = makeMap();
    const renderer = new TilemapRenderer(map);
    // Don't set any tileset image

    const camera = new Camera2D();
    camera.setViewport(160, 160);
    camera.x = 80;
    camera.y = 80;

    renderer.draw(camera, (batch) => {
      expect(batch.count).toBe(0);
    });
  });

  test('skips empty tiles (gid 0)', () => {
    const map = makeMap();
    // Make half the tiles empty
    const layer = map.layers[0] as TileLayer;
    for (let i = 0; i < layer.tiles.length; i += 2) {
      layer.tiles[i] = 0;
    }
    const renderer = new TilemapRenderer(map);
    const image = mockImage();
    renderer.setTilesetImage('terrain', image);

    const camera = new Camera2D();
    camera.setViewport(160, 160);
    camera.x = 80;
    camera.y = 80;

    let fullCount = 0;
    // First get fully visible tile count with all tiles
    const fullMap = makeMap();
    const fullRenderer = new TilemapRenderer(fullMap);
    fullRenderer.setTilesetImage('terrain', image);
    fullRenderer.draw(camera, (batch) => {
      fullCount = batch.count;
    });

    renderer.draw(camera, (batch) => {
      expect(batch.count).toBeLessThan(fullCount);
      expect(batch.count).toBeGreaterThan(0);
    });
  });
});

describe('TilemapRenderer.drawInto', () => {
  test('queues tiles into an external batch, not into renderer.batch', () => {
    const map = makeMap();
    const renderer = new TilemapRenderer(map);
    const image = mockImage();
    renderer.setTilesetImage('terrain', image);

    const camera = new Camera2D();
    camera.setViewport(160, 160);
    camera.x = 80;
    camera.y = 80;

    const external = new SpriteBatch();
    renderer.drawInto(camera, external);

    expect(external.count).toBeGreaterThan(0);
    expect(renderer.batch.count).toBe(0);
  });

  test('drawInto queues the same tile count as draw()', () => {
    const map = makeMap();
    const renderer = new TilemapRenderer(map);
    const image = mockImage();
    renderer.setTilesetImage('terrain', image);

    const camera = new Camera2D();
    camera.setViewport(160, 160);
    camera.x = 80;
    camera.y = 80;

    // Count tiles via draw()
    let drawCount = 0;
    renderer.draw(camera, (batch) => {
      drawCount = batch.count;
    });

    // Count tiles via drawInto() into a fresh batch
    const external = new SpriteBatch();
    renderer.drawInto(camera, external);

    expect(external.count).toBe(drawCount);
  });

  test('drawInto defers flushing to the caller (queues without consuming)', () => {
    const map = makeMap();
    const renderer = new TilemapRenderer(map);
    renderer.setTilesetImage('terrain', mockImage());

    const camera = new Camera2D();
    camera.setViewport(160, 160);
    camera.x = 80;
    camera.y = 80;

    const external = new SpriteBatch();
    renderer.drawInto(camera, external);

    // drawInto must NOT flush: a flush returns commands to the pool and drops the
    // count to 0. The commands stay queued for the caller to flush once.
    const queued = external.count;
    expect(queued).toBeGreaterThan(0);

    // The caller owns the single flush and receives exactly what drawInto queued.
    let flushedTotal = 0;
    external.flush((_image, commands) => {
      flushedTotal += commands.length;
    });
    expect(flushedTotal).toBe(queued);
  });

  test('draw() still passes all existing behavior after delegation refactor', () => {
    const map = makeMap();
    (map.layers[0]! as TileLayer).visible = false;
    const renderer = new TilemapRenderer(map);
    renderer.setTilesetImage('terrain', mockImage());

    const camera = new Camera2D();
    camera.setViewport(160, 160);
    camera.x = 80;
    camera.y = 80;

    renderer.draw(camera, (batch) => {
      expect(batch.count).toBe(0); // invisible layer → nothing queued
    });
  });
});

describe('TilemapRenderer — flip-bit source rect (regression)', () => {
  // Exercises the `(gid & GID_FLIP_MASK) - tileset.firstGid` mask at tilemap-renderer.ts.
  // Without the mask: localId = 2147483667 - 17 = 2147483650,
  //   srcRow = floor(2147483650 / 4) = 536870912, srcY = 536870912 * 16 = 8589934592 (wrong).
  // With the mask: localId = 19 - 17 = 2, srcRow = 0, srcY = 0 (correct).
  test('H-flipped tile uses same source rect as unflipped tile', () => {
    // Real unsigned Tiled H-flip form: 19 + 0x80000000 = 2147483667 (positive float64).
    // Authored with + (not |) to mirror actual JSON values Tiled exports.
    const FLIP_H_UINT = 0x80000000; // 2147483648 as float64 Number
    const flippedGid = 19 + FLIP_H_UINT; // 2147483667

    const terrain: TilesetRef = {
      firstGid: 1,
      name: 'terrain',
      tileWidth: 16,
      tileHeight: 16,
      columns: 4,
      tileCount: 16,
      image: 'terrain.png',
      imageWidth: 64,
      imageHeight: 64,
      tileProperties: new Map(),
      solidTiles: new Set(),
    };
    const props: TilesetRef = {
      firstGid: 17,
      name: 'props',
      tileWidth: 16,
      tileHeight: 16,
      columns: 4,
      tileCount: 16,
      image: 'props.png',
      imageWidth: 64,
      imageHeight: 64,
      tileProperties: new Map(),
      solidTiles: new Set(),
    };
    // Layer: col 0 = unflipped gid 19 (props, local 2), col 1 = H-flipped gid 2147483667.
    // Both map to localId=2, srcCol=2, srcRow=0 → srcX=32, srcY=0.
    const layer: TileLayer = {
      type: 'tile',
      name: 'ground',
      width: 2,
      height: 1,
      tiles: [19, flippedGid],
      visible: true,
      opacity: 1,
      offsetX: 0,
      offsetY: 0,
      properties: {},
    };
    const map: TilemapData = {
      width: 2,
      height: 1,
      tileWidth: 16,
      tileHeight: 16,
      layers: [layer],
      tilesets: [terrain, props],
      properties: {},
    };

    const renderer = new TilemapRenderer(map);
    renderer.setTilesetImage('terrain', mockImage());
    const propsImage = mockImage();
    renderer.setTilesetImage('props', propsImage);

    const camera = new Camera2D();
    camera.setViewport(64, 32);
    camera.x = 16;
    camera.y = 8;

    const external = new SpriteBatch();
    renderer.drawInto(camera, external);

    const captured: Array<{ srcX: number; srcY: number; dstX: number }> = [];
    external.flush((_image, commands) => {
      for (const cmd of commands) {
        captured.push({ srcX: cmd.srcX, srcY: cmd.srcY, dstX: cmd.dstX });
      }
    });

    expect(captured).toHaveLength(2);
    const unflipped = captured.find((c) => c.dstX === 0)!;
    const flipped = captured.find((c) => c.dstX === 16)!;
    expect(unflipped.srcX).toBe(32); // localId=2, col 2 of 4 → 2*16
    expect(unflipped.srcY).toBe(0); // row 0
    // Without mask: srcY = floor(2147483650 / 4) * 16 = 8589934592 — fails here
    expect(flipped.srcX).toBe(32);
    expect(flipped.srcY).toBe(0);
  });
});
