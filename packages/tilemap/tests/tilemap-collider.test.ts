import { describe, expect, test } from 'bun:test';
import { extractColliders } from '../src/tilemap-collider.js';
import type { TileLayer, TilemapData, TilesetRef } from '../src/tilemap-data.js';

function makeSolidMap(): TilemapData {
  // 4x3 grid, tiles 1-12
  // Tileset: tiles 0 and 2 are solid (GIDs 1 and 3)
  const tiles = new Uint32Array([1, 2, 3, 0, 5, 6, 7, 8, 9, 10, 11, 12]);
  const layer: TileLayer = {
    type: 'tile',
    name: 'ground',
    width: 4,
    height: 3,
    tiles,
    visible: true,
    opacity: 1,
    offsetX: 0,
    offsetY: 0,
    properties: {},
  };

  const solidTiles = new Set([0, 2]); // local IDs 0 and 2 are solid

  const tileset: TilesetRef = {
    firstGid: 1,
    name: 'tiles',
    tileWidth: 16,
    tileHeight: 16,
    columns: 4,
    tileCount: 16,
    image: 'tiles.png',
    imageWidth: 64,
    imageHeight: 64,
    tileProperties: new Map(),
    solidTiles,
  };

  return {
    width: 4,
    height: 3,
    tileWidth: 16,
    tileHeight: 16,
    layers: [layer],
    tilesets: [tileset],
    properties: {},
  };
}

describe('extractColliders', () => {
  test('extracts colliders for solid tiles', () => {
    const map = makeSolidMap();
    const colliders = extractColliders(map);

    // Solid local IDs: 0, 2
    // GID 1 = local 0 (solid) → at (0,0)
    // GID 2 = local 1 (not solid)
    // GID 3 = local 2 (solid) → at (2,0)
    // GID 0 = empty → skipped
    // GID 5 = local 4 (not solid)
    // etc.
    expect(colliders).toHaveLength(2);
  });

  test('collider positions are tile centers', () => {
    const map = makeSolidMap();
    const colliders = extractColliders(map);

    // GID 1 at col=0, row=0: center = (8, 8)
    const c0 = colliders.find((c) => c.col === 0 && c.row === 0);
    expect(c0).toBeDefined();
    expect(c0!.x).toBe(8); // 0*16 + 16*0.5
    expect(c0!.y).toBe(8);

    // GID 3 at col=2, row=0: center = (40, 8)
    const c1 = colliders.find((c) => c.col === 2 && c.row === 0);
    expect(c1).toBeDefined();
    expect(c1!.x).toBe(40); // 2*16 + 8
    expect(c1!.y).toBe(8);
  });

  test('collider shapes are AABB with tile dimensions', () => {
    const map = makeSolidMap();
    const colliders = extractColliders(map);
    for (const c of colliders) {
      expect(c.shape.type).toBe('aabb');
      expect(c.shape.hw).toBe(8); // 16/2
      expect(c.shape.hh).toBe(8);
    }
  });

  test('filters by layer name', () => {
    const map = makeSolidMap();
    // Add another layer that has no solid tiles
    const layer2: TileLayer = {
      type: 'tile',
      name: 'decoration',
      width: 4,
      height: 3,
      tiles: new Uint32Array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]), // all GID 1 (solid)
      visible: true,
      opacity: 1,
      offsetX: 0,
      offsetY: 0,
      properties: {},
    };
    map.layers.push(layer2);

    // Only extract from 'ground' layer
    const groundColliders = extractColliders(map, 'ground');
    expect(groundColliders).toHaveLength(2);

    // Extract from 'decoration' layer — all 12 are GID 1 (local 0, solid)
    const decoColliders = extractColliders(map, 'decoration');
    expect(decoColliders).toHaveLength(12);
  });

  test('returns empty array when no solid tiles', () => {
    const map = makeSolidMap();
    // Clear solid tiles
    map.tilesets[0]!.solidTiles.clear();
    const colliders = extractColliders(map);
    expect(colliders).toHaveLength(0);
  });

  test('applies layer offset to positions', () => {
    const map = makeSolidMap();
    (map.layers[0] as TileLayer).offsetX = 100;
    (map.layers[0] as TileLayer).offsetY = 50;
    const colliders = extractColliders(map);

    const c0 = colliders.find((c) => c.col === 0 && c.row === 0);
    expect(c0!.x).toBe(108); // 0*16 + 8 + 100
    expect(c0!.y).toBe(58); // 0*16 + 8 + 50
  });

  test('stores gid on colliders', () => {
    const map = makeSolidMap();
    const colliders = extractColliders(map);
    const c0 = colliders.find((c) => c.col === 0 && c.row === 0);
    expect(c0!.gid).toBe(1);
    const c1 = colliders.find((c) => c.col === 2 && c.row === 0);
    expect(c1!.gid).toBe(3);
  });
});

describe('extractColliders — flip-bit regression', () => {
  // Tileset layout: tileset1 firstGid=1 tileCount=10 (no solids),
  //                 tileset2 firstGid=11 tileCount=10 (local id 2 = solid → GID 13).
  // A flipped variant of GID 13 (unsigned: 13 + 0x80000000 = 2147483661) is placed in the layer.
  // Uses arithmetic addition (+) to represent the real Tiled on-disk form (positive float64).

  function makeFlippedMap(): TilemapData {
    const ts1: TilesetRef = {
      firstGid: 1,
      name: 'terrain',
      tileWidth: 16,
      tileHeight: 16,
      columns: 5,
      tileCount: 10,
      image: 'terrain.png',
      imageWidth: 80,
      imageHeight: 32,
      tileProperties: new Map(),
      solidTiles: new Set(),
    };
    const ts2: TilesetRef = {
      firstGid: 11,
      name: 'props',
      tileWidth: 16,
      tileHeight: 16,
      columns: 5,
      tileCount: 10,
      image: 'props.png',
      imageWidth: 80,
      imageHeight: 32,
      tileProperties: new Map(),
      solidTiles: new Set([2]), // local id 2 is solid → GID 13
    };

    const flippedGid = 13 + 0x80000000; // H-flipped GID 13 (props, local 2) — real unsigned Tiled value
    const layer: TileLayer = {
      type: 'tile',
      name: 'ground',
      width: 3,
      height: 1,
      tiles: new Uint32Array([1, flippedGid, 0]), // terrain (not solid), flipped-solid, empty
      visible: true,
      opacity: 1,
      offsetX: 0,
      offsetY: 0,
      properties: {},
    };

    return {
      width: 3,
      height: 1,
      tileWidth: 16,
      tileHeight: 16,
      layers: [layer],
      tilesets: [ts1, ts2],
      properties: {},
    };
  }

  test('flipped solid tile in tileset #2 resolves to tileset #2 (not #1)', () => {
    const map = makeFlippedMap();
    const colliders = extractColliders(map);
    expect(colliders).toHaveLength(1);
    expect(colliders[0]!.col).toBe(1);
  });

  test('collider gid is the masked (stripped) gid', () => {
    const map = makeFlippedMap();
    const colliders = extractColliders(map);
    // Stored gid must be the real id (flip bits stripped) so downstream lookups work
    expect(colliders[0]!.gid).toBe(13);
  });

  test('collider position is correct for the flipped tile', () => {
    const map = makeFlippedMap();
    const colliders = extractColliders(map);
    // col=1, row=0: center = (1*16 + 8, 0*16 + 8) = (24, 8)
    expect(colliders[0]!.x).toBe(24);
    expect(colliders[0]!.y).toBe(8);
  });
});
