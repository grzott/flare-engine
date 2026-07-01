import { parseTiled } from '@flare-engine/tilemap';
import type { TilemapData } from '@flare-engine/tilemap';

export const TILE_SIZE = 16;

export const TILE_GRASS = 1;
export const TILE_WALL = 2;
export const TILE_WATER = 3;
export const TILE_SAND = 4;

const CHAR_TO_GID: Record<string, number> = {
  '.': TILE_GRASS,
  '#': TILE_WALL,
  '~': TILE_WATER,
  ',': TILE_SAND,
};

/** ASCII source for the starter zone. `#` wall, `.` grass, `~` water, `,` sand.
 *  Wall and water are solid (marked in the tileset). */
export const MAP_ART: readonly string[] = [
  '####################',
  '#........~~........#',
  '#..##....~~....##..#',
  '#..##..........##..#',
  '#......,,,,,,......#',
  '#......,....,......#',
  '#......,....,......#',
  '#..##..,,,,,,..##..#',
  '#..##..........##..#',
  '#........~~........#',
  '#........~~........#',
  '####################',
];

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
        columns: 4,
        tilecount: 4,
        image: 'procedural://tiles',
        imagewidth: 64,
        imageheight: 16,
        tiles: [
          { id: TILE_WALL - 1, properties: [{ name: 'solid', type: 'bool', value: true }] },
          { id: TILE_WATER - 1, properties: [{ name: 'solid', type: 'bool', value: true }] },
        ],
      },
    ],
  };
}

export function loadMap(): TilemapData {
  return parseTiled(buildTiledMapJson());
}
