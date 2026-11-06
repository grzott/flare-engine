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

  test('TileLayer.tiles is a Uint32Array that preserves flip-bit GIDs', () => {
    // 0x80000000 (H-flip bit set) exceeds Float32Array's 24-bit mantissa —
    // Uint32Array is the only typed-array form that holds it exactly.
    const flippedGid = 5 + 0x80000000;
    const json = makeTiledJSON({
      layers: [
        {
          type: 'tilelayer',
          name: 'ground',
          width: 2,
          height: 1,
          data: [1, flippedGid],
          visible: true,
          opacity: 1,
        },
      ],
    });
    const map = parseTiled(json);
    const layer = map.layers[0]!;
    if (layer.type !== 'tile') throw new Error('expected a tile layer');
    expect(layer.tiles).toBeInstanceOf(Uint32Array);
    expect(layer.tiles[1]).toBe(flippedGid);
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

  test('throws TilemapParseError (not TypeError) for non-map input', () => {
    for (const bad of [{}, null, 'garbage', 42, { width: 4, height: 3 }]) {
      expect(() => parseTiled(bad)).toThrow(TilemapParseError);
    }
  });
});

describe('parseTiled — tile animations', () => {
  // A 4x4 tileset (tilecount 16) whose `tiles[]` carries the per-tile animation arrays.
  function withTiles(tiles: unknown[]) {
    return makeTiledJSON({
      tilesets: [
        {
          firstgid: 1,
          name: 'water',
          tilewidth: 16,
          tileheight: 16,
          columns: 4,
          tilecount: 16,
          image: 'water.png',
          imagewidth: 64,
          imageheight: 64,
          tiles,
        },
      ],
    });
  }

  function messageOf(json: unknown): string {
    try {
      parseTiled(json);
    } catch (e) {
      return (e as Error).message;
    }
    throw new Error('expected parseTiled to throw');
  }

  test('an animated tile yields frames, cumulative ends in seconds and the cycle duration', () => {
    const map = parseTiled(
      withTiles([
        {
          id: 3,
          animation: [
            { tileid: 3, duration: 100 },
            { tileid: 7, duration: 250 },
            { tileid: 11, duration: 150 },
          ],
        },
      ]),
    );
    const ts = map.tilesets[0]!;
    const anim = ts.animations!.get(3)!;
    expect(anim.frames).toBeInstanceOf(Uint32Array);
    expect(Array.from(anim.frames)).toEqual([3, 7, 11]);
    expect(anim.ends).toBeInstanceOf(Float64Array);
    // Tiled durations are milliseconds; ends are cumulative seconds.
    expect(Array.from(anim.ends)).toEqual([0.1, 0.35, 0.5]);
    expect(anim.duration).toBe(0.5);
  });

  test('a one-frame animation registers with its single end equal to the duration', () => {
    const map = parseTiled(withTiles([{ id: 0, animation: [{ tileid: 5, duration: 1000 }] }]));
    const anim = map.tilesets[0]!.animations!.get(0)!;
    expect(Array.from(anim.frames)).toEqual([5]);
    expect(Array.from(anim.ends)).toEqual([1]);
    expect(anim.duration).toBe(1);
  });

  test('animated tiles keep their properties and solid flag', () => {
    const map = parseTiled(
      withTiles([
        {
          id: 2,
          type: 'solid',
          properties: [{ name: 'damage', type: 'int', value: 4 }],
          animation: [
            { tileid: 2, duration: 200 },
            { tileid: 6, duration: 200 },
          ],
        },
      ]),
    );
    const ts = map.tilesets[0]!;
    expect(ts.solidTiles.has(2)).toBe(true);
    expect(ts.tileProperties.get(2)).toEqual({ damage: 4 });
    expect(Array.from(ts.animations!.get(2)!.frames)).toEqual([2, 6]);
  });

  test('a tileset without animated tiles has no animations field', () => {
    const map = parseTiled(
      withTiles([{ id: 1, properties: [{ name: 'solid', type: 'bool', value: true }] }]),
    );
    const ts = map.tilesets[0]!;
    expect('animations' in ts).toBe(false);
    expect(ts.animations).toBeUndefined();
  });

  test('an empty animation array is not registered', () => {
    const map = parseTiled(withTiles([{ id: 0, animation: [] }]));
    expect(map.tilesets[0]!.animations).toBeUndefined();
  });

  test('an animation whose durations sum to 0 is not registered', () => {
    const map = parseTiled(
      withTiles([
        {
          id: 0,
          animation: [
            { tileid: 0, duration: 0 },
            { tileid: 1, duration: 0 },
          ],
        },
        { id: 4, animation: [{ tileid: 4, duration: 100 }] },
      ]),
    );
    const animations = map.tilesets[0]!.animations!;
    expect(animations.has(0)).toBe(false);
    expect(animations.has(4)).toBe(true);
    expect(animations.size).toBe(1);
  });

  test('throws TilemapParseError for a frame tileid outside [0, tilecount)', () => {
    for (const tileid of [16, -1, 100]) {
      const bad = withTiles([
        {
          id: 2,
          animation: [
            { tileid: 2, duration: 100 },
            { tileid, duration: 100 },
          ],
        },
      ]);
      expect(() => parseTiled(bad)).toThrow(TilemapParseError);
      const message = messageOf(bad);
      expect(message).toContain('water');
      expect(message).toContain('tile 2');
      expect(message).toContain(String(tileid));
    }
  });

  test('throws TilemapParseError for a non-integer frame tileid', () => {
    for (const tileid of [1.5, Number.NaN, '3']) {
      const bad = withTiles([{ id: 0, animation: [{ tileid, duration: 100 }] }]);
      expect(() => parseTiled(bad)).toThrow(TilemapParseError);
      const message = messageOf(bad);
      expect(message).toContain('water');
      expect(message).toContain('tile 0');
    }
  });

  test('throws TilemapParseError for a negative frame duration', () => {
    const bad = withTiles([
      {
        id: 5,
        animation: [
          { tileid: 5, duration: 100 },
          { tileid: 6, duration: -1 },
        ],
      },
    ]);
    expect(() => parseTiled(bad)).toThrow(TilemapParseError);
    const message = messageOf(bad);
    expect(message).toContain('water');
    expect(message).toContain('tile 5');
    expect(message).toContain('-1');
  });

  test('throws TilemapParseError for a NaN or infinite frame duration', () => {
    // JSON cannot carry these, but parseTiled accepts in-memory objects.
    for (const duration of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const bad = withTiles([{ id: 5, animation: [{ tileid: 5, duration }] }]);
      expect(() => parseTiled(bad)).toThrow(TilemapParseError);
      const message = messageOf(bad);
      expect(message).toContain('water');
      expect(message).toContain('tile 5');
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
