/**
 * Generator-based coroutines for game logic.
 *
 * - yield number → wait N seconds (scaled time)
 * - yield undefined → wait 1 frame
 * - yield Promise → wait until resolved; a rejection is thrown into the generator
 */

/** A running coroutine handle. Ends exactly one of three ways: completed, cancelled, or failed. */
export interface CoroutineHandle {
  /** Whether the coroutine has finished — completed, cancelled, or failed. */
  readonly done: boolean;
  /**
   * Whether `cancel()` or `clear()` ended the coroutine before it completed. Implies `done`;
   * mutually exclusive with `failed`. A cancel issued from inside the running body reports the
   * same way as one issued from outside.
   */
  readonly cancelled: boolean;
  /**
   * Whether a rejected `yield Promise` ended the coroutine without the generator recovering.
   * Implies `done`; mutually exclusive with `cancelled`. The failure is never re-raised as an
   * unhandled rejection; this is the channel.
   */
  readonly failed: boolean;
  /**
   * What the generator threw when `failed` — the rejection reason, unless a `catch`/`finally`
   * block threw something else. `undefined` while running, after a clean finish, or after a
   * cancel. Test `failed` rather than `error`: a bare `reject()` rejects with `undefined`.
   */
  readonly error: unknown;
  /** Cancel the coroutine. Its pending `finally` blocks run; it will not resume. */
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
  /** True while the generator body is executing — `gen.return()` would throw. */
  running: boolean;
  done: boolean;
  cancelled: boolean;
  failed: boolean;
  error: unknown;
}

/**
 * Marks the coroutine cancelled and closes its generator so pending `finally` blocks run.
 * A generator cannot be closed while its body is executing (`gen.return()` throws
 * "Generator is already running"), so a cancel that arrives from inside the body is only
 * marked here and closed by `dispatch()` once the body suspends. Shared by `cancel()` and
 * `clear()` — a scene teardown is a cancel from the coroutine's point of view.
 */
function closeCoroutine(state: CoroutineState): void {
  if (state.done) return;
  state.done = true;
  state.cancelled = true;
  if (!state.running) state.gen.return();
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
      running: false,
      done: false,
      cancelled: false,
      failed: false,
      error: undefined,
    };
    this.coroutines.push(state);

    // Advance to first yield immediately
    this.advance(state);

    const handle: CoroutineHandle = {
      get done() {
        return state.done;
      },
      get cancelled() {
        return state.cancelled;
      },
      get failed() {
        return state.failed;
      },
      get error() {
        return state.error;
      },
      cancel() {
        closeCoroutine(state);
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

  /** Cancel all running coroutines. Each one's pending `finally` blocks run. */
  clear(): void {
    // Pop rather than iterate: a finally block may start() another coroutine, which must close too
    let state = this.coroutines.pop();
    while (state !== undefined) {
      closeCoroutine(state);
      state = this.coroutines.pop();
    }
  }

  /** Number of active coroutines. */
  get count(): number {
    return this.coroutines.length;
  }

  private advance(state: CoroutineState): void {
    state.running = true;
    const result = state.gen.next();
    state.running = false;
    this.dispatch(state, result);
  }

  /** Resume the generator by throwing a rejected promise's reason into it. */
  private advanceWithError(state: CoroutineState, err: unknown): void {
    let result: IteratorResult<CoroutineYield, void>;
    state.running = true;
    try {
      result = state.gen.throw(err);
    } catch (thrown) {
      // The generator did not recover: it is closed and its finally blocks have already run
      state.running = false;
      state.done = true;
      state.failed = true;
      state.error = thrown;
      return;
    }
    state.running = false;
    this.dispatch(state, result);
  }

  private dispatch(state: CoroutineState, result: IteratorResult<CoroutineYield, void>): void {
    if (state.done) {
      // cancel()/clear() ran inside the body; the generator is suspended now, so close it
      if (!result.done) state.gen.return();
      return;
    }
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
        (err: unknown) => {
          // Cancelled while waiting: the generator is already closed
          if (state.done) return;
          state.waitingForPromise = false;
          this.advanceWithError(state, err);
        },
      );
    }
    // undefined → wait 1 frame (will advance next update)
  }
}
