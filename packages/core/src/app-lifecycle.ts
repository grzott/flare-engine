import { Signal } from '@flare-engine/events';
import type { GameLoop } from './game-loop.js';

/**
 * AppLifecycle is a manual adapter between the host's app-state events and the game loop.
 *
 * It subscribes to nothing. The host calls `background()`, `foreground()` and
 * `memoryWarning()` itself, for example from a React Native `AppState` listener or a
 * web `visibilitychange` handler it writes.
 *
 * - `background()` pauses the loop if it was running and unpaused, and remembers that it did
 * - `foreground()` resumes the loop only if `background()` paused it
 * - each method emits its matching signal: `onBackground`, `onForeground`, `onMemoryWarning`
 *
 * The first frame after a resume does not see the time spent in the background:
 * `GameLoop.resume()` resets the loop's last timestamp.
 */
export class AppLifecycle {
  /** Fires when app enters background. */
  readonly onBackground = new Signal<void>();
  /** Fires when app returns to foreground. */
  readonly onForeground = new Signal<void>();
  /** Fires on memory warning (RN-specific). */
  readonly onMemoryWarning = new Signal<void>();

  private loop: GameLoop;
  private wasRunningBeforeBackground = false;
  private _inBackground = false;

  constructor(loop: GameLoop) {
    this.loop = loop;
  }

  /** Call when app goes to background. */
  background(): void {
    if (this._inBackground) return;
    this._inBackground = true;
    this.wasRunningBeforeBackground = this.loop.isRunning && !this.loop.isPaused;
    if (this.wasRunningBeforeBackground) {
      this.loop.pause();
    }
    this.onBackground.emit();
  }

  /** Call when app returns to foreground. */
  foreground(): void {
    this._inBackground = false;
    if (this.wasRunningBeforeBackground) {
      this.loop.resume();
    }
    this.onForeground.emit();
  }

  /** Call on memory warning. */
  memoryWarning(): void {
    this.onMemoryWarning.emit();
  }
}
