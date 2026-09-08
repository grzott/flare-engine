import type { SkImageLike, SpriteFrame } from '@flare-engine/assets';
import type { SpriteBatch } from './sprite-batch.js';
import type { AnySpriteEffect } from './sprite-effects.js';

/**
 * Draw a sprite using a 9-slice (scale-9) layout.
 *
 * The source frame is divided into a 3×3 grid by `inset` pixels from each
 * edge. Corners draw at natural size; edges stretch along one axis; the
 * centre stretches in both axes. This preserves crisp borders at any
 * destination size — the canonical use case is UI panels and buttons.
 *
 * All 9 slices use the `drawImageRect` (`stretch=true`) path, so they are
 * NOT batched with regular Atlas sprites; they form their own consecutive run
 * in the batch. The function calls `batch.drawRaw()` for each non-degenerate
 * slice (a slice with zero source or destination area is skipped silently).
 *
 * **Coarse culling:** if `batch.cullBounds` is set, the entire nine-slice is
 * skipped when the destination rectangle `[x, y, x+w, y+h]` does not
 * intersect the bounds. Individual slice culling is not performed — the
 * caller should set tight bounds if per-slice savings matter.
 *
 * @param batch  Target SpriteBatch — must outlive this call.
 * @param image  Source texture.
 * @param frame  Sub-region of the texture to use as the nine-slice source.
 * @param x      Destination left edge (screen / world coords).
 * @param y      Destination top edge.
 * @param w      Destination width.
 * @param h      Destination height.
 * @param inset  Border size in source-texture pixels, applied uniformly to
 *               all four edges. Must be ≥ 0; clamped to half the frame
 *               dimension so corners never overlap.
 * @param effect Optional sprite effect applied to every slice identically.
 * @param alpha  Per-instance opacity multiplier in [0, 1]. Default 1.
 */
export function drawNineSlice(
  batch: SpriteBatch,
  image: SkImageLike,
  frame: SpriteFrame,
  x: number,
  y: number,
  w: number,
  h: number,
  inset: number,
  effect?: AnySpriteEffect,
  alpha = 1,
): void {
  const cb = batch.cullBounds;
  if (cb !== null) {
    if (x + w <= cb.minX || x >= cb.maxX || y + h <= cb.minY || y >= cb.maxY) return;
  }

  const si = Math.min(inset, frame.w * 0.5, frame.h * 0.5);
  const di = Math.min(si, w * 0.5, h * 0.5);

  const fx = frame.x;
  const fy = frame.y;
  const fw = frame.w;
  const fh = frame.h;

  const srcMidW = fw - 2 * si;
  const srcMidH = fh - 2 * si;
  const dstMidW = w - 2 * di;
  const dstMidH = h - 2 * di;

  const a = alpha;
  const e = effect;

  // row: top
  _slice(batch, image, fx, fy, si, si, x, y, di, di, e, a);
  _slice(batch, image, fx + si, fy, srcMidW, si, x + di, y, dstMidW, di, e, a);
  _slice(batch, image, fx + fw - si, fy, si, si, x + w - di, y, di, di, e, a);
  // row: middle
  _slice(batch, image, fx, fy + si, si, srcMidH, x, y + di, di, dstMidH, e, a);
  _slice(batch, image, fx + si, fy + si, srcMidW, srcMidH, x + di, y + di, dstMidW, dstMidH, e, a);
  _slice(batch, image, fx + fw - si, fy + si, si, srcMidH, x + w - di, y + di, di, dstMidH, e, a);
  // row: bottom
  _slice(batch, image, fx, fy + fh - si, si, si, x, y + h - di, di, di, e, a);
  _slice(batch, image, fx + si, fy + fh - si, srcMidW, si, x + di, y + h - di, dstMidW, di, e, a);
  _slice(batch, image, fx + fw - si, fy + fh - si, si, si, x + w - di, y + h - di, di, di, e, a);
}

function _slice(
  batch: SpriteBatch,
  image: SkImageLike,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  effect: AnySpriteEffect | undefined,
  alpha: number,
): void {
  if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return;
  batch.drawRaw(image, sx, sy, sw, sh, dx, dy, dw, dh, effect, 0, 0, alpha, 0, true);
}
