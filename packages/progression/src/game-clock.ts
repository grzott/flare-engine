/**
 * Game-day clock with per-segment real-time rates.
 * A day is 1440 game minutes split into ordered segments; each segment
 * runs at its own `secondsPerGameHour`. Supports pause, hold (stop at the
 * next phase boundary), manual advance, skip-to-segment, change callbacks,
 * and a plain serializable state.
 */

const MINUTES_PER_DAY = 1440;

export interface GameClockSegment {
  /** Segment name, e.g. 'day', 'dusk'. May repeat (a night that wraps midnight is two rows). */
  readonly name: string;
  /** Coarser grouping, e.g. 'day' | 'night'. */
  readonly phase: string;
  /** Minute of the game day at which the segment starts, integer 0..1439. */
  readonly startMinute: number;
  /** Real seconds per game hour while in this segment. */
  readonly secondsPerGameHour: number;
}

export interface GameClockConfig {
  /** Ordered by `startMinute`; the first must start at 0. The last runs to 1440. */
  readonly segments: readonly GameClockSegment[];
  readonly onSegmentChange?: (segment: string, previous: string) => void;
  readonly onPhaseChange?: (phase: string, previous: string) => void;
}

export interface GameClockState {
  readonly absoluteMinutes: number;
  readonly paused: boolean;
}

export interface GameClock {
  /** Game minutes since day 0 00:00. Fractional, never decreases. */
  readonly absoluteMinutes: number;
  /** `floor(absoluteMinutes / 1440)`. */
  readonly day: number;
  /** 0..23. */
  readonly hour: number;
  /** 0..59, integer. */
  readonly minute: number;
  readonly segment: string;
  readonly phase: string;
  readonly paused: boolean;
  readonly held: boolean;
  /**
   * Advance by `dt` real seconds. No-op while paused, or when `dt` is not finite or <= 0.
   * Throws `RangeError` when `dt` could carry `absoluteMinutes` past `Number.MAX_SAFE_INTEGER`.
   */
  update(dt: number): void;
  /**
   * Advance by `n` game minutes, even while paused. Throws `RangeError` when `n` is negative or
   * not finite, or when `absoluteMinutes + n` exceeds `Number.MAX_SAFE_INTEGER`.
   */
  advanceMinutes(n: number): void;
  /** Jump forward to the next start of `segmentName`, strictly after now. Throws on an unknown name. */
  skipTo(segmentName: string): void;
  pause(): void;
  resume(): void;
  /** Stop at the next phase boundary and stay there until `release()`. */
  hold(): void;
  release(): void;
  /** Allocates a fresh state object (cold path). `held` is not persisted. */
  serialize(): GameClockState;
}

function validateSegments(segments: readonly GameClockSegment[]): void {
  if (segments.length === 0) {
    throw new Error('createGameClock: segments must not be empty');
  }
  const first = segments[0] as GameClockSegment;
  if (first.startMinute !== 0) {
    throw new Error(
      `createGameClock: first segment must start at minute 0, got ${first.startMinute}`,
    );
  }
  let previousStart = -1;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i] as GameClockSegment;
    const start = seg.startMinute;
    if (!Number.isInteger(start) || start < 0 || start >= MINUTES_PER_DAY) {
      throw new Error(
        `createGameClock: segment ${i} ("${seg.name}") startMinute must be an integer in 0..1439, got ${start}`,
      );
    }
    if (start <= previousStart) {
      throw new Error(
        `createGameClock: segment ${i} ("${seg.name}") startMinute ${start} must be greater than the previous start ${previousStart}`,
      );
    }
    previousStart = start;
    const rate = seg.secondsPerGameHour;
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(
        `createGameClock: segment ${i} ("${seg.name}") secondsPerGameHour must be finite and > 0, got ${rate}`,
      );
    }
  }
}

/**
 * Returns a `GameClock` backed by `config`, optionally restored from `state`.
 * The returned object is a plain object with getters (no class).
 */
export function createGameClock(config: GameClockConfig, state?: GameClockState): GameClock {
  const segments = config.segments;
  validateSegments(segments);
  const count = segments.length;
  const onSegmentChange = config.onSegmentChange;
  const onPhaseChange = config.onPhaseChange;

  // Per-segment end minute: the next segment's start, or 1440 for the last.
  const ends = new Float64Array(count);
  let fastestRate = Number.POSITIVE_INFINITY;
  for (let i = 0; i < count; i++) {
    ends[i] = i + 1 < count ? (segments[i + 1] as GameClockSegment).startMinute : MINUTES_PER_DAY;
    fastestRate = Math.min(fastestRate, (segments[i] as GameClockSegment).secondsPerGameHour);
  }

  let absolute = 0;
  let paused = false;
  let held = false;
  let index = 0;

  if (state !== undefined) {
    if (!Number.isFinite(state.absoluteMinutes) || state.absoluteMinutes < 0) {
      throw new Error(
        `createGameClock: state.absoluteMinutes must be finite and >= 0, got ${state.absoluteMinutes}`,
      );
    }
    if (typeof state.paused !== 'boolean') {
      throw new Error(
        `createGameClock: state.paused must be a boolean, got ${String(state.paused)}`,
      );
    }
    absolute = state.absoluteMinutes;
    paused = state.paused;
    const minuteOfDay = absolute - Math.floor(absolute / MINUTES_PER_DAY) * MINUTES_PER_DAY;
    for (let i = 0; i < count; i++) {
      if ((segments[i] as GameClockSegment).startMinute <= minuteOfDay) index = i;
    }
  }

  /**
   * Move from the current segment to the next one, firing callbacks.
   * Returns false (and leaves everything untouched) when held and the next
   * segment opens a different phase.
   */
  function cross(): boolean {
    const next = index + 1 < count ? index + 1 : 0;
    const prev = segments[index] as GameClockSegment;
    const nextSeg = segments[next] as GameClockSegment;
    const phaseChanges = nextSeg.phase !== prev.phase;
    if (held && phaseChanges) return false;
    index = next;
    if (nextSeg.name !== prev.name && onSegmentChange !== undefined) {
      onSegmentChange(nextSeg.name, prev.name);
    }
    if (phaseChanges && onPhaseChange !== undefined) {
      onPhaseChange(nextSeg.phase, prev.phase);
    }
    return true;
  }

  /** Absolute minute at which the current segment ends (an integer while below 2^53). */
  function currentBoundary(): number {
    let day = Math.floor(absolute / MINUTES_PER_DAY);
    // Sitting on the midnight boundary with the last segment still current
    // (a held clock): that is minute 1440 of the previous day.
    if (absolute - day * MINUTES_PER_DAY < (segments[index] as GameClockSegment).startMinute) {
      day -= 1;
    }
    return day * MINUTES_PER_DAY + (ends[index] as number);
  }

  /**
   * Game-minute advance to an absolute target. Each boundary is compared against
   * the target itself rather than a carried remainder, so a target that equals a
   * boundary always lands on it and crosses (unless held).
   */
  function advanceTo(target: number): void {
    for (;;) {
      const boundary = currentBoundary();
      if (target < boundary) {
        absolute = target;
        return;
      }
      absolute = boundary;
      if (!cross()) return;
    }
  }

  function update(dt: number): void {
    if (paused || !Number.isFinite(dt) || dt <= 0) return;
    if (absolute + (dt * 60) / fastestRate > Number.MAX_SAFE_INTEGER) {
      throw new RangeError(
        `GameClock.update: dt ${dt} would carry absoluteMinutes past Number.MAX_SAFE_INTEGER`,
      );
    }
    // Rates differ per segment, so real seconds are carried as a remainder.
    let remaining = dt;
    for (;;) {
      const boundary = currentBoundary();
      const toBoundary = boundary - absolute;
      if (toBoundary > 0) {
        const rate = (segments[index] as GameClockSegment).secondsPerGameHour;
        const cost = (toBoundary * rate) / 60;
        if (remaining < cost) {
          const next = absolute + (remaining * 60) / rate;
          if (next < boundary) {
            absolute = next;
            return;
          }
          // Rounding reached the boundary: land on it and cross, like an exact step.
          remaining = 0;
        } else {
          remaining -= cost;
        }
        absolute = boundary;
      }
      if (!cross()) return;
    }
  }

  function advanceMinutes(n: number): void {
    if (!Number.isFinite(n) || n < 0) {
      throw new RangeError(`GameClock.advanceMinutes: n must be finite and >= 0, got ${n}`);
    }
    const target = absolute + n;
    if (target > Number.MAX_SAFE_INTEGER) {
      throw new RangeError(
        `GameClock.advanceMinutes: absoluteMinutes + n must not exceed Number.MAX_SAFE_INTEGER, got ${target}`,
      );
    }
    advanceTo(target);
  }

  function skipTo(segmentName: string): void {
    const day = Math.floor(absolute / MINUTES_PER_DAY);
    let target = Number.POSITIVE_INFINITY;
    for (let i = 0; i < count; i++) {
      const seg = segments[i] as GameClockSegment;
      if (seg.name !== segmentName) continue;
      let candidate = day * MINUTES_PER_DAY + seg.startMinute;
      if (candidate <= absolute) candidate += MINUTES_PER_DAY;
      if (candidate < target) target = candidate;
    }
    if (target === Number.POSITIVE_INFINITY) {
      throw new Error(`GameClock.skipTo: unknown segment "${segmentName}"`);
    }
    advanceTo(target);
  }

  return {
    get absoluteMinutes() {
      return absolute;
    },
    get day() {
      return Math.floor(absolute / MINUTES_PER_DAY);
    },
    get hour() {
      const minuteOfDay = absolute - Math.floor(absolute / MINUTES_PER_DAY) * MINUTES_PER_DAY;
      return Math.floor(minuteOfDay / 60);
    },
    get minute() {
      const minuteOfDay = absolute - Math.floor(absolute / MINUTES_PER_DAY) * MINUTES_PER_DAY;
      return Math.floor(minuteOfDay - Math.floor(minuteOfDay / 60) * 60);
    },
    get segment() {
      return (segments[index] as GameClockSegment).name;
    },
    get phase() {
      return (segments[index] as GameClockSegment).phase;
    },
    get paused() {
      return paused;
    },
    get held() {
      return held;
    },
    update,
    advanceMinutes,
    skipTo,
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    hold() {
      held = true;
    },
    release() {
      held = false;
    },
    serialize(): GameClockState {
      return { absoluteMinutes: absolute, paused };
    },
  };
}
