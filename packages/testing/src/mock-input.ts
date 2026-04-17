import { InputManager } from '@flare-engine/input';

/**
 * `InputManager` subclass with scripted helpers for tests. Drives the same
 * internal state the real manager uses, so any system reading
 * `.pointer` / `.touches` sees identical data.
 */
export class MockInputManager extends InputManager {
  /** Press a pointer at `(x, y)`. `id` defaults to 0 (primary). */
  press(x: number, y: number, id = 0): void {
    this.onPointerDown(id, x, y);
  }
  /** Move a pointer to `(x, y)`. */
  move(x: number, y: number, id = 0): void {
    this.onPointerMove(id, x, y);
  }
  /** Release a pointer at `(x, y)`. */
  release(x: number, y: number, id = 0): void {
    this.onPointerUp(id, x, y);
  }
  /** Full tap: press → release in one call. */
  tap(x: number, y: number, id = 0): void {
    this.onPointerDown(id, x, y);
    this.onPointerUp(id, x, y);
  }
}

export function createMockInputManager(): MockInputManager {
  return new MockInputManager();
}
