import type { SkImageLike } from '@flare-engine/assets';
import type { Rect } from '@flare-engine/math';
import type { Camera2D } from '@flare-engine/render';
import { SpriteBatch } from '@flare-engine/render';
import type { TileLayer, TilemapData } from './tilemap-data.js';
import { GID_FLIP_MASK, getTileAt, getTilesetForGid } from './tilemap-data.js';

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
   */
  drawInto(camera: Camera2D, batch: SpriteBatch): void {
    const bounds = camera.getBoundsInto(this._boundsBuf);
    const tw = this.map.tileWidth;
    const th = this.map.tileHeight;

    for (const layer of this.map.layers) {
      if (layer.type !== 'tile' || !layer.visible) continue;
      this._drawTileLayer(layer, bounds.x, bounds.y, bounds.width, bounds.height, tw, th, batch);
    }
  }

  /**
   * Draw visible tile layers using the camera for culling.
   * Call `flush` on a callback to issue the actual draw calls.
   * Delegates to `drawInto` so culling and queuing logic live in one place.
   */
  draw(camera: Camera2D, flush: (batch: SpriteBatch) => void): void {
    this.drawInto(camera, this.batch);
    flush(this.batch);
  }

  // Flip rendering transforms (horizontal/vertical/diagonal) are a deferred
  // limitation — render-flip support is post-flip M10. Tileset resolution and
  // collider extraction are correct for flipped GIDs as of B8.
  private _drawTileLayer(
    layer: TileLayer,
    viewX: number,
    viewY: number,
    viewW: number,
    viewH: number,
    tw: number,
    th: number,
    batch: SpriteBatch,
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

        // Inlined source-rect math — strips flip bits, avoids allocating a Rect per tile.
        const localId = (gid & GID_FLIP_MASK) - tileset.firstGid;
        const srcCol = localId % tileset.columns;
        const srcRow = (localId - srcCol) / tileset.columns;
        const srcX = srcCol * tileset.tileWidth;
        const srcY = srcRow * tileset.tileHeight;
        const dstX = col * tw + offsetX;
        const dstY = row * th + offsetY;

        batch.drawRaw(image, srcX, srcY, tileset.tileWidth, tileset.tileHeight, dstX, dstY, tw, th);
      }
    }
  }
}
