import { describe, expect, it } from 'bun:test';
import type { CoroutineHandle } from '../src/coroutine.js';
import { CoroutineManager } from '../src/coroutine.js';

describe('CoroutineManager.start', () => {
  it('runs generator to completion', () => {
    const mgr = new CoroutineManager();
    let step = 0;
    mgr.start(
      (function* () {
        step = 1;
        yield undefined;
        step = 2;
        yield undefined;
        step = 3;
      })(),
    );
    // start() advances to first yield
    expect(step).toBe(1);
    mgr.update(0);
    expect(step).toBe(2);
    mgr.update(0);
    expect(step).toBe(3);
  });

  it('handles empty generator', () => {
    const mgr = new CoroutineManager();
    const handle = mgr.start((function* () {})());
    expect(handle.done).toBe(true);
  });
});

describe('yield undefined (wait 1 frame)', () => {
  it('waits exactly one frame', () => {
    const mgr = new CoroutineManager();
    let reached = false;
    mgr.start(
      (function* () {
        yield undefined;
        reached = true;
      })(),
    );
    expect(reached).toBe(false);
    mgr.update(0);
    expect(reached).toBe(true);
  });
});

describe('yield number (wait seconds)', () => {
  it('waits specified time', () => {
    const mgr = new CoroutineManager();
    let reached = false;
    mgr.start(
      (function* () {
        yield 0.5;
        reached = true;
      })(),
    );
    mgr.update(0.3);
    expect(reached).toBe(false);
    mgr.update(0.3);
    expect(reached).toBe(true);
  });

  it('handles zero wait', () => {
    const mgr = new CoroutineManager();
    let reached = false;
    mgr.start(
      (function* () {
        yield 0;
        reached = true;
      })(),
    );
    // 0 seconds — should advance on next update
    mgr.update(0);
    expect(reached).toBe(true);
  });
});

describe('yield Promise (wait async)', () => {
  it('waits for promise resolution', async () => {
    const mgr = new CoroutineManager();
    let reached = false;
    let resolve!: () => void;
    const p = new Promise<void>((r) => {
      resolve = r;
    });

    mgr.start(
      (function* () {
        yield p;
        reached = true;
      })(),
    );

    mgr.update(0);
    expect(reached).toBe(false);

    resolve();
    await p;

    mgr.update(0);
    expect(reached).toBe(true);
  });

  it('cancels on promise rejection', async () => {
    const mgr = new CoroutineManager();
    let reached = false;
    let reject!: () => void;
    const p = new Promise<void>((_, r) => {
      reject = r;
    });

    const handle = mgr.start(
      (function* () {
        yield p;
        reached = true;
      })(),
    );

    reject();
    try {
      await p;
    } catch {}

    mgr.update(0);
    expect(reached).toBe(false);
    expect(handle.done).toBe(true);
    expect(handle.failed).toBe(true);
    expect(handle.error).toBeUndefined();
  });
});

describe('CoroutineHandle', () => {
  it('reports done when completed', () => {
    const mgr = new CoroutineManager();
    const handle = mgr.start(
      (function* () {
        yield undefined;
      })(),
    );
    expect(handle.done).toBe(false);
    mgr.update(0);
    expect(handle.done).toBe(true);
  });

  it('can be cancelled', () => {
    const mgr = new CoroutineManager();
    let reached = false;
    const handle = mgr.start(
      (function* () {
        yield undefined;
        reached = true;
      })(),
    );
    handle.cancel();
    mgr.update(0);
    expect(reached).toBe(false);
    expect(handle.done).toBe(true);
    expect(handle.cancelled).toBe(true);
    expect(handle.failed).toBe(false);
  });

  it('reports cancelled: false and failed: false on a clean finish', () => {
    const mgr = new CoroutineManager();
    const handle = mgr.start((function* () {})());
    expect(handle.done).toBe(true);
    expect(handle.cancelled).toBe(false);
    expect(handle.failed).toBe(false);
  });
});

describe('CoroutineManager.clear', () => {
  it('cancels all coroutines', () => {
    const mgr = new CoroutineManager();
    let a = false;
    let b = false;
    const handleA = mgr.start(
      (function* () {
        yield undefined;
        a = true;
      })(),
    );
    const handleB = mgr.start(
      (function* () {
        yield undefined;
        b = true;
      })(),
    );
    expect(mgr.count).toBe(2);
    mgr.clear();
    expect(mgr.count).toBe(0);
    mgr.update(0);
    expect(a).toBe(false);
    expect(b).toBe(false);
    // clear() is a cancel from each coroutine's point of view, not a distinct end state
    expect(handleA.cancelled).toBe(true);
    expect(handleA.failed).toBe(false);
    expect(handleB.cancelled).toBe(true);
    expect(handleB.failed).toBe(false);
  });
});

describe('CoroutineManager.count', () => {
  it('tracks active coroutine count', () => {
    const mgr = new CoroutineManager();
    expect(mgr.count).toBe(0);
    mgr.start(
      (function* () {
        yield undefined;
      })(),
    );
    expect(mgr.count).toBe(1);
    mgr.update(0);
    expect(mgr.count).toBe(0);
  });
});

describe('multiple coroutines', () => {
  it('runs multiple coroutines concurrently', () => {
    const mgr = new CoroutineManager();
    const log: string[] = [];
    mgr.start(
      (function* () {
        log.push('a1');
        yield undefined;
        log.push('a2');
      })(),
    );
    mgr.start(
      (function* () {
        log.push('b1');
        yield undefined;
        log.push('b2');
      })(),
    );
    expect(log).toEqual(['a1', 'b1']);
    mgr.update(0);
    expect(log).toEqual(['a1', 'b1', 'b2', 'a2']);
  });
});

describe('CoroutineManager re-entrancy', () => {
  it('clear() called inside a running coroutine does not throw', () => {
    const mgr = new CoroutineManager();
    // A yields once (start advances past that), then calls clear() during update()
    mgr.start(
      (function* () {
        yield undefined;
        mgr.clear();
      })(),
    );
    mgr.start(
      (function* () {
        yield undefined;
      })(),
    );
    mgr.start(
      (function* () {
        yield undefined;
      })(),
    );
    // All 3 coroutines are now paused at their first yield.
    // update() will advance them; A's body calls clear() mid-iteration.
    expect(() => mgr.update(0)).not.toThrow();
    expect(mgr.count).toBe(0);
  });
});

describe('generator cleanup on cancel/clear', () => {
  it('cancel() runs the finally block', () => {
    const mgr = new CoroutineManager();
    let disposed = false;
    const handle = mgr.start(
      (function* () {
        try {
          yield 2;
        } finally {
          disposed = true;
        }
      })(),
    );
    expect(disposed).toBe(false);
    handle.cancel();
    expect(disposed).toBe(true);
    expect(handle.done).toBe(true);
    expect(handle.cancelled).toBe(true);
    expect(handle.failed).toBe(false);
  });

  it('clear() runs every finally block and reports cancelled on each handle', () => {
    const mgr = new CoroutineManager();
    const disposed: string[] = [];
    const handles: CoroutineHandle[] = [];
    for (const name of ['a', 'b', 'c']) {
      handles.push(
        mgr.start(
          (function* () {
            try {
              yield 10;
            } finally {
              disposed.push(name);
            }
          })(),
        ),
      );
    }
    mgr.clear();
    expect(disposed.sort()).toEqual(['a', 'b', 'c']);
    expect(mgr.count).toBe(0);
    for (const h of handles) {
      expect(h.cancelled).toBe(true);
      expect(h.failed).toBe(false);
    }
  });

  it('a coroutine that cancels itself from inside is closed once it suspends', () => {
    const mgr = new CoroutineManager();
    const log: string[] = [];
    let self!: CoroutineHandle;
    self = mgr.start(
      (function* () {
        try {
          yield undefined;
          log.push('body');
          self.cancel();
          log.push('after-cancel');
          yield undefined;
          log.push('resumed');
        } finally {
          log.push('finally');
        }
      })(),
    );
    expect(() => mgr.update(0)).not.toThrow();
    expect(log).toEqual(['body', 'after-cancel', 'finally']);
    expect(self.done).toBe(true);
    // Same end state as a cancel issued from outside — the deferred close is not a different outcome
    expect(self.cancelled).toBe(true);
    expect(self.failed).toBe(false);
    expect(mgr.count).toBe(0);
    mgr.update(0);
    expect(log).toEqual(['body', 'after-cancel', 'finally']);
  });

  it('clear() called inside a running coroutine still runs every finally block, same end state as an outside cancel', () => {
    const mgr = new CoroutineManager();
    const disposed: string[] = [];
    const handleA = mgr.start(
      (function* () {
        try {
          yield undefined;
          mgr.clear();
          yield undefined;
        } finally {
          disposed.push('a');
        }
      })(),
    );
    const handleB = mgr.start(
      (function* () {
        try {
          yield 10;
        } finally {
          disposed.push('b');
        }
      })(),
    );
    expect(() => mgr.update(0)).not.toThrow();
    expect(disposed.sort()).toEqual(['a', 'b']);
    expect(mgr.count).toBe(0);
    // A's clear() ran from inside its own running body (the deferred-close path); B's was an
    // ordinary clear from outside. Both must report the same shape.
    expect(handleA.cancelled).toBe(true);
    expect(handleA.failed).toBe(false);
    expect(handleB.cancelled).toBe(true);
    expect(handleB.failed).toBe(false);
  });

  it('cancel() is idempotent, including from its own finally block', () => {
    const mgr = new CoroutineManager();
    let closes = 0;
    let handle!: CoroutineHandle;
    handle = mgr.start(
      (function* () {
        try {
          yield undefined;
        } finally {
          closes++;
          handle.cancel();
        }
      })(),
    );
    expect(() => handle.cancel()).not.toThrow();
    handle.cancel();
    expect(closes).toBe(1);
    expect(handle.done).toBe(true);
    expect(handle.cancelled).toBe(true);
  });

  it('clear() called from a finally block during clear() closes everything once', () => {
    const mgr = new CoroutineManager();
    const disposed: string[] = [];
    mgr.start(
      (function* () {
        try {
          yield 10;
        } finally {
          disposed.push('a');
          mgr.clear();
        }
      })(),
    );
    mgr.start(
      (function* () {
        try {
          yield 10;
        } finally {
          disposed.push('b');
        }
      })(),
    );
    expect(() => mgr.clear()).not.toThrow();
    expect(disposed.sort()).toEqual(['a', 'b']);
    expect(mgr.count).toBe(0);
  });

  it('a coroutine started from a finally block during clear() is closed too', () => {
    const mgr = new CoroutineManager();
    const log: string[] = [];
    mgr.start(
      (function* () {
        try {
          yield 10;
        } finally {
          mgr.start(
            (function* () {
              try {
                log.push('spawned');
                yield 10;
              } finally {
                log.push('spawned-closed');
              }
            })(),
          );
        }
      })(),
    );
    mgr.clear();
    expect(log).toEqual(['spawned', 'spawned-closed']);
    expect(mgr.count).toBe(0);
  });
});

describe('yield Promise rejection', () => {
  it('exposes the rejection reason on the handle', async () => {
    const mgr = new CoroutineManager();
    const boom = new Error('boom');
    const p = Promise.reject(boom);
    const handle = mgr.start(
      (function* () {
        yield p;
      })(),
    );
    expect(handle.failed).toBe(false);
    expect(handle.error).toBeUndefined();
    await p.catch(() => {});
    expect(handle.done).toBe(true);
    expect(handle.failed).toBe(true);
    expect(handle.cancelled).toBe(false);
    expect(handle.error).toBe(boom);
  });

  it('runs the finally block when the generator does not catch', async () => {
    const mgr = new CoroutineManager();
    let disposed = false;
    const p = Promise.reject(new Error('boom'));
    const handle = mgr.start(
      (function* () {
        try {
          yield p;
        } finally {
          disposed = true;
        }
      })(),
    );
    await p.catch(() => {});
    expect(disposed).toBe(true);
    expect(handle.failed).toBe(true);
  });

  it('a generator that catches the rejection keeps running', async () => {
    const mgr = new CoroutineManager();
    const boom = new Error('boom');
    const p = Promise.reject(boom);
    let caught: unknown;
    let reached = false;
    const handle = mgr.start(
      (function* () {
        try {
          yield p;
        } catch (e) {
          caught = e;
        }
        yield undefined;
        reached = true;
      })(),
    );
    await p.catch(() => {});
    expect(caught).toBe(boom);
    expect(handle.failed).toBe(false);
    expect(handle.done).toBe(false);
    mgr.update(0);
    expect(reached).toBe(true);
    expect(handle.done).toBe(true);
  });

  it('a caught rejection can yield a number and waits for it', async () => {
    const mgr = new CoroutineManager();
    const p = Promise.reject(new Error('boom'));
    let reached = false;
    mgr.start(
      (function* () {
        try {
          yield p;
        } catch {}
        yield 0.5;
        reached = true;
      })(),
    );
    await p.catch(() => {});
    mgr.update(0.3);
    expect(reached).toBe(false);
    mgr.update(0.3);
    expect(reached).toBe(true);
  });

  it('a caught rejection can yield another promise and waits for it', async () => {
    const mgr = new CoroutineManager();
    const p = Promise.reject(new Error('boom'));
    let resolve!: () => void;
    const p2 = new Promise<void>((r) => {
      resolve = r;
    });
    let reached = false;
    mgr.start(
      (function* () {
        try {
          yield p;
        } catch {}
        yield p2;
        reached = true;
      })(),
    );
    await p.catch(() => {});
    mgr.update(0);
    expect(reached).toBe(false);
    resolve();
    await p2;
    mgr.update(0);
    expect(reached).toBe(true);
  });

  it('an error thrown from the catch block becomes the handle error', async () => {
    const mgr = new CoroutineManager();
    const p = Promise.reject(new Error('boom'));
    const wrapped = new Error('wrapped');
    const handle = mgr.start(
      (function* () {
        try {
          yield p;
        } catch {
          throw wrapped;
        }
      })(),
    );
    await p.catch(() => {});
    expect(handle.failed).toBe(true);
    expect(handle.error).toBe(wrapped);
  });

  it('a coroutine cancelled while waiting is not failed when the promise later rejects', async () => {
    const mgr = new CoroutineManager();
    let reject!: (e: unknown) => void;
    const p = new Promise<void>((_, r) => {
      reject = r;
    });
    let disposed = false;
    const handle = mgr.start(
      (function* () {
        try {
          yield p;
        } finally {
          disposed = true;
        }
      })(),
    );
    handle.cancel();
    expect(disposed).toBe(true);
    expect(handle.cancelled).toBe(true);
    reject(new Error('late'));
    await p.catch(() => {});
    expect(handle.done).toBe(true);
    expect(handle.cancelled).toBe(true);
    expect(handle.failed).toBe(false);
    expect(handle.error).toBeUndefined();
  });

  it('an uncaught rejection does not escape as an unhandled rejection', async () => {
    // bun's runner fails the test on any unhandled rejection raised while it runs, so the
    // macrotask wait below is the assertion: a manager that rethrew would fail here.
    const mgr = new CoroutineManager();
    const p = Promise.reject(new Error('boom'));
    const handle = mgr.start(
      (function* () {
        yield p;
      })(),
    );
    await p.catch(() => {});
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(handle.failed).toBe(true);
  });
});

describe('end state is not retroactively overwritten by clear()', () => {
  it('a coroutine that completed synchronously in start() stays completed if clear() runs before update() splices it', () => {
    const mgr = new CoroutineManager();
    // Completes immediately inside start() — its state entry is still in the internal array,
    // not yet spliced out (that only happens in update()).
    const handle = mgr.start((function* () {})());
    expect(handle.done).toBe(true);
    expect(handle.cancelled).toBe(false);

    mgr.clear();

    expect(handle.done).toBe(true);
    expect(handle.cancelled).toBe(false);
    expect(handle.failed).toBe(false);
  });

  it('a coroutine that already failed stays failed if clear() runs before update() splices it', async () => {
    const mgr = new CoroutineManager();
    const boom = new Error('boom');
    const p = Promise.reject(boom);
    const handle = mgr.start(
      (function* () {
        yield p;
      })(),
    );
    await p.catch(() => {});
    expect(handle.failed).toBe(true);

    // failed was set asynchronously via the promise rejection handler; the state entry is still
    // in the array, so clear() reaches it too.
    mgr.clear();

    expect(handle.failed).toBe(true);
    expect(handle.cancelled).toBe(false);
    expect(handle.error).toBe(boom);
  });
});
