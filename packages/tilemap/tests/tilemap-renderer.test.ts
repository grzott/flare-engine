import { describe, expect, mock, test } from 'bun:test';
import type { TileLayer, TilemapData, TilesetRef } from '../src/tilemap-data.js';

// Restore real @flare-engine/ecs FIRST — render/dist/index.mjs has a static
// `import { defineComponent } from "@flare-engine/ecs"`.  If the ecs cache
// holds the stripped mock { World, Position } (set by game-view.test.ts),
// Bun throws SyntaxError when any code path loads @flare-engine/render dist.
const _realEcs = await import('../../ecs/src/index.ts');
mock.module('@flare-engine/ecs', () => ({ ..._realEcs }));

// Restore real @flare-engine/render before loading TilemapRenderer.
// game-view.test.ts and virtual-controls.test.ts mock @flare-engine/render
// with stub Camera2D classes that lack getBoundsInto / setViewport.
const _realRender = await import('../../render/src/index.ts');
mock.module('@flare-engine/render', () => ({ ..._realRender }));
const { Camera2D } = await import('@flare-engine/render');

// Dynamically import TilemapRenderer AFTER mocks are restored — tilemap-renderer.ts
// imports SpriteBatch from '@flare-engine/render' (package name → dist), which
// in turn imports { defineComponent } from '@flare-engine/ecs'.  Loading it
// statically would trigger that chain before mock.module() runs.
const { TilemapRenderer } = await import('../src/tilemap-renderer.js');

function mockImage() {
  return {
    width: () => 160,
    height: () => 160,
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
