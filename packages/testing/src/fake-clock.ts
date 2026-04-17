/**
 * Fake monotonic clock for driving `GameLoop` deterministically in tests.
 *
 * Usage:
 *   const fake = createFakeClock();
 *   loop.tick = fake.requestFrame;
 *   loop.cancelTick = fake.cancelFrame;
 *   loop.start();
 *   fake.advance(1 / 60); // runs one frame
 */
export interface FakeClock {
  /** Current fake timestamp in milliseconds. */
  readonly now: number;
  /** rAF-compatible request — stores the callback for the next `advance`. */
  requestFrame(callback: (time: number) => void): number;
  /** rAF-compatible cancel. */
  cancelFrame(id: number): void;
  /** Advance time by `seconds` and fire every pending callback once. */
  advance(seconds: number): void;
  /** Reset time and cancel all pending callbacks. */
  reset(): void;
}

export function createFakeClock(): FakeClock {
  let nowMs = 0;
  let nextId = 1;
  const pending = new Map<number, (time: number) => void>();

  const clock: FakeClock = {
    get now() {
      return nowMs;
    },
    requestFrame(callback) {
      const id = nextId++;
      pending.set(id, callback);
      return id;
    },
    cancelFrame(id) {
      pending.delete(id);
    },
    advance(seconds) {
      if (seconds < 0) throw new Error('[@flare-engine/testing] cannot advance backwards');
      nowMs += seconds * 1000;
      // Snapshot callbacks so any newly scheduled ones via requestFrame during
      // this flush are deferred to the next advance — mirrors rAF semantics.
      const snapshot = [...pending.entries()];
      pending.clear();
      for (const [, cb] of snapshot) cb(nowMs);
    },
    reset() {
      nowMs = 0;
      pending.clear();
      nextId = 1;
    },
  };
  return clock;
}
