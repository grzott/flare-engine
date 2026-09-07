import { describe, expect, test } from 'bun:test';
import type { TileLayer, TilesetRef } from '../src/tilemap-data.js';
import {
  createTilemapData,
  decodeGidFlags,
  GID_FLIP_MASK,
  getTileAt,
  getTileSourceRect,
  getTileSourceRectInto,
  getTilesetForGid,
  stripGidFlags,
} from '../src/tilemap-data.js';

describe('tilemap-data', () => {
  test('createTilemapData returns empty map', () => {
    const map = createTilemapData(10, 8, 16, 16);
    expect(map.width).toBe(10);
    expect(map.height).toBe(8);
    expect(map.tileWidth).toBe(16);
    expect(map.tileHeight).toBe(16);
    expect(map.layers).toHaveLength(0);
    expect(map.tilesets).toHaveLength(0);
    expect(map.properties).toEqual({});
  });

  test('getTileAt returns correct GID', () => {
    const layer: TileLayer = {
      type: 'tile',
      name: 'ground',
      width: 3,
      height: 2,
      tiles: new Uint32Array([1, 2, 3, 4, 5, 6]),
      visible: true,
      opacity: 1,
      offsetX: 0,
      offsetY: 0,
      properties: {},
    };
    expect(getTileAt(layer, 0, 0)).toBe(1);
    expect(getTileAt(layer, 2, 0)).toBe(3);
    expect(getTileAt(layer, 1, 1)).toBe(5);
  });

  test('getTileAt returns 0 for out-of-bounds', () => {
    const layer: TileLayer = {
      type: 'tile',
      name: 'ground',
      width: 2,
      height: 2,
      tiles: new Uint32Array([1, 2, 3, 4]),
      visible: true,
      opacity: 1,
      offsetX: 0,
      offsetY: 0,
      properties: {},
    };
    expect(getTileAt(layer, -1, 0)).toBe(0);
    expect(getTileAt(layer, 0, -1)).toBe(0);
    expect(getTileAt(layer, 2, 0)).toBe(0);
    expect(getTileAt(layer, 0, 2)).toBe(0);
  });

  test('getTilesetForGid finds correct tileset', () => {
    const tilesets: TilesetRef[] = [
      makeTileset('ground', 1, 100),
      makeTileset('objects', 101, 50),
      makeTileset('decorations', 151, 30),
    ];
    expect(getTilesetForGid(tilesets, 1)?.name).toBe('ground');
    expect(getTilesetForGid(tilesets, 100)?.name).toBe('ground');
    expect(getTilesetForGid(tilesets, 101)?.name).toBe('objects');
    expect(getTilesetForGid(tilesets, 151)?.name).toBe('decorations');
    expect(getTilesetForGid(tilesets, 180)?.name).toBe('decorations');
  });

  test('getTilesetForGid returns undefined for GID 0', () => {
    const tilesets: TilesetRef[] = [makeTileset('ground', 1, 100)];
    expect(getTilesetForGid(tilesets, 0)).toBeUndefined();
  });

  test('getTileSourceRect computes correct source rect', () => {
    const tileset = makeTileset('tiles', 1, 20, 16, 16, 5);
    // Local ID 0 → (0,0)
    const r0 = getTileSourceRect(tileset, 1);
    expect(r0).toEqual({ x: 0, y: 0, width: 16, height: 16 });
    // Local ID 4 → (4*16, 0) = col 4, row 0
    const r4 = getTileSourceRect(tileset, 5);
    expect(r4).toEqual({ x: 64, y: 0, width: 16, height: 16 });
    // Local ID 5 → col 0, row 1
    const r5 = getTileSourceRect(tileset, 6);
    expect(r5).toEqual({ x: 0, y: 16, width: 16, height: 16 });
    // Local ID 7 → col 2, row 1
    const r7 = getTileSourceRect(tileset, 8);
    expect(r7).toEqual({ x: 32, y: 16, width: 16, height: 16 });
  });

  test('getTileSourceRectInto writes into `out` with no allocation, and getTileSourceRect delegates to it', () => {
    const tileset = makeTileset('tiles', 1, 20, 16, 16, 5);
    const out = { x: 0, y: 0, width: 0, height: 0 };
    const result = getTileSourceRectInto(tileset, 5, out);
    expect(result).toBe(out);
    expect(out).toEqual({ x: 64, y: 0, width: 16, height: 16 });
    expect(getTileSourceRect(tileset, 5)).toEqual(out);
  });
});

describe('GID flip API', () => {
  test('GID_FLIP_MASK is 0x1fffffff', () => {
    expect(GID_FLIP_MASK).toBe(0x1fffffff);
  });

  test('stripGidFlags strips all high bits', () => {
    expect(stripGidFlags(19)).toBe(19);
    // Use arithmetic addition (+) to stay unsigned float64 — the real Tiled on-disk form.
    expect(stripGidFlags(19 + 0x80000000)).toBe(19); // H-flip: 2147483667
    expect(stripGidFlags(19 + 0x40000000)).toBe(19); // V-flip: 1073741843
    expect(stripGidFlags(19 + 0x20000000)).toBe(19); // D-flip:  536870931
    expect(stripGidFlags(19 + 0x80000000 + 0x40000000 + 0x20000000)).toBe(19); // all: 3758096403
  });

  test('decodeGidFlags: no flip bits → all false', () => {
    const f = decodeGidFlags(5);
    expect(f.horizontal).toBe(false);
    expect(f.vertical).toBe(false);
    expect(f.diagonal).toBe(false);
  });

  test('decodeGidFlags: H-flip bit → horizontal true', () => {
    // Real unsigned Tiled H-flip value: 2147483667 (positive float64).
    // JS `& FLIP_H` converts to int32 before testing; !== 0 is correct (never > 0 when bit is set).
    const f = decodeGidFlags(19 + 0x80000000);
    expect(f.horizontal).toBe(true);
    expect(f.vertical).toBe(false);
    expect(f.diagonal).toBe(false);
  });

  test('decodeGidFlags: V-flip bit → vertical true', () => {
    const f = decodeGidFlags(19 + 0x40000000);
    expect(f.horizontal).toBe(false);
    expect(f.vertical).toBe(true);
    expect(f.diagonal).toBe(false);
  });

  test('decodeGidFlags: D-flip bit → diagonal true', () => {
    const f = decodeGidFlags(19 + 0x20000000);
    expect(f.horizontal).toBe(false);
    expect(f.vertical).toBe(false);
    expect(f.diagonal).toBe(true);
  });

  test('decodeGidFlags: all flip bits → all true', () => {
    const f = decodeGidFlags(19 + 0x80000000 + 0x40000000 + 0x20000000);
    expect(f.horizontal).toBe(true);
    expect(f.vertical).toBe(true);
    expect(f.diagonal).toBe(true);
  });

  test('getTilesetForGid resolves flipped GID to correct tileset (regression)', () => {
    // 2147483667 is the real unsigned Tiled value (19 + 0x80000000).
    // Before B8, getTilesetForGid compared raw (unmasked) GIDs, so any value ≥ 2^31
    // had id > every firstGid yet still resolved — but negative int32 forms did NOT
    // (they compared less than firstGid=1). The mask at getTilesetForGid:143 fixes both.
    const terrain = makeTileset('terrain', 1, 16);
    const props = makeTileset('props', 17, 16);
    const flippedGid = 19 + 0x80000000; // 2147483667 — unsigned, as Tiled exports
    const result = getTilesetForGid([terrain, props], flippedGid);
    expect(result?.name).toBe('props');
  });

  test('getTileSourceRect returns same rect for flipped and unflipped GID', () => {
    const props = makeTileset('props', 17, 16, 16, 16, 4);
    const rect = getTileSourceRect(props, 19);
    const rectFlipped = getTileSourceRect(props, 19 + 0x80000000);
    expect(rectFlipped).toEqual(rect);
  });
});

function makeTileset(
  name: string,
  firstGid: number,
  tileCount: number,
  tileWidth = 16,
  tileHeight = 16,
  columns = 10,
): TilesetRef {
  return {
    firstGid,
    name,
    tileWidth,
    tileHeight,
    columns,
    tileCount,
    image: `${name}.png`,
    imageWidth: columns * tileWidth,
    imageHeight: Math.ceil(tileCount / columns) * tileHeight,
    tileProperties: new Map(),
    solidTiles: new Set(),
  };
}
