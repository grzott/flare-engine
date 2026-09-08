import type { SolidGrid } from '@flare-engine/physics';
import { parseTiled } from '@flare-engine/tilemap';
import type { TileLayer, TilemapData } from '@flare-engine/tilemap';

export const TILE_SIZE = 16;

export const TILE_GRASS = 1;
export const TILE_WALL = 2;
export const TILE_ROCK = 3;
export const TILE_DOOR_CLOSED = 4;
export const TILE_DOOR_OPEN = 5;

const CHAR_TO_GID: Record<string, number> = {
  '.': TILE_GRASS,
  '#': TILE_WALL,
  R: TILE_ROCK,
  D: TILE_DOOR_CLOSED,
};

/** ASCII source for a 4x8 house on an open field. `#` wall, `.` grass,
 *  `R` rock, `D` door (starts closed). Walls, rocks, and the closed door all
 *  collide; the door stops colliding once opened at runtime — see
 *  `openDoor` below. */
export const MAP_ART: readonly string[] = [
  '............',
  '....####....',
  '....#..#....',
  '..R.#..#....',
  '....#..#....',
  '....#..#.R..',
  '....#..#....',
  '....#..#....',
  '....#D##....',
  '....R.......',
];

/** Scan `art` for the door character once at module load; throws if a future
 *  edit to MAP_ART drops the door, instead of silently shipping a doorless map. */
function findDoorTile(art: readonly string[]): { row: number; col: number } {
  for (let row = 0; row < art.length; row++) {
    const col = art[row]?.indexOf('D') ?? -1;
    if (col !== -1) return { row, col };
  }
  throw new Error('map.ts: MAP_ART has no door ("D") tile');
}

const DOOR_TILE = findDoorTile(MAP_ART);
export const DOOR_ROW = DOOR_TILE.row;
export const DOOR_COL = DOOR_TILE.col;
export const DOOR_WORLD_X = DOOR_COL * TILE_SIZE + TILE_SIZE / 2;
export const DOOR_WORLD_Y = DOOR_ROW * TILE_SIZE + TILE_SIZE / 2;

/** Build a Tiled `.tmj`-shaped JSON object from the ASCII art.
 *  Swapping in a real editor-made map is a drop-in change:
 *  `parseTiled(require('./zone1.tmj'))`. */
export function buildTiledMapJson(art: readonly string[] = MAP_ART): unknown {
  const height = art.length;
  const width = art[0]?.length ?? 0;
  const data: number[] = [];
  for (const row of art) {
    for (const ch of row) {
      data.push(CHAR_TO_GID[ch] ?? 0);
    }
  }
  return {
    width,
    height,
    tilewidth: TILE_SIZE,
    tileheight: TILE_SIZE,
    orientation: 'orthogonal',
    layers: [
      {
        type: 'tilelayer',
        name: 'ground',
        width,
        height,
        data,
        visible: true,
        opacity: 1,
      },
    ],
    tilesets: [
      {
        firstgid: 1,
        name: 'tiles',
        tilewidth: TILE_SIZE,
        tileheight: TILE_SIZE,
        columns: 5,
        tilecount: 5,
        image: 'procedural://tiles',
        imagewidth: 80,
        imageheight: 16,
        tiles: [
          { id: TILE_WALL - 1, properties: [{ name: 'solid', type: 'bool', value: true }] },
          { id: TILE_ROCK - 1, properties: [{ name: 'solid', type: 'bool', value: true }] },
          { id: TILE_DOOR_CLOSED - 1, properties: [{ name: 'solid', type: 'bool', value: true }] },
        ],
      },
    ],
  };
}

export function loadMap(): TilemapData {
  return parseTiled(buildTiledMapJson());
}

/** True while an AABB centered at (`x`, `y`) with half-extents (`halfW`,
 *  `halfH`) overlaps the door tile. Pure and zero-alloc — safe to call every
 *  frame from the game loop. */
export function isTouchingDoor(x: number, y: number, halfW: number, halfH: number): boolean {
  const halfTile = TILE_SIZE / 2;
  return Math.abs(x - DOOR_WORLD_X) <= halfW + halfTile && Math.abs(y - DOOR_WORLD_Y) <= halfH + halfTile;
}

/**
 * Open the door: flips its cell in the collision grid so it stops blocking
 * movement, and swaps its tile GID so the renderer draws the open frame
 * instead of the closed one. Both are plain index writes into arrays the
 * engine already owns (`SolidGrid.solid`, `TileLayer.tiles`) — no grid
 * rebuild, no allocation. Idempotent: calling it again is a no-op.
 */
export function openDoor(groundLayer: TileLayer, grid: SolidGrid): void {
  const idx = DOOR_ROW * grid.width + DOOR_COL;
  grid.solid[idx] = 0;
  groundLayer.tiles[idx] = TILE_DOOR_OPEN;
}
