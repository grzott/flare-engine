/** Minimal Skia Canvas-like interface for the Renderer. */
export interface CanvasLike {
  save(): number;
  restore(): void;
  translate(x: number, y: number): void;
  scale(sx: number, sy: number): void;
  /** Rotate around (cx, cy). Angle in DEGREES — both Skia backends take degrees. */
  rotate(degrees: number, cx: number, cy: number): void;
  clear(color: number): void;
}

/** Stats tracked per frame. */
export interface RenderStats {
  drawCalls: number;
  batchCount: number;
}

/**
 * Renderer — manages the Skia Canvas lifecycle for a frame.
 * `begin()` to start, draw your content, `end()` to finish.
 */
export class Renderer {
  /** Current frame stats. */
  readonly stats: RenderStats = { drawCalls: 0, batchCount: 0 };

  private _canvas: CanvasLike | null = null;
  private _inFrame = false;

  /** Set the canvas to render to. Called once when canvas is available. */
  setCanvas(canvas: CanvasLike): void {
    this._canvas = canvas;
  }

  /** Get the current canvas. Throws if not in a frame. */
  get canvas(): CanvasLike {
    if (!this._canvas) {
      throw new Error('Renderer: no canvas set');
    }
    return this._canvas;
  }

  /** Whether we are currently between begin() and end(). */
  get inFrame(): boolean {
    return this._inFrame;
  }

  /**
   * Begin a new frame. Clears the canvas and resets stats.
   * @param clearColor 32-bit ARGB color to clear with (default black = 0xFF000000).
   */
  begin(clearColor = 0xff000000): void {
    if (this._inFrame) {
      throw new Error('Renderer: begin() called while already in frame');
    }
    this._inFrame = true;
    this.stats.drawCalls = 0;
    this.stats.batchCount = 0;
    this.canvas.save();
    this.canvas.clear(clearColor);
  }

  /**
   * End the current frame. Restores canvas state.
   */
  end(): void {
    if (!this._inFrame) {
      throw new Error('Renderer: end() called without begin()');
    }
    this.canvas.restore();
    this._inFrame = false;
  }

  /**
   * Apply camera transform to the canvas.
   * Call after begin() and before drawing.
   */
  applyCamera(
    cameraX: number,
    cameraY: number,
    zoom: number,
    rotation: number,
    viewportWidth: number,
    viewportHeight: number,
  ): void {
    const c = this.canvas;
    // Move origin to viewport center
    c.translate(viewportWidth / 2, viewportHeight / 2);
    // Apply zoom
    c.scale(zoom, zoom);
    // Apply rotation around center. Camera2D.rotation is radians; the CanvasLike
    // rotate contract is degrees — convert once here (the single camera seam).
    if (rotation !== 0) {
      c.rotate((-rotation * 180) / Math.PI, 0, 0);
    }
    // Offset by camera position
    c.translate(-cameraX, -cameraY);
  }

  /** Increment draw call counter. Called by batching systems. */
  recordDrawCall(): void {
    this.stats.drawCalls++;
  }

  /** Increment batch counter. */
  recordBatch(): void {
    this.stats.batchCount++;
  }
}
