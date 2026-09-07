import type { Rect } from '@flare-engine/math';

/** Low 29 bits of a Tiled GID — Tiled stores flip state in the high 3 bits. */
export const GID_FLIP_MASK = 0x1fffffff;

const FLIP_H = 0x80000000;
const FLIP_V = 0x40000000;
const FLIP_D = 0x20000000;

/** Flip state encoded in the high bits of a Tiled GID. */
export interface TileFlipFlags {
  horizontal: boolean;
  vertical: boolean;
  diagonal: boolean;
}

/** Strip the Tiled flip bits from a raw GID, returning the real global tile id. */
export function stripGidFlags(gid: number): number {
  return gid & GID_FLIP_MASK;
}

/**
 * Decode the Tiled flip bits encoded in the high bits of a raw GID.
 * Note: `gid & 0x80000000` yields a negative Int32 when the bit is set;
 * compare with `!== 0`, not `> 0`.
 */
export function decodeGidFlags(gid: number): TileFlipFlags {
  return {
    horizontal: (gid & FLIP_H) !== 0,
    vertical: (gid & FLIP_V) !== 0,
    diagonal: (gid & FLIP_D) !== 0,
  };
}

/** A layer of tiles in a grid. */
export interface TileLayer {
  readonly type: 'tile';
  /** Layer name. */
  name: string;
  /** Grid width in tiles. */
  width: number;
  /** Grid height in tiles. */
  height: number;
  /**
   * Flat array of tile GIDs (row-major, length = width * height). `Uint32Array`,
   * not `Float32Array` — a 24-bit mantissa cannot hold Tiled's flip-bit GIDs
   * (`0x80000000` and up). This is a type decision for bulk numeric data per the
   * repo convention, not a measured perf change.
   */
  tiles: Uint32Array;
  /** Visibility flag. */
  visible: boolean;
  /** Opacity (0–1). */
  opacity: number;
  /** Layer offset in pixels. */
  offsetX: number;
  offsetY: number;
  /** Custom properties. */
  properties: Record<string, unknown>;
}

/** An object in an object layer. */
export interface MapObject {
  /** Object ID. */
  id: number;
  /** Object name. */
  name: string;
  /** Object type/class. */
  type: string;
  /** Position in pixels. */
  x: number;
  y: number;
  /** Size in pixels. */
  width: number;
  height: number;
  /** Rotation in degrees. */
  rotation: number;
  /** Custom properties. */
  properties: Record<string, unknown>;
}

/** A layer of objects. */
export interface ObjectLayer {
  readonly type: 'object';
  /** Layer name. */
  name: string;
  /** Objects in the layer. */
  objects: MapObject[];
  /** Visibility flag. */
  visible: boolean;
  /** Opacity (0–1). */
  opacity: number;
  /** Custom properties. */
  properties: Record<string, unknown>;
}

/** Union of layer types. */
export type MapLayer = TileLayer | ObjectLayer;

/** Information about a tileset used in the map. */
export interface TilesetRef {
  /** First GID in this tileset. */
  firstGid: number;
  /** Tileset name. */
  name: string;
  /** Tile width in pixels. */
  tileWidth: number;
  /** Tile height in pixels. */
  tileHeight: number;
  /** Number of columns in the tileset image. */
  columns: number;
  /** Total tile count. */
  tileCount: number;
  /** Image source path (may need resolving). */
  image: string;
  /** Image width in pixels. */
  imageWidth: number;
  /** Image height in pixels. */
  imageHeight: number;
  /** Per-tile properties (indexed by local tile ID). */
  tileProperties: Map<number, Record<string, unknown>>;
  /** Tile IDs marked as solid/collision. */
  solidTiles: Set<number>;
}

/** Complete parsed tilemap data — format-independent. */
export interface TilemapData {
  /** Map width in tiles. */
  width: number;
  /** Map height in tiles. */
  height: number;
  /** Tile width in pixels. */
  tileWidth: number;
  /** Tile height in pixels. */
  tileHeight: number;
  /** All layers in order. */
  layers: MapLayer[];
  /** Tilesets referenced by this map. */
  tilesets: TilesetRef[];
  /** Custom map properties. */
  properties: Record<string, unknown>;
}

/** Create an empty TilemapData. */
export function createTilemapData(
  width: number,
  height: number,
  tileWidth: number,
  tileHeight: number,
): TilemapData {
  return {
    width,
    height,
    tileWidth,
    tileHeight,
    layers: [],
    tilesets: [],
    properties: {},
  };
}

/** Get a tile GID at a grid position from a tile layer. Returns 0 if out of bounds. */
export function getTileAt(layer: TileLayer, col: number, row: number): number {
  if (col < 0 || col >= layer.width || row < 0 || row >= layer.height) return 0;
  // The `?? 0` is unreachable at runtime (the bounds check above guarantees an
  // in-range index into a hole-free Uint32Array) — it satisfies noUncheckedIndexedAccess,
  // which types every typed-array index read as `number | undefined`.
  return layer.tiles[row * layer.width + col] ?? 0;
}

/** Get the tileset that owns a given GID. Handles Tiled flip bits in the high bits. */
export function getTilesetForGid(tilesets: TilesetRef[], gid: number): TilesetRef | undefined {
  const id = gid & GID_FLIP_MASK;
  // Tilesets are ordered by firstGid; find the last one where firstGid <= id
  let result: TilesetRef | undefined;
  for (const ts of tilesets) {
    if (ts.firstGid <= id) {
      result = ts;
    } else {
      break;
    }
  }
  return result;
}

/** Compute the source rect in a tileset image for a given GID into `out`. Strips Tiled flip bits. Zero-alloc. */
export function getTileSourceRectInto(tileset: TilesetRef, gid: number, out: Rect): Rect {
  const localId = (gid & GID_FLIP_MASK) - tileset.firstGid;
  const col = localId % tileset.columns;
  const row = Math.floor(localId / tileset.columns);
  out.x = col * tileset.tileWidth;
  out.y = row * tileset.tileHeight;
  out.width = tileset.tileWidth;
  out.height = tileset.tileHeight;
  return out;
}

/** Compute the source rect in a tileset image for a given GID. Strips Tiled flip bits. */
export function getTileSourceRect(tileset: TilesetRef, gid: number): Rect {
  return getTileSourceRectInto(tileset, gid, { x: 0, y: 0, width: 0, height: 0 });
}
