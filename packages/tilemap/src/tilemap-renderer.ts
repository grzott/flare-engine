import type { SkImageLike } from '@flare-engine/assets';
import type { Rect } from '@flare-engine/math';
import type { AnySpriteEffect, Camera2D } from '@flare-engine/render';
import { SpriteBatch } from '@flare-engine/render';
import type { TileLayer, TilemapData } from './tilemap-data.js';
import { getTileAt, getTileSourceRectInto, getTilesetForGid } from './tilemap-data.js';

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
 */
export interface TilemapDrawOptions {
  effect?: AnySpriteEffect;
  alphaScale?: number;
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
   * is applied to every tile (see `TilemapDrawOptions`).
   */
  drawInto(camera: Camera2D, batch: SpriteBatch, opts?: TilemapDrawOptions): void {
    const bounds = camera.getBoundsInto(this._boundsBuf);
    const tw = this.map.tileWidth;
    const th = this.map.tileHeight;
    const effect = opts?.effect;
    const alphaScale = opts?.alphaScale ?? 1;

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
  // @flare-engine/render's flip draw path ignores `rotation` (see
  // SpriteDrawCommand.flipX), so D alone and D+H+V queue the right command
  // but draw without the turn until render composes the two.
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
  ): void {
    const offsetX = layer.offsetX;
    const offsetY = layer.offsetY;

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

        // Strips flip bits; writes into the reusable buffer, no per-tile allocation.
        const src = getTileSourceRectInto(tileset, gid, this._srcBuf);

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
