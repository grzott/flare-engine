import type {
  MapLayer,
  MapObject,
  ObjectLayer,
  TileLayer,
  TilemapData,
  TilesetRef,
} from './tilemap-data.js';
import { createTilemapData } from './tilemap-data.js';

// ----- Tiled JSON types (.tmj format) -----

interface TiledProperty {
  name: string;
  type: string;
  value: unknown;
}

interface TiledTileLayer {
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

interface TiledObject {
  id: number;
  name: string;
  type?: string;
  class?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  properties?: TiledProperty[];
}

interface TiledObjectLayer {
  type: 'objectgroup';
  name: string;
  objects: TiledObject[];
  visible: boolean;
  opacity: number;
  properties?: TiledProperty[];
}

type TiledLayer = TiledTileLayer | TiledObjectLayer;

interface TiledTile {
  id: number;
  properties?: TiledProperty[];
  type?: string;
  class?: string;
}

interface TiledTileset {
  firstgid: number;
  name: string;
  tilewidth: number;
  tileheight: number;
  columns: number;
  tilecount: number;
  image: string;
  imagewidth: number;
  imageheight: number;
  tiles?: TiledTile[];
  properties?: TiledProperty[];
}

interface TiledMapJSON {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  orientation: string;
  layers: TiledLayer[];
  tilesets: TiledTileset[];
  properties?: TiledProperty[];
}

/** Convert Tiled properties array to a Record. */
function parseProperties(props?: TiledProperty[]): Record<string, unknown> {
  if (!props || props.length === 0) return {};
  const result: Record<string, unknown> = {};
  for (const p of props) {
    result[p.name] = p.value;
  }
  return result;
}

/**
 * Parse a Tiled .tmj (JSON) map into TilemapData.
 * Supports orthogonal maps with tile layers and object layers.
 */
export function parseTiled(json: unknown): TilemapData {
  const data = json as TiledMapJSON;
  const map = createTilemapData(data.width, data.height, data.tilewidth, data.tileheight);
  map.properties = parseProperties(data.properties);

  // Parse tilesets
  for (const ts of data.tilesets) {
    const tileProperties = new Map<number, Record<string, unknown>>();
    const solidTiles = new Set<number>();

    if (ts.tiles) {
      for (const tile of ts.tiles) {
        const props = parseProperties(tile.properties);
        if (Object.keys(props).length > 0) {
          tileProperties.set(tile.id, props);
        }
        // Mark as solid if it has a "collision" or "solid" property, or type/class is "solid"
        const tileType = tile.type ?? tile.class ?? '';
        if (tileType === 'solid' || props.solid === true || props.collision === true) {
          solidTiles.add(tile.id);
        }
      }
    }

    const ref: TilesetRef = {
      firstGid: ts.firstgid,
      name: ts.name,
      tileWidth: ts.tilewidth,
      tileHeight: ts.tileheight,
      columns: ts.columns,
      tileCount: ts.tilecount,
      image: ts.image,
      imageWidth: ts.imagewidth,
      imageHeight: ts.imageheight,
      tileProperties,
      solidTiles,
    };
    map.tilesets.push(ref);
  }

  // Sort tilesets by firstGid
  map.tilesets.sort((a, b) => a.firstGid - b.firstGid);

  // Parse layers
  for (const layer of data.layers) {
    map.layers.push(parseLayer(layer));
  }

  return map;
}

function parseLayer(layer: TiledLayer): MapLayer {
  if (layer.type === 'tilelayer') {
    return parseTileLayer(layer);
  }
  return parseObjectLayer(layer);
}

function parseTileLayer(layer: TiledTileLayer): TileLayer {
  return {
    type: 'tile',
    name: layer.name,
    width: layer.width,
    height: layer.height,
    tiles: layer.data.slice(),
    visible: layer.visible,
    opacity: layer.opacity,
    offsetX: layer.offsetx ?? 0,
    offsetY: layer.offsety ?? 0,
    properties: parseProperties(layer.properties),
  };
}

function parseObjectLayer(layer: TiledObjectLayer): ObjectLayer {
  const objects: MapObject[] = layer.objects.map((obj) => ({
    id: obj.id,
    name: obj.name,
    type: obj.type ?? obj.class ?? '',
    x: obj.x,
    y: obj.y,
    width: obj.width,
    height: obj.height,
    rotation: obj.rotation,
    properties: parseProperties(obj.properties),
  }));

  return {
    type: 'object',
    name: layer.name,
    objects,
    visible: layer.visible,
    opacity: layer.opacity,
    properties: parseProperties(layer.properties),
  };
}
