import type { Clock } from '@flare/core';

/**
 * TimeControl — pause, step-frame, and slow-motion via Clock.timescale.
 * Wrap in `__DEV__` checks at the call site for tree-shaking.
 */
export class TimeControl {
  private _clock: Clock;
  private _savedTimescale = 1;
  private _paused = false;
  private _stepRequested = false;

  constructor(clock: Clock) {
    this._clock = clock;
  }

  /** Whether the game is currently paused. */
  get paused(): boolean {
    return this._paused;
  }

  /** Current time scale. */
  get timescale(): number {
    return this._clock.timescale;
  }

  /** Pause the game (sets timescale to 0). */
  pause(): void {
    if (this._paused) return;
    this._savedTimescale = this._clock.timescale;
    this._clock.timescale = 0;
    this._paused = true;
  }

  /** Resume the game (restores previous timescale). */
  resume(): void {
    if (!this._paused) return;
    this._clock.timescale = this._savedTimescale;
    this._paused = false;
    this._stepRequested = false;
  }

  /** Toggle pause/resume. */
  toggle(): void {
    if (this._paused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  /**
   * Request a single-frame step while paused.
   * Call this, then on the next update check `consumeStep()`.
   */
  step(): void {
    if (!this._paused) return;
    this._stepRequested = true;
  }

  /**
   * Consume a pending step request. Returns true if a step was requested.
   * When true, the caller should run one frame with the saved timescale,
   * then re-pause.
   */
  consumeStep(): boolean {
    if (!this._stepRequested) return false;
    this._stepRequested = false;
    return true;
  }

  /** Set slow-motion multiplier (e.g., 0.5 for half-speed). */
  setTimescale(scale: number): void {
    if (this._paused) {
      this._savedTimescale = scale;
    } else {
      this._clock.timescale = scale;
    }
  }
}
