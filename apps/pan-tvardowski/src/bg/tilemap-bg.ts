/**
 * Zone 3 scrolling water + fog tilemap background.
 *
 * Parses an inline Tiled .tmj map via `@flare-engine/tilemap.parseTiled`,
 * spawns one Sprite entity per non-empty tile, then scrolls the layer by
 * mutating each entity's `Position.y` every frame. When a tile falls off
 * the bottom it wraps back to the top so the scroll loops seamlessly.
 *
 * This exercises the tilemap package's parser contract end-to-end while
 * staying fully inside the ECS render pipeline (no raw Skia draw needed).
 */

import { type SpriteFrame, type SpriteSheet, getFrame } from '@flare-engine/assets';
import type { World } from '@flare-engine/ecs';
import { Position } from '@flare-engine/ecs';
import { Sprite } from '@flare-engine/render';
import { type TileLayer, type TilemapData, parseTiled } from '@flare-engine/tilemap';
import type { SkImage } from '@shopify/react-native-skia';

const BG_Z = -100;
const ANCHOR = { x: 0.5, y: 0.5 };
const SCROLL_SPEED = 35; // px/sec downward

/** 12 × 20 map of Vistula water + drifting fog patches, 32 px tiles. */
const WATER = 1;
const FOG = 2;
const W = 12;
const H = 20;

function buildWaterLayer(): number[] {
  // Solid water everywhere.
  const arr = new Array<number>(W * H);
  for (let i = 0; i < W * H; i++) arr[i] = WATER;
  return arr;
}

function buildFogLayer(): number[] {
  // Sparse, deterministic fog blobs. Seeded mulberry32.
  let seed = 0x1a3c5e;
  const rand = (): number => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const arr = new Array<number>(W * H);
  for (let i = 0; i < W * H; i++) arr[i] = rand() < 0.18 ? FOG : 0;
  return arr;
}

export function zone3TilemapJson(): unknown {
  return {
    width: W,
    height: H,
    tilewidth: 32,
    tileheight: 32,
    orientation: 'orthogonal',
    tilesets: [
      {
        firstgid: 1,
        name: 'zone3-tiles',
        tilewidth: 32,
        tileheight: 32,
        columns: 2,
        tilecount: 2,
        image: 'shape-atlas',
        imagewidth: 64,
        imageheight: 32,
      },
    ],
    layers: [
      {
        type: 'tilelayer',
        name: 'water',
        width: W,
        height: H,
        data: buildWaterLayer(),
        visible: true,
        opacity: 1,
      },
      {
        type: 'tilelayer',
        name: 'fog',
        width: W,
        height: H,
        data: buildFogLayer(),
        visible: true,
        opacity: 1,
      },
    ],
  };
}

/** Map tile gid to a sprite frame name. gid===0 means empty. */
function frameForGid(gid: number): string | null {
  if (gid === WATER) return 'tile-water';
  if (gid === FOG) return 'tile-fog';
  return null;
}

export interface TilemapBgDeps {
  world: World;
  atlas: { image: SkImage; sheet: SpriteSheet };
  viewportWidth: number;
  viewportHeight: number;
}

export interface TilemapBgController {
  readonly data: TilemapData;
  /** Advance the scroll and wrap tiles back to the top when they exit the bottom. */
  update(dt: number, viewportHeight: number): void;
  /** Destroy all spawned tile sprite entities. */
  destroy(): void;
}

interface TileEntry {
  id: number;
  baseY: number;
}

/**
 * Create the Zone-3 tilemap background.  Spawns one sprite entity per non-empty
 * tile and positions them in world space.  Tile entities have Position + Sprite
 * only (no Velocity, no collider) so the standard render system picks them up.
 */
export function createZone3TilemapBg(deps: TilemapBgDeps): TilemapBgController {
  const data = parseTiled(zone3TilemapJson());
  const { world, atlas } = deps;
  const entries: TileEntry[] = [];

  const mapHeightPx = data.height * data.tileHeight;
  // Center horizontally; align the first tile so that rows 0..H-1 occupy y ∈ [0, mapHeightPx).
  const offsetX = Math.max(0, (deps.viewportWidth - data.width * data.tileWidth) / 2);

  for (const layer of data.layers) {
    if (layer.type !== 'tile') continue;
    const tileLayer = layer as TileLayer;
    for (let row = 0; row < tileLayer.height; row++) {
      for (let col = 0; col < tileLayer.width; col++) {
        const gid = tileLayer.tiles[row * tileLayer.width + col] ?? 0;
        const name = frameForGid(gid);
        if (!name) continue;
        const f: SpriteFrame | undefined = getFrame(atlas.sheet, name);
        if (!f) continue;
        const x = offsetX + col * data.tileWidth + data.tileWidth / 2;
        const y = row * data.tileHeight + data.tileHeight / 2;
        const id = world.spawn();
        world.add(id, Position, { x, y });
        world.add(id, Sprite, {
          image: atlas.image,
          frame: f,
          z: BG_Z,
          anchor: ANCHOR,
        });
        entries.push({ id, baseY: y });
      }
    }
  }

  let scroll = 0;

  return {
    data,
    update(dt, viewportHeight) {
      scroll = (scroll + dt * SCROLL_SPEED) % mapHeightPx;
      // Recompute each tile's position from baseY + scroll, wrapping vertically.
      for (const e of entries) {
        const pos = world.get(e.id, Position);
        if (!pos) continue;
        let y = e.baseY + scroll;
        if (y >= mapHeightPx) y -= mapHeightPx;
        // Hide tiles above the viewport by shifting them one map-height below
        // the bottom — they'll come back around next wrap.  Keeps the sprite
        // batch culled naturally by the camera without destroy/respawn.
        if (y < -data.tileHeight) y += mapHeightPx;
        if (y > viewportHeight + data.tileHeight) y -= mapHeightPx;
        pos.y = y;
      }
    },
    destroy() {
      for (const e of entries) {
        world.destroy(e.id);
      }
      entries.length = 0;
    },
  };
}
