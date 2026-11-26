import { describe, expect, it } from 'bun:test';
import {
  type ContextLossEvent,
  type ContextLossTarget,
  createContextLossWatch,
  findContextLossTarget,
} from '../src/context-loss.js';

interface FakeCanvas extends ContextLossTarget {
  fire(type: string): { defaultPrevented: boolean };
  listenerCount(): number;
}

// The same shape as packages/render-web/tests/postfx-surface.test.ts's fake canvas.
function makeFakeCanvas(): FakeCanvas {
  const listeners = new Map<string, Set<(event: ContextLossEvent) => void>>();
  return {
    addEventListener(type, fn) {
      const set = listeners.get(type) ?? new Set();
      set.add(fn);
      listeners.set(type, set);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    fire(type) {
      const ev = {
        defaultPrevented: false,
        preventDefault() {
          ev.defaultPrevented = true;
        },
      };
      for (const fn of [...(listeners.get(type) ?? [])]) fn(ev);
      return ev;
    },
    listenerCount: () => [...listeners.values()].reduce((n, s) => n + s.size, 0),
  };
}

function setup(): {
  canvas: FakeCanvas;
  recovered: () => number;
  watch: ReturnType<typeof createContextLossWatch>;
} {
  let count = 0;
  const watch = createContextLossWatch(() => {
    count++;
  });
  const canvas = makeFakeCanvas();
  watch.attach(canvas);
  return { canvas, recovered: () => count, watch };
}

describe('createContextLossWatch', () => {
  it('listens for both events once attached', () => {
    const { canvas } = setup();
    expect(canvas.listenerCount()).toBe(2);
  });

  it('calls preventDefault on loss so the context stays restorable', () => {
    const { canvas } = setup();
    expect(canvas.fire('webglcontextlost').defaultPrevented).toBe(true);
  });

  it('a loss alone does not recover until the next flush', () => {
    const { canvas, recovered, watch } = setup();
    canvas.fire('webglcontextlost');
    expect(recovered()).toBe(0);
    watch.flush();
    expect(recovered()).toBe(1);
  });

  it('a loss then a restore recovers at the restore, without waiting for a frame', () => {
    const { canvas, recovered } = setup();
    canvas.fire('webglcontextlost');
    canvas.fire('webglcontextrestored');
    expect(recovered()).toBe(1);
  });

  it('recovers once per loss: later flushes and events are silent', () => {
    const { canvas, recovered, watch } = setup();
    canvas.fire('webglcontextlost');
    canvas.fire('webglcontextrestored');
    watch.flush();
    watch.flush();
    canvas.fire('webglcontextrestored');
    expect(recovered()).toBe(1);
  });

  it('flush without a loss does nothing', () => {
    const { recovered, watch } = setup();
    watch.flush();
    expect(recovered()).toBe(0);
  });

  it('a restore with no loss before it does nothing', () => {
    const { canvas, recovered } = setup();
    canvas.fire('webglcontextrestored');
    expect(recovered()).toBe(0);
    expect(canvas.listenerCount()).toBe(2);
  });

  it('removes its listeners before it calls onRecover', () => {
    const canvas = makeFakeCanvas();
    let seen = -1;
    const watch = createContextLossWatch(() => {
      seen = canvas.listenerCount();
    });
    watch.attach(canvas);
    canvas.fire('webglcontextlost');
    watch.flush();
    expect(seen).toBe(0);
  });

  it('the loss the old canvas reports as it unmounts is not seen as a new loss', () => {
    // RN-Skia calls loseContext() on the canvas it unmounts. The remount that a
    // recovery asks for must not start another recovery.
    const { canvas, recovered, watch } = setup();
    canvas.fire('webglcontextlost');
    watch.flush();
    const next = makeFakeCanvas();
    watch.attach(next);

    canvas.fire('webglcontextlost');
    watch.flush();

    expect(recovered()).toBe(1);
    expect(next.listenerCount()).toBe(2);
  });

  it('watches the canvas attached after a recovery', () => {
    const { canvas, recovered, watch } = setup();
    canvas.fire('webglcontextlost');
    watch.flush();
    const next = makeFakeCanvas();
    watch.attach(next);

    next.fire('webglcontextlost');
    watch.flush();

    expect(recovered()).toBe(2);
    expect(next.listenerCount()).toBe(0);
  });

  it('attaching another canvas takes the listeners off the first and forgets its loss', () => {
    const { canvas, recovered, watch } = setup();
    canvas.fire('webglcontextlost');
    const next = makeFakeCanvas();
    watch.attach(next);
    expect(canvas.listenerCount()).toBe(0);
    watch.flush();
    expect(recovered()).toBe(0);
  });

  it('attaching the same canvas again adds no second pair of listeners', () => {
    const { canvas, watch } = setup();
    watch.attach(canvas);
    expect(canvas.listenerCount()).toBe(2);
  });

  it('attach(null) is a detach', () => {
    const { canvas, watch } = setup();
    watch.attach(null);
    expect(canvas.listenerCount()).toBe(0);
  });

  it('detach removes both listeners, drops a pending loss, and is safe to repeat', () => {
    const { canvas, recovered, watch } = setup();
    canvas.fire('webglcontextlost');
    watch.detach();
    watch.detach();
    expect(canvas.listenerCount()).toBe(0);
    watch.flush();
    expect(recovered()).toBe(0);
  });
});

describe('findContextLossTarget', () => {
  it('returns the first canvas under the host', () => {
    const canvas = makeFakeCanvas();
    const selectors: string[] = [];
    const host = {
      querySelector(selector: string) {
        selectors.push(selector);
        return canvas;
      },
    };
    expect(findContextLossTarget(host)).toBe(canvas);
    expect(selectors).toEqual(['canvas']);
  });

  it('returns null when the host has no canvas', () => {
    expect(findContextLossTarget({ querySelector: () => null })).toBeNull();
  });

  it('returns null for a host that is not a DOM element', () => {
    expect(findContextLossTarget(null)).toBeNull();
    expect(findContextLossTarget(undefined)).toBeNull();
    expect(findContextLossTarget({})).toBeNull();
    expect(findContextLossTarget(7)).toBeNull();
  });
});
