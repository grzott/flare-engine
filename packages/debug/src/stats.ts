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

/** Per-frame debug statistics, as returned by {@link createStatsTracker}. */
export interface StatsTrackerHandle {
  /** Current frame stats. The same object for the tracker's lifetime, updated in place. */
  readonly stats: DebugStats;
  /** Update timing stats from the clock. */
  updateFromClock(fps: number, rawDt: number, dt: number, frame: number): void;
  /** Set entity count for this frame. */
  setEntityCount(count: number): void;
  /** Set draw call count for this frame. */
  setDrawCalls(count: number): void;
  /** Reset all counters to zero. */
  reset(): void;
}

/**
 * Collects and exposes per-frame debug statistics. Nothing is allocated after
 * creation: every call writes into the one `stats` object.
 * Wrap in `__DEV__` checks at the call site for tree-shaking.
 */
export function createStatsTracker(): StatsTrackerHandle {
  const stats: DebugStats = {
    fps: 0,
    rawDt: 0,
    dt: 0,
    frame: 0,
    entityCount: 0,
    drawCalls: 0,
  };
  return {
    stats,
    updateFromClock(fps, rawDt, dt, frame) {
      stats.fps = fps;
      stats.rawDt = rawDt;
      stats.dt = dt;
      stats.frame = frame;
    },
    setEntityCount(count) {
      stats.entityCount = count;
    },
    setDrawCalls(count) {
      stats.drawCalls = count;
    },
    reset() {
      stats.fps = 0;
      stats.rawDt = 0;
      stats.dt = 0;
      stats.frame = 0;
      stats.entityCount = 0;
      stats.drawCalls = 0;
    },
  };
}

/**
 * StatsTracker — collects and exposes per-frame debug statistics.
 * Wrap in `__DEV__` checks at the call site for tree-shaking.
 * @deprecated Removed in 0.5.0. Use {@link createStatsTracker}, which returns a
 * {@link StatsTrackerHandle} with the same members; annotate with
 * `StatsTrackerHandle` where you annotated `StatsTracker`.
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
