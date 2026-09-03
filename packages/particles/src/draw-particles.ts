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
 * The parameter list mirrors `SpriteBatch.drawRaw`.
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
   */
  effect?: unknown;
  /** Anchor within the destination rect. Defaults to the centre (0.5, 0.5). */
  anchorX?: number;
  anchorY?: number;
}

/**
 * Queue every live particle into a caller-owned sprite batch.
 *
 * Zero-alloc: the loop reads the pool's active list directly, allocates nothing
 * per particle, and hands each one to `drawRaw` — so a steady-state emitter adds
 * no garbage. Size and alpha come from the pool's own interpolators, and
 * rotation from the particle.
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
 * **Colour is not applied per particle.** The pool interpolates
 * `startR/G/B → endR/G/B`, but delivering that to a batch needs one effect
 * object per particle per frame (see `DrawParticlesOptions.effect`). Alpha *is*
 * applied, because `drawRaw` takes it as a number. For per-particle colour today,
 * write the loop yourself over `pool.particles` and accept the allocation.
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
  }
}
