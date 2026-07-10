import type { SkImageLike, SpriteFrame } from '@flare-engine/assets';
import type { Renderer } from './renderer.js';
import type { AnySpriteEffect } from './sprite-effects.js';

/** A single sprite draw request in the batch. */
export interface SpriteDrawCommand {
  /** Texture (Skia SkImage). */
  image: SkImageLike;
  /** Source rectangle in the texture. */
  srcX: number;
  srcY: number;
  srcW: number;
  srcH: number;
  /** Destination position and size. */
  dstX: number;
  dstY: number;
  dstW: number;
  dstH: number;
  /** Optional per-sprite effect. Shared by reference across commands in a
   *  batch — the render adapter applies it once per batch. */
  effect: AnySpriteEffect | undefined;
  /** Per-instance alpha multiplier. Range [0, 1]. Default 1 (fully opaque).
   *  Participates in the batch key — sprites with different alphas are
   *  placed in separate batches so the renderer can apply each alpha once
   *  per draw call without per-sprite overhead. */
  alpha: number;
  /** Rotation in radians, clockwise (Skia Y-down convention). Default 0.
   *  Rotation is applied about the anchor point. */
  rotation: number;
  /** Anchor X fraction stored for the bridge rotation path. Range [0, 1]. */
  anchorX: number;
  /** Anchor Y fraction stored for the bridge rotation path. Range [0, 1]. */
  anchorY: number;
  /**
   * When true, the sprite is drawn via `drawImageRect` so `dstW` and `dstH`
   * are honored independently (non-uniform scale). A 256×256 source image
   * will fill an arbitrary W×H destination rect.
   *
   * Default (false/absent): drawn via the batched `drawAtlas` path (uniform
   * scale — dstW/srcW drives both axes). Stretched sprites are NOT batched
   * with regular sprites; each is an independent `drawImageRect` call.
   *
   * Rotation is unsupported in stretch mode — the RSXform similarity-transform
   * limit does not apply, but the bridge draws a plain axis-aligned rect.
   * Combine with a zero rotation only.
   */
  stretch: boolean;
}

/** Internal run-bucket — one reused across all runs per flush. */
interface Batch {
  image: SkImageLike;
  effect: AnySpriteEffect | undefined;
  alpha: number;
  stretch: boolean;
  commands: SpriteDrawCommand[];
}

/**
 * SpriteBatch — collects sprite draw commands and groups them by texture
 * (and optionally by effect) for efficient batched rendering.
 *
 * Usage:
 * 1. Call `draw()` for each sprite, optionally passing an effect
 * 2. Call `flush()` with an atlas draw callback to execute all batched draws
 * 3. Batching groups consecutive commands by `(image, effect, alpha, stretch)`
 *    identity, preserving global insertion (z-sorted) order. Sharing an effect
 *    reference and the same alpha across consecutive entities maximizes batch
 *    size while keeping sprites in correct draw order.
 *
 * The actual Skia Atlas draw call is delegated to a callback so this module
 * remains testable without Skia.
 */
export class SpriteBatch {
  private _commands: SpriteDrawCommand[] = [];
  private _pool: SpriteDrawCommand[] = [];
  private _batches: Batch[] = [];

  /** Number of queued draw commands. */
  get count(): number {
    return this._commands.length;
  }

  /** Queue a sprite draw from a frame.
   *
   *  `anchorX` / `anchorY` define the pivot point of the sprite as a
   *  fraction of its destination size — `(0, 0)` = top-left (default),
   *  `(0.5, 0.5)` = center, `(1, 1)` = bottom-right. `dstX` / `dstY`
   *  then refer to the anchor point instead of the top-left corner.
   *
   *  `alpha` is a per-instance opacity multiplier in [0, 1]. Default 1. */
  draw(
    image: SkImageLike,
    frame: SpriteFrame,
    dstX: number,
    dstY: number,
    dstW?: number,
    dstH?: number,
    effect?: AnySpriteEffect,
    anchorX = 0,
    anchorY = 0,
    alpha = 1,
    rotation = 0,
    stretch = false,
  ): void {
    const cmd = this._acquire();
    const w = dstW ?? frame.w;
    const h = dstH ?? frame.h;
    cmd.image = image;
    cmd.srcX = frame.x;
    cmd.srcY = frame.y;
    cmd.srcW = frame.w;
    cmd.srcH = frame.h;
    cmd.dstX = dstX - anchorX * w;
    cmd.dstY = dstY - anchorY * h;
    cmd.dstW = w;
    cmd.dstH = h;
    cmd.effect = effect;
    cmd.alpha = alpha;
    cmd.rotation = rotation;
    cmd.anchorX = anchorX;
    cmd.anchorY = anchorY;
    cmd.stretch = stretch;
    this._commands.push(cmd);
  }

  /** Queue a raw sprite draw with explicit src/dst rects. `dstX` / `dstY`
   *  refer to the anchor point — offset by `anchorX * dstW` / `anchorY * dstH`.
   *
   *  `alpha` is a per-instance opacity multiplier in [0, 1]. Default 1. */
  drawRaw(
    image: SkImageLike,
    srcX: number,
    srcY: number,
    srcW: number,
    srcH: number,
    dstX: number,
    dstY: number,
    dstW: number,
    dstH: number,
    effect?: AnySpriteEffect,
    anchorX = 0,
    anchorY = 0,
    alpha = 1,
    rotation = 0,
    stretch = false,
  ): void {
    const cmd = this._acquire();
    cmd.image = image;
    cmd.srcX = srcX;
    cmd.srcY = srcY;
    cmd.srcW = srcW;
    cmd.srcH = srcH;
    cmd.dstX = dstX - anchorX * dstW;
    cmd.dstY = dstY - anchorY * dstH;
    cmd.dstW = dstW;
    cmd.dstH = dstH;
    cmd.effect = effect;
    cmd.alpha = alpha;
    cmd.rotation = rotation;
    cmd.anchorX = anchorX;
    cmd.anchorY = anchorY;
    cmd.stretch = stretch;
    this._commands.push(cmd);
  }

  /**
   * Flush all queued commands in insertion order, grouping maximal consecutive
   * runs that share the same `(image, effect, alpha, stretch)` key into a
   * single `drawAtlas` call. This preserves global z-order (the caller is
   * responsible for queuing in z-sorted order) while still batching runs of
   * same-key sprites for efficiency.
   *
   * @param drawAtlas Callback invoked once per run. Receives
   *   `(image, commands)` — all commands in a run share the same key and are
   *   contiguous in the original insertion order.
   * @param renderer Optional renderer to record stats.
   */
  flush(
    drawAtlas: (image: SkImageLike, commands: SpriteDrawCommand[]) => void,
    renderer?: Renderer,
  ): void {
    if (this._commands.length === 0) return;

    // Ensure one reusable run-bucket exists (allocated once, never in steady state).
    let run = this._batches[0];
    if (run === undefined) {
      run = { image: null!, effect: undefined, alpha: 1, stretch: false, commands: [] };
      this._batches[0] = run;
    }

    // Walk commands in insertion order. Emit a drawAtlas call whenever the
    // run key changes, then reset the run bucket for the next run.
    for (const cmd of this._commands) {
      if (
        run.commands.length > 0 &&
        (cmd.image !== run.image ||
          cmd.effect !== run.effect ||
          cmd.alpha !== run.alpha ||
          cmd.stretch !== run.stretch)
      ) {
        drawAtlas(run.image, run.commands);
        if (renderer) {
          renderer.recordDrawCall();
          renderer.recordBatch();
        }
        run.commands.length = 0;
      }
      run.image = cmd.image;
      run.effect = cmd.effect;
      run.alpha = cmd.alpha;
      run.stretch = cmd.stretch;
      run.commands.push(cmd);
    }

    // Flush the final run.
    if (run.commands.length > 0) {
      drawAtlas(run.image, run.commands);
      if (renderer) {
        renderer.recordDrawCall();
        renderer.recordBatch();
      }
      run.commands.length = 0;
    }

    // Return commands to pool. Field values remain on the command until
    // the next draw() overwrites them — consumers must read inside the
    // drawAtlas callback, not after flush returns.
    for (const cmd of this._commands) {
      this._pool.push(cmd);
    }
    this._commands.length = 0;
  }

  /** Clear all queued commands without drawing. */
  clear(): void {
    for (const cmd of this._commands) {
      this._pool.push(cmd);
    }
    this._commands.length = 0;
  }

  private _acquire(): SpriteDrawCommand {
    if (this._pool.length > 0) {
      return this._pool.pop()!;
    }
    return {
      image: null!,
      srcX: 0,
      srcY: 0,
      srcW: 0,
      srcH: 0,
      dstX: 0,
      dstY: 0,
      dstW: 0,
      dstH: 0,
      effect: undefined,
      alpha: 1,
      rotation: 0,
      anchorX: 0,
      anchorY: 0,
      stretch: false,
    };
  }
}
