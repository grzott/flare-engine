/**
 * DebugOverlay — configuration for debug visualization overlays.
 * The actual rendering is done by the host (e.g., @flare-engine/react) reading
 * these flags and drawing appropriate debug shapes.
 * Wrap in `__DEV__` checks at the call site for tree-shaking.
 */
export interface OverlayFlags {
  /** Show collision bounding boxes. */
  showCollisionBounds: boolean;
  /** Show entity origin points. */
  showEntityOrigins: boolean;
  /** Show velocity vectors. */
  showVelocityVectors: boolean;
  /** Show FPS/stats overlay. */
  showStats: boolean;
}

/** Debug draw command types. */
export interface DebugRect {
  readonly type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface DebugCircle {
  readonly type: 'circle';
  x: number;
  y: number;
  radius: number;
  color: string;
}

export interface DebugLine {
  readonly type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

/** Union of debug draw primitive commands. */
export type DebugDrawCommand = DebugRect | DebugCircle | DebugLine;

/**
 * DebugOverlay — collects debug draw commands for the current frame.
 * Commands are generated based on active overlay flags, then consumed
 * by the renderer.
 */
export class DebugOverlay {
  /** Active overlay flags. */
  readonly flags: OverlayFlags = {
    showCollisionBounds: false,
    showEntityOrigins: false,
    showVelocityVectors: false,
    showStats: false,
  };

  /** Queued debug draw commands for the current frame. */
  private _commands: DebugDrawCommand[] = [];

  /** Number of queued commands. */
  get commandCount(): number {
    return this._commands.length;
  }

  /** Get all commands (read-only view). */
  get commands(): readonly DebugDrawCommand[] {
    return this._commands;
  }

  /** Add a debug rectangle. */
  drawRect(x: number, y: number, width: number, height: number, color = '#00ff00'): void {
    this._commands.push({ type: 'rect', x, y, width, height, color });
  }

  /** Add a debug circle. */
  drawCircle(x: number, y: number, radius: number, color = '#00ff00'): void {
    this._commands.push({ type: 'circle', x, y, radius, color });
  }

  /** Add a debug line. */
  drawLine(x1: number, y1: number, x2: number, y2: number, color = '#ffff00'): void {
    this._commands.push({ type: 'line', x1, y1, x2, y2, color });
  }

  /** Clear all commands. Call at the start of each frame. */
  clear(): void {
    this._commands.length = 0;
  }

  /** Toggle a specific overlay flag. */
  toggleFlag(flag: keyof OverlayFlags): void {
    this.flags[flag] = !this.flags[flag];
  }

  /** Enable all overlays. */
  enableAll(): void {
    this.flags.showCollisionBounds = true;
    this.flags.showEntityOrigins = true;
    this.flags.showVelocityVectors = true;
    this.flags.showStats = true;
  }

  /** Disable all overlays. */
  disableAll(): void {
    this.flags.showCollisionBounds = false;
    this.flags.showEntityOrigins = false;
    this.flags.showVelocityVectors = false;
    this.flags.showStats = false;
  }
}
