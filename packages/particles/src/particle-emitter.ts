import type { Color } from '@flare-engine/math';
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
  /** Maximum active particles. */
  maxParticles?: number;
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
  private _seed = 1;

  constructor(config: EmitterConfig, maxParticles?: number) {
    this.config = config;
    this.pool = new ParticlePool(maxParticles ?? config.maxParticles ?? 256);
  }

  /** Update the emitter: emit new particles and update existing ones. */
  update(dt: number): void {
    // Emit new particles
    if (this.emitting) {
      this._emitAccumulator += dt * this.config.rate;
      while (this._emitAccumulator >= 1) {
        this._emitAccumulator -= 1;
        if (this.config.maxParticles && this.pool.activeCount >= this.config.maxParticles) {
          this._emitAccumulator = 0;
          break;
        }
        this._emitOne();
      }
    }

    // Update all particles
    this.pool.update(dt, this.config.gravityX ?? 0, this.config.gravityY ?? 0);
  }

  /** Emit a burst of particles. */
  burst(count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.config.maxParticles && this.pool.activeCount >= this.config.maxParticles) break;
      this._emitOne();
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

  private _emitOne(): void {
    const c = this.config;
    const p: Particle = this.pool.acquire();

    // Position at emitter origin
    p.x = this.x;
    p.y = this.y;

    // Random angle within spread
    const angle = c.direction + this._randomRange(-c.spread, c.spread);
    const speed = c.speedMax ? this._randomRange(c.speed, c.speedMax) : c.speed;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;

    // Lifetime
    const lifetime = c.lifetimeMax ? this._randomRange(c.lifetime, c.lifetimeMax) : c.lifetime;
    p.life = lifetime;
    p.maxLife = lifetime;

    // Size
    p.startSize = c.startSize ?? 4;
    p.endSize = c.endSize ?? 0;

    // Alpha
    p.startAlpha = c.startAlpha ?? 1;
    p.endAlpha = c.endAlpha ?? 0;

    // Colors
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

    // Angular velocity
    if (c.angularVelocity !== undefined) {
      p.angularVelocity = c.angularVelocityMax
        ? this._randomRange(c.angularVelocity, c.angularVelocityMax)
        : c.angularVelocity;
    }
  }
}
