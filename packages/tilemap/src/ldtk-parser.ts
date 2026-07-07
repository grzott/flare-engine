import { TilemapParseError } from './parse-error.js';
import type { MapObject, ObjectLayer, TileLayer, TilemapData, TilesetRef } from './tilemap-data.js';
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
  externalLevels?: boolean;
  defs: {
    tilesets: LDtkTilesetDef[];
  };
  levels: LDtkLevel[];
}

export interface ParseLDtkOptions {
  /** Predicate deciding whether an IntGrid value marks a solid cell. Default: value > 0. */
  intGridSolid?: (value: number) => boolean;
}

/**
 * Parse an LDtk JSON project into an array of TilemapData (one per level).
 * Returns all levels with their tile and entity layers.
 * Throws TilemapParseError for unsupported formats (externalLevels, invalid input).
 */
export function parseLDtk(json: unknown, options: ParseLDtkOptions = {}): TilemapData[] {
  if (
    !json ||
    typeof json !== 'object' ||
    !Array.isArray((json as Record<string, unknown>).levels) ||
    !(json as Record<string, unknown>).defs ||
    !Array.isArray(((json as Record<string, unknown>).defs as Record<string, unknown>).tilesets)
  ) {
    throw new TilemapParseError(
      'parseLDtk: input is not an LDtk project JSON (missing defs.tilesets or levels).',
    );
  }

  const data = json as LDtkJSON;

  if (data.externalLevels === true) {
    throw new TilemapParseError(
      'parseLDtk: projects with "Save levels to separate files" (externalLevels) are not supported. Disable it in LDtk ▸ Project settings and re-save.',
    );
  }

  const isSolid = options.intGridSolid ?? ((v) => v > 0);

  const tilesetDefs = new Map<number, LDtkTilesetDef>();
  for (const ts of data.defs.tilesets) {
    tilesetDefs.set(ts.uid, ts);
  }

  const results: TilemapData[] = [];

  for (const level of data.levels) {
    const gridSize = data.defaultGridSize;
    const mapWidth = Math.ceil(level.pxWid / gridSize);
    const mapHeight = Math.ceil(level.pxHei / gridSize);
    const map = createTilemapData(mapWidth, mapHeight, gridSize, gridSize);

    if (level.fieldInstances) {
      for (const field of level.fieldInstances) {
        map.properties[field.__identifier] = field.__value;
      }
    }

    // Pass 1: collect tile-layer tileset uids, sort ascending, assign deterministic firstGids.
    // Tilesets must be sorted by firstGid (ascending) for getTilesetForGid's early-break.
    const firstGidByUid = new Map<number, number>();
    let nextFirstGid = 1;

    if (level.layerInstances) {
      const usedTileUids = new Set<number>();
      for (const layerInst of level.layerInstances) {
        if (
          (layerInst.__type === 'Tiles' || layerInst.__type === 'AutoLayer') &&
          layerInst.__tilesetDefUid !== undefined
        ) {
          usedTileUids.add(layerInst.__tilesetDefUid);
        }
      }

      const sortedUids = Array.from(usedTileUids).sort((a, b) => a - b);
      for (const uid of sortedUids) {
        const def = tilesetDefs.get(uid);
        if (!def) continue;
        const columns = def.__cWid;
        const tileCount = def.__cWid * def.__cHei;
        firstGidByUid.set(uid, nextFirstGid);
        const ref: TilesetRef = {
          firstGid: nextFirstGid,
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
        nextFirstGid += tileCount;
      }
    }

    // Pass 2: parse layers in reverse order (LDtk stores top-first; emit bottom-first).
    if (level.layerInstances) {
      for (let i = level.layerInstances.length - 1; i >= 0; i--) {
        const layerInst = level.layerInstances[i]!;

        if (layerInst.__type === 'IntGrid') {
          // IntGrid layers are treated as collision grids; IntGrid layers that also
          // carry auto-render tiles keep collision only (visual auto-tiles are M4 scope).
          const csv = layerInst.intGridCsv;
          const cellCount = layerInst.__cWid * layerInst.__cHei;
          const tiles = new Array(cellCount).fill(0) as number[];
          const intFirstGid = nextFirstGid;
          let maxLocal = 0;
          let hasNonZero = false;
          const solidSet = new Set<number>();

          if (csv) {
            for (let j = 0; j < csv.length; j++) {
              const v = csv[j] ?? 0;
              if (v > 0) {
                hasNonZero = true;
                const localId = v - 1;
                if (localId > maxLocal) maxLocal = localId;
                tiles[j] = intFirstGid + localId;
                if (isSolid(v)) solidSet.add(localId);
              }
            }
          }

          if (hasNonZero) {
            const tileCount = maxLocal + 1;
            map.tilesets.push({
              firstGid: intFirstGid,
              name: layerInst.__identifier,
              tileWidth: layerInst.__gridSize,
              tileHeight: layerInst.__gridSize,
              columns: tileCount,
              tileCount,
              image: '',
              imageWidth: 0,
              imageHeight: 0,
              tileProperties: new Map(),
              solidTiles: solidSet,
            });
            nextFirstGid += tileCount;
          }

          map.layers.push({
            type: 'tile',
            name: layerInst.__identifier,
            width: layerInst.__cWid,
            height: layerInst.__cHei,
            tiles,
            visible: layerInst.visible,
            opacity: layerInst.__opacity,
            offsetX: 0,
            offsetY: 0,
            properties: {},
          });
        } else if (layerInst.__type === 'Tiles' || layerInst.__type === 'AutoLayer') {
          const firstGid = firstGidByUid.get(layerInst.__tilesetDefUid ?? -1) ?? 1;
          map.layers.push(parseTilesLayer(layerInst, mapWidth, mapHeight, gridSize, firstGid));
        } else if (layerInst.__type === 'Entities') {
          map.layers.push(parseEntitiesLayer(layerInst));
        }
      }
    }

    results.push(map);
  }

  return results;
}

function parseTilesLayer(
  layer: LDtkLayerInstance,
  mapWidth: number,
  mapHeight: number,
  gridSize: number,
  firstGid: number,
): TileLayer {
  const tiles = new Array(mapWidth * mapHeight).fill(0) as number[];
  const tileInstances = layer.gridTiles ?? layer.autoLayerTiles ?? [];

  for (const ti of tileInstances) {
    const col = Math.floor(ti.px[0] / gridSize);
    const row = Math.floor(ti.px[1] / gridSize);
    if (col >= 0 && col < mapWidth && row >= 0 && row < mapHeight) {
      tiles[row * mapWidth + col] = firstGid + ti.t;
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
