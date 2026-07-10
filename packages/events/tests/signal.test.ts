import { describe, expect, it } from 'bun:test';
import { Signal } from '../src/index.js';

describe('Signal.add', () => {
  it('calls handler on emit', () => {
    const signal = new Signal<number>();
    let received = 0;
    signal.add((v) => {
      received = v;
    });
    signal.emit(42);
    expect(received).toBe(42);
  });

  it('supports multiple handlers', () => {
    const signal = new Signal<void>();
    let count = 0;
    signal.add(() => {
      count++;
    });
    signal.add(() => {
      count++;
    });
    signal.emit();
    expect(count).toBe(2);
  });

  it('returns unsubscribe function', () => {
    const signal = new Signal<number>();
    let count = 0;
    const unsub = signal.add(() => {
      count++;
    });
    signal.emit(1);
    unsub();
    signal.emit(2);
    expect(count).toBe(1);
  });
});

describe('Signal.once', () => {
  it('fires only once', () => {
    const signal = new Signal<number>();
    let count = 0;
    signal.once(() => {
      count++;
    });
    signal.emit(1);
    signal.emit(2);
    expect(count).toBe(1);
  });

  it('returns unsubscribe function', () => {
    const signal = new Signal<number>();
    let called = false;
    const unsub = signal.once(() => {
      called = true;
    });
    unsub();
    signal.emit(1);
    expect(called).toBe(false);
  });

  it('passes value', () => {
    const signal = new Signal<string>();
    let received = '';
    signal.once((v) => {
      received = v;
    });
    signal.emit('hello');
    expect(received).toBe('hello');
  });
});

describe('Signal.remove', () => {
  it('removes specific handler', () => {
    const signal = new Signal<void>();
    let count = 0;
    const handler = () => {
      count++;
    };
    signal.add(handler);
    signal.emit();
    signal.remove(handler);
    signal.emit();
    expect(count).toBe(1);
  });

  it('no-op for non-existent handler', () => {
    const signal = new Signal<void>();
    signal.remove(() => {}); // should not throw
  });
});

describe('Signal.emit', () => {
  it('no-op with no handlers', () => {
    const signal = new Signal<number>();
    signal.emit(42); // should not throw
  });

  it('allows removal during emit', () => {
    const signal = new Signal<void>();
    const calls: number[] = [];
    let unsub2: (() => void) | undefined;
    signal.add(() => {
      calls.push(1);
      unsub2?.();
    });
    unsub2 = signal.add(() => {
      calls.push(2);
    });
    signal.emit();
    expect(calls).toEqual([1, 2]);
    calls.length = 0;
    signal.emit();
    expect(calls).toEqual([1]);
  });
});

describe('Signal.emit re-entrancy and throw-safety', () => {
  it('a throwing handler does not wedge future removals', () => {
    const signal = new Signal<void>();
    let count = 0;
    const bad = () => {
      throw new Error('boom');
    };
    const good = () => {
      count++;
    };
    signal.add(bad);
    signal.add(good);
    expect(() => signal.emit()).toThrow('boom');
    // With the old boolean flag the throw left `iterating` true forever, so these
    // removes would defer forever and the next emit would re-throw.
    signal.remove(bad);
    signal.remove(good);
    signal.emit();
    expect(count).toBe(0);
  });

  it("a nested emit does not flush the outer emit's deferred removals early", () => {
    const signal = new Signal<void>();
    const seen: number[] = [];
    const h2 = () => seen.push(2);
    let nested = false;
    const h1 = () => {
      seen.push(1);
      if (!nested) {
        nested = true;
        signal.remove(h2); // deferred until the outermost emit ends
        signal.emit(); // nested emit must NOT flush the pending remove(h2)
      }
    };
    signal.add(h1);
    signal.add(h2);
    signal.emit();
    // outer h1 -> [1]; nested emit -> h1 [1] (nested) + h2 [2]; back to outer -> h2 [2].
    // Old code flushed remove(h2) at the nested emit's end, so the outer loop skipped
    // h2 and produced [1, 1, 2].
    expect(seen).toEqual([1, 1, 2, 2]);
    seen.length = 0;
    signal.emit();
    expect(seen).toEqual([1]); // h2 removed once the outer emit completed
  });

  it('a handler added during emit runs in the same emit (live-set semantics)', () => {
    const signal = new Signal<void>();
    const seen: number[] = [];
    let added = false;
    signal.add(() => {
      seen.push(1);
      if (!added) {
        added = true;
        signal.add(() => seen.push(2));
      }
    });
    signal.emit();
    expect(seen).toEqual([1, 2]);
  });
});

describe('Signal.clear', () => {
  it('removes all handlers', () => {
    const signal = new Signal<void>();
    let count = 0;
    signal.add(() => {
      count++;
    });
    signal.add(() => {
      count++;
    });
    signal.clear();
    signal.emit();
    expect(count).toBe(0);
  });
});

describe('Signal<void>', () => {
  it('works with void type', () => {
    const signal = new Signal<void>();
    let called = false;
    signal.add(() => {
      called = true;
    });
    signal.emit();
    expect(called).toBe(true);
  });
});
