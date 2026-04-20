import type { GameLoop } from '@flare-engine/core';
import type { SnapshotRingBuffer } from './ring-buffer.js';

/**
 * Restore callback invoked by `TimeScrubber.rewind()` to apply a historical
 * snapshot back to world state. Consumers implement deserialize semantics
 * here — the scrubber itself never touches ECS state.
 */
export type RestoreCallback<T> = (snapshot: T) => void;

export interface TimeScrubberOptions<T> {
  loop: GameLoop;
  buffer: SnapshotRingBuffer<T>;
  /** Optional restore callback. If omitted, `rewind()` is a no-op beyond pausing the loop. */
  restore?: RestoreCallback<T>;
}

/**
 * TimeScrubber — imperative controller binding a `GameLoop` to a snapshot
 * ring buffer. Exposes pause / step / resume plus `rewind(framesAgo)` which
 * pauses the loop and hands the historical snapshot to the restore callback.
 */
export class TimeScrubber<T> {
  private readonly loop: GameLoop;
  private readonly buffer: SnapshotRingBuffer<T>;
  private readonly restore: RestoreCallback<T> | undefined;
  private _stepRequested = false;
  private _scrubFrames = 0;

  constructor(options: TimeScrubberOptions<T>) {
    this.loop = options.loop;
    this.buffer = options.buffer;
    this.restore = options.restore;
  }

  /** Whether the loop is currently paused. */
  get paused(): boolean {
    return this.loop.clock.timescale === 0;
  }

  /** Whether the scrubber is currently displaying a historical snapshot. */
  get scrubbing(): boolean {
    return this._scrubFrames > 0;
  }

  /** Current scrub offset (0 = latest, N = N frames back). */
  get scrubOffset(): number {
    return this._scrubFrames;
  }

  /** Pause the loop (timescale → 0). */
  pause(): void {
    this.loop.clock.timescale = 0;
  }

  /** Resume the loop at normal speed and clear any scrub state. */
  resume(): void {
    this.loop.clock.timescale = 1;
    this._scrubFrames = 0;
    this._stepRequested = false;
  }

  /** Request a single-frame step. Caller polls `consumeStep()` each frame. */
  step(): void {
    this._stepRequested = true;
  }

  /** Ring-buffer depth available for rewind. */
  get available(): number {
    return this.buffer.length;
  }

  /**
   * Pause the loop and restore the snapshot from `framesAgo` captures back.
   * Clamps to available history. Returns the snapshot applied, or `null`
   * when the buffer is empty.
   */
  rewind(framesAgo: number): T | null {
    if (framesAgo < 0 || !Number.isFinite(framesAgo)) return null;
    const max = this.buffer.length - 1;
    if (max < 0) return null;
    const offset = Math.min(Math.floor(framesAgo), max);
    const snap = this.buffer.rewind(offset);
    if (snap === null) return null;
    this.pause();
    this._scrubFrames = offset;
    if (this.restore) this.restore(snap);
    return snap;
  }

  /**
   * Returns true once per `step()` call, then resets. Frame-driver code is
   * expected to advance the simulation by one fixed tick when this is true.
   */
  consumeStep(): boolean {
    if (!this._stepRequested) return false;
    this._stepRequested = false;
    return true;
  }
}
