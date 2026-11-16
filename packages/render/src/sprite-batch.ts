import type { SkImageLike, SpriteFrame } from '@flare-engine/assets';
import type { Renderer } from './renderer.js';
import type { AnySpriteEffect } from './sprite-effects.js';

/**
 * Axis-aligned bounds used for viewport culling in the batch.
 * All coordinates are in the same space as the sprite destination rects.
 */
export interface BatchCullBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

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
   *  per draw call without per-sprite overhead. A sprite drawn with a `color`
   *  is the exception: its alpha is folded into that colour and leaves the key. */
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
  /**
   * Blend mode for this batch run. Participates in the batch key — sprites
   * with different blend modes are placed in separate runs.
   * `'normal'` (default): standard alpha-over (SrcOver).
   * `'additive'`: destination pixel receives `src + dst` (Skia Plus mode) —
   *   useful for particle add-ons, glows, and projectile trails.
   */
  blend: 'normal' | 'additive';
  /**
   * Mirror the sprite horizontally about its center.
   * Participates in the batch key. Flipped sprites are drawn via
   * `drawImageRect` with a canvas scale(-1, 1) transform — one draw call
   * per sprite (per-sprite draw call trade-off, documented).
   * `rotation` is honoured: the renderer rotates about the anchor point (as
   * the atlas path does) and then mirrors about the sprite centre.
   */
  flipX: boolean;
  /**
   * Mirror the sprite vertically about its center.
   * Same trade-offs as flipX; the two may be combined freely.
   */
  flipY: boolean;
}

/** Internal run-bucket — one reused across all runs per flush. */
interface Batch {
  image: SkImageLike;
  effect: AnySpriteEffect | undefined;
  alpha: number;
  colored: boolean;
  stretch: boolean;
  blend: 'normal' | 'additive';
  flipX: boolean;
  flipY: boolean;
  commands: SpriteDrawCommand[];
}

/** Sprites the colour buffers hold before their first growth. */
const INITIAL_COLOR_CAPACITY = 64;

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
 * 4. A sprite drawn with a `color` carries its alpha in that colour instead, so
 *    consecutive coloured sprites that differ only in colour or alpha share one
 *    run.
 *
 * The actual Skia Atlas draw call is delegated to a callback so this module
 * remains testable without Skia.
 */
export class SpriteBatch {
  private _commands: SpriteDrawCommand[] = [];
  private _pool: SpriteDrawCommand[] = [];
  private _batches: Batch[] = [];
  private _allocCount = 0;
  // Parallel to `_commands` by index, grown together. `_colored[i]` is 1 when
  // command `i` was drawn with a colour; `_colors[i]` is then its packed ARGB
  // with the command's alpha already folded into the alpha byte.
  private _colors = new Uint32Array(INITIAL_COLOR_CAPACITY);
  private _colored = new Uint8Array(INITIAL_COLOR_CAPACITY);
  // The current run's colours, from index 0 — what the flush callback receives.
  private _runColors = new Uint32Array(INITIAL_COLOR_CAPACITY);
  private _cull: { minX: number; minY: number; maxX: number; maxY: number } | null = null;

  /** Number of queued draw commands. */
  get count(): number {
    return this._commands.length;
  }

  /** Cumulative number of SpriteDrawCommand objects allocated because the internal
   *  command pool was empty. Steady state should be 0 after warm-up. */
  get allocCount(): number {
    return this._allocCount;
  }

  /**
   * Current cull bounds, or `null` when culling is disabled.
   * Read by `drawNineSlice` for coarse AABB precheck.
   * Set via `setCullBounds()` / `clearCullBounds()`.
   */
  get cullBounds(): BatchCullBounds | null {
    return this._cull;
  }

  /** Set the viewport cull bounds for this batch.
   *  Zero-alloc in steady state — the internal object is allocated once and then mutated. */
  setCullBounds(minX: number, minY: number, maxX: number, maxY: number): void {
    if (this._cull === null) {
      this._cull = { minX, minY, maxX, maxY };
    } else {
      this._cull.minX = minX;
      this._cull.minY = minY;
      this._cull.maxX = maxX;
      this._cull.maxY = maxY;
    }
  }

  /** Disable viewport culling (e.g. during UI rendering). */
  clearCullBounds(): void {
    this._cull = null;
  }

  /** Queue a sprite draw from a frame.
   *
   *  `anchorX` / `anchorY` define the pivot point of the sprite as a
   *  fraction of its destination size — `(0, 0)` = top-left (default),
   *  `(0.5, 0.5)` = center, `(1, 1)` = bottom-right. `dstX` / `dstY`
   *  then refer to the anchor point instead of the top-left corner.
   *
   *  `alpha` is a per-instance opacity multiplier in [0, 1]. Default 1.
   *
   *  `color` is an optional packed-ARGB multiplier (`0xAARRGGBB`): each texel is
   *  multiplied by it channel by channel, and `alpha` multiplies its alpha byte.
   *  Sprites drawn with a `color` batch regardless of colour and alpha — see
   *  `flush()`. Omit it and the sprite draws exactly as it did without one. */
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
    blend: 'normal' | 'additive' = 'normal',
    flipX = false,
    flipY = false,
    color?: number,
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
    cmd.blend = blend;
    cmd.flipX = flipX;
    cmd.flipY = flipY;
    this._setColor(this._commands.length, color, alpha);
    this._commands.push(cmd);
  }

  /** Queue a raw sprite draw with explicit src/dst rects. `dstX` / `dstY`
   *  refer to the anchor point — offset by `anchorX * dstW` / `anchorY * dstH`.
   *
   *  `alpha` is a per-instance opacity multiplier in [0, 1]. Default 1.
   *
   *  `color` is an optional packed-ARGB multiplier — see `draw()`. */
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
    blend: 'normal' | 'additive' = 'normal',
    flipX = false,
    flipY = false,
    color?: number,
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
    cmd.blend = blend;
    cmd.flipX = flipX;
    cmd.flipY = flipY;
    this._setColor(this._commands.length, color, alpha);
    this._commands.push(cmd);
  }

  /**
   * Flush all queued commands in insertion order, grouping maximal consecutive
   * runs that share the same `(image, effect, alpha, stretch)` key into a
   * single `drawAtlas` call. This preserves global z-order (the caller is
   * responsible for queuing in z-sorted order) while still batching runs of
   * same-key sprites for efficiency.
   *
   * Sprites drawn with a `color` form their own runs, keyed by
   * `(image, effect, stretch, blend, flipX, flipY)`. `alpha` is not in that
   * key, because it is folded into each sprite's colour. A coloured sprite and
   * an uncoloured one never share a run.
   *
   * @param drawAtlas Callback invoked once per run. Receives
   *   `(image, commands)` — all commands in a run share the same key and are
   *   contiguous in the original insertion order. A coloured run adds a third
   *   argument, `colors`: packed ARGB, `colors[i]` belonging to `commands[i]`,
   *   with that command's alpha already multiplied into the alpha byte. The
   *   buffer is reused and may be longer than `commands`: read its first
   *   `commands.length` entries, and only inside the callback.
   * @param renderer Optional renderer to record stats.
   */
  flush(
    drawAtlas: (image: SkImageLike, commands: SpriteDrawCommand[], colors?: Uint32Array) => void,
    renderer?: Renderer,
  ): void {
    if (this._commands.length === 0) return;

    // Ensure one reusable run-bucket exists (allocated once, never in steady state).
    let run = this._batches[0];
    if (run === undefined) {
      run = {
        image: null!,
        effect: undefined,
        alpha: 1,
        colored: false,
        stretch: false,
        blend: 'normal',
        flipX: false,
        flipY: false,
        commands: [],
      };
      this._batches[0] = run;
    }

    const commands = this._commands;
    const colors = this._colors;
    const colored = this._colored;
    const runColors = this._runColors;

    // Walk commands in insertion order. Emit a drawAtlas call whenever the
    // run key changes, then reset the run bucket for the next run.
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i] as SpriteDrawCommand;
      const cmdColored = colored[i] === 1;
      if (
        run.commands.length > 0 &&
        (cmd.image !== run.image ||
          cmd.effect !== run.effect ||
          cmdColored !== run.colored ||
          // A coloured sprite's alpha lives in its colour, so it cannot split a run.
          (!cmdColored && cmd.alpha !== run.alpha) ||
          cmd.stretch !== run.stretch ||
          cmd.blend !== run.blend ||
          cmd.flipX !== run.flipX ||
          cmd.flipY !== run.flipY)
      ) {
        if (run.colored) drawAtlas(run.image, run.commands, runColors);
        else drawAtlas(run.image, run.commands);
        if (renderer) {
          renderer.recordDrawCall();
          renderer.recordBatch();
        }
        run.commands.length = 0;
      }
      run.image = cmd.image;
      run.effect = cmd.effect;
      run.alpha = cmd.alpha;
      run.colored = cmdColored;
      run.stretch = cmd.stretch;
      run.blend = cmd.blend;
      run.flipX = cmd.flipX;
      run.flipY = cmd.flipY;
      if (cmdColored) runColors[run.commands.length] = colors[i] as number;
      run.commands.push(cmd);
    }

    // Flush the final run.
    if (run.commands.length > 0) {
      if (run.colored) drawAtlas(run.image, run.commands, runColors);
      else drawAtlas(run.image, run.commands);
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

  /**
   * Record whether the command about to be queued at `index` is coloured and,
   * if so, its colour with `alpha` folded into the alpha byte.
   */
  private _setColor(index: number, color: number | undefined, alpha: number): void {
    if (index === this._colors.length) {
      const capacity = index * 2;
      const colors = new Uint32Array(capacity);
      colors.set(this._colors);
      this._colors = colors;
      const colored = new Uint8Array(capacity);
      colored.set(this._colored);
      this._colored = colored;
      // Written from index 0 during each flush, so there is nothing to carry over.
      this._runColors = new Uint32Array(capacity);
    }
    if (color === undefined) {
      this._colored[index] = 0;
      return;
    }
    this._colored[index] = 1;
    const a = alpha <= 0 ? 0 : alpha >= 1 ? 1 : alpha;
    // `>>> 0`: a set alpha bit would otherwise make the packed value negative.
    this._colors[index] = ((Math.round((color >>> 24) * a) << 24) | (color & 0x00ffffff)) >>> 0;
  }

  private _acquire(): SpriteDrawCommand {
    if (this._pool.length > 0) {
      return this._pool.pop()!;
    }
    this._allocCount++;
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
      blend: 'normal',
      flipX: false,
      flipY: false,
    };
  }
}
