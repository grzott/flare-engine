import type { Vec2 } from '@flare-engine/math';
import type { Rect } from '@flare-engine/math';

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
  private _shakeSeed = 0;

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

  /** Start camera shake. */
  shake(intensity: number, duration: number): void {
    this._shake = {
      intensity,
      duration,
      elapsed: 0,
      offsetX: 0,
      offsetY: 0,
    };
    this._shakeSeed++;
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

        // Only move if target is outside dead zone
        if (relX < dz.x) {
          this.x += (goalX - this.x - (dz.x - relX)) * (1 - smoothing ** dt);
        } else if (relX > dz.x + dz.width) {
          this.x += (goalX - this.x + (relX - dz.x - dz.width)) * (1 - smoothing ** dt);
        }
        if (relY < dz.y) {
          this.y += (goalY - this.y - (dz.y - relY)) * (1 - smoothing ** dt);
        } else if (relY > dz.y + dz.height) {
          this.y += (goalY - this.y + (relY - dz.y - dz.height)) * (1 - smoothing ** dt);
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

    // Shake
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
  }

  /** Get the effective camera X (including shake offset). */
  get effectiveX(): number {
    return this.x + (this._shake?.offsetX ?? 0);
  }

  /** Get the effective camera Y (including shake offset). */
  get effectiveY(): number {
    return this.y + (this._shake?.offsetY ?? 0);
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
