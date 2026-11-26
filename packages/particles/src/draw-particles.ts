import type { Color } from '@flare-engine/math';
import type { ParticlePool } from './particle-pool.js';

/**
 * The frame rectangle within a texture. Structural on purpose: it matches
 * `SpriteFrame` from `@flare-engine/assets` without this package depending on
 * it — extra members like `name` are simply ignored.
 */
export interface ParticleFrameLike {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The one method this adapter needs from a sprite batch.
 *
 * Declared structurally so `@flare-engine/particles` keeps its two dependencies
 * (`core`, `math`) and stays usable with no renderer at all. A real
 * `SpriteBatch` from `@flare-engine/render` satisfies it; so does a test double.
 * The parameter list mirrors `SpriteBatch.drawRaw`. `color` is a packed-ARGB
 * multiplier (`0xAARRGGBB`); a batch that declares fewer parameters simply does
 * not receive it.
 */
export interface ParticleBatchLike {
  drawRaw(
    image: unknown,
    srcX: number,
    srcY: number,
    srcW: number,
    srcH: number,
    dstX: number,
    dstY: number,
    dstW: number,
    dstH: number,
    effect?: unknown,
    anchorX?: number,
    anchorY?: number,
    alpha?: number,
    rotation?: number,
    stretch?: boolean,
    blend?: 'normal' | 'additive',
    flipX?: boolean,
    flipY?: boolean,
    color?: number,
  ): void;
}

/** Options for `drawParticles`. */
export interface DrawParticlesOptions {
  /**
   * A single effect applied to every particle in this call.
   *
   * Constant for the whole batch, and deliberately not per-particle: a batch
   * retains the effect *reference* until it flushes, so one mutable object
   * reused across the loop would give every particle the last particle's
   * values. Per-particle effects therefore cost one object per particle per
   * frame, which is exactly what this package exists to avoid — pass a constant
   * here, or build the loop yourself over `pool.particles`.
   *
   * Per-particle colour needs no effect: with `color: true` it is passed as a
   * number. Use this for what a colour multiplier cannot express, such as a
   * flash, an outline or grayscale.
   */
  effect?: unknown;
  /** Anchor within the destination rect. Defaults to the centre (0.5, 0.5). */
  anchorX?: number;
  anchorY?: number;
  /**
   * Pass each particle's interpolated `startR/G/B → endR/G/B` to `drawRaw` as its
   * trailing `color` argument. Defaults to `false`, which draws exactly as before
   * this option existed: no colour argument, and colour not applied.
   *
   * With `true` and `@flare-engine/render`'s `SpriteBatch`, each particle is
   * tinted by its colour, and coloured sprites share one run per image whatever
   * their colours and alphas — a fading, colour-shifting emitter becomes one draw
   * call instead of one per distinct alpha. The batch's renderer must support
   * per-sprite colours (both of the engine's backends do).
   *
   * The default becomes `true` in 0.5.0. Pass `color: false` to keep today's
   * colourless draw after that release.
   */
  color?: boolean;
}

/** Interpolated colour of the particle being drawn; rewritten for each one. */
const colorScratch: Color = { r: 1, g: 1, b: 1, a: 1 };

/** A 0-1 channel as a 0-255 byte, clamped so it cannot spill into a neighbouring channel. */
function channelByte(value: number): number {
  return value <= 0 ? 0 : value >= 1 ? 255 : Math.round(value * 255);
}

/**
 * Queue every live particle into a caller-owned sprite batch.
 *
 * Zero-alloc: the loop reads the pool's active list directly, allocates nothing
 * per particle, and hands each one to `drawRaw` — so a steady-state emitter adds
 * no garbage. Size, alpha and (with `color: true`) colour come from the pool's
 * own interpolators, and rotation from the particle.
 *
 * The batch is passed in rather than owned so particles share one batch, and one
 * flush, with the rest of the scene — the `drawInto` idiom used elsewhere in the
 * engine.
 *
 * ```ts
 * // once, outside the loop
 * const frame = sheet.frames.find((f) => f.name === 'spark')!;
 * // each frame, before the batch flushes
 * drawParticles(emitter.pool, batch, atlas.image, frame);
 * ```
 *
 * **Colour is opt-in** (`{ color: true }`). Then each particle's interpolated
 * `startR/G/B → endR/G/B` goes to `drawRaw` as its trailing `color` argument: an
 * opaque packed ARGB that multiplies the frame's texels, so a white frame takes
 * the colour exactly and a particle left at the default white draws unchanged.
 * Alpha stays the separate `alpha` argument. With `@flare-engine/render`'s
 * `SpriteBatch`, sprites drawn with a colour share one run per image whatever
 * their colours and alphas, so a fading, colour-shifting emitter is one draw
 * call rather than one per distinct alpha. Without the option, colour is not
 * applied and each distinct alpha is its own run, as before. From 0.5.0 colour
 * is on by default, and `{ color: false }` turns it off.
 *
 * `image` and `frame` are separate parameters because they are separate
 * everywhere else in the engine — a frame is a rectangle within a texture and
 * does not carry the texture.
 */
export function drawParticles(
  pool: ParticlePool,
  batch: ParticleBatchLike,
  image: unknown,
  frame: ParticleFrameLike,
  options?: DrawParticlesOptions,
): void {
  const particles = pool.particles;
  const count = particles.length;
  if (count === 0) return;

  const effect = options?.effect;
  const anchorX = options?.anchorX ?? 0.5;
  const anchorY = options?.anchorY ?? 0.5;
  const colored = options?.color === true;
  const srcX = frame.x;
  const srcY = frame.y;
  const srcW = frame.w;
  const srcH = frame.h;

  for (let i = 0; i < count; i++) {
    const p = particles[i]!;
    const size = pool.getSize(p);
    // A fully shrunk or fully faded particle costs a draw call for nothing.
    if (size <= 0) continue;
    const alpha = pool.getAlpha(p);
    if (alpha <= 0) continue;

    if (!colored) {
      batch.drawRaw(
        image,
        srcX,
        srcY,
        srcW,
        srcH,
        p.x,
        p.y,
        size,
        size,
        effect,
        anchorX,
        anchorY,
        alpha,
        p.rotation,
      );
      continue;
    }

    const c = pool.getColorInto(p, colorScratch);
    // `>>> 0`: the opaque alpha byte would otherwise make the packed value negative.
    const color =
      (0xff000000 | (channelByte(c.r) << 16) | (channelByte(c.g) << 8) | channelByte(c.b)) >>> 0;

    batch.drawRaw(
      image,
      srcX,
      srcY,
      srcW,
      srcH,
      p.x,
      p.y,
      size,
      size,
      effect,
      anchorX,
      anchorY,
      alpha,
      p.rotation,
      undefined,
      undefined,
      undefined,
      undefined,
      color,
    );
  }
}
