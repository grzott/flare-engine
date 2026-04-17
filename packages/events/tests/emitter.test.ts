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
    // biome-ignore lint/style/useConst: assigned after declaration
    let unsub2: (() => void) | undefined;
    em.on('ping', () => {
      calls.push(1);
      unsub2?.();
    });
    unsub2 = em.on('ping', () => {
      calls.push(2);
    });
    em.emit('ping');
    // Both should have been called since we iterate a copy
    expect(calls).toEqual([1, 2]);
    // Now handler 2 is removed
    calls.length = 0;
    em.emit('ping');
    expect(calls).toEqual([1]);
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
