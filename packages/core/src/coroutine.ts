/**
 * Generator-based coroutines for game logic.
 *
 * - yield number → wait N seconds (scaled time)
 * - yield undefined → wait 1 frame
 * - yield Promise → wait until resolved
 */

/** A running coroutine handle. */
export interface CoroutineHandle {
  /** Whether the coroutine has completed or been cancelled. */
  readonly done: boolean;
  /** Cancel the coroutine. It will not resume. */
  cancel(): void;
}

/** Yield type for coroutine generators. */
export type CoroutineYield = number | undefined | Promise<unknown>;

/** A coroutine generator function. */
export type CoroutineGenerator = Generator<CoroutineYield, void, unknown>;

interface CoroutineState {
  gen: CoroutineGenerator;
  waitTime: number;
  waitingForPromise: boolean;
  done: boolean;
}

/**
 * CoroutineManager runs generator-based coroutines.
 * Call update(dt) each frame to advance all active coroutines.
 */
export class CoroutineManager {
  private coroutines: CoroutineState[] = [];

  /** Start a new coroutine. Returns a handle to check status or cancel. */
  start(gen: CoroutineGenerator): CoroutineHandle {
    const state: CoroutineState = {
      gen,
      waitTime: 0,
      waitingForPromise: false,
      done: false,
    };
    this.coroutines.push(state);

    // Advance to first yield immediately
    this.advance(state);

    const handle: CoroutineHandle = {
      get done() {
        return state.done;
      },
      cancel() {
        state.done = true;
      },
    };
    return handle;
  }

  /** Update all running coroutines. Call once per frame with scaled dt. */
  update(dt: number): void {
    for (let i = this.coroutines.length - 1; i >= 0; i--) {
      const state = this.coroutines[i];
      if (state === undefined) continue;
      if (state.done) {
        this.coroutines.splice(i, 1);
        continue;
      }

      if (state.waitingForPromise) continue;

      if (state.waitTime > 0) {
        state.waitTime -= dt;
        if (state.waitTime > 0) continue;
      }

      this.advance(state);

      if (state.done) {
        this.coroutines.splice(i, 1);
      }
    }
  }

  /** Cancel all running coroutines. */
  clear(): void {
    for (const state of this.coroutines) {
      state.done = true;
    }
    this.coroutines.length = 0;
  }

  /** Number of active coroutines. */
  get count(): number {
    return this.coroutines.length;
  }

  private advance(state: CoroutineState): void {
    const result = state.gen.next();
    if (result.done) {
      state.done = true;
      return;
    }

    const value = result.value;
    if (typeof value === 'number') {
      state.waitTime = value;
    } else if (value instanceof Promise) {
      state.waitingForPromise = true;
      value.then(
        () => {
          state.waitingForPromise = false;
        },
        () => {
          // On rejection, stop the coroutine
          state.done = true;
        },
      );
    }
    // undefined → wait 1 frame (will advance next update)
  }
}
