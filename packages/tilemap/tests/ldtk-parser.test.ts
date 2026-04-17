import { describe, expect, test } from 'bun:test';
import { parseLDtk } from '../src/ldtk-parser.js';

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
      expect(layer.tiles).toEqual([1, 0, 1, 0, 1, 0]);
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
      // t + 1 for GID convention
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
