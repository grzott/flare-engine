import { describe, expect, test } from 'bun:test';
import { TilemapParseError } from '../src/parse-error.js';
import { parseTiled } from '../src/tiled-parser.js';
import { extractColliders } from '../src/tilemap-collider.js';
import { decodeGidFlags, getTilesetForGid } from '../src/tilemap-data.js';
import { twoTilesetFlippedTmj } from './fixtures/two-tileset-flipped.js';

describe('parseTiled', () => {
  test('parses a minimal orthogonal map', () => {
    const json = makeTiledJSON();
    const map = parseTiled(json);
    expect(map.width).toBe(4);
    expect(map.height).toBe(3);
    expect(map.tileWidth).toBe(16);
    expect(map.tileHeight).toBe(16);
  });

  test('parses map properties', () => {
    const json = makeTiledJSON({
      properties: [{ name: 'author', type: 'string', value: 'test' }],
    });
    const map = parseTiled(json);
    expect(map.properties.author).toBe('test');
  });

  test('parses tile layers', () => {
    const json = makeTiledJSON({
      layers: [
        {
          type: 'tilelayer',
          name: 'ground',
          width: 4,
          height: 3,
          data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          visible: true,
          opacity: 1,
        },
      ],
    });
    const map = parseTiled(json);
    expect(map.layers).toHaveLength(1);
    const layer = map.layers[0]!;
    expect(layer.type).toBe('tile');
    if (layer.type === 'tile') {
      expect(layer.name).toBe('ground');
      expect(layer.width).toBe(4);
      expect(layer.height).toBe(3);
      expect(layer.tiles).toHaveLength(12);
      expect(layer.tiles[0]).toBe(1);
      expect(layer.tiles[11]).toBe(12);
    }
  });

  test('parses tile layer offset', () => {
    const json = makeTiledJSON({
      layers: [
        {
          type: 'tilelayer',
          name: 'fg',
          width: 4,
          height: 3,
          data: new Array(12).fill(0),
          visible: true,
          opacity: 0.5,
          offsetx: 8,
          offsety: -4,
        },
      ],
    });
    const map = parseTiled(json);
    const layer = map.layers[0]!;
    if (layer.type === 'tile') {
      expect(layer.offsetX).toBe(8);
      expect(layer.offsetY).toBe(-4);
      expect(layer.opacity).toBe(0.5);
    }
  });

  test('parses object layers', () => {
    const json = makeTiledJSON({
      layers: [
        {
          type: 'objectgroup',
          name: 'entities',
          visible: true,
          opacity: 1,
          objects: [
            {
              id: 1,
              name: 'spawn',
              type: 'PlayerSpawn',
              x: 32,
              y: 48,
              width: 16,
              height: 16,
              rotation: 0,
              properties: [{ name: 'direction', type: 'string', value: 'right' }],
            },
          ],
        },
      ],
    });
    const map = parseTiled(json);
    expect(map.layers).toHaveLength(1);
    const layer = map.layers[0]!;
    expect(layer.type).toBe('object');
    if (layer.type === 'object') {
      expect(layer.objects).toHaveLength(1);
      expect(layer.objects[0]!.name).toBe('spawn');
      expect(layer.objects[0]!.type).toBe('PlayerSpawn');
      expect(layer.objects[0]!.x).toBe(32);
      expect(layer.objects[0]!.y).toBe(48);
      expect(layer.objects[0]!.properties.direction).toBe('right');
    }
  });

  test('parses tilesets', () => {
    const json = makeTiledJSON({
      tilesets: [
        {
          firstgid: 1,
          name: 'terrain',
          tilewidth: 16,
          tileheight: 16,
          columns: 10,
          tilecount: 40,
          image: 'terrain.png',
          imagewidth: 160,
          imageheight: 64,
        },
      ],
    });
    const map = parseTiled(json);
    expect(map.tilesets).toHaveLength(1);
    expect(map.tilesets[0]!.firstGid).toBe(1);
    expect(map.tilesets[0]!.name).toBe('terrain');
    expect(map.tilesets[0]!.columns).toBe(10);
    expect(map.tilesets[0]!.tileCount).toBe(40);
  });

  test('parses tileset solid tiles', () => {
    const json = makeTiledJSON({
      tilesets: [
        {
          firstgid: 1,
          name: 'tiles',
          tilewidth: 16,
          tileheight: 16,
          columns: 4,
          tilecount: 16,
          image: 'tiles.png',
          imagewidth: 64,
          imageheight: 64,
          tiles: [
            { id: 0, properties: [{ name: 'solid', type: 'bool', value: true }] },
            { id: 3, type: 'solid' },
            { id: 5, properties: [{ name: 'collision', type: 'bool', value: true }] },
          ],
        },
      ],
    });
    const map = parseTiled(json);
    const ts = map.tilesets[0]!;
    expect(ts.solidTiles.has(0)).toBe(true);
    expect(ts.solidTiles.has(3)).toBe(true);
    expect(ts.solidTiles.has(5)).toBe(true);
    expect(ts.solidTiles.has(1)).toBe(false);
  });

  test('parses tileset tile properties', () => {
    const json = makeTiledJSON({
      tilesets: [
        {
          firstgid: 1,
          name: 'tiles',
          tilewidth: 16,
          tileheight: 16,
          columns: 4,
          tilecount: 16,
          image: 'tiles.png',
          imagewidth: 64,
          imageheight: 64,
          tiles: [{ id: 2, properties: [{ name: 'damage', type: 'int', value: 10 }] }],
        },
      ],
    });
    const map = parseTiled(json);
    const ts = map.tilesets[0]!;
    expect(ts.tileProperties.get(2)).toEqual({ damage: 10 });
    expect(ts.tileProperties.has(0)).toBe(false);
  });

  test('sorts tilesets by firstGid', () => {
    const json = makeTiledJSON({
      tilesets: [
        {
          firstgid: 51,
          name: 'second',
          tilewidth: 16,
          tileheight: 16,
          columns: 4,
          tilecount: 16,
          image: 'b.png',
          imagewidth: 64,
          imageheight: 64,
        },
        {
          firstgid: 1,
          name: 'first',
          tilewidth: 16,
          tileheight: 16,
          columns: 4,
          tilecount: 50,
          image: 'a.png',
          imagewidth: 64,
          imageheight: 200,
        },
      ],
    });
    const map = parseTiled(json);
    expect(map.tilesets[0]!.name).toBe('first');
    expect(map.tilesets[1]!.name).toBe('second');
  });

  test('uses class field as type for objects', () => {
    const json = makeTiledJSON({
      layers: [
        {
          type: 'objectgroup',
          name: 'objs',
          visible: true,
          opacity: 1,
          objects: [
            { id: 1, name: 'npc', class: 'Enemy', x: 0, y: 0, width: 16, height: 16, rotation: 0 },
          ],
        },
      ],
    });
    const map = parseTiled(json);
    if (map.layers[0]!.type === 'object') {
      expect(map.layers[0]!.objects[0]!.type).toBe('Enemy');
    }
  });
});

describe('parseTiled — flip-bit fixture', () => {
  test('parses the two-tileset flipped fixture without error', () => {
    const map = parseTiled(twoTilesetFlippedTmj);
    expect(map.tilesets).toHaveLength(2);
    expect(map.tilesets[0]!.name).toBe('terrain');
    expect(map.tilesets[1]!.name).toBe('props');
  });

  test('flipped solid tile resolves to the correct tileset (props, not terrain)', () => {
    const map = parseTiled(twoTilesetFlippedTmj);
    const flippedGid = 19 + 0x80000000; // 2147483667 — unsigned, as Tiled exports
    const ts = getTilesetForGid(map.tilesets, flippedGid);
    expect(ts?.name).toBe('props');
  });

  test('extractColliders finds all five flipped solid tiles and no terrain tiles', () => {
    const map = parseTiled(twoTilesetFlippedTmj);
    const colliders = extractColliders(map);
    // 5 solid tiles: unflipped + H + V + D + all-flipped variants of GID 19
    expect(colliders).toHaveLength(5);
  });

  test('decodeGidFlags correctly identifies H-flipped GID', () => {
    const flippedH = 19 + 0x80000000; // 2147483667 — real unsigned Tiled value
    const f = decodeGidFlags(flippedH);
    expect(f.horizontal).toBe(true);
    expect(f.vertical).toBe(false);
    expect(f.diagonal).toBe(false);
  });

  test('decodeGidFlags correctly identifies V-flipped GID', () => {
    const flippedV = 19 + 0x40000000; // 1073741843
    const f = decodeGidFlags(flippedV);
    expect(f.horizontal).toBe(false);
    expect(f.vertical).toBe(true);
    expect(f.diagonal).toBe(false);
  });

  test('all collider gids are the masked GID (19)', () => {
    const map = parseTiled(twoTilesetFlippedTmj);
    const colliders = extractColliders(map);
    for (const c of colliders) {
      expect(c.gid).toBe(19);
    }
  });
});

describe('parseTiled — validation errors', () => {
  test('throws TilemapParseError for infinite maps', () => {
    const bad = makeTiledJSON({ infinite: true });
    expect(() => parseTiled(bad)).toThrow(TilemapParseError);
    try {
      parseTiled(bad);
    } catch (e) {
      expect((e as Error).message).toMatch(/[Ii]nfinite/);
    }
  });

  test('throws TilemapParseError for non-orthogonal orientation', () => {
    const bad = makeTiledJSON({ orientation: 'isometric' });
    expect(() => parseTiled(bad)).toThrow(TilemapParseError);
    try {
      parseTiled(bad);
    } catch (e) {
      expect((e as Error).message).toMatch(/orthogonal/);
    }
  });

  test('throws TilemapParseError for external tileset (source field present)', () => {
    const bad = makeTiledJSON({
      tilesets: [{ firstgid: 1, source: 'terrain.tsj' }],
    });
    expect(() => parseTiled(bad)).toThrow(TilemapParseError);
    try {
      parseTiled(bad);
    } catch (e) {
      expect((e as Error).message).toMatch(/embed/i);
    }
  });

  test('throws TilemapParseError for base64-encoded layer (encoding: base64)', () => {
    const bad = makeTiledJSON({
      layers: [
        {
          type: 'tilelayer',
          name: 'ground',
          width: 4,
          height: 3,
          data: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
          encoding: 'base64',
          visible: true,
          opacity: 1,
        },
      ],
    });
    expect(() => parseTiled(bad)).toThrow(TilemapParseError);
    try {
      parseTiled(bad);
    } catch (e) {
      expect((e as Error).message).toMatch(/CSV/);
    }
  });

  test('throws TilemapParseError for group layer (unsupported type)', () => {
    const bad = makeTiledJSON({
      layers: [{ type: 'group', name: 'myGroup', layers: [] }],
    });
    expect(() => parseTiled(bad)).toThrow(TilemapParseError);
    try {
      parseTiled(bad);
    } catch (e) {
      expect((e as Error).message).toMatch(/unsupported/i);
      expect((e as Error).message).toContain('group');
    }
  });

  test('throws TilemapParseError for imagelayer (unsupported type)', () => {
    const bad = makeTiledJSON({
      layers: [{ type: 'imagelayer', name: 'bg', image: 'bg.png' }],
    });
    expect(() => parseTiled(bad)).toThrow(TilemapParseError);
    try {
      parseTiled(bad);
    } catch (e) {
      expect((e as Error).message).toMatch(/unsupported/i);
      expect((e as Error).message).toContain('imagelayer');
    }
  });
});

function makeTiledJSON(overrides: Record<string, unknown> = {}) {
  return {
    width: 4,
    height: 3,
    tilewidth: 16,
    tileheight: 16,
    orientation: 'orthogonal',
    layers: [],
    tilesets: [],
    ...overrides,
  };
}
