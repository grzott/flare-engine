import { describe, expect, it } from 'bun:test';
import { EventEmitter } from '../src/index.js';

type TestEvents = {
  update: (dt: number) => void;
  resize: (w: number, h: number) => void;
  ping: () => void;
};

describe('EventEmitter.on', () => {
  it('calls handler on emit', () => {
    const em = new EventEmitter<TestEvents>();
    let called = false;
    em.on('ping', () => {
      called = true;
    });
    em.emit('ping');
    expect(called).toBe(true);
  });

  it('passes arguments', () => {
    const em = new EventEmitter<TestEvents>();
    let w = 0,
      h = 0;
    em.on('resize', (ww, hh) => {
      w = ww;
      h = hh;
    });
    em.emit('resize', 800, 600);
    expect(w).toBe(800);
    expect(h).toBe(600);
  });

  it('supports multiple handlers', () => {
    const em = new EventEmitter<TestEvents>();
    let count = 0;
    em.on('ping', () => {
      count++;
    });
    em.on('ping', () => {
      count++;
    });
    em.emit('ping');
    expect(count).toBe(2);
  });

  it('returns unsubscribe function', () => {
    const em = new EventEmitter<TestEvents>();
    let count = 0;
    const unsub = em.on('ping', () => {
      count++;
    });
    em.emit('ping');
    unsub();
    em.emit('ping');
    expect(count).toBe(1);
  });

  it('does not call other event handlers', () => {
    const em = new EventEmitter<TestEvents>();
    let called = false;
    em.on('ping', () => {
      called = true;
    });
    em.emit('update', 0.016);
    expect(called).toBe(false);
  });
});

describe('EventEmitter.once', () => {
  it('calls handler only once', () => {
    const em = new EventEmitter<TestEvents>();
    let count = 0;
    em.once('ping', () => {
      count++;
    });
    em.emit('ping');
    em.emit('ping');
    expect(count).toBe(1);
  });

  it('returns unsubscribe function', () => {
    const em = new EventEmitter<TestEvents>();
    let called = false;
    const unsub = em.once('ping', () => {
      called = true;
    });
    unsub();
    em.emit('ping');
    expect(called).toBe(false);
  });

  it('passes arguments', () => {
    const em = new EventEmitter<TestEvents>();
    let received = 0;
    em.once('update', (dt) => {
      received = dt;
    });
    em.emit('update', 0.016);
    expect(received).toBe(0.016);
  });
});

describe('EventEmitter.off', () => {
  it('removes specific handler', () => {
    const em = new EventEmitter<TestEvents>();
    let count = 0;
    const handler = () => {
      count++;
    };
    em.on('ping', handler);
    em.emit('ping');
    em.off('ping', handler);
    em.emit('ping');
    expect(count).toBe(1);
  });

  it('no-op for non-existent handler', () => {
    const em = new EventEmitter<TestEvents>();
    em.off('ping', () => {}); // should not throw
  });

  it('no-op for non-existent event', () => {
    const em = new EventEmitter<TestEvents>();
    em.off('ping', () => {}); // should not throw
  });
});

describe('EventEmitter.emit', () => {
  it('no-op for empty event', () => {
    const em = new EventEmitter<TestEvents>();
    em.emit('ping'); // should not throw
  });

  it('allows removal during emit', () => {
    const em = new EventEmitter<TestEvents>();
    const calls: number[] = [];
    let unsub2: (() => void) | undefined;
    em.on('ping', () => {
      calls.push(1);
      unsub2?.();
    });
    unsub2 = em.on('ping', () => {
      calls.push(2);
    });
    em.emit('ping');
    // Both run: emit iterates the live set with deferred removal, so h2 (removed
    // during h1) still fires this emit and is gone next emit.
    expect(calls).toEqual([1, 2]);
    // Now handler 2 is removed
    calls.length = 0;
    em.emit('ping');
    expect(calls).toEqual([1]);
  });
});

describe('EventEmitter.emit re-entrancy and throw-safety', () => {
  it('a throwing handler does not wedge future removals', () => {
    const em = new EventEmitter<TestEvents>();
    let count = 0;
    const bad = () => {
      throw new Error('boom');
    };
    const good = () => {
      count++;
    };
    em.on('ping', bad);
    em.on('ping', good);
    expect(() => em.emit('ping')).toThrow('boom');
    // Old boolean flag left `iterating` true after the throw -> these offs would
    // defer forever and the next emit would re-throw.
    em.off('ping', bad);
    em.off('ping', good);
    em.emit('ping');
    expect(count).toBe(0);
  });

  it("a nested emit does not flush the outer emit's deferred removals early", () => {
    const em = new EventEmitter<TestEvents>();
    const seen: number[] = [];
    const h2 = () => seen.push(2);
    let nested = false;
    const h1 = () => {
      seen.push(1);
      if (!nested) {
        nested = true;
        em.off('ping', h2); // deferred until the outermost emit ends
        em.emit('ping'); // nested emit must NOT flush the pending off(h2)
      }
    };
    em.on('ping', h1);
    em.on('ping', h2);
    em.emit('ping');
    // Old code flushed off(h2) at the nested emit's end -> outer loop skipped h2 -> [1, 1, 2].
    expect(seen).toEqual([1, 1, 2, 2]);
    seen.length = 0;
    em.emit('ping');
    expect(seen).toEqual([1]); // h2 removed once the outer emit completed
  });

  it('a handler added during emit runs in the same emit (live-set semantics)', () => {
    const em = new EventEmitter<TestEvents>();
    const seen: number[] = [];
    let added = false;
    em.on('ping', () => {
      seen.push(1);
      if (!added) {
        added = true;
        em.on('ping', () => seen.push(2));
      }
    });
    em.emit('ping');
    expect(seen).toEqual([1, 2]);
  });
});

describe('EventEmitter.removeAll', () => {
  it('removes all handlers for a specific event', () => {
    const em = new EventEmitter<TestEvents>();
    let count = 0;
    em.on('ping', () => {
      count++;
    });
    em.on('ping', () => {
      count++;
    });
    em.removeAll('ping');
    em.emit('ping');
    expect(count).toBe(0);
  });

  it("during emit does not drop another event's deferred removal", () => {
    const em = new EventEmitter<TestEvents>();
    let updateCount = 0;
    const hUpdate = () => {
      updateCount++;
    };
    em.on('update', hUpdate);
    em.on('ping', () => {
      em.off('update', hUpdate); // deferred — we are mid-emit
      em.removeAll('ping'); // must NOT wipe the deferred off('update', hUpdate)
    });
    em.emit('ping');
    em.emit('update', 0.016);
    // Old code cleared the shared pendingRemove in removeAll, dropping the deferred
    // off -> hUpdate would still fire (updateCount === 1).
    expect(updateCount).toBe(0);
  });

  it('removes all handlers for all events', () => {
    const em = new EventEmitter<TestEvents>();
    let pingCount = 0;
    let updateCount = 0;
    em.on('ping', () => {
      pingCount++;
    });
    em.on('update', () => {
      updateCount++;
    });
    em.removeAll();
    em.emit('ping');
    em.emit('update', 0);
    expect(pingCount).toBe(0);
    expect(updateCount).toBe(0);
  });
});
