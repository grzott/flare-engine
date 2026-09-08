import { describe, expect, test } from 'bun:test';
import {
  buildSolidGrid,
  isBlockedAABB,
  moveAndSlideInto,
} from '@flare-engine/physics';
import {
  extractColliders,
} from '@flare-engine/tilemap';
import {
  DOOR_COL,
  DOOR_ROW,
  DOOR_WORLD_X,
  DOOR_WORLD_Y,
  TILE_DOOR_CLOSED,
  TILE_DOOR_OPEN,
  TILE_ROCK,
  TILE_SIZE,
  TILE_WALL,
  buildTiledMapJson,
  isTouchingDoor,
  loadMap,
  openDoor,
} from '../src/map';

const MAP_WIDTH = 12;
const MAP_HEIGHT = 10;
const PLAYER_HALF = 6;
// PLAYER_START from App.tsx: {x:24, y:152} -> tile col=1, row=9, char='.'
const PLAYER_X = 24;
const PLAYER_Y = 152;

// House top wall (row=1, col=4). World center = (4*16+8, 1*16+8).
const WALL_X = 72;
const WALL_Y = 24;

// Rock at (row=3, col=2). World center = (2*16+8, 3*16+8).
const ROCK_X = 40;
const ROCK_Y = 56;

/** Load a fresh map + ground layer + solid grid for one test — every test
 *  gets its own SolidGrid so openDoor in one test cannot leak into another. */
function setup() {
  const map = loadMap();
  const groundLayer = map.layers[0];
  if (groundLayer === undefined || groundLayer.type !== 'tile') {
    throw new Error('expected a tile layer at index 0');
  }
  const grid = buildSolidGrid(map.width, map.height, TILE_SIZE, extractColliders(map));
  return { map, groundLayer, grid };
}

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
    // House top wall corner (row=1, col=4) -> '#' -> TILE_WALL
    expect(data[1 * MAP_WIDTH + 4]).toBe(TILE_WALL);
    // Rock (row=3, col=2) -> 'R' -> TILE_ROCK
    expect(data[3 * MAP_WIDTH + 2]).toBe(TILE_ROCK);
    // Door (row=8, col=5) -> 'D' -> starts closed
    expect(data[DOOR_ROW * MAP_WIDTH + DOOR_COL]).toBe(TILE_DOOR_CLOSED);

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
    const ts = map.tilesets[0];
    expect(ts?.name).toBe('tiles');

    // wall, rock, and the closed door must be solid; localId = gid - firstGid
    expect(ts?.solidTiles.has(TILE_WALL - 1)).toBe(true);
    expect(ts?.solidTiles.has(TILE_ROCK - 1)).toBe(true);
    expect(ts?.solidTiles.has(TILE_DOOR_CLOSED - 1)).toBe(true);
    // grass (localId=0) is not solid
    expect(ts?.solidTiles.has(0)).toBe(false);
  });
});

describe('extractColliders', () => {
  test('house walls, rocks, and the closed door are solid; interior floor is not', () => {
    const map = loadMap();
    const colliders = extractColliders(map);
    const solidSet = new Set(colliders.map((c) => `${c.row},${c.col}`));

    // House top wall corner and a rock
    expect(solidSet.has('1,4')).toBe(true);
    expect(solidSet.has('3,2')).toBe(true);
    // Closed door
    expect(solidSet.has(`${DOOR_ROW},${DOOR_COL}`)).toBe(true);
    // Interior floor tile (row=4, col=5)
    expect(solidSet.has('4,5')).toBe(false);
  });
});

describe('isTouchingDoor', () => {
  test('true when the AABB overlaps the door tile, false far away', () => {
    expect(isTouchingDoor(DOOR_WORLD_X, DOOR_WORLD_Y, PLAYER_HALF, PLAYER_HALF)).toBe(true);
    expect(isTouchingDoor(PLAYER_X, PLAYER_Y, PLAYER_HALF, PLAYER_HALF)).toBe(false);
  });
});

describe('openDoor', () => {
  test('flips the solid-grid cell and swaps the tile GID', () => {
    const { groundLayer, grid } = setup();
    const idx = DOOR_ROW * grid.width + DOOR_COL;

    expect(grid.solid[idx]).toBe(1);
    expect(groundLayer.tiles[idx]).toBe(TILE_DOOR_CLOSED);

    openDoor(groundLayer, grid);

    expect(grid.solid[idx]).toBe(0);
    expect(groundLayer.tiles[idx]).toBe(TILE_DOOR_OPEN);
  });
});

describe('collision: wall, rock, and door', () => {
  test('wall and rock block; PLAYER_START is open', () => {
    const { grid } = setup();

    expect(isBlockedAABB(grid, WALL_X, WALL_Y, PLAYER_HALF, PLAYER_HALF)).toBe(true);
    expect(isBlockedAABB(grid, ROCK_X, ROCK_Y, PLAYER_HALF, PLAYER_HALF)).toBe(true);
    expect(isBlockedAABB(grid, PLAYER_X, PLAYER_Y, PLAYER_HALF, PLAYER_HALF)).toBe(false);
  });

  test('closed door blocks; open door does not; wall and rock are unaffected by opening it', () => {
    const { groundLayer, grid } = setup();

    expect(isBlockedAABB(grid, DOOR_WORLD_X, DOOR_WORLD_Y, PLAYER_HALF, PLAYER_HALF)).toBe(true);

    openDoor(groundLayer, grid);

    expect(isBlockedAABB(grid, DOOR_WORLD_X, DOOR_WORLD_Y, PLAYER_HALF, PLAYER_HALF)).toBe(false);
    // Opening the door must not touch any other cell.
    expect(isBlockedAABB(grid, WALL_X, WALL_Y, PLAYER_HALF, PLAYER_HALF)).toBe(true);
    expect(isBlockedAABB(grid, ROCK_X, ROCK_Y, PLAYER_HALF, PLAYER_HALF)).toBe(true);
  });

  test('moveAndSlideInto: closed door blocks approach; opening it lets the same move through', () => {
    // Just south of the door tile (row=8 spans y=128..144), moving north (dy<0).
    const { groundLayer, grid } = setup();
    const startX = DOOR_WORLD_X;
    const startY = 150;

    const blocked = { x: startX, y: startY };
    moveAndSlideInto(grid, startX, startY, 0, -10, PLAYER_HALF, PLAYER_HALF, blocked);
    expect(blocked.y).toBe(startY); // door still closed — no movement

    openDoor(groundLayer, grid);

    const opened = { x: startX, y: startY };
    moveAndSlideInto(grid, startX, startY, 0, -10, PLAYER_HALF, PLAYER_HALF, opened);
    expect(opened.y).toBe(startY - 10); // door open — the same move now succeeds
  });

  test('moveAndSlideInto: blocks x-movement into a wall; allows y-movement into open space', () => {
    const { grid } = setup();

    // House right side wall is col=7 (x starts at 112). Approach from just west of it.
    const wallBlockX = 105;
    const out1 = { x: wallBlockX, y: WALL_Y + 32 };
    moveAndSlideInto(grid, wallBlockX, WALL_Y + 32, 10, 0, PLAYER_HALF, PLAYER_HALF, out1);
    expect(out1.x).toBe(wallBlockX); // x unchanged — wall blocks it

    // PLAYER_START position with dy=2 stays on open field grass -> movement applies
    const out2 = { x: PLAYER_X, y: PLAYER_Y };
    moveAndSlideInto(grid, PLAYER_X, PLAYER_Y, 0, 2, PLAYER_HALF, PLAYER_HALF, out2);
    expect(out2.x).toBe(PLAYER_X);     // x unchanged — no dx
    expect(out2.y).toBe(PLAYER_Y + 2); // y advances
  });
});
