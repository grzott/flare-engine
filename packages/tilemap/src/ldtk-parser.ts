import type {
  MapLayer,
  MapObject,
  ObjectLayer,
  TileLayer,
  TilemapData,
  TilesetRef,
} from './tilemap-data.js';
import { createTilemapData } from './tilemap-data.js';

// ----- LDtk JSON types -----

interface LDtkFieldInstance {
  __identifier: string;
  __value: unknown;
  __type: string;
}

interface LDtkEntityInstance {
  __identifier: string;
  __grid: [number, number];
  __pivot: [number, number];
  __tile?: { x: number; y: number; w: number; h: number };
  iid: string;
  width: number;
  height: number;
  px: [number, number];
  fieldInstances: LDtkFieldInstance[];
}

interface LDtkTileInstance {
  px: [number, number];
  src: [number, number];
  f: number; // flip flags
  t: number; // tile ID
}

interface LDtkLayerInstance {
  __identifier: string;
  __type: string;
  __cWid: number;
  __cHei: number;
  __gridSize: number;
  __tilesetDefUid?: number;
  __tilesetRelPath?: string;
  visible: boolean;
  __opacity: number;
  intGridCsv?: number[];
  gridTiles?: LDtkTileInstance[];
  autoLayerTiles?: LDtkTileInstance[];
  entityInstances?: LDtkEntityInstance[];
}

interface LDtkTilesetDef {
  uid: number;
  identifier: string;
  relPath: string;
  pxWid: number;
  pxHei: number;
  tileGridSize: number;
  __cWid: number;
  __cHei: number;
}

interface LDtkLevel {
  identifier: string;
  uid: number;
  pxWid: number;
  pxHei: number;
  worldX: number;
  worldY: number;
  layerInstances?: LDtkLayerInstance[];
  fieldInstances?: LDtkFieldInstance[];
}

interface LDtkJSON {
  defaultGridSize: number;
  defs: {
    tilesets: LDtkTilesetDef[];
  };
  levels: LDtkLevel[];
}

/**
 * Parse an LDtk JSON project into an array of TilemapData (one per level).
 * Returns all levels with their tile and entity layers.
 */
export function parseLDtk(json: unknown): TilemapData[] {
  const data = json as LDtkJSON;
  const results: TilemapData[] = [];

  // Build tileset lookup
  const tilesetDefs = new Map<number, LDtkTilesetDef>();
  for (const ts of data.defs.tilesets) {
    tilesetDefs.set(ts.uid, ts);
  }

  for (const level of data.levels) {
    const gridSize = data.defaultGridSize;
    const mapWidth = Math.ceil(level.pxWid / gridSize);
    const mapHeight = Math.ceil(level.pxHei / gridSize);
    const map = createTilemapData(mapWidth, mapHeight, gridSize, gridSize);

    // Parse level properties
    if (level.fieldInstances) {
      for (const field of level.fieldInstances) {
        map.properties[field.__identifier] = field.__value;
      }
    }

    const usedTilesets = new Set<number>();

    if (level.layerInstances) {
      // LDtk layers are in reverse order (first = top)
      for (let i = level.layerInstances.length - 1; i >= 0; i--) {
        const layerInst = level.layerInstances[i]!;
        const layer = parseLayerInstance(layerInst, mapWidth, mapHeight, gridSize);
        if (layer) {
          map.layers.push(layer);
        }

        // Track tileset usage
        if (layerInst.__tilesetDefUid !== undefined) {
          usedTilesets.add(layerInst.__tilesetDefUid);
        }
      }
    }

    // Add tileset refs
    let firstGid = 1;
    for (const uid of usedTilesets) {
      const def = tilesetDefs.get(uid);
      if (!def) continue;

      const columns = def.__cWid;
      const tileCount = def.__cWid * def.__cHei;

      const ref: TilesetRef = {
        firstGid: firstGid,
        name: def.identifier,
        tileWidth: def.tileGridSize,
        tileHeight: def.tileGridSize,
        columns,
        tileCount,
        image: def.relPath,
        imageWidth: def.pxWid,
        imageHeight: def.pxHei,
        tileProperties: new Map(),
        solidTiles: new Set(),
      };
      map.tilesets.push(ref);
      firstGid += tileCount;
    }

    results.push(map);
  }

  return results;
}

function parseLayerInstance(
  layer: LDtkLayerInstance,
  mapWidth: number,
  mapHeight: number,
  gridSize: number,
): MapLayer | null {
  switch (layer.__type) {
    case 'IntGrid':
      return parseIntGridLayer(layer, mapWidth, mapHeight);
    case 'Tiles':
    case 'AutoLayer':
      return parseTilesLayer(layer, mapWidth, mapHeight, gridSize);
    case 'Entities':
      return parseEntitiesLayer(layer);
    default:
      return null;
  }
}

function parseIntGridLayer(
  layer: LDtkLayerInstance,
  mapWidth: number,
  mapHeight: number,
): TileLayer {
  const tiles = layer.intGridCsv
    ? layer.intGridCsv.slice()
    : (new Array(mapWidth * mapHeight).fill(0) as number[]);
  return {
    type: 'tile',
    name: layer.__identifier,
    width: layer.__cWid,
    height: layer.__cHei,
    tiles,
    visible: layer.visible,
    opacity: layer.__opacity,
    offsetX: 0,
    offsetY: 0,
    properties: {},
  };
}

function parseTilesLayer(
  layer: LDtkLayerInstance,
  mapWidth: number,
  mapHeight: number,
  gridSize: number,
): TileLayer {
  const tiles = new Array(mapWidth * mapHeight).fill(0) as number[];
  const tileInstances = layer.gridTiles ?? layer.autoLayerTiles ?? [];

  for (const ti of tileInstances) {
    const col = Math.floor(ti.px[0] / gridSize);
    const row = Math.floor(ti.px[1] / gridSize);
    if (col >= 0 && col < mapWidth && row >= 0 && row < mapHeight) {
      // Store tile ID + 1 (to match GID convention where 0 = empty)
      tiles[row * mapWidth + col] = ti.t + 1;
    }
  }

  return {
    type: 'tile',
    name: layer.__identifier,
    width: mapWidth,
    height: mapHeight,
    tiles,
    visible: layer.visible,
    opacity: layer.__opacity,
    offsetX: 0,
    offsetY: 0,
    properties: {},
  };
}

function parseEntitiesLayer(layer: LDtkLayerInstance): ObjectLayer {
  const objects: MapObject[] = (layer.entityInstances ?? []).map((ent, idx) => {
    const props: Record<string, unknown> = {};
    for (const field of ent.fieldInstances) {
      props[field.__identifier] = field.__value;
    }
    return {
      id: idx + 1,
      name: ent.__identifier,
      type: ent.__identifier,
      x: ent.px[0],
      y: ent.px[1],
      width: ent.width,
      height: ent.height,
      rotation: 0,
      properties: props,
    };
  });

  return {
    type: 'object',
    name: layer.__identifier,
    objects,
    visible: layer.visible,
    opacity: layer.__opacity,
    properties: {},
  };
}
