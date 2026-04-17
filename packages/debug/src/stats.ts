/** Snapshot of engine stats for a single frame. */
export interface DebugStats {
  /** Frames per second (smoothed). */
  fps: number;
  /** Raw delta time in seconds. */
  rawDt: number;
  /** Scaled delta time in seconds. */
  dt: number;
  /** Current frame number. */
  frame: number;
  /** Total active entities (set by user). */
  entityCount: number;
  /** Draw calls this frame (set by user). */
  drawCalls: number;
}

/**
 * StatsTracker — collects and exposes per-frame debug statistics.
 * Wrap in `__DEV__` checks at the call site for tree-shaking.
 */
export class StatsTracker {
  /** Current frame stats (read-only snapshot). */
  readonly stats: DebugStats = {
    fps: 0,
    rawDt: 0,
    dt: 0,
    frame: 0,
    entityCount: 0,
    drawCalls: 0,
  };

  /** Update timing stats from the clock. */
  updateFromClock(fps: number, rawDt: number, dt: number, frame: number): void {
    this.stats.fps = fps;
    this.stats.rawDt = rawDt;
    this.stats.dt = dt;
    this.stats.frame = frame;
  }

  /** Set entity count for this frame. */
  setEntityCount(count: number): void {
    this.stats.entityCount = count;
  }

  /** Set draw call count for this frame. */
  setDrawCalls(count: number): void {
    this.stats.drawCalls = count;
  }

  /** Reset all counters to zero. */
  reset(): void {
    this.stats.fps = 0;
    this.stats.rawDt = 0;
    this.stats.dt = 0;
    this.stats.frame = 0;
    this.stats.entityCount = 0;
    this.stats.drawCalls = 0;
  }
}
