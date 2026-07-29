import { Pool } from '@flare-engine/core';
import type { Color } from '@flare-engine/math';

/** A single particle. Managed by ParticlePool — not user-facing. */
export interface Particle {
  /** World position. */
  x: number;
  y: number;
  /** Velocity in pixels/second. */
  vx: number;
  vy: number;
  /** Time remaining in seconds. */
  life: number;
  /** Total lifetime for interpolation. */
  maxLife: number;
  /** Start/end size for interpolation. */
  startSize: number;
  endSize: number;
  /** Start/end alpha for interpolation. */
  startAlpha: number;
  endAlpha: number;
  /** Start/end color components for interpolation. */
  startR: number;
  startG: number;
  startB: number;
  endR: number;
  endG: number;
  endB: number;
  /** Rotation in radians. */
  rotation: number;
  /** Angular velocity in radians/second. */
  angularVelocity: number;
  /** Whether this particle is active. */
  active: boolean;
}

/** Create a default (inactive) particle. */
function createParticle(): Particle {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 0,
    startSize: 1,
    endSize: 1,
    startAlpha: 1,
    endAlpha: 0,
    startR: 1,
    startG: 1,
    startB: 1,
    endR: 1,
    endG: 1,
    endB: 1,
    rotation: 0,
    angularVelocity: 0,
    active: false,
  };
}

/** Reset a particle to default (inactive) state. */
function resetParticle(p: Particle): void {
  p.x = 0;
  p.y = 0;
  p.vx = 0;
  p.vy = 0;
  p.life = 0;
  p.maxLife = 0;
  p.startSize = 1;
  p.endSize = 1;
  p.startAlpha = 1;
  p.endAlpha = 0;
  p.startR = 1;
  p.startG = 1;
  p.startB = 1;
  p.endR = 1;
  p.endG = 1;
  p.endB = 1;
  p.rotation = 0;
  p.angularVelocity = 0;
  p.active = false;
}

/**
 * ParticlePool — pre-allocated pool of particles.
 * Zero GC pressure during steady-state gameplay.
 */
export class ParticlePool {
  private _pool: Pool<Particle>;
  private _active: Particle[] = [];

  constructor(capacity = 256) {
    this._pool = new Pool(createParticle, resetParticle, { capacity });
    this._pool.prewarm(capacity);
  }

  /** Number of currently active particles. */
  get activeCount(): number {
    return this._active.length;
  }

  /**
   * Cumulative factory calls made by the internal pool's acquire()/tryAcquire().
   * prewarm() is excluded: factory calls there pre-fill the free list and are
   * not counted. Intended use: snapshot before and after a frame — a non-zero
   * delta in steady state means unexpected allocation.
   */
  get created(): number {
    return this._pool.created;
  }

  /** Read-only access to active particles. */
  get particles(): readonly Particle[] {
    return this._active;
  }

  /** Acquire a particle from the pool. */
  acquire(): Particle {
    const p = this._pool.acquire();
    p.active = true;
    this._active.push(p);
    return p;
  }

  /**
   * Acquire a particle only if the pool is below capacity.
   * Returns null at cap — no allocation occurs.
   */
  tryAcquire(): Particle | null {
    const p = this._pool.tryAcquire();
    if (!p) return null;
    p.active = true;
    this._active.push(p);
    return p;
  }

  /** Update all active particles. Releases dead particles. */
  update(dt: number, gravityX: number, gravityY: number): void {
    let i = 0;
    while (i < this._active.length) {
      const p = this._active[i]!;
      p.life -= dt;

      if (p.life <= 0) {
        // Dead — release and swap-remove
        p.active = false;
        this._pool.release(p);
        this._active[i] = this._active[this._active.length - 1]!;
        this._active.pop();
        continue;
      }

      // Apply gravity
      p.vx += gravityX * dt;
      p.vy += gravityY * dt;

      // Integrate position
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Rotate
      p.rotation += p.angularVelocity * dt;

      i++;
    }
  }

  /** Get interpolated size for a particle (0 = start, 1 = end of life). */
  getSize(p: Particle): number {
    const t = 1 - p.life / p.maxLife;
    return p.startSize + (p.endSize - p.startSize) * t;
  }

  /** Get interpolated alpha for a particle. */
  getAlpha(p: Particle): number {
    const t = 1 - p.life / p.maxLife;
    return p.startAlpha + (p.endAlpha - p.startAlpha) * t;
  }

  /** Shared color buffer — avoids per-call allocation in the render hot path. */
  private _colorBuf: Color = { r: 1, g: 1, b: 1, a: 1 };

  /**
   * Get interpolated color for a particle.
   *
   * Returns a shared buffer — read the values immediately, do not retain the
   * reference. For a fresh object call `getColorInto()` with your own out param.
   */
  getColor(p: Particle): Color {
    return this.getColorInto(p, this._colorBuf);
  }

  /** Zero-alloc variant — writes the interpolated color into `out`. */
  getColorInto(p: Particle, out: Color): Color {
    const t = 1 - p.life / p.maxLife;
    out.r = p.startR + (p.endR - p.startR) * t;
    out.g = p.startG + (p.endG - p.startG) * t;
    out.b = p.startB + (p.endB - p.startB) * t;
    out.a = p.startAlpha + (p.endAlpha - p.startAlpha) * t;
    return out;
  }

  /** Release all active particles back to pool. */
  clear(): void {
    for (const p of this._active) {
      p.active = false;
      this._pool.release(p);
    }
    this._active.length = 0;
  }
}
