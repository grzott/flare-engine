import { describe, expect, test } from 'bun:test';
import { parseLDtk, parseLDtkEntities } from '../src/ldtk-parser.js';
import { TilemapParseError } from '../src/parse-error.js';
import { extractColliders } from '../src/tilemap-collider.js';
import { getTilesetForGid } from '../src/tilemap-data.js';
import { entitiesLdtk } from './fixtures/entities-ldtk.js';
import { twoTilesetIntGridLdtk } from './fixtures/two-tileset-intgrid.js';

describe('parseLDtk', () => {
  test('parses a single level', () => {
    const json = makeLDtkJSON();
    const maps = parseLDtk(json);
    expect(maps).toHaveLength(1);
    const map = maps[0]!;
    expect(map.width).toBe(10);
    expect(map.height).toBe(8);
    expect(map.tileWidth).toBe(16);
    expect(map.tileHeight).toBe(16);
  });

  test('parses IntGrid layers', () => {
    const json = makeLDtkJSON({
      levels: [
        makeLevel({
          layerInstances: [
            {
              __identifier: 'Collision',
              __type: 'IntGrid',
              __cWid: 3,
              __cHei: 2,
              __gridSize: 16,
              visible: true,
              __opacity: 1,
              intGridCsv: [1, 0, 1, 0, 1, 0],
            },
          ],
        }),
      ],
    });
    const map = parseLDtk(json)[0]!;
    expect(map.layers).toHaveLength(1);
    const layer = map.layers[0]!;
    expect(layer.type).toBe('tile');
    if (layer.type === 'tile') {
      expect(layer.name).toBe('Collision');
      expect(layer.tiles).toBeInstanceOf(Uint32Array);
      expect(Array.from(layer.tiles)).toEqual([1, 0, 1, 0, 1, 0]);
    }
  });

  test('parses Tiles layers', () => {
    const json = makeLDtkJSON({
      levels: [
        makeLevel({
          layerInstances: [
            {
              __identifier: 'Ground',
              __type: 'Tiles',
              __cWid: 3,
              __cHei: 2,
              __gridSize: 16,
              __tilesetDefUid: 1,
              __tilesetRelPath: 'tileset.png',
              visible: true,
              __opacity: 1,
              gridTiles: [
                { px: [0, 0], src: [0, 0], f: 0, t: 0 },
                { px: [16, 0], src: [16, 0], f: 0, t: 1 },
                { px: [32, 16], src: [32, 0], f: 0, t: 2 },
              ],
            },
          ],
        }),
      ],
    });
    const map = parseLDtk(json)[0]!;
    const layer = map.layers[0]!;
    expect(layer.type).toBe('tile');
    if (layer.type === 'tile') {
      expect(layer.name).toBe('Ground');
      expect(layer.tiles).toBeInstanceOf(Uint32Array);
      // firstGid fallback=1 (no matching def), so gid = 1 + t
      expect(layer.tiles[0]).toBe(1); // (0,0) → t=0 → gid=1
      expect(layer.tiles[1]).toBe(2); // (1,0) → t=1 → gid=2
      expect(layer.tiles[10 * 1 + 2]).toBe(3); // (2,1) → t=2 → gid=3
    }
  });

  test('parses Entities layers', () => {
    const json = makeLDtkJSON({
      levels: [
        makeLevel({
          layerInstances: [
            {
              __identifier: 'Entities',
              __type: 'Entities',
              __cWid: 10,
              __cHei: 8,
              __gridSize: 16,
              visible: true,
              __opacity: 1,
              entityInstances: [
                {
                  __identifier: 'Player',
                  __grid: [2, 3],
                  __pivot: [0.5, 0.5],
                  iid: 'abc',
                  width: 16,
                  height: 16,
                  px: [40, 56],
                  fieldInstances: [{ __identifier: 'health', __value: 100, __type: 'Int' }],
                },
              ],
            },
          ],
        }),
      ],
    });
    const map = parseLDtk(json)[0]!;
    const layer = map.layers[0]!;
    expect(layer.type).toBe('object');
    if (layer.type === 'object') {
      expect(layer.objects).toHaveLength(1);
      expect(layer.objects[0]!.name).toBe('Player');
      expect(layer.objects[0]!.x).toBe(40);
      expect(layer.objects[0]!.y).toBe(56);
      expect(layer.objects[0]!.properties.health).toBe(100);
    }
  });

  test('parses multiple levels', () => {
    const json = makeLDtkJSON({
      levels: [
        makeLevel({ identifier: 'Level_0' }),
        makeLevel({ identifier: 'Level_1', pxWid: 320, pxHei: 256 }),
      ],
    });
    const maps = parseLDtk(json);
    expect(maps).toHaveLength(2);
    expect(maps[1]!.width).toBe(20); // 320/16
    expect(maps[1]!.height).toBe(16); // 256/16
  });

  test('parses level field instances as properties', () => {
    const json = makeLDtkJSON({
      levels: [
        makeLevel({
          fieldInstances: [{ __identifier: 'biome', __value: 'forest', __type: 'String' }],
        }),
      ],
    });
    const map = parseLDtk(json)[0]!;
    expect(map.properties.biome).toBe('forest');
  });

  test('creates tileset refs for used tilesets', () => {
    const json = makeLDtkJSON({
      defs: {
        tilesets: [
          {
            uid: 1,
            identifier: 'Terrain',
            relPath: 'terrain.png',
            pxWid: 160,
            pxHei: 64,
            tileGridSize: 16,
            __cWid: 10,
            __cHei: 4,
          },
        ],
      },
      levels: [
        makeLevel({
          layerInstances: [
            {
              __identifier: 'Ground',
              __type: 'Tiles',
              __cWid: 10,
              __cHei: 8,
              __gridSize: 16,
              __tilesetDefUid: 1,
              __tilesetRelPath: 'terrain.png',
              visible: true,
              __opacity: 1,
              gridTiles: [],
            },
          ],
        }),
      ],
    });
    const map = parseLDtk(json)[0]!;
    expect(map.tilesets).toHaveLength(1);
    expect(map.tilesets[0]!.name).toBe('Terrain');
    expect(map.tilesets[0]!.tileWidth).toBe(16);
    expect(map.tilesets[0]!.columns).toBe(10);
    expect(map.tilesets[0]!.image).toBe('terrain.png');
  });

  test('reverses LDtk layer order (bottom-first)', () => {
    const json = makeLDtkJSON({
      levels: [
        makeLevel({
          layerInstances: [
            {
              __identifier: 'Foreground',
              __type: 'IntGrid',
              __cWid: 3,
              __cHei: 2,
              __gridSize: 16,
              visible: true,
              __opacity: 1,
              intGridCsv: [0, 0, 0, 0, 0, 0],
            },
            {
              __identifier: 'Background',
              __type: 'IntGrid',
              __cWid: 3,
              __cHei: 2,
              __gridSize: 16,
              visible: true,
              __opacity: 1,
              intGridCsv: [1, 1, 1, 1, 1, 1],
            },
          ],
        }),
      ],
    });
    const map = parseLDtk(json)[0]!;
    // Background should come first (bottom), Foreground second (top)
    expect(map.layers[0]!.name).toBe('Background');
    expect(map.layers[1]!.name).toBe('Foreground');
  });
});

describe('parseLDtk — two-tileset IntGrid fixture', () => {
  test('tilesets are assigned deterministic firstGids sorted by uid (ascending)', () => {
    const maps = parseLDtk(twoTilesetIntGridLdtk);
    const map = maps[0]!;
    // uid=1 (TileA) → firstGid=1; uid=7 (TileB) → firstGid=17; Walls → firstGid=33
    expect(map.tilesets[0]!.name).toBe('TileA');
    expect(map.tilesets[0]!.firstGid).toBe(1);
    expect(map.tilesets[1]!.name).toBe('TileB');
    expect(map.tilesets[1]!.firstGid).toBe(17);
    // Tilesets must be in ascending firstGid order for getTilesetForGid
    for (let i = 1; i < map.tilesets.length; i++) {
      expect(map.tilesets[i]!.firstGid).toBeGreaterThan(map.tilesets[i - 1]!.firstGid);
    }
  });

  test('TilesB tile stores correct absolute GID = 20, and firstGids are stable (core regression)', () => {
    const maps = parseLDtk(twoTilesetIntGridLdtk);
    const map = maps[0]!;
    // Deterministic uid-sort guarantees: TileA (uid=1) → firstGid=1, TileB (uid=7) → firstGid=17.
    // If sort were dropped and uids iterated as [7,1]: TileB gets firstGid=1, TileA gets firstGid=17.
    // Then TilesB tile t=3 → gid = 1+3 = 4 (wrong), not 20 (correct).
    // The VALUE assertion on the stored gid is what catches the regression —
    // getTilesetForGid(gid) alone would self-resolve to TileB regardless of ordering.
    expect(map.tilesets.find((t) => t.name === 'TileA')!.firstGid).toBe(1);
    expect(map.tilesets.find((t) => t.name === 'TileB')!.firstGid).toBe(17);

    const tilesBLayer = map.layers.find((l) => l.name === 'TilesB');
    expect(tilesBLayer?.type).toBe('tile');
    if (tilesBLayer?.type === 'tile') {
      const gid = tilesBLayer.tiles[0]!; // tile at (0,0), t=3
      expect(gid).toBe(20); // 17 + 3; if sort dropped: 1+3=4, failing here
      expect(getTilesetForGid(map.tilesets, gid)?.name).toBe('TileB');
    }
  });

  test('extractColliders returns non-empty list with correct wall count', () => {
    const maps = parseLDtk(twoTilesetIntGridLdtk);
    const map = maps[0]!;
    // intGridCsv=[1,2,0,1,0,2]: 4 non-zero cells → 4 colliders
    const colliders = extractColliders(map);
    expect(colliders.length).toBeGreaterThan(0);
    // Count comes from the Walls IntGrid layer (the only layer with solidTiles set)
    expect(colliders).toHaveLength(4);
  });

  test('intGridSolid predicate changes which cells are solid', () => {
    // Default predicate (v > 0): values 1 and 2 are both solid → 4 colliders
    const mapsDefault = parseLDtk(twoTilesetIntGridLdtk);
    const defaultCount = extractColliders(mapsDefault[0]!).length;

    // Custom predicate (v === 2): only value 2 is solid → 2 colliders
    const mapsCustom = parseLDtk(twoTilesetIntGridLdtk, { intGridSolid: (v) => v === 2 });
    const customCount = extractColliders(mapsCustom[0]!).length;

    expect(defaultCount).toBe(4);
    expect(customCount).toBe(2);
    expect(customCount).toBeLessThan(defaultCount);
  });
});

describe('parseLDtkEntities', () => {
  test('extracts two entities with correct id, position, size, and fields', () => {
    const map = parseLDtk(entitiesLdtk)[0]!;
    const entities = parseLDtkEntities(map);
    expect(entities).toHaveLength(2);

    const player = entities.find((e) => e.id === 'Player')!;
    expect(player.id).toBe('Player');
    expect(typeof player.id).toBe('string');
    expect(player.x).toBe(40);
    expect(player.y).toBe(56);
    expect(player.width).toBe(16);
    expect(player.height).toBe(16);
    expect(player.fields).toEqual({ health: 100 });

    const enemy = entities.find((e) => e.id === 'Enemy')!;
    expect(enemy.id).toBe('Enemy');
    expect(enemy.x).toBe(96);
    expect(enemy.y).toBe(32);
    expect(enemy.width).toBe(24);
    expect(enemy.height).toBe(24);
    expect(enemy.fields).toEqual({ patrol: true, speed: 40 });
  });

  test('skips tile layers — count stays 2, no spurious ids', () => {
    const map = parseLDtk(entitiesLdtk)[0]!;
    const entities = parseLDtkEntities(map);
    expect(entities).toHaveLength(2);
    expect(entities.every((e) => e.id === 'Player' || e.id === 'Enemy')).toBe(true);
  });

  test('returns empty array when no entity layers are present', () => {
    const map = parseLDtk(makeLDtkJSON())[0]!;
    expect(parseLDtkEntities(map)).toHaveLength(0);
  });
});

describe('parseLDtk — validation errors', () => {
  test('throws TilemapParseError for invalid input ({})', () => {
    expect(() => parseLDtk({})).toThrow(TilemapParseError);
    try {
      parseLDtk({});
    } catch (e) {
      expect((e as Error).message).toMatch(/LDtk/);
    }
  });

  test('throws TilemapParseError for externalLevels: true', () => {
    const bad = {
      externalLevels: true,
      defaultGridSize: 16,
      defs: { tilesets: [] },
      levels: [],
    };
    expect(() => parseLDtk(bad)).toThrow(TilemapParseError);
    try {
      parseLDtk(bad);
    } catch (e) {
      expect((e as Error).message).toMatch(/externalLevels/);
    }
  });
});

function makeLevel(overrides: Record<string, unknown> = {}) {
  return {
    identifier: 'Level_0',
    uid: 0,
    pxWid: 160,
    pxHei: 128,
    worldX: 0,
    worldY: 0,
    layerInstances: [],
    ...overrides,
  };
}

function makeLDtkJSON(overrides: Record<string, unknown> = {}) {
  return {
    defaultGridSize: 16,
    defs: { tilesets: [] },
    levels: [makeLevel()],
    ...overrides,
  };
}
