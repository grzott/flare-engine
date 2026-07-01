import { describe, expect, test } from 'bun:test';
import {
  buildSolidGrid,
  isBlockedAABB,
  moveAndSlideInto,
} from '@flare-engine/physics';
import {
  extractColliders,
  parseTiled,
} from '@flare-engine/tilemap';
import {
  MAP_ART,
  TILE_SIZE,
  TILE_WALL,
  TILE_WATER,
  buildTiledMapJson,
  loadMap,
} from '../src/map';

const MAP_WIDTH = 20;
const MAP_HEIGHT = 12;
const PLAYER_HALF = 6;
// PLAYER_START from App.tsx: {x:40, y:88} -> tile col=2, row=5, char='.'
const PLAYER_X = 40;
const PLAYER_Y = 88;

describe('buildTiledMapJson', () => {
  test('produces correct shape, dimensions and known GIDs', () => {
    const json = buildTiledMapJson() as {
      width: number;
      height: number;
      tilewidth: number;
      tileheight: number;
      layers: Array<{ type: string; data: number[] }>;
      tilesets: Array<{ name: string; firstgid: number }>;
    };

    expect(json.width).toBe(MAP_WIDTH);
    expect(json.height).toBe(MAP_HEIGHT);
    expect(json.tilewidth).toBe(TILE_SIZE);
    expect(json.tileheight).toBe(TILE_SIZE);

    const layer = json.layers[0];
    expect(layer?.type).toBe('tilelayer');

    const data = layer?.data ?? [];
    // top-left corner (row=0, col=0) is '#' -> TILE_WALL = 2
    expect(data[0]).toBe(TILE_WALL);
    // top-right corner (row=0, col=19) is '#' -> TILE_WALL = 2
    expect(data[19]).toBe(TILE_WALL);
    // bottom-right corner (row=11, col=19) is '#' -> TILE_WALL = 2
    expect(data[11 * MAP_WIDTH + 19]).toBe(TILE_WALL);
    // row=1, col=9 is '~' -> TILE_WATER = 3
    expect(data[1 * MAP_WIDTH + 9]).toBe(TILE_WATER);

    expect(json.tilesets[0]?.name).toBe('tiles');
  });
});

describe('parseTiled round-trip', () => {
  test('produces correct TilemapData with solid tile marks', () => {
    const map = loadMap();

    expect(map.width).toBe(MAP_WIDTH);
    expect(map.height).toBe(MAP_HEIGHT);
    expect(map.tileWidth).toBe(TILE_SIZE);
    expect(map.tileHeight).toBe(TILE_SIZE);

    expect(map.layers.length).toBe(1);
    expect(map.layers[0]?.type).toBe('tile');

    expect(map.tilesets.length).toBe(1);
    expect(map.tilesets[0]?.name).toBe('tiles');

    // wall and water must be solid; localId = gid - firstGid
    // TILE_WALL=2 -> localId=1; TILE_WATER=3 -> localId=2
    const ts = map.tilesets[0];
    expect(ts?.solidTiles.has(TILE_WALL - 1)).toBe(true);
    expect(ts?.solidTiles.has(TILE_WATER - 1)).toBe(true);
    // grass (localId=0) is not solid
    expect(ts?.solidTiles.has(0)).toBe(false);
  });
});

describe('extractColliders', () => {
  test('all 4 map corners are solid; interior grass tile is not', () => {
    const map = loadMap();
    const colliders = extractColliders(map);

    const solidSet = new Set(colliders.map((c) => `${c.row},${c.col}`));

    // Border corners are '#' (wall)
    expect(solidSet.has('0,0')).toBe(true);
    expect(solidSet.has('0,19')).toBe(true);
    expect(solidSet.has('11,0')).toBe(true);
    expect(solidSet.has('11,19')).toBe(true);

    // Interior grass tile at row=5, col=5 -> '.' -> NOT solid
    expect(solidSet.has('5,5')).toBe(false);
  });
});

describe('buildSolidGrid + isBlockedAABB', () => {
  test('true inside a border wall AABB, false at PLAYER_START', () => {
    const map = loadMap();
    const grid = buildSolidGrid(
      map.width,
      map.height,
      TILE_SIZE,
      extractColliders(map),
    );

    // AABB centered at (8, 8) with hw=8, hh=8 covers only tile (col=0, row=0)
    // which is '#' (wall) -> blocked
    expect(isBlockedAABB(grid, 8, 8, 8, 8)).toBe(true);

    // Player start (40, 88) tile = col=2, row=5 = '.' (grass) -> not blocked
    expect(isBlockedAABB(grid, PLAYER_X, PLAYER_Y, PLAYER_HALF, PLAYER_HALF)).toBe(false);
  });
});

describe('moveAndSlideInto', () => {
  test('blocks x-movement into a wall; allows y-movement into open space', () => {
    const map = loadMap();
    const grid = buildSolidGrid(
      map.width,
      map.height,
      TILE_SIZE,
      extractColliders(map),
    );

    // Place entity just left of the right border wall (col=19 starts at x=304).
    // With hw=6 the entity's rightmost pixel is at x+6.
    // x=297: right edge = 303 (free). Move dx=10 -> right edge = 313 -> col=19 -> wall -> blocked.
    const wallBlockX = 297;
    const out1 = { x: wallBlockX, y: PLAYER_Y };
    moveAndSlideInto(grid, wallBlockX, PLAYER_Y, 10, 0, PLAYER_HALF, PLAYER_HALF, out1);
    expect(out1.x).toBe(wallBlockX); // x unchanged — wall blocks it
    expect(out1.y).toBe(PLAYER_Y);   // y unchanged — no dy

    // PLAYER_START position with dy=2 stays on grass -> movement applies
    const out2 = { x: PLAYER_X, y: PLAYER_Y };
    moveAndSlideInto(grid, PLAYER_X, PLAYER_Y, 0, 2, PLAYER_HALF, PLAYER_HALF, out2);
    expect(out2.x).toBe(PLAYER_X);       // x unchanged — no dx
    expect(out2.y).toBe(PLAYER_Y + 2);   // y advances
  });

  test('diagonal into top wall: free axis (x) advances, blocked axis (y) stays', () => {
    const map = loadMap();
    const grid = buildSolidGrid(
      map.width,
      map.height,
      TILE_SIZE,
      extractColliders(map),
    );

    // Player at (40, 22): tile col=2 row=1 ('.' grass), hh=6 -> top edge = 16 (free of row-0 wall).
    // dx=+2 (right, into open grass col=2-3 row=1): isBlocked(42, 22) -> col 2..2 row 1..1 -> '.' -> free -> x advances to 42.
    // dy=-10 (up, into top border wall row 0): isBlocked(42, 12) -> rows 0..1, cols 2..2 -> row 0 = '#' -> blocked -> y stays at 22.
    const startX = 40;
    const startY = 22;
    const out = { x: startX, y: startY };
    moveAndSlideInto(grid, startX, startY, 2, -10, PLAYER_HALF, PLAYER_HALF, out);
    expect(out.x).toBe(42); // free axis advances
    expect(out.y).toBe(22); // blocked axis stays
  });
});
