import type { Color } from '@flare-engine/math';
import type { EmitterShape, ShapeSample } from './emitter-shape.js';
import { createShapeSample, hasRadialNormal, sampleEmitterShape } from './emitter-shape.js';
import type { Particle } from './particle-pool.js';
import { ParticlePool } from './particle-pool.js';

/** Configuration for a ParticleEmitter. */
export interface EmitterConfig {
  /** Emission rate in particles per second. */
  rate: number;
  /** Particle lifetime in seconds. */
  lifetime: number;
  /** Min lifetime (if set, actual lifetime is random between lifetime and lifetimeMax). */
  lifetimeMax?: number;
  /** Initial speed in pixels/second. */
  speed: number;
  /** Max speed (random range). */
  speedMax?: number;
  /** Emission direction in radians (0 = right). */
  direction: number;
  /** Spread angle in radians (half-angle of the emission cone). */
  spread: number;
  /** Gravity in pixels/second² (applied each frame). */
  gravityX?: number;
  gravityY?: number;
  /** Start size and end size. */
  startSize?: number;
  endSize?: number;
  /** Start alpha and end alpha. */
  startAlpha?: number;
  endAlpha?: number;
  /** Start color. */
  startColor?: Color;
  /** End color. */
  endColor?: Color;
  /** Angular velocity range (radians/second). */
  angularVelocity?: number;
  angularVelocityMax?: number;
  /** Maximum active particles (used as pool capacity default when no opts.maxParticles given). */
  maxParticles?: number;
  /**
   * Where particles spawn, relative to the emitter position. Defaults to
   * `{ kind: 'point' }`, which is the pre-existing behaviour — every particle
   * starts exactly at `x`/`y`.
   *
   * A shape samples position only; `direction` and `spread` still govern
   * velocity, unless the shape sets `radial: true` (see `EmitterShape`).
   */
  shape?: EmitterShape;
}

/** Construction options for ParticleEmitter. */
export interface EmitterOptions {
  /**
   * Hard cap on simultaneously active particles.
   * Overrides config.maxParticles when provided.
   * Defaults to config.maxParticles ?? 256.
   */
  maxParticles?: number;
  /**
   * Initial LCG seed for deterministic particle randomness.
   * Defaults to 1. Call reseed() at any time to restart the sequence.
   */
  seed?: number;
}

/**
 * ParticleEmitter — emits particles based on a configuration.
 * Uses a ParticlePool for zero-GC operation.
 *
 * Call `update(dt)` each frame. Read `pool.particles` for rendering.
 */
export class ParticleEmitter {
  readonly config: EmitterConfig;
  readonly pool: ParticlePool;

  /** Emitter world position. */
  x = 0;
  y = 0;

  /** Whether the emitter is actively emitting. */
  emitting = true;

  private _emitAccumulator = 0;
  private _seed = 0;
  /** Reused spawn-offset buffer — one per emitter, never per particle. */
  private readonly _sample: ShapeSample = createShapeSample();
  /** Bound once at construction; binding per emit would allocate a closure. */
  private readonly _rand = (): number => this._random();

  constructor(config: EmitterConfig, opts?: EmitterOptions) {
    this.config = config;
    const cap = opts?.maxParticles ?? config.maxParticles ?? 256;
    this.pool = new ParticlePool(cap);
    this._setSeed(opts?.seed ?? 1);
  }

  /** Reset the LCG seed — restarts the particle random sequence from this seed. */
  reseed(seed: number): void {
    this._setSeed(seed);
  }

  /** Normalize s into the valid Park-Miller domain [1, 2147483646]. */
  private _setSeed(s: number): void {
    let n = Number.isFinite(s) ? Math.floor(s) % 2147483647 : 0;
    if (n < 0) n += 2147483647;
    if (n === 0) n = 1;
    this._seed = n;
  }

  /** Update the emitter: emit new particles and update existing ones. */
  update(dt: number): void {
    if (this.emitting) {
      this._emitAccumulator += dt * this.config.rate;
      while (this._emitAccumulator >= 1) {
        this._emitAccumulator -= 1;
        if (!this._emitOne()) {
          this._emitAccumulator = 0;
          break;
        }
      }
    }

    this.pool.update(dt, this.config.gravityX ?? 0, this.config.gravityY ?? 0);
  }

  /** Emit a burst of particles. */
  burst(count: number): void {
    for (let i = 0; i < count; i++) {
      if (!this._emitOne()) break;
    }
  }

  /** Stop emitting and clear all particles. */
  reset(): void {
    this.emitting = false;
    this._emitAccumulator = 0;
    this.pool.clear();
  }

  /** Simple seeded pseudo-random for deterministic particles. */
  private _random(): number {
    this._seed = (this._seed * 16807) % 2147483647;
    return (this._seed - 1) / 2147483646;
  }

  /** Random float in [min, max]. */
  private _randomRange(min: number, max: number): number {
    return min + this._random() * (max - min);
  }

  /** Emit one particle. Returns false when the pool is at cap — caller should stop. */
  private _emitOne(): boolean {
    const p: Particle | null = this.pool.tryAcquire();
    if (!p) return false;

    const c = this.config;

    // Shape sampling comes first so it consumes its random draws before the
    // velocity draws below — that ordering is what makes a given seed replay
    // identically, and it is why `point` deliberately draws nothing at all
    // (an emitter with no shape produces the exact pre-shape sequence).
    const shape = c.shape;
    if (shape === undefined || shape.kind === 'point') {
      p.x = this.x;
      p.y = this.y;
      const angle = c.direction + this._randomRange(-c.spread, c.spread);
      const speed = c.speedMax ? this._randomRange(c.speed, c.speedMax) : c.speed;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
    } else {
      const s = sampleEmitterShape(shape, this._rand, this._sample, c.direction);
      p.x = this.x + s.x;
      p.y = this.y + s.y;
      // A radial shape emits along its own outward normal, fanned by `spread`;
      // otherwise `direction` still rules, exactly as for a point emitter.
      const base = hasRadialNormal(shape) ? Math.atan2(s.ny, s.nx) : c.direction;
      const angle = base + this._randomRange(-c.spread, c.spread);
      const speed = c.speedMax ? this._randomRange(c.speed, c.speedMax) : c.speed;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
    }

    const lifetime = c.lifetimeMax ? this._randomRange(c.lifetime, c.lifetimeMax) : c.lifetime;
    p.life = lifetime;
    p.maxLife = lifetime;

    p.startSize = c.startSize ?? 4;
    p.endSize = c.endSize ?? 0;

    p.startAlpha = c.startAlpha ?? 1;
    p.endAlpha = c.endAlpha ?? 0;

    if (c.startColor) {
      p.startR = c.startColor.r;
      p.startG = c.startColor.g;
      p.startB = c.startColor.b;
    }
    if (c.endColor) {
      p.endR = c.endColor.r;
      p.endG = c.endColor.g;
      p.endB = c.endColor.b;
    }

    if (c.angularVelocity !== undefined) {
      p.angularVelocity = c.angularVelocityMax
        ? this._randomRange(c.angularVelocity, c.angularVelocityMax)
        : c.angularVelocity;
    }

    return true;
  }
}
