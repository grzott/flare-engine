import { describe, expect, it } from 'bun:test';
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
  });
});

describe('CoroutineManager.clear', () => {
  it('cancels all coroutines', () => {
    const mgr = new CoroutineManager();
    let a = false;
    let b = false;
    mgr.start(
      (function* () {
        yield undefined;
        a = true;
      })(),
    );
    mgr.start(
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
