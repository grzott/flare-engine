import { Signal } from '@flare-engine/events';
import { Clock } from './clock.js';

/** Configuration for the game loop. */
export interface GameLoopConfig {
  /** Fixed timestep in seconds (default 1/60). */
  fixedDt?: number;
  /** Maximum raw dt cap in seconds to prevent spiral of death (default 0.25). */
  maxDt?: number;
}

/**
 * GameLoop drives the update cycle using fixed + variable timestep.
 *
 * Fixed updates run at a constant rate (accumulator pattern).
 * Variable updates run once per frame with the actual dt.
 */
export class GameLoop {
  readonly clock = new Clock();

  /** Fixed-timestep update (physics, deterministic logic). */
  readonly onFixedUpdate = new Signal<number>();
  /** Variable-timestep update (movement, AI, game logic). */
  readonly onUpdate = new Signal<number>();
  /** Runs after onUpdate (camera follow, post-processing logic). */
  readonly onLateUpdate = new Signal<number>();
  /** Runs before rendering. */
  readonly onPreRender = new Signal<void>();
  /** Runs after rendering. */
  readonly onPostRender = new Signal<void>();

  private running = false;
  private paused = false;
  private accumulator = 0;
  private maxDt: number;
  private rafId = 0;
  private lastTime = 0;
  private _hasFixedDt = false;

  /** External tick function — set this for testing or custom scheduling. */
  tick: ((callback: (time: number) => void) => number) | undefined;
  /** External cancel function — paired with tick. */
  cancelTick: ((id: number) => void) | undefined;

  constructor(config?: GameLoopConfig) {
    this.maxDt = config?.maxDt ?? 0.25;
    if (config?.fixedDt !== undefined) {
      this.clock.fixedDt = config.fixedDt;
      this._hasFixedDt = true;
    }
  }

  /** Start the game loop. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.lastTime = 0;
    this.accumulator = 0;
    this.scheduleFrame();
  }

  /** Stop the game loop entirely and reset. */
  stop(): void {
    this.running = false;
    this.paused = false;
    if (this.rafId !== 0) {
      const cancel = this.cancelTick ?? cancelAnimationFrame;
      cancel(this.rafId);
      this.rafId = 0;
    }
  }

  /** Pause — signals stop firing but loop stays alive. */
  pause(): void {
    if (!this.running || this.paused) return;
    this.paused = true;
  }

  /** Resume from pause. */
  resume(): void {
    if (!this.running || !this.paused) return;
    this.paused = false;
    this.lastTime = 0; // Reset so next frame doesn't have a huge dt
  }

  /** Whether the loop is currently running (started and not stopped). */
  get isRunning(): boolean {
    return this.running;
  }

  /** Whether the loop is paused. */
  get isPaused(): boolean {
    return this.paused;
  }

  /**
   * Post-step residual fraction for physics interpolation.
   *
   * After fixed updates drain the accumulator, `alpha` is the fraction of a
   * fixed step that has elapsed since the last fixed tick — always in [0, 1).
   * Read in `onPreRender` to lerp between the previous and current physics
   * state for smooth visuals at any display refresh rate.
   *
   * Returns 0 when no fixed step was configured (i.e. `fixedDt` was not
   * passed to the constructor).
   */
  get alpha(): number {
    return this._hasFixedDt ? this.accumulator / this.clock.fixedDt : 0;
  }

  /** Process a single frame. Exposed for testing. */
  step(rawDt: number): void {
    if (this.paused) return;

    // Cap the dt to avoid spiral of death
    const capped = Math.min(rawDt, this.maxDt);
    this.clock.update(capped);

    const dt = this.clock.dt;
    const fixedDt = this.clock.fixedDt;

    // Fixed update accumulator
    this.accumulator += dt;
    while (this.accumulator >= fixedDt) {
      this.onFixedUpdate.emit(fixedDt);
      this.accumulator -= fixedDt;
    }

    // Variable update
    this.onUpdate.emit(dt);
    this.onLateUpdate.emit(dt);

    // Render
    this.onPreRender.emit();
    this.onPostRender.emit();
  }

  private scheduleFrame(): void {
    const request = this.tick ?? requestAnimationFrame;
    this.rafId = request((time: number) => {
      if (!this.running) return;

      if (this.lastTime === 0) {
        this.lastTime = time;
        this.scheduleFrame();
        return;
      }

      const rawDt = (time - this.lastTime) / 1000;
      this.lastTime = time;

      this.step(rawDt);
      this.scheduleFrame();
    });
  }
}
