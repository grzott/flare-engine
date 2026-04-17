import type { Rect } from '@flare/math';

/** A single tile in a tilemap grid. */
export interface TileData {
  /** Global tile ID (0 = empty). */
  gid: number;
  /** Whether this tile is flagged as solid (for collision). */
  solid: boolean;
  /** Custom properties on the tile. */
  properties: Record<string, unknown>;
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
  /** Flat array of tile GIDs (row-major, length = width * height). */
  tiles: number[];
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
  return layer.tiles[row * layer.width + col] ?? 0;
}

/** Get the tileset that owns a given GID. */
export function getTilesetForGid(tilesets: TilesetRef[], gid: number): TilesetRef | undefined {
  // Tilesets are ordered by firstGid; find the last one where firstGid <= gid
  let result: TilesetRef | undefined;
  for (const ts of tilesets) {
    if (ts.firstGid <= gid) {
      result = ts;
    } else {
      break;
    }
  }
  return result;
}

/** Compute the source rect in a tileset image for a given GID. */
export function getTileSourceRect(tileset: TilesetRef, gid: number): Rect {
  const localId = gid - tileset.firstGid;
  const col = localId % tileset.columns;
  const row = Math.floor(localId / tileset.columns);
  return {
    x: col * tileset.tileWidth,
    y: row * tileset.tileHeight,
    width: tileset.tileWidth,
    height: tileset.tileHeight,
  };
}
