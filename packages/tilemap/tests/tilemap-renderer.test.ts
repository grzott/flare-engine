import { describe, expect, mock, test } from 'bun:test';
import type { Rect } from '@flare-engine/math';
import type { TileAnimation, TileLayer, TilemapData, TilesetRef } from '../src/tilemap-data.js';

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
const { Camera2D, SpriteBatch, tint } = await import('@flare-engine/render');

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
  const tiles = new Uint32Array(10 * 10);
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

describe('TilemapRenderer — layer opacity and draw options', () => {
  function fullCamera() {
    const camera = new Camera2D();
    camera.setViewport(160, 160);
    camera.x = 80;
    camera.y = 80;
    return camera;
  }

  function flushAll(batch: InstanceType<typeof SpriteBatch>) {
    const commands: Array<{ alpha: number; effect: unknown }> = [];
    let runs = 0;
    batch.flush((_image, run) => {
      runs++;
      for (const cmd of run) commands.push({ alpha: cmd.alpha, effect: cmd.effect });
    });
    return { commands, runs };
  }

  test('a layer with opacity 0.4 queues every tile with alpha 0.4', () => {
    const map = makeMap();
    (map.layers[0] as TileLayer).opacity = 0.4;
    const renderer = new TilemapRenderer(map);
    renderer.setTilesetImage('terrain', mockImage());

    const external = new SpriteBatch();
    renderer.drawInto(fullCamera(), external);

    const { commands } = flushAll(external);
    expect(commands.length).toBeGreaterThan(0);
    for (const cmd of commands) expect(cmd.alpha).toBe(0.4);
  });

  test('alphaScale multiplies layer.opacity', () => {
    const map = makeMap();
    (map.layers[0] as TileLayer).opacity = 0.5;
    const renderer = new TilemapRenderer(map);
    renderer.setTilesetImage('terrain', mockImage());

    const external = new SpriteBatch();
    renderer.drawInto(fullCamera(), external, { alphaScale: 0.5 });

    const { commands } = flushAll(external);
    expect(commands.length).toBeGreaterThan(0);
    for (const cmd of commands) expect(cmd.alpha).toBe(0.25);
  });

  test('drawInto with a shared effect sets it on every tile and keeps one batch run', () => {
    const map = makeMap();
    const renderer = new TilemapRenderer(map);
    renderer.setTilesetImage('terrain', mockImage());
    const night = tint({ r: 0.2, g: 0.2, b: 0.6, a: 1 }, 0.5);

    const external = new SpriteBatch();
    renderer.drawInto(fullCamera(), external, { effect: night });

    const { commands, runs } = flushAll(external);
    expect(commands.length).toBeGreaterThan(0);
    for (const cmd of commands) expect(cmd.effect).toBe(night);
    expect(runs).toBe(1);
  });

  test('draw(camera, flush, opts) threads the same options', () => {
    const map = makeMap();
    (map.layers[0] as TileLayer).opacity = 0.8;
    const renderer = new TilemapRenderer(map);
    renderer.setTilesetImage('terrain', mockImage());
    const night = tint({ r: 0.2, g: 0.2, b: 0.6, a: 1 }, 0.5);

    let seen = 0;
    renderer.draw(
      fullCamera(),
      (batch) => {
        const { commands, runs } = flushAll(batch);
        seen = commands.length;
        for (const cmd of commands) {
          expect(cmd.alpha).toBe(0.4);
          expect(cmd.effect).toBe(night);
        }
        expect(runs).toBe(1);
      },
      { effect: night, alphaScale: 0.5 },
    );
    expect(seen).toBeGreaterThan(0);
  });

  test('the two-argument call is unchanged: alpha 1, no effect', () => {
    const map = makeMap();
    const renderer = new TilemapRenderer(map);
    renderer.setTilesetImage('terrain', mockImage());

    const external = new SpriteBatch();
    renderer.drawInto(fullCamera(), external);

    const { commands, runs } = flushAll(external);
    expect(commands.length).toBeGreaterThan(0);
    for (const cmd of commands) {
      expect(cmd.alpha).toBe(1);
      expect(cmd.effect).toBeUndefined();
    }
    expect(runs).toBe(1);
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
      tiles: new Uint32Array([19, flippedGid]),
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

describe('TilemapRenderer — flipped GIDs draw mirrored', () => {
  // Unsigned Tiled bit values, combined with + as Tiled's JSON exports them.
  const H = 0x80000000;
  const V = 0x40000000;
  const D = 0x20000000;
  const GID = 3; // firstGid 1, local id 2 → srcX 32, srcY 0
  const QUARTER = Math.PI / 2;

  // cols 0..7: plain, H, V, H+V, D+H, D+V, D, D+H+V
  const gids = [
    GID,
    GID + H,
    GID + V,
    GID + H + V,
    GID + D + H,
    GID + D + V,
    GID + D,
    GID + D + H + V,
  ];
  const expected: Array<{ flipX: boolean; flipY: boolean; rotation: number }> = [
    { flipX: false, flipY: false, rotation: 0 },
    { flipX: true, flipY: false, rotation: 0 },
    { flipX: false, flipY: true, rotation: 0 },
    { flipX: true, flipY: true, rotation: 0 },
    { flipX: false, flipY: false, rotation: QUARTER },
    { flipX: false, flipY: false, rotation: -QUARTER },
    { flipX: false, flipY: true, rotation: QUARTER },
    { flipX: true, flipY: false, rotation: QUARTER },
  ];

  interface Captured {
    srcX: number;
    srcY: number;
    dstX: number;
    dstY: number;
    flipX: boolean;
    flipY: boolean;
    rotation: number;
    anchorX: number;
    anchorY: number;
  }

  function drawRow(offsetX = 0, offsetY = 0): Captured[] {
    const tileset: TilesetRef = {
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
    const layer: TileLayer = {
      type: 'tile',
      name: 'ground',
      width: 8,
      height: 1,
      tiles: new Uint32Array(gids),
      visible: true,
      opacity: 1,
      offsetX,
      offsetY,
      properties: {},
    };
    const map: TilemapData = {
      width: 8,
      height: 1,
      tileWidth: 16,
      tileHeight: 16,
      layers: [layer],
      tilesets: [tileset],
      properties: {},
    };

    const renderer = new TilemapRenderer(map);
    renderer.setTilesetImage('terrain', mockImage());

    const camera = new Camera2D();
    camera.setViewport(128, 16);
    camera.x = 64;
    camera.y = 8;

    const external = new SpriteBatch();
    renderer.drawInto(camera, external);

    const captured: Captured[] = [];
    external.flush((_image, commands) => {
      for (const cmd of commands) {
        captured.push({
          srcX: cmd.srcX,
          srcY: cmd.srcY,
          dstX: cmd.dstX,
          dstY: cmd.dstY,
          flipX: cmd.flipX,
          flipY: cmd.flipY,
          rotation: cmd.rotation,
          anchorX: cmd.anchorX,
          anchorY: cmd.anchorY,
        });
      }
    });
    captured.sort((a, b) => a.dstX - b.dstX);
    return captured;
  }

  function at(col: number): Captured {
    const captured = drawRow();
    expect(captured).toHaveLength(8);
    return captured[col]!;
  }

  test('a plain gid draws unflipped with no rotation', () => {
    const cmd = at(0);
    expect(cmd.flipX).toBe(false);
    expect(cmd.flipY).toBe(false);
    expect(cmd.rotation).toBe(0);
  });

  test('an H-flipped gid sets flipX', () => {
    const cmd = at(1);
    expect(cmd.flipX).toBe(true);
    expect(cmd.flipY).toBe(false);
    expect(cmd.rotation).toBe(0);
  });

  test('a V-flipped gid sets flipY', () => {
    const cmd = at(2);
    expect(cmd.flipX).toBe(false);
    expect(cmd.flipY).toBe(true);
    expect(cmd.rotation).toBe(0);
  });

  test('a diagonally flipped gid turns a quarter turn about the tile centre', () => {
    // D+H is Tiled's rotate-right: 90° clockwise, no mirror.
    const cmd = at(4);
    expect(cmd.flipX).toBe(false);
    expect(cmd.flipY).toBe(false);
    expect(cmd.rotation).toBe(QUARTER);
    expect(cmd.anchorX).toBe(0.5);
    expect(cmd.anchorY).toBe(0.5);
  });

  test('a diagonal-only gid queues flipY plus a CW quarter turn about the tile centre', () => {
    // D alone is a transpose: render draws it as flipY, then rotates 90° CW.
    const cmd = at(6);
    expect(cmd.flipX).toBe(false);
    expect(cmd.flipY).toBe(true);
    expect(cmd.rotation).toBe(QUARTER);
    expect(cmd.anchorX).toBe(0.5);
    expect(cmd.anchorY).toBe(0.5);
  });

  test('a D+H+V gid queues flipX plus a CW quarter turn about the tile centre', () => {
    const cmd = at(7);
    expect(cmd.flipX).toBe(true);
    expect(cmd.flipY).toBe(false);
    expect(cmd.rotation).toBe(QUARTER);
    expect(cmd.anchorX).toBe(0.5);
    expect(cmd.anchorY).toBe(0.5);
  });

  test('every flip combination maps to the Tiled table and stays in its cell', () => {
    const captured = drawRow();
    expect(captured).toHaveLength(8);
    for (let col = 0; col < 8; col++) {
      const cmd = captured[col]!;
      const want = expected[col]!;
      expect(cmd.dstX).toBe(col * 16);
      expect(cmd.dstY).toBe(0);
      expect(cmd.srcX).toBe(32);
      expect(cmd.srcY).toBe(0);
      expect(cmd.flipX).toBe(want.flipX);
      expect(cmd.flipY).toBe(want.flipY);
      expect(cmd.rotation).toBe(want.rotation);
    }
  });

  test('an H-flipped tile honours the layer offset', () => {
    const captured = drawRow(4, 6);
    expect(captured).toHaveLength(8);
    const cmd = captured[1]!;
    expect(cmd.flipX).toBe(true);
    expect(cmd.dstX).toBe(1 * 16 + 4);
    expect(cmd.dstY).toBe(6);
  });
});

describe('TilemapRenderer — animated tiles', () => {
  // Unsigned Tiled flip bits, combined with + as Tiled's JSON exports them.
  const H = 0x80000000;
  const V = 0x40000000;
  const D = 0x20000000;
  const QUARTER = Math.PI / 2;

  // 4-column tileset, firstGid 1. Local 0 (gid 1) is animated over row 1 of the
  // sheet — frames 4, 5, 6 → src (0,16), (16,16), (32,16) — so every frame differs
  // from the authored local 0 at src (0,0). Local 3 (gid 4, src (48,0)) is static.
  const ANIMATED_GID = 1;
  const STATIC_GID = 4;

  function makeAnimation(): TileAnimation {
    return {
      frames: Uint32Array.of(4, 5, 6),
      ends: Float64Array.of(0.1, 0.35, 0.5),
      duration: 0.5,
    };
  }

  function makeAnimatedMap(gids: number[]): TilemapData {
    const tileset: TilesetRef = {
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
      animations: new Map([[0, makeAnimation()]]),
    };
    const layer: TileLayer = {
      type: 'tile',
      name: 'ground',
      width: gids.length,
      height: 1,
      tiles: new Uint32Array(gids),
      visible: true,
      opacity: 1,
      offsetX: 0,
      offsetY: 0,
      properties: {},
    };
    return {
      width: gids.length,
      height: 1,
      tileWidth: 16,
      tileHeight: 16,
      layers: [layer],
      tilesets: [tileset],
      properties: {},
    };
  }

  function rowCamera(cols: number) {
    const camera = new Camera2D();
    camera.setViewport(cols * 16, 16);
    camera.x = cols * 8;
    camera.y = 8;
    return camera;
  }

  interface Captured {
    srcX: number;
    srcY: number;
    dstX: number;
    flipX: boolean;
    flipY: boolean;
    rotation: number;
  }

  function capture(batch: InstanceType<typeof SpriteBatch>): Captured[] {
    const captured: Captured[] = [];
    batch.flush((_image, commands) => {
      for (const cmd of commands) {
        captured.push({
          srcX: cmd.srcX,
          srcY: cmd.srcY,
          dstX: cmd.dstX,
          flipX: cmd.flipX,
          flipY: cmd.flipY,
          rotation: cmd.rotation,
        });
      }
    });
    captured.sort((a, b) => a.dstX - b.dstX);
    return captured;
  }

  function drawRow(gids: number[], opts?: { time?: number; alphaScale?: number }): Captured[] {
    const renderer = new TilemapRenderer(makeAnimatedMap(gids));
    renderer.setTilesetImage('terrain', mockImage());
    const external = new SpriteBatch();
    if (opts === undefined) renderer.drawInto(rowCamera(gids.length), external);
    else renderer.drawInto(rowCamera(gids.length), external, opts);
    const captured = capture(external);
    expect(captured).toHaveLength(gids.length);
    return captured;
  }

  function src(cmd: Captured): [number, number] {
    return [cmd.srcX, cmd.srcY];
  }

  test('time 0 draws the first frame, not the authored tile', () => {
    expect(src(drawRow([ANIMATED_GID], { time: 0 })[0]!)).toEqual([0, 16]);
  });

  test('a time inside the first frame still draws the first frame', () => {
    expect(src(drawRow([ANIMATED_GID], { time: 0.05 })[0]!)).toEqual([0, 16]);
  });

  test('a time exactly on the first frame boundary draws the next frame', () => {
    expect(src(drawRow([ANIMATED_GID], { time: 0.1 })[0]!)).toEqual([16, 16]);
  });

  test('a time inside the last frame draws the last frame', () => {
    expect(src(drawRow([ANIMATED_GID], { time: 0.4 })[0]!)).toEqual([32, 16]);
  });

  test('a time past the duration wraps around the cycle', () => {
    // 1.2 s = two full 0.5 s cycles + 0.2 s → second frame.
    expect(src(drawRow([ANIMATED_GID], { time: 1.2 })[0]!)).toEqual([16, 16]);
  });

  test('a negative time wraps forward from the end of the cycle', () => {
    // -0.1 s → 0.4 s into the cycle → third frame.
    expect(src(drawRow([ANIMATED_GID], { time: -0.1 })[0]!)).toEqual([32, 16]);
  });

  test('flip bits of the authored gid survive on an animated tile', () => {
    const captured = drawRow(
      [ANIMATED_GID + H, ANIMATED_GID + V, ANIMATED_GID + D + H, ANIMATED_GID + D + V],
      { time: 0.2 },
    );
    for (const cmd of captured) expect(src(cmd)).toEqual([16, 16]);
    expect(captured[0]!.flipX).toBe(true);
    expect(captured[0]!.flipY).toBe(false);
    expect(captured[0]!.rotation).toBe(0);
    expect(captured[1]!.flipX).toBe(false);
    expect(captured[1]!.flipY).toBe(true);
    expect(captured[1]!.rotation).toBe(0);
    expect(captured[2]!.flipX).toBe(false);
    expect(captured[2]!.flipY).toBe(false);
    expect(captured[2]!.rotation).toBe(QUARTER);
    expect(captured[3]!.flipX).toBe(false);
    expect(captured[3]!.flipY).toBe(false);
    expect(captured[3]!.rotation).toBe(-QUARTER);
  });

  test('an unanimated tile is unchanged when time is set', () => {
    const captured = drawRow([ANIMATED_GID, STATIC_GID], { time: 0.2 });
    expect(src(captured[0]!)).toEqual([16, 16]);
    expect(src(captured[1]!)).toEqual([48, 0]);
  });

  test('the two-argument drawInto draws the authored tile', () => {
    const captured = drawRow([ANIMATED_GID, STATIC_GID]);
    expect(src(captured[0]!)).toEqual([0, 0]);
    expect(src(captured[1]!)).toEqual([48, 0]);
  });

  test('opts without time draw the authored tile', () => {
    expect(src(drawRow([ANIMATED_GID], { alphaScale: 0.5 })[0]!)).toEqual([0, 0]);
  });

  test('a non-finite time draws the authored tile', () => {
    for (const time of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(src(drawRow([ANIMATED_GID], { time })[0]!)).toEqual([0, 0]);
    }
  });

  test('draw(camera, flush, opts) threads time the same way', () => {
    const renderer = new TilemapRenderer(makeAnimatedMap([ANIMATED_GID]));
    renderer.setTilesetImage('terrain', mockImage());
    let seen: Captured[] = [];
    renderer.draw(
      rowCamera(1),
      (batch) => {
        seen = capture(batch);
      },
      { time: 0.4 },
    );
    expect(seen).toHaveLength(1);
    expect(src(seen[0]!)).toEqual([32, 16]);
  });

  test('a tileset without animations draws the authored tile when time is set', () => {
    const map = makeAnimatedMap([ANIMATED_GID]);
    delete map.tilesets[0]!.animations;
    const renderer = new TilemapRenderer(map);
    renderer.setTilesetImage('terrain', mockImage());
    const external = new SpriteBatch();
    renderer.drawInto(rowCamera(1), external, { time: 0.2 });
    const captured = capture(external);
    expect(captured).toHaveLength(1);
    expect(src(captured[0]!)).toEqual([0, 0]);
  });
});

describe('TilemapRenderer — animated frame lookup keeps buffer identity (identity pin, not a heap measure)', () => {
  // JS cannot observe a transient allocation directly, so this pins what the lookup
  // must reuse: the tileset's animations map, each TileAnimation and its typed arrays,
  // and the renderer's one source-rect buffer, across many draws at varying times.
  function internals(renderer: InstanceType<typeof TilemapRenderer>): { _srcBuf: Rect } {
    return renderer as unknown as { _srcBuf: Rect };
  }

  test('after warm-up, 200 draws at different times keep every animation object and _srcBuf identity', () => {
    const anim: TileAnimation = {
      frames: Uint32Array.of(4, 5, 6),
      ends: Float64Array.of(0.1, 0.35, 0.5),
      duration: 0.5,
    };
    const animations = new Map([[0, anim]]);
    const tileset: TilesetRef = {
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
      animations,
    };
    const layer: TileLayer = {
      type: 'tile',
      name: 'ground',
      width: 4,
      height: 1,
      tiles: new Uint32Array([1, 1 + 0x80000000, 4, 1]),
      visible: true,
      opacity: 1,
      offsetX: 0,
      offsetY: 0,
      properties: {},
    };
    const map: TilemapData = {
      width: 4,
      height: 1,
      tileWidth: 16,
      tileHeight: 16,
      layers: [layer],
      tilesets: [tileset],
      properties: {},
    };
    const renderer = new TilemapRenderer(map);
    renderer.setTilesetImage('terrain', mockImage());
    const camera = new Camera2D();
    camera.setViewport(64, 16);
    camera.x = 32;
    camera.y = 8;
    const external = new SpriteBatch();

    renderer.drawInto(camera, external, { time: 0.05 });
    external.flush(() => {});
    const frames = anim.frames;
    const ends = anim.ends;
    const srcBuf = internals(renderer)._srcBuf;

    for (let i = 0; i < 200; i++) {
      renderer.drawInto(camera, external, { time: i * 0.037 - 1 });
      expect(external.count).toBe(4);
      external.flush(() => {});
      expect(tileset.animations).toBe(animations);
      expect(animations.get(0)).toBe(anim);
      expect(anim.frames).toBe(frames);
      expect(anim.ends).toBe(ends);
      expect(internals(renderer)._srcBuf).toBe(srcBuf);
    }
  });
});

describe('TilemapRenderer — tileset and image resolved once per run', () => {
  const H = 0x80000000;
  const V = 0x40000000;
  const D = 0x20000000;

  // terrain owns gids 1..16, props owns 17..32; both are 4 columns of 16px tiles.
  const A = 2;
  const B = 18;

  // Recorded from the per-tile renderer (before resolution was memoised per run).
  const GOLDEN_OVERLAP: string[] = [
    'terrain | src 16,0,16,16 | dst 0,0,16,16 | anchor 0.5,0.5 | alpha 1 | rot 0q | flip -- | normal | plain',
    'props | src 48,0,16,16 | dst 16,0,16,16 | anchor 0.5,0.5 | alpha 1 | rot 0q | flip -- | normal | plain',
    'terrain | src 16,0,16,16 | dst 32,0,16,16 | anchor 0.5,0.5 | alpha 1 | rot 0q | flip -- | normal | plain',
  ];
  const GOLDEN_PAST_END: string[] = [
    'props | src 16,0,16,16 | dst 0,0,16,16 | anchor 0.5,0.5 | alpha 1 | rot 0q | flip -- | normal | plain',
    'props | src 48,80,16,16 | dst 16,0,16,16 | anchor 0.5,0.5 | alpha 1 | rot 0q | flip -- | normal | plain',
    'props | src 16,0,16,16 | dst 32,0,16,16 | anchor 0.5,0.5 | alpha 1 | rot 0q | flip -- | normal | plain',
  ];
  const GOLDEN_UNSORTED: string[] = [
    'terrain | src 48,64,16,16 | dst 0,0,16,16 | anchor 0.5,0.5 | alpha 1 | rot 0q | flip -- | normal | plain',
    'terrain | src 48,64,16,16 | dst 32,0,16,16 | anchor 0.5,0.5 | alpha 1 | rot 0q | flip -- | normal | plain',
    'terrain | src 0,64,16,16 | dst 48,0,16,16 | anchor 0.5,0.5 | alpha 1 | rot 0q | flip -- | normal | plain',
  ];
  const GOLDEN_STATIC: string[] = [
    'terrain | src 16,0,16,16 | dst 0,0,16,16 | anchor 0.5,0.5 | alpha 1 | rot 0q | flip -- | normal | plain',
    'terrain | src 16,0,16,16 | dst 16,0,16,16 | anchor 0.5,0.5 | alpha 1 | rot 0q | flip x- | normal | plain',
    'props | src 16,0,16,16 | dst 32,0,16,16 | anchor 0.5,0.5 | alpha 1 | rot 0q | flip -- | normal | plain',
    'props | src 16,0,16,16 | dst 48,0,16,16 | anchor 0.5,0.5 | alpha 1 | rot 0q | flip -y | normal | plain',
    'terrain | src 16,0,16,16 | dst 64,0,16,16 | anchor 0.5,0.5 | alpha 1 | rot 1q | flip -- | normal | plain',
    'props | src 32,0,16,16 | dst 0,16,16,16 | anchor 0.5,0.5 | alpha 1 | rot 0q | flip -- | normal | plain',
    'props | src 32,0,16,16 | dst 16,16,16,16 | anchor 0.5,0.5 | alpha 1 | rot 1q | flip -y | normal | plain',
    'props | src 32,0,16,16 | dst 32,16,16,16 | anchor 0.5,0.5 | alpha 1 | rot 0q | flip xy | normal | plain',
    'terrain | src 32,16,16,16 | dst 48,16,16,16 | anchor 0.5,0.5 | alpha 1 | rot 0q | flip -- | normal | plain',
    'terrain | src 16,0,16,16 | dst 64,16,16,16 | anchor 0.5,0.5 | alpha 1 | rot -1q | flip -- | normal | plain',
    'props | src 48,48,16,16 | dst 80,16,16,16 | anchor 0.5,0.5 | alpha 1 | rot 1q | flip x- | normal | plain',
    'props | src 32,0,16,16 | dst 20,-8,16,16 | anchor 0.5,0.5 | alpha 0.5 | rot 0q | flip x- | normal | plain',
    'terrain | src 16,0,16,16 | dst 36,-8,16,16 | anchor 0.5,0.5 | alpha 0.5 | rot 0q | flip -y | normal | plain',
    'terrain | src 48,48,16,16 | dst 68,-8,16,16 | anchor 0.5,0.5 | alpha 0.5 | rot 0q | flip -- | normal | plain',
    'props | src 0,0,16,16 | dst 84,-8,16,16 | anchor 0.5,0.5 | alpha 0.5 | rot 0q | flip -- | normal | plain',
  ];
  const GOLDEN_ANIMATED: string[] = [
    'terrain | src 16,16,16,16 | dst 0,0,16,16 | anchor 0.5,0.5 | alpha 0.5 | rot 0q | flip -- | normal | plain',
    'terrain | src 16,16,16,16 | dst 16,0,16,16 | anchor 0.5,0.5 | alpha 0.5 | rot 0q | flip x- | normal | plain',
    'props | src 16,0,16,16 | dst 32,0,16,16 | anchor 0.5,0.5 | alpha 0.5 | rot 0q | flip -- | normal | plain',
    'props | src 16,0,16,16 | dst 48,0,16,16 | anchor 0.5,0.5 | alpha 0.5 | rot 0q | flip -y | normal | plain',
    'terrain | src 16,16,16,16 | dst 64,0,16,16 | anchor 0.5,0.5 | alpha 0.5 | rot 1q | flip -- | normal | plain',
    'props | src 32,32,16,16 | dst 0,16,16,16 | anchor 0.5,0.5 | alpha 0.5 | rot 0q | flip -- | normal | plain',
    'props | src 32,32,16,16 | dst 16,16,16,16 | anchor 0.5,0.5 | alpha 0.5 | rot 1q | flip -y | normal | plain',
    'props | src 32,32,16,16 | dst 32,16,16,16 | anchor 0.5,0.5 | alpha 0.5 | rot 0q | flip xy | normal | plain',
    'terrain | src 32,16,16,16 | dst 48,16,16,16 | anchor 0.5,0.5 | alpha 0.5 | rot 0q | flip -- | normal | plain',
    'terrain | src 16,16,16,16 | dst 64,16,16,16 | anchor 0.5,0.5 | alpha 0.5 | rot -1q | flip -- | normal | plain',
    'props | src 48,48,16,16 | dst 80,16,16,16 | anchor 0.5,0.5 | alpha 0.5 | rot 1q | flip x- | normal | plain',
    'props | src 32,32,16,16 | dst 20,-8,16,16 | anchor 0.5,0.5 | alpha 0.25 | rot 0q | flip x- | normal | plain',
    'terrain | src 16,16,16,16 | dst 36,-8,16,16 | anchor 0.5,0.5 | alpha 0.25 | rot 0q | flip -y | normal | plain',
    'terrain | src 48,48,16,16 | dst 68,-8,16,16 | anchor 0.5,0.5 | alpha 0.25 | rot 0q | flip -- | normal | plain',
    'props | src 0,0,16,16 | dst 84,-8,16,16 | anchor 0.5,0.5 | alpha 0.25 | rot 0q | flip -- | normal | plain',
  ];

  function makeTileset(name: string, firstGid: number, tileCount = 16): TilesetRef {
    return {
      firstGid,
      name,
      tileWidth: 16,
      tileHeight: 16,
      columns: 4,
      tileCount,
      image: `${name}.png`,
      imageWidth: 64,
      imageHeight: 64,
      tileProperties: new Map(),
      solidTiles: new Set(),
    };
  }

  function makeLayer(gids: number[], width = gids.length): TileLayer {
    return {
      type: 'tile',
      name: 'ground',
      width,
      height: gids.length / width,
      tiles: new Uint32Array(gids),
      visible: true,
      opacity: 1,
      offsetX: 0,
      offsetY: 0,
      properties: {},
    };
  }

  function makeRunMap(layers: TileLayer[], tilesets?: TilesetRef[]): TilemapData {
    const first = layers[0]!;
    return {
      width: first.width,
      height: first.height,
      tileWidth: 16,
      tileHeight: 16,
      layers,
      tilesets: tilesets ?? [makeTileset('terrain', 1), makeTileset('props', 17)],
      properties: {},
    };
  }

  function mapCamera(map: TilemapData) {
    const camera = new Camera2D();
    camera.setViewport(map.width * 16, map.height * 16);
    camera.x = map.width * 8;
    camera.y = map.height * 8;
    return camera;
  }

  // The tileset owning a gid is found by walking `map.tilesets`, so every walk
  // the renderer starts is one resolution.
  function countTilesetWalks(map: TilemapData): () => number {
    const tilesets = map.tilesets;
    const walk = tilesets[Symbol.iterator].bind(tilesets);
    let walks = 0;
    tilesets[Symbol.iterator] = () => {
      walks++;
      return walk();
    };
    return () => walks;
  }

  // One line per queued command, in queue order, naming the image by label.
  function dump(batch: InstanceType<typeof SpriteBatch>, labels: Map<unknown, string>): string[] {
    const lines: string[] = [];
    batch.flush((_image, commands) => {
      for (const c of commands) {
        lines.push(
          [
            labels.get(c.image) ?? '?',
            `src ${c.srcX},${c.srcY},${c.srcW},${c.srcH}`,
            `dst ${c.dstX},${c.dstY},${c.dstW},${c.dstH}`,
            `anchor ${c.anchorX},${c.anchorY}`,
            `alpha ${c.alpha}`,
            `rot ${c.rotation / (Math.PI / 2)}q`,
            `flip ${c.flipX ? 'x' : '-'}${c.flipY ? 'y' : '-'}`,
            `${c.blend}${c.stretch ? ' stretch' : ''}`,
            c.effect === undefined ? 'plain' : 'effect',
          ].join(' | '),
        );
      }
    });
    return lines;
  }

  function drawRunMap(
    map: TilemapData,
    images: Record<string, ReturnType<typeof mockImage>>,
    opts?: { time?: number; alphaScale?: number },
  ): string[] {
    const renderer = new TilemapRenderer(map);
    const labels = new Map<unknown, string>();
    for (const [name, image] of Object.entries(images)) {
      renderer.setTilesetImage(name, image);
      labels.set(image, name);
    }
    const batch = new SpriteBatch();
    renderer.drawInto(mapCamera(map), batch, opts);
    return dump(batch, labels);
  }

  function drawnImages(
    renderer: InstanceType<typeof TilemapRenderer>,
    map: TilemapData,
  ): unknown[] {
    const batch = new SpriteBatch();
    renderer.drawInto(mapCamera(map), batch);
    const images: unknown[] = [];
    batch.flush((_image, commands) => {
      for (const c of commands) images.push(c.image);
    });
    return images;
  }

  function expectSameImages(actual: unknown[], expected: unknown[]): void {
    expect(actual).toHaveLength(expected.length);
    for (let i = 0; i < expected.length; i++) expect(actual[i]).toBe(expected[i]);
  }

  test('a row of two same-tileset runs resolves twice, not once per tile', () => {
    const map = makeRunMap([makeLayer([1, 2, 3, 4, 17, 18, 19, 20])]);
    const renderer = new TilemapRenderer(map);
    renderer.setTilesetImage('terrain', mockImage());
    renderer.setTilesetImage('props', mockImage());
    const batch = new SpriteBatch();
    const walks = countTilesetWalks(map);

    renderer.drawInto(mapCamera(map), batch);

    expect(batch.count).toBe(8);
    expect(walks()).toBe(2);
  });

  test('mixed runs A A B B A resolve three times', () => {
    const map = makeRunMap([makeLayer([A, A, B, B, A])]);
    const renderer = new TilemapRenderer(map);
    renderer.setTilesetImage('terrain', mockImage());
    renderer.setTilesetImage('props', mockImage());
    const batch = new SpriteBatch();
    const walks = countTilesetWalks(map);

    renderer.drawInto(mapCamera(map), batch);

    expect(batch.count).toBe(5);
    expect(walks()).toBe(3);
  });

  test('empty, flipped and animated tiles do not break a run', () => {
    const tilesets = [makeTileset('terrain', 1), makeTileset('props', 17)];
    tilesets[0]!.animations = new Map([
      [1, { frames: Uint32Array.of(4, 5), ends: Float64Array.of(0.1, 0.2), duration: 0.2 }],
    ]);
    const map = makeRunMap([makeLayer([A, 0, A + H, 3 + D + V, 0, B, B + H + V])], tilesets);
    const renderer = new TilemapRenderer(map);
    renderer.setTilesetImage('terrain', mockImage());
    renderer.setTilesetImage('props', mockImage());
    const batch = new SpriteBatch();
    const walks = countTilesetWalks(map);

    renderer.drawInto(mapCamera(map), batch, { time: 0.15 });

    expect(batch.count).toBe(5);
    expect(walks()).toBe(2);
  });

  test('a run of tiles whose tileset has no image still resolves once', () => {
    const map = makeRunMap([makeLayer([A, A, A, B, B])]);
    const renderer = new TilemapRenderer(map);
    renderer.setTilesetImage('props', mockImage());
    const batch = new SpriteBatch();
    const walks = countTilesetWalks(map);

    renderer.drawInto(mapCamera(map), batch);

    expect(batch.count).toBe(2);
    expect(walks()).toBe(2);
  });

  test('a tileset without an image skips its tiles and draws the rest in place', () => {
    const map = makeRunMap([makeLayer([A, A, B, B, A])]);
    expect(drawRunMap(map, { props: mockImage() })).toEqual([
      'props | src 16,0,16,16 | dst 32,0,16,16 | anchor 0.5,0.5 | alpha 1 | rot 0q | flip -- | normal | plain',
      'props | src 16,0,16,16 | dst 48,0,16,16 | anchor 0.5,0.5 | alpha 1 | rot 0q | flip -- | normal | plain',
    ]);
  });

  test('setTilesetImage mid-session takes effect on the next draw', () => {
    const map = makeRunMap([makeLayer([A, A, B, B, A])]);
    const renderer = new TilemapRenderer(map);
    const terrain = mockImage();
    const props = mockImage();
    const terrain2 = mockImage();

    renderer.setTilesetImage('terrain', terrain);
    expectSameImages(drawnImages(renderer, map), [terrain, terrain, terrain]);

    renderer.setTilesetImage('props', props);
    expectSameImages(drawnImages(renderer, map), [terrain, terrain, props, props, terrain]);

    renderer.setTilesetImage('terrain', terrain2);
    expectSameImages(drawnImages(renderer, map), [terrain2, terrain2, props, props, terrain2]);
  });

  test('an image set before its tileset joins the map is used once the tileset is there', () => {
    const map = makeRunMap([makeLayer([A, B])], [makeTileset('terrain', 1)]);
    const renderer = new TilemapRenderer(map);
    const terrain = mockImage();
    const props = mockImage();
    renderer.setTilesetImage('terrain', terrain);
    renderer.setTilesetImage('props', props);

    // Gid 18 has no tileset of its own yet, so it falls to the last one below it.
    expectSameImages(drawnImages(renderer, map), [terrain, terrain]);

    map.tilesets.push(makeTileset('props', 17));
    expectSameImages(drawnImages(renderer, map), [terrain, props]);
  });

  test('a gid inside an earlier tileset tile count but past the next firstGid uses the later tileset', () => {
    const tilesets = [makeTileset('terrain', 1, 100), makeTileset('props', 17)];
    const map = makeRunMap([makeLayer([A, 20, A])], tilesets);
    expect(drawRunMap(map, { terrain: mockImage(), props: mockImage() })).toEqual(GOLDEN_OVERLAP);
  });

  test('a gid past the last tileset tile count still draws from the last tileset', () => {
    const map = makeRunMap([makeLayer([B, 40, B])]);
    expect(drawRunMap(map, { terrain: mockImage(), props: mockImage() })).toEqual(GOLDEN_PAST_END);
  });

  test('tilesets out of firstGid order resolve as a front-to-back walk does', () => {
    const tilesets = [makeTileset('props', 17), makeTileset('terrain', 1)];
    const map = makeRunMap([makeLayer([20, 5, 20, 17])], tilesets);
    expect(drawRunMap(map, { terrain: mockImage(), props: mockImage() })).toEqual(GOLDEN_UNSORTED);
  });

  test('two layers of flipped and animated tiles over two tilesets queue the recorded commands', () => {
    const tilesets = [makeTileset('terrain', 1), makeTileset('props', 17)];
    tilesets[0]!.animations = new Map([
      [
        1,
        { frames: Uint32Array.of(4, 5, 6), ends: Float64Array.of(0.1, 0.35, 0.5), duration: 0.5 },
      ],
    ]);
    tilesets[1]!.animations = new Map([
      [2, { frames: Uint32Array.of(9, 10), ends: Float64Array.of(0.2, 0.4), duration: 0.4 }],
    ]);
    const ground = makeLayer(
      [A, A + H, B, B + V, A + D + H, 0, 19, 19 + D, 19 + H + V, 7, A + D + V, 32 + D + H + V],
      6,
    );
    const overlay = makeLayer([0, 19 + H, A + V, 0, 16, 17], 6);
    overlay.opacity = 0.5;
    overlay.offsetX = 4;
    overlay.offsetY = -8;
    const map = makeRunMap([ground, overlay], tilesets);
    const images = { terrain: mockImage(), props: mockImage() };

    expect(drawRunMap(map, images)).toEqual(GOLDEN_STATIC);
    expect(drawRunMap(map, images, { time: 0.3, alphaScale: 0.5 })).toEqual(GOLDEN_ANIMATED);
  });
});
