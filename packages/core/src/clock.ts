/**
 * Clock tracks frame timing: delta time, elapsed time, fps, timescale.
 * One instance per GameLoop. Updated once per frame.
 */

/** Scheduled callback entry. */
interface ScheduleEntry {
  remaining: number;
  callback: () => void;
  interval: number; // 0 = one-shot
}

export class Clock {
  /** Unscaled delta time in seconds since last frame. */
  rawDt = 0;

  /** Scaled delta time in seconds (rawDt * timescale). */
  dt = 0;

  /** Fixed timestep in seconds for physics updates (default 1/60). */
  fixedDt = 1 / 60;

  /** Total elapsed time in seconds (scaled). */
  elapsed = 0;

  /** Smoothed frames per second. */
  fps = 0;

  /** Time scale multiplier. 1 = normal, 0 = paused, 0.5 = slow-mo. */
  timescale = 1;

  /** Current frame number (monotonically increasing). */
  frame = 0;

  private schedules: ScheduleEntry[] = [];
  private fpsAlpha = 0.9;

  /** Called once per frame by the GameLoop with raw unscaled dt. */
  update(rawDt: number): void {
    this.rawDt = rawDt;
    this.dt = rawDt * this.timescale;
    this.elapsed += this.dt;
    this.frame++;

    // Exponential moving average FPS
    if (rawDt > 0) {
      const instantFps = 1 / rawDt;
      this.fps =
        this.fps === 0 ? instantFps : this.fps * this.fpsAlpha + instantFps * (1 - this.fpsAlpha);
    }

    // Process scheduled callbacks
    this.tickSchedules(this.dt);
  }

  /** Schedule a one-shot callback after `delay` seconds (scaled time). */
  schedule(delay: number, callback: () => void): () => void {
    const entry: ScheduleEntry = { remaining: delay, callback, interval: 0 };
    this.schedules.push(entry);
    return () => {
      const idx = this.schedules.indexOf(entry);
      if (idx !== -1) this.schedules.splice(idx, 1);
    };
  }

  /** Schedule a repeating callback every `interval` seconds (scaled time). */
  repeat(interval: number, callback: () => void): () => void {
    const entry: ScheduleEntry = { remaining: interval, callback, interval };
    this.schedules.push(entry);
    return () => {
      const idx = this.schedules.indexOf(entry);
      if (idx !== -1) this.schedules.splice(idx, 1);
    };
  }

  /** Reset clock to initial state. */
  reset(): void {
    this.rawDt = 0;
    this.dt = 0;
    this.elapsed = 0;
    this.fps = 0;
    this.frame = 0;
    this.timescale = 1;
    this.schedules.length = 0;
  }

  private tickSchedules(dt: number): void {
    for (let i = this.schedules.length - 1; i >= 0; i--) {
      const entry = this.schedules[i]!;
      entry.remaining -= dt;
      if (entry.remaining <= 0) {
        entry.callback();
        if (entry.interval > 0) {
          entry.remaining += entry.interval;
        } else {
          this.schedules.splice(i, 1);
        }
      }
    }
  }
}
