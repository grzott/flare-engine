/** Options for `packAtlas` / `flare pack-atlas`. */
export interface AtlasPackerOptions {
  /** Directory containing source `.png` sprites (non-recursive). */
  input: string;
  /** Output directory for atlas JSON + image (default: `input`). */
  out?: string;
  /** Base filename (no extension) for the atlas pair (default: `atlas`). */
  name?: string;
  /** Pixel padding between sprites in the packed atlas (default: 2). */
  padding?: number;
  /** Maximum atlas side length in pixels (default: 2048). */
  maxSize?: number;
  /** Output image format (default: `png`). */
  format?: 'png' | 'webp';
}

/** One packed frame in the resulting atlas. */
export interface AtlasFrame {
  /** Frame name — sprite filename without extension. */
  name: string;
  /** X position in atlas (px). */
  x: number;
  /** Y position in atlas (px). */
  y: number;
  /** Source sprite width (px). */
  w: number;
  /** Source sprite height (px). */
  h: number;
}

/** Result returned by `packAtlas`. */
export interface AtlasResult {
  /** Absolute path to the written JSON descriptor. */
  jsonPath: string;
  /** Absolute path to the written atlas image. */
  imagePath: string;
  /** Packed frames. */
  frames: readonly AtlasFrame[];
  /** Final atlas width (px). */
  width: number;
  /** Final atlas height (px). */
  height: number;
}

/** Options for `convertTiled` / `flare tiled-to-flare`. */
export interface TiledConvertOptions {
  /** Path to a Tiled `.tmj` (JSON) map file. */
  input: string;
  /** Output `.json` path (default: `<input>.flare.json`). */
  out?: string;
  /**
   * Embed external tilesets inline rather than leaving references (default: true).
   * With `false`, the emitted tileset keeps its Tiled `source` path instead of being
   * resolved — `@flare-engine/tilemap`'s `parseTiled` rejects a tileset with `source`
   * set, so that output is not directly engine-consumable; it exists for pipelines
   * that resolve external tilesets themselves before calling `parseTiled`.
   */
  embedTilesets?: boolean;
}

/** A Tiled custom property, as Tiled's JSON export represents it. */
export interface TiledProperty {
  name: string;
  type?: string;
  value: string | number | boolean;
}

/**
 * A tile definition inside a tileset's `tiles[]` — the only place per-tile
 * `properties` and `solid`/`collision` flags live. `parseTiled` reads this shape
 * directly to populate `TilesetRef.solidTiles` / `tileProperties`.
 */
export interface TiledTile {
  id: number;
  type?: string;
  class?: string;
  properties?: TiledProperty[];
}

/** An object inside an object layer — Tiled-shaped, unchanged by `convertTiled`. */
export interface TiledObject {
  id: number;
  name?: string;
  type?: string;
  class?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  visible?: boolean;
  properties?: TiledProperty[];
}

/** A tile layer, Tiled-shaped — accepted directly by `@flare-engine/tilemap`'s `parseTiled`. */
export interface TiledTileLayer {
  type: 'tilelayer';
  name: string;
  width: number;
  height: number;
  data: number[];
  visible: boolean;
  opacity: number;
  offsetx?: number;
  offsety?: number;
  properties?: TiledProperty[];
}

/** An object layer, Tiled-shaped — accepted directly by `@flare-engine/tilemap`'s `parseTiled`. */
export interface TiledObjectLayer {
  type: 'objectgroup';
  name: string;
  objects: TiledObject[];
  visible: boolean;
  opacity: number;
  properties?: TiledProperty[];
}

export type TiledLayer = TiledTileLayer | TiledObjectLayer;

/**
 * A tileset entry, Tiled-shaped. External tilesets are resolved and inlined here
 * when `embedTilesets` (the default) — `tiles` and `properties` carry through so
 * `parseTiled` can populate collision flags and custom data.
 */
export interface TiledTileset {
  name: string;
  firstgid: number;
  tilewidth: number;
  tileheight: number;
  columns: number;
  tilecount: number;
  image: string;
  imagewidth: number;
  imageheight: number;
  tiles?: TiledTile[];
  properties?: TiledProperty[];
  /**
   * External tileset path — present only when `embedTilesets` is false.
   * `parseTiled` rejects a tileset with `source` set; see `TiledConvertOptions.embedTilesets`.
   */
  source?: string;
}

/**
 * Tiled-shaped runtime JSON written by `convertTiled` — a pass-through of the
 * original map's layers and tilesets (group/image layers flattened/dropped,
 * external tilesets inlined), accepted directly by `parseTiled`.
 */
export interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  tilesets: TiledTileset[];
  layers: TiledLayer[];
}

/** Result returned by `convertTiled`. */
export interface TiledResult {
  outPath: string;
  layers: TiledLayer[];
  tilesets: TiledTileset[];
  map: TiledMap;
}
