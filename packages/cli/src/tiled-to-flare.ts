import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import type {
  FlareLayer,
  FlareMap,
  FlareObject,
  FlareObjectLayer,
  FlareTileLayer,
  FlareTileset,
  TiledConvertOptions,
  TiledResult,
} from './types.js';

interface TiledProperty {
  name: string;
  type?: string;
  value: string | number | boolean;
}

interface TiledObject {
  id: number;
  name?: string;
  type?: string;
  class?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible?: boolean;
  properties?: TiledProperty[];
}

interface TiledLayer {
  type: 'tilelayer' | 'objectgroup' | 'imagelayer' | 'group';
  name: string;
  visible?: boolean;
  opacity?: number;
  width?: number;
  height?: number;
  data?: number[];
  objects?: TiledObject[];
}

interface TiledTilesetRef {
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
}

interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets: TiledTilesetRef[];
}

function absPath(p: string, base: string): string {
  return isAbsolute(p) ? p : resolve(base, p);
}

function propsToRecord(
  props: TiledProperty[] | undefined,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!props) return out;
  for (const p of props) out[p.name] = p.value;
  return out;
}

async function resolveTileset(
  ref: TiledTilesetRef,
  mapDir: string,
  embed: boolean,
): Promise<FlareTileset> {
  let data: TiledTilesetRef = ref;
  if (ref.source && embed) {
    const srcPath = absPath(ref.source, mapDir);
    const raw = await readFile(srcPath, 'utf8');
    const external = JSON.parse(raw) as TiledTilesetRef;
    data = { ...external, firstgid: ref.firstgid };
  }
  return {
    name: data.name ?? 'tileset',
    firstgid: data.firstgid,
    tilewidth: data.tilewidth ?? 0,
    tileheight: data.tileheight ?? 0,
    columns: data.columns ?? 0,
    tilecount: data.tilecount ?? 0,
    image: data.image ?? '',
    imagewidth: data.imagewidth ?? 0,
    imageheight: data.imageheight ?? 0,
    ...(ref.source && !embed ? { source: ref.source } : {}),
  };
}

function flattenLayers(layers: TiledLayer[]): TiledLayer[] {
  const out: TiledLayer[] = [];
  const walk = (ls: TiledLayer[]): void => {
    for (const l of ls) {
      if (l.type === 'group') {
        const inner = (l as unknown as { layers?: TiledLayer[] }).layers;
        if (inner) walk(inner);
      } else {
        out.push(l);
      }
    }
  };
  walk(layers);
  return out;
}

function convertLayer(layer: TiledLayer): FlareLayer | null {
  const visible = layer.visible !== false;
  const opacity = typeof layer.opacity === 'number' ? layer.opacity : 1;
  if (layer.type === 'tilelayer') {
    const tile: FlareTileLayer = {
      kind: 'tile',
      name: layer.name,
      width: layer.width ?? 0,
      height: layer.height ?? 0,
      data: layer.data ?? [],
      visible,
      opacity,
    };
    return tile;
  }
  if (layer.type === 'objectgroup') {
    const objects: FlareObject[] = (layer.objects ?? []).map((o) => ({
      id: o.id,
      name: o.name ?? '',
      type: o.type ?? o.class ?? '',
      x: o.x,
      y: o.y,
      width: o.width,
      height: o.height,
      properties: propsToRecord(o.properties),
    }));
    const obj: FlareObjectLayer = {
      kind: 'object',
      name: layer.name,
      objects,
      visible,
      opacity,
    };
    return obj;
  }
  return null;
}

/**
 * Convert a Tiled `.tmj` JSON map into Flare's normalized runtime format.
 * Flattens group layers, resolves external tilesets (when `embedTilesets`),
 * and drops image/editor-only layers.
 */
export async function convertTiled(opts: TiledConvertOptions): Promise<TiledResult> {
  const inputPath = absPath(opts.input, process.cwd());
  const outPath = opts.out
    ? absPath(opts.out, process.cwd())
    : join(dirname(inputPath), `${basename(inputPath).replace(/\.(tmj|json)$/i, '')}.flare.json`);
  const embed = opts.embedTilesets !== false;

  const raw = await readFile(inputPath, 'utf8');
  const parsed = JSON.parse(raw) as TiledMap;
  const mapDir = dirname(inputPath);

  const tilesets: FlareTileset[] = [];
  for (const ref of parsed.tilesets ?? []) {
    tilesets.push(await resolveTileset(ref, mapDir, embed));
  }

  const layers: FlareLayer[] = [];
  for (const l of flattenLayers(parsed.layers ?? [])) {
    const converted = convertLayer(l);
    if (converted) layers.push(converted);
  }

  const map: FlareMap = {
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
