import { describe, expect, test } from 'bun:test';
import {
  createTilemapData,
  getTileAt,
  getTileSourceRect,
  getTilesetForGid,
} from '../src/tilemap-data.js';
import type { TileLayer, TilesetRef } from '../src/tilemap-data.js';

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
      tiles: [1, 2, 3, 4, 5, 6],
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
      tiles: [1, 2, 3, 4],
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
