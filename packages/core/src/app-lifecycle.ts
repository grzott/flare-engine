import { Signal } from '@flare-engine/events';
import type { GameLoop } from './game-loop.js';

/**
 * AppLifecycle bridges React Native AppState to the game loop.
 *
 * - Auto-pauses the loop when app goes to background
 * - Auto-resumes when app returns to foreground
 * - Caps dt on resume to prevent huge time jumps
 *
 * In non-RN environments (tests, web), use the manual methods.
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
