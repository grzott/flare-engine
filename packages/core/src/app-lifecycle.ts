import { Signal } from '@flare/events';
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

  constructor(loop: GameLoop) {
    this.loop = loop;
  }

  /** Call when app goes to background. */
  background(): void {
    this.wasRunningBeforeBackground = this.loop.isRunning && !this.loop.isPaused;
    if (this.wasRunningBeforeBackground) {
      this.loop.pause();
    }
    this.onBackground.emit();
  }

  /** Call when app returns to foreground. */
  foreground(): void {
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
