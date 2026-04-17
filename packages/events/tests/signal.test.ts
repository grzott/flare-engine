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
    // biome-ignore lint/style/useConst: assigned after declaration
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
