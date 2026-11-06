import type { SkImageLike } from '@flare-engine/assets';
import type { Rect } from '@flare-engine/math';
import type { AnySpriteEffect, Camera2D } from '@flare-engine/render';
import { SpriteBatch } from '@flare-engine/render';
import type { TileAnimation, TileLayer, TilemapData } from './tilemap-data.js';
import {
  GID_FLIP_MASK,
  getTileAt,
  getTileSourceRectInto,
  getTilesetForGid,
} from './tilemap-data.js';

// Tiled GID flag bits (kept module-private; tilemap-data.ts owns the public mask).
const FLIP_H = 0x80000000;
const FLIP_V = 0x40000000;
const FLIP_D = 0x20000000;
const QUARTER_TURN = Math.PI / 2;

/**
 * Per-draw options for `TilemapRenderer.drawInto` / `draw`.
 *
 * `effect` is set on every queued tile command. Batch runs key on the effect
 * by reference, so one shared instance (e.g. an ambient `tint()`) keeps every
 * tile — and any sprite drawn with the same instance — in a single run.
 * `alphaScale` multiplies each layer's own `opacity` (default 1).
 * `time` (seconds, e.g. the clock's elapsed) advances Tiled tile animations
 * parsed onto `TilesetRef.animations`; it wraps in both directions. Without
 * it (or when non-finite) every tile draws as authored.
 */
export interface TilemapDrawOptions {
  effect?: AnySpriteEffect;
  alphaScale?: number;
  time?: number;
}

/** Local tile id of the frame an animation shows at `time` (seconds, finite). */
function animatedLocalId(anim: TileAnimation, time: number): number {
  let t = time % anim.duration;
  if (t < 0) t += anim.duration;
  const ends = anim.ends;
  const last = ends.length - 1;
  let i = 0;
  // A frame boundary belongs to the next frame; ends[last] === duration > t stops the scan.
  while (i < last && t >= (ends[i] ?? 0)) i++;
  // The `?? 0` is unreachable (i <= last < frames.length) — it satisfies noUncheckedIndexedAccess.
  return anim.frames[i] ?? 0;
}

/**
 * TilemapRenderer — draws a tilemap with viewport culling.
 * Only tiles visible to the camera are submitted to the SpriteBatch.
 */
export class TilemapRenderer {
  /** The tilemap data to render. */
  readonly map: TilemapData;

  /** SpriteBatch used for batched tile rendering. */
  readonly batch: SpriteBatch;

  /** Map from tileset name → SkImage. Set via setTilesetImage(). */
  private _images = new Map<string, SkImageLike>();

  /** Reusable bounds rect — avoids per-frame allocation from camera.getBounds(). */
  private _boundsBuf: Rect = { x: 0, y: 0, width: 0, height: 0 };

  /** Reusable source rect — avoids a per-tile allocation from getTileSourceRect. */
  private _srcBuf: Rect = { x: 0, y: 0, width: 0, height: 0 };

  constructor(map: TilemapData) {
    this.map = map;
    this.batch = new SpriteBatch();
  }

  /** Associate a loaded image with a tileset by name. */
  setTilesetImage(tilesetName: string, image: SkImageLike): void {
    this._images.set(tilesetName, image);
  }

  /**
   * Queue visible tile layers into a caller-owned `batch` using the camera for
   * culling. Does NOT flush — the caller owns the single flush so tiles z-order
   * under sprites. Zero-alloc: reuses the internal bounds buffer.
   *
   * Each tile's `alpha` is `layer.opacity * opts.alphaScale`; `opts.effect`
   * is applied to every tile; `opts.time` picks each animated tile's frame
   * (see `TilemapDrawOptions`).
   */
  drawInto(camera: Camera2D, batch: SpriteBatch, opts?: TilemapDrawOptions): void {
    const bounds = camera.getBoundsInto(this._boundsBuf);
    const tw = this.map.tileWidth;
    const th = this.map.tileHeight;
    const effect = opts?.effect;
    const alphaScale = opts?.alphaScale ?? 1;
    // NaN stands for "no time": the layer pass animates only when `time` is finite.
    const time = opts?.time ?? Number.NaN;

    for (const layer of this.map.layers) {
      if (layer.type !== 'tile' || !layer.visible) continue;
      this._drawTileLayer(
        layer,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        tw,
        th,
        batch,
        effect,
        layer.opacity * alphaScale,
        time,
      );
    }
  }

  /**
   * Draw visible tile layers using the camera for culling.
   * Call `flush` on a callback to issue the actual draw calls.
   * Delegates to `drawInto` so culling and queuing logic live in one place;
   * `opts` is threaded through unchanged.
   */
  draw(camera: Camera2D, flush: (batch: SpriteBatch) => void, opts?: TilemapDrawOptions): void {
    this.drawInto(camera, this.batch, opts);
    flush(this.batch);
  }

  // Tiled flip bits: H/V become the batch's flipX/flipY; the diagonal bit is a
  // quarter turn about the tile centre composed with the flip Tiled defines
  // (D+H = 90° CW, D+V = 90° CCW, D = flipY + CW, D+H+V = flipX + CW).
  private _drawTileLayer(
    layer: TileLayer,
    viewX: number,
    viewY: number,
    viewW: number,
    viewH: number,
    tw: number,
    th: number,
    batch: SpriteBatch,
    effect: AnySpriteEffect | undefined,
    alpha: number,
    time: number,
  ): void {
    const offsetX = layer.offsetX;
    const offsetY = layer.offsetY;
    const animate = Number.isFinite(time);

    // Calculate visible tile range (clamped to layer bounds)
    const startCol = Math.max(0, Math.floor((viewX - offsetX) / tw));
    const startRow = Math.max(0, Math.floor((viewY - offsetY) / th));
    const endCol = Math.min(layer.width - 1, Math.floor((viewX - offsetX + viewW) / tw));
    const endRow = Math.min(layer.height - 1, Math.floor((viewY - offsetY + viewH) / th));

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const gid = getTileAt(layer, col, row);
        if (gid === 0) continue;

        const tileset = getTilesetForGid(this.map.tilesets, gid);
        if (!tileset) continue;

        const image = this._images.get(tileset.name);
        if (!image) continue;

        // An animated tile sources its current frame; flip bits still come from `gid`.
        let srcGid = gid;
        if (animate && tileset.animations !== undefined) {
          const anim = tileset.animations.get((gid & GID_FLIP_MASK) - tileset.firstGid);
          if (anim !== undefined) srcGid = tileset.firstGid + animatedLocalId(anim, time);
        }

        // Strips flip bits; writes into the reusable buffer, no per-tile allocation.
        const src = getTileSourceRectInto(tileset, srcGid, this._srcBuf);

        // Bit tests only — `gid & FLIP_H` is a negative Int32 when set, so compare to 0.
        const h = (gid & FLIP_H) !== 0;
        const v = (gid & FLIP_V) !== 0;
        const d = (gid & FLIP_D) !== 0;
        let flipX = h;
        let flipY = v;
        let rotation = 0;
        if (d) {
          rotation = !h && v ? -QUARTER_TURN : QUARTER_TURN;
          flipX = h && v;
          flipY = !h && !v;
        }

        // Centre anchor keeps a turned tile in its cell; the stored dstX/dstY
        // stay the cell's top-left. Positional slots — no per-tile object.
        batch.drawRaw(
          image,
          src.x,
          src.y,
          src.width,
          src.height,
          col * tw + offsetX + tw * 0.5,
          row * th + offsetY + th * 0.5,
          tw,
          th,
          effect,
          0.5,
          0.5,
          alpha,
          rotation,
          false,
          'normal',
          flipX,
          flipY,
        );
      }
    }
  }
}
