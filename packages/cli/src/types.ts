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
  /** Embed external tilesets inline rather than leaving references (default: true). */
  embedTilesets?: boolean;
}

/** Normalized Flare tileset descriptor. */
export interface FlareTileset {
  name: string;
  firstgid: number;
  tilewidth: number;
  tileheight: number;
  columns: number;
  tilecount: number;
  image: string;
  imagewidth: number;
  imageheight: number;
  /** External tileset path, preserved when embedTilesets is false. */
  source?: string;
}

/** Normalized Flare tile layer. */
export interface FlareTileLayer {
  kind: 'tile';
  name: string;
  width: number;
  height: number;
  data: number[];
  visible: boolean;
  opacity: number;
}

/** Normalized Flare object. */
export interface FlareObject {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties: Record<string, string | number | boolean>;
}

/** Normalized Flare object layer. */
export interface FlareObjectLayer {
  kind: 'object';
  name: string;
  objects: FlareObject[];
  visible: boolean;
  opacity: number;
}

export type FlareLayer = FlareTileLayer | FlareObjectLayer;

/** Normalized runtime JSON produced by `convertTiled`. */
export interface FlareMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  tilesets: FlareTileset[];
  layers: FlareLayer[];
}

/** Result returned by `convertTiled`. */
export interface TiledResult {
  outPath: string;
  layers: FlareLayer[];
  tilesets: FlareTileset[];
  map: FlareMap;
}
