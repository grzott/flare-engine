import type { Rect, Vec2 } from '@flare-engine/math';

/** Camera follow smoothing options. */
export interface FollowOptions {
  /** Smoothing factor (0 = instant, lower = faster, default 0.1). */
  smoothing?: number;
  /** Offset from target (e.g. look-ahead). */
  offset?: Vec2;
  /** Dead zone rect — camera won't move while target is inside. */
  deadZone?: Rect;
}

/** Camera shake state. */
interface ShakeState {
  intensity: number;
  duration: number;
  elapsed: number;
  offsetX: number;
  offsetY: number;
}

/** Simple pseudo-random for deterministic shake. Avoids Math.random() allocs. */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// ─── Simplex-like 2D noise for shakePerlin ───────────────────────────────────
// 256-entry permutation table — written once at module load, never mutated.
const PERM = new Uint8Array(256);
{
  for (let i = 0; i < 256; i++) PERM[i] = i;
  // Deterministic Fisher-Yates with a fixed seed (no Math.random()).
  let s = 0x9e3779b9;
  for (let i = 255; i > 0; i--) {
    s = (s ^ (s >>> 15)) >>> 0;
    s = Math.imul(s, 0x85ebca6b) >>> 0;
    s = (s ^ (s >>> 13)) >>> 0;
    const j = s % (i + 1);
    const t = PERM[i]!;
    PERM[i] = PERM[j]!;
    PERM[j] = t;
  }
}

// 8 evenly-spaced 2D gradient directions (unit vectors × 1 for integer math).
const S = Math.SQRT1_2; // ≈ 0.7071 — diagonal component
const GRADS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [S, S],
  [0, 1],
  [-S, S],
  [-1, 0],
  [-S, -S],
  [0, -1],
  [S, -S],
];

function grad2(hash: number, x: number, y: number): number {
  const g = GRADS[hash & 7]!;
  return g[0] * x + g[1] * y;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** 2D value-gradient noise in [-1, 1]. */
function noise2d(x: number, y: number): number {
  const xi = Math.floor(x) & 255;
  const yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);

  const aa = PERM[PERM[xi]! + yi]!;
  const ab = PERM[PERM[xi]! + yi + 1]!;
  const ba = PERM[PERM[(xi + 1) & 255]! + yi]!;
  const bb = PERM[PERM[(xi + 1) & 255]! + yi + 1]!;

  const x1 = xf;
  const y1 = yf;
  const x2 = xf - 1;
  const y2 = yf - 1;

  const n00 = grad2(aa, x1, y1);
  const n10 = grad2(ba, x2, y1);
  const n01 = grad2(ab, x1, y2);
  const n11 = grad2(bb, x2, y2);

  const lerpX0 = n00 + u * (n10 - n00);
  const lerpX1 = n01 + u * (n11 - n01);
  return lerpX0 + v * (lerpX1 - lerpX0);
}

/** 2-octave FBM for shake displacement — result in [-1, 1]. */
function fbmNoise2d(x: number, y: number): number {
  return 0.6667 * noise2d(x, y) + 0.3333 * noise2d(x * 2, y * 2);
}

/**
 * Camera2D — 2D camera with position, zoom, rotation, follow, and shake.
 * Pure data + methods — no Skia dependency. The renderer reads camera state
 * to build the view transform.
 */
export class Camera2D {
  /** Camera position (world-space center). */
  x = 0;
  y = 0;

  /** Zoom level (1 = 100%). */
  zoom = 1;

  /** Rotation in radians. */
  rotation = 0;

  /** Viewport width in pixels. */
  viewportWidth = 0;

  /** Viewport height in pixels. */
  viewportHeight = 0;

  /** Optional world bounds to clamp camera position. */
  bounds: Rect | null = null;

  private _follow: { target: Vec2; options: FollowOptions } | null = null;
  private _shake: ShakeState | null = null;
  private _shakePerlin: ShakeState | null = null;
  private _shakeSeed = 0;
  private _shakePerlinSeed = 0;
  private _motionScale = 1;

  /** Set viewport dimensions. */
  setViewport(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  /** Start following a target position. */
  follow(target: Vec2, options?: FollowOptions): void {
    this._follow = { target, options: options ?? {} };
  }

  /** Stop following. */
  unfollow(): void {
    this._follow = null;
  }

  /**
   * Global motion multiplier applied to subsequent `shake()` calls. Scales
   * both amplitude and duration. Default 1 (no-op). 0 fully suppresses
   * shake. Intended to be driven by `@flare-engine/a11y` reduced-motion so
   * callers don't have to guard every shake site.
   *
   * Only affects future `shake()` calls — does not retroactively modify an
   * in-flight shake.
   *
   * Clamped to `>= 0`.
   */
  setMotionScale(scale: number): void {
    this._motionScale = scale < 0 ? 0 : scale;
  }

  /** Current motion scale (default 1). */
  get motionScale(): number {
    return this._motionScale;
  }

  /** Start camera shake. */
  shake(intensity: number, duration: number): void {
    const k = this._motionScale;
    if (k <= 0) {
      this._shake = null;
      return;
    }
    this._shake = {
      intensity: intensity * k,
      duration: duration * k,
      elapsed: 0,
      offsetX: 0,
      offsetY: 0,
    };
    this._shakeSeed++;
  }

  /**
   * Start a Perlin-noise-based camera shake. Overwrites any in-flight
   * shakePerlin (same semantics as shake()). Respects motionScale.
   */
  shakePerlin(intensity: number, duration: number): void {
    const k = this._motionScale;
    if (k <= 0) {
      this._shakePerlin = null;
      return;
    }
    this._shakePerlin = {
      intensity: intensity * k,
      duration: duration * k,
      elapsed: 0,
      offsetX: 0,
      offsetY: 0,
    };
    this._shakePerlinSeed++;
  }

  /**
   * Update camera. Call once per frame.
   * @param dt Delta time in seconds.
   */
  update(dt: number): void {
    // Follow target
    if (this._follow) {
      const { target, options } = this._follow;
      const smoothing = options.smoothing ?? 0.1;
      const offsetX = options.offset?.x ?? 0;
      const offsetY = options.offset?.y ?? 0;
      const goalX = target.x + offsetX;
      const goalY = target.y + offsetY;

      if (options.deadZone) {
        const dz = options.deadZone;
        const relX = target.x - this.x;
        const relY = target.y - this.y;

        // Only move if target is outside dead zone.
        // Each branch moves the camera by exactly the excess beyond the boundary,
        // including the look-ahead offset. relX appears once — old code double-counted it.
        if (relX < dz.x) {
          this.x += (relX + offsetX - dz.x) * (1 - smoothing ** dt);
        } else if (relX > dz.x + dz.width) {
          this.x += (relX + offsetX - dz.x - dz.width) * (1 - smoothing ** dt);
        }
        if (relY < dz.y) {
          this.y += (relY + offsetY - dz.y) * (1 - smoothing ** dt);
        } else if (relY > dz.y + dz.height) {
          this.y += (relY + offsetY - dz.y - dz.height) * (1 - smoothing ** dt);
        }
      } else {
        // Exponential smoothing
        const factor = 1 - smoothing ** dt;
        this.x += (goalX - this.x) * factor;
        this.y += (goalY - this.y) * factor;
      }
    }

    // Clamp to bounds
    if (this.bounds) {
      this._clampToBounds();
    }

    // Shake (pseudo-random)
    if (this._shake) {
      this._shake.elapsed += dt;
      if (this._shake.elapsed >= this._shake.duration) {
        this._shake = null;
      } else {
        const progress = this._shake.elapsed / this._shake.duration;
        const decay = 1 - progress;
        const seed = this._shakeSeed + this._shake.elapsed * 100;
        this._shake.offsetX = (pseudoRandom(seed) * 2 - 1) * this._shake.intensity * decay;
        this._shake.offsetY = (pseudoRandom(seed + 1) * 2 - 1) * this._shake.intensity * decay;
      }
    }

    // Shake (Perlin / FBM noise)
    if (this._shakePerlin) {
      this._shakePerlin.elapsed += dt;
      if (this._shakePerlin.elapsed >= this._shakePerlin.duration) {
        this._shakePerlin = null;
      } else {
        const progress = this._shakePerlin.elapsed / this._shakePerlin.duration;
        const decay = 1 - progress;
        const t = this._shakePerlin.elapsed * 4.7 + this._shakePerlinSeed * 17.3;
        this._shakePerlin.offsetX = fbmNoise2d(t, 0) * this._shakePerlin.intensity * decay;
        this._shakePerlin.offsetY = fbmNoise2d(0, t + 5.4) * this._shakePerlin.intensity * decay;
      }
    }
  }

  /** Get the effective camera X (including shake + shakePerlin offsets). */
  get effectiveX(): number {
    return this.x + (this._shake?.offsetX ?? 0) + (this._shakePerlin?.offsetX ?? 0);
  }

  /** Get the effective camera Y (including shake + shakePerlin offsets). */
  get effectiveY(): number {
    return this.y + (this._shake?.offsetY ?? 0) + (this._shakePerlin?.offsetY ?? 0);
  }

  /** Convert world coordinates to screen coordinates. */
  worldToScreen(worldX: number, worldY: number): Vec2 {
    return this.worldToScreenInto(worldX, worldY, { x: 0, y: 0 });
  }

  /** Zero-alloc variant — writes screen coordinates into `out`. */
  worldToScreenInto(worldX: number, worldY: number, out: Vec2): Vec2 {
    const cos = Math.cos(-this.rotation);
    const sin = Math.sin(-this.rotation);
    const dx = (worldX - this.effectiveX) * this.zoom;
    const dy = (worldY - this.effectiveY) * this.zoom;
    out.x = cos * dx - sin * dy + this.viewportWidth / 2;
    out.y = sin * dx + cos * dy + this.viewportHeight / 2;
    return out;
  }

  /** Convert screen coordinates to world coordinates. */
  screenToWorld(screenX: number, screenY: number): Vec2 {
    return this.screenToWorldInto(screenX, screenY, { x: 0, y: 0 });
  }

  /** Zero-alloc variant — writes world coordinates into `out`. */
  screenToWorldInto(screenX: number, screenY: number, out: Vec2): Vec2 {
    const cx = screenX - this.viewportWidth / 2;
    const cy = screenY - this.viewportHeight / 2;
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    const rx = cos * cx - sin * cy;
    const ry = sin * cx + cos * cy;
    out.x = rx / this.zoom + this.effectiveX;
    out.y = ry / this.zoom + this.effectiveY;
    return out;
  }

  /** Get the visible world-space bounding rect (allocates a fresh Rect). */
  getBounds(): Rect {
    return this.getBoundsInto({ x: 0, y: 0, width: 0, height: 0 });
  }

  /** Zero-alloc variant — writes the visible bounds into `out`. */
  getBoundsInto(out: Rect): Rect {
    const halfW = this.viewportWidth / (2 * this.zoom);
    const halfH = this.viewportHeight / (2 * this.zoom);
    out.x = this.effectiveX - halfW;
    out.y = this.effectiveY - halfH;
    out.width = halfW * 2;
    out.height = halfH * 2;
    return out;
  }

  private _clampToBounds(): void {
    const b = this.bounds!;
    const halfW = this.viewportWidth / (2 * this.zoom);
    const halfH = this.viewportHeight / (2 * this.zoom);

    const minX = b.x + halfW;
    const maxX = b.x + b.width - halfW;
    const minY = b.y + halfH;
    const maxY = b.y + b.height - halfH;

    if (minX <= maxX) {
      this.x = Math.max(minX, Math.min(maxX, this.x));
    } else {
      // Viewport larger than bounds — center
      this.x = b.x + b.width / 2;
    }

    if (minY <= maxY) {
      this.y = Math.max(minY, Math.min(maxY, this.y));
    } else {
      this.y = b.y + b.height / 2;
    }
  }
}
