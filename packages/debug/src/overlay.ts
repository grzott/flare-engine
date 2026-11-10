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

/** Options for {@link DebugOverlay}. */
export interface DebugOverlayOptions {
  /**
   * When true, `drawRect` / `drawCircle` / `drawLine` reuse pooled command
   * objects, so no command object is created per call once the pools are warm.
   * A reused object changes after `clear()`, so copy a command to keep it past
   * the frame. Default `false`: every call creates a fresh object.
   */
  reuseCommands?: boolean;
}

/**
 * DebugOverlay — collects debug draw commands for the current frame.
 * Commands are generated based on active overlay flags, then consumed
 * by the renderer. Commands are fresh objects by default and pooled with
 * `reuseCommands` (see {@link DebugOverlayOptions}).
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

  private _rects: DebugRect[] = [];
  private _circles: DebugCircle[] = [];
  private _lines: DebugLine[] = [];
  private _rectCursor = 0;
  private _circleCursor = 0;
  private _lineCursor = 0;
  private readonly _reuseCommands: boolean;

  constructor(options: DebugOverlayOptions = {}) {
    this._reuseCommands = options.reuseCommands === true;
  }

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
    if (!this._reuseCommands) {
      this._commands.push({ type: 'rect', x, y, width, height, color });
      return;
    }
    let cmd = this._rects[this._rectCursor];
    if (cmd) {
      cmd.x = x;
      cmd.y = y;
      cmd.width = width;
      cmd.height = height;
      cmd.color = color;
    } else {
      cmd = { type: 'rect', x, y, width, height, color };
      this._rects.push(cmd);
    }
    this._rectCursor += 1;
    this._commands.push(cmd);
  }

  /** Add a debug circle. */
  drawCircle(x: number, y: number, radius: number, color = '#00ff00'): void {
    if (!this._reuseCommands) {
      this._commands.push({ type: 'circle', x, y, radius, color });
      return;
    }
    let cmd = this._circles[this._circleCursor];
    if (cmd) {
      cmd.x = x;
      cmd.y = y;
      cmd.radius = radius;
      cmd.color = color;
    } else {
      cmd = { type: 'circle', x, y, radius, color };
      this._circles.push(cmd);
    }
    this._circleCursor += 1;
    this._commands.push(cmd);
  }

  /** Add a debug line. */
  drawLine(x1: number, y1: number, x2: number, y2: number, color = '#ffff00'): void {
    if (!this._reuseCommands) {
      this._commands.push({ type: 'line', x1, y1, x2, y2, color });
      return;
    }
    let cmd = this._lines[this._lineCursor];
    if (cmd) {
      cmd.x1 = x1;
      cmd.y1 = y1;
      cmd.x2 = x2;
      cmd.y2 = y2;
      cmd.color = color;
    } else {
      cmd = { type: 'line', x1, y1, x2, y2, color };
      this._lines.push(cmd);
    }
    this._lineCursor += 1;
    this._commands.push(cmd);
  }

  /** Clear all commands. Call at the start of each frame. */
  clear(): void {
    this._commands.length = 0;
    this._rectCursor = 0;
    this._circleCursor = 0;
    this._lineCursor = 0;
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
