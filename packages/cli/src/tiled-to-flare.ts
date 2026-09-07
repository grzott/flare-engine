import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import type {
  TiledConvertOptions,
  TiledLayer,
  TiledMap,
  TiledObject,
  TiledObjectLayer,
  TiledProperty,
  TiledResult,
  TiledTile,
  TiledTileLayer,
  TiledTileset,
} from './types.js';

/** Raw layer shape as Tiled writes it — a superset covering group/image layers, which are dropped. */
interface RawTiledLayer {
  type: 'tilelayer' | 'objectgroup' | 'imagelayer' | 'group';
  name: string;
  visible?: boolean;
  opacity?: number;
  width?: number;
  height?: number;
  data?: number[];
  objects?: TiledObject[];
  offsetx?: number;
  offsety?: number;
  properties?: TiledProperty[];
  layers?: RawTiledLayer[];
}

interface RawTiledTilesetRef {
  firstgid: number;
  source?: string;
  name?: string;
  tilewidth?: number;
  tileheight?: number;
  columns?: number;
  tilecount?: number;
  image?: string;
  imagewidth?: number;
  imageheight?: number;
  tiles?: TiledTile[];
  properties?: TiledProperty[];
}

interface RawTiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: RawTiledLayer[];
  tilesets: RawTiledTilesetRef[];
}

function absPath(p: string, base: string): string {
  return isAbsolute(p) ? p : resolve(base, p);
}

async function resolveTileset(
  ref: RawTiledTilesetRef,
  mapDir: string,
  embed: boolean,
): Promise<TiledTileset> {
  let data: RawTiledTilesetRef = ref;
  if (ref.source && embed) {
    const srcPath = absPath(ref.source, mapDir);
    const raw = await readFile(srcPath, 'utf8');
    const external = JSON.parse(raw) as RawTiledTilesetRef;
    data = { ...external, firstgid: ref.firstgid };
  }
  const tileset: TiledTileset = {
    name: data.name ?? 'tileset',
    firstgid: data.firstgid,
    tilewidth: data.tilewidth ?? 0,
    tileheight: data.tileheight ?? 0,
    columns: data.columns ?? 0,
    tilecount: data.tilecount ?? 0,
    image: data.image ?? '',
    imagewidth: data.imagewidth ?? 0,
    imageheight: data.imageheight ?? 0,
  };
  if (data.tiles) tileset.tiles = data.tiles;
  if (data.properties) tileset.properties = data.properties;
  if (ref.source && !embed) tileset.source = ref.source;
  return tileset;
}

function flattenLayers(layers: RawTiledLayer[]): RawTiledLayer[] {
  const out: RawTiledLayer[] = [];
  const walk = (ls: RawTiledLayer[]): void => {
    for (const l of ls) {
      if (l.type === 'group') {
        if (l.layers) walk(l.layers);
      } else {
        out.push(l);
      }
    }
  };
  walk(layers);
  return out;
}

/**
 * Route a layer through as Tiled-shaped `TiledLayer`, keeping every field
 * `parseTiled` reads (offsets, properties, and — for objects — rotation, which
 * passes through untouched since `objects` is not re-mapped).
 */
function convertLayer(layer: RawTiledLayer): TiledLayer | null {
  const visible = layer.visible !== false;
  const opacity = typeof layer.opacity === 'number' ? layer.opacity : 1;
  if (layer.type === 'tilelayer') {
    const tile: TiledTileLayer = {
      type: 'tilelayer',
      name: layer.name,
      width: layer.width ?? 0,
      height: layer.height ?? 0,
      data: layer.data ?? [],
      visible,
      opacity,
    };
    if (layer.offsetx !== undefined) tile.offsetx = layer.offsetx;
    if (layer.offsety !== undefined) tile.offsety = layer.offsety;
    if (layer.properties) tile.properties = layer.properties;
    return tile;
  }
  if (layer.type === 'objectgroup') {
    const obj: TiledObjectLayer = {
      type: 'objectgroup',
      name: layer.name,
      objects: layer.objects ?? [],
      visible,
      opacity,
    };
    if (layer.properties) obj.properties = layer.properties;
    return obj;
  }
  return null;
}

/**
 * Convert a Tiled `.tmj` JSON map into Tiled-shaped runtime JSON, accepted
 * directly by `@flare-engine/tilemap`'s `parseTiled` — this is a pass-through of
 * the original layer/tileset objects (not a re-projection), so `type`,
 * `properties`, tileset `tiles[]`, object `rotation` and layer `offsetx`/`offsety`
 * all survive. Flattens group layers, resolves external tilesets (when
 * `embedTilesets`), and drops image/editor-only layers.
 */
export async function convertTiled(opts: TiledConvertOptions): Promise<TiledResult> {
  const inputPath = absPath(opts.input, process.cwd());
  const outPath = opts.out
    ? absPath(opts.out, process.cwd())
    : join(dirname(inputPath), `${basename(inputPath).replace(/\.(tmj|json)$/i, '')}.flare.json`);
  const embed = opts.embedTilesets !== false;

  const raw = await readFile(inputPath, 'utf8');
  const parsed = JSON.parse(raw) as RawTiledMap;
  const mapDir = dirname(inputPath);

  const tilesets: TiledTileset[] = [];
  for (const ref of parsed.tilesets ?? []) {
    tilesets.push(await resolveTileset(ref, mapDir, embed));
  }

  const layers: TiledLayer[] = [];
  for (const l of flattenLayers(parsed.layers ?? [])) {
    const converted = convertLayer(l);
    if (converted) layers.push(converted);
  }

  const map: TiledMap = {
    width: parsed.width,
    height: parsed.height,
    tilewidth: parsed.tilewidth,
    tileheight: parsed.tileheight,
    tilesets,
    layers,
  };

  await writeFile(outPath, `${JSON.stringify(map, null, 2)}\n`, 'utf8');
  return { outPath, layers, tilesets, map };
}
