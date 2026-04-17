import { AABB } from '@flare-engine/physics';
import type { AABBShape } from '@flare-engine/physics';
import type { TileLayer, TilemapData, TilesetRef } from './tilemap-data.js';
import { getTilesetForGid } from './tilemap-data.js';

/** A collision body extracted from a solid tile. */
export interface TileCollider {
  /** World position of the tile center. */
  x: number;
  y: number;
  /** AABB collision shape. */
  shape: AABBShape;
  /** Grid column. */
  col: number;
  /** Grid row. */
  row: number;
  /** The tile GID. */
  gid: number;
}

/**
 * Extract collision shapes from solid tiles in a tilemap.
 * A tile is considered solid if its tileset marks the local tile ID as solid.
 *
 * @param map The parsed tilemap data.
 * @param layerName Optional: only extract from this layer. If omitted, extracts from all tile layers.
 * @returns Array of TileCollider bodies.
 */
export function extractColliders(map: TilemapData, layerName?: string): TileCollider[] {
  const colliders: TileCollider[] = [];
  const tw = map.tileWidth;
  const th = map.tileHeight;

  for (const layer of map.layers) {
    if (layer.type !== 'tile') continue;
    if (layerName !== undefined && layer.name !== layerName) continue;

    extractFromLayer(layer, map.tilesets, tw, th, colliders);
  }

  return colliders;
}

function extractFromLayer(
  layer: TileLayer,
  tilesets: TilesetRef[],
  tw: number,
  th: number,
  out: TileCollider[],
): void {
  for (let row = 0; row < layer.height; row++) {
    for (let col = 0; col < layer.width; col++) {
      const gid = layer.tiles[row * layer.width + col] ?? 0;
      if (gid === 0) continue;

      const tileset = getTilesetForGid(tilesets, gid);
      if (!tileset) continue;

      const localId = gid - tileset.firstGid;
      if (!tileset.solidTiles.has(localId)) continue;

      out.push({
        x: col * tw + tw * 0.5 + layer.offsetX,
        y: row * th + th * 0.5 + layer.offsetY,
        shape: AABB(tw, th),
        col,
        row,
        gid,
      });
    }
  }
}
