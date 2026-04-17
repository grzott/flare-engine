import { describe, expect, it, mock } from 'bun:test';
import type { GameContextValue } from '../src/game-context.js';

// ---- Inline stub types (no @flare/ecs dependency) ----

type Unsubscribe = () => void;

class InlineSignal<T = void> {
  readonly handlers = new Set<(v: T) => void>();
  add(fn: (v: T) => void): Unsubscribe {
    this.handlers.add(fn);
    return () => {
      this.handlers.delete(fn);
    };
  }
  emit(v: T): void {
    for (const h of [...this.handlers]) h(v);
  }
}

class InlineQuery {
  readonly onEntityAdded = new InlineSignal<number>();
  readonly onEntityRemoved = new InlineSignal<number>();
  private entities: number[] = [];
  addEntity(id: number): void {
    this.entities.push(id);
    this.onEntityAdded.emit(id);
  }
  removeEntity(id: number): void {
    const i = this.entities.indexOf(id);
    if (i !== -1) {
      this.entities.splice(i, 1);
      this.onEntityRemoved.emit(id);
    }
  }
  [Symbol.iterator]() {
    return this.entities[Symbol.iterator]();
  }
}

class InlineGameLoop {
  readonly onUpdate = new InlineSignal<number>();
}

// ---- React mock ----
let mockContextValue: unknown = null;
const pendingEffects: (() => (() => void) | undefined)[] = [];

mock.module('react', () => ({
  createContext: (def: unknown) => ({ _default: def }),
  useContext: (_ctx: unknown) => mockContextValue,
  useEffect: (fn: () => (() => void) | undefined) => {
    pendingEffects.push(fn);
  },
  useRef: (init: unknown) => ({ current: init }),
  useMemo: (fn: () => unknown) => fn(),
  useCallback: (fn: unknown) => fn,
  useState: (init: unknown) => {
    const val = typeof init === 'function' ? (init as () => unknown)() : init;
    return [val, () => {}];
  },
}));

/** Flush all pending effects (simulates React commit phase). */
function flushEffects(): (() => void)[] {
  const cleanups: (() => void)[] = [];
  while (pendingEffects.length > 0) {
    const fn = pendingEffects.shift()!;
    const cleanup = fn();
    if (typeof cleanup === 'function') cleanups.push(cleanup);
  }
  return cleanups;
}

const { useGame, useEntity, useGameLoop } = await import('../src/hooks.js');

// ---- Tests ----

describe('useGame', () => {
  it('throws when context is null', () => {
    mockContextValue = null;
    expect(() => useGame()).toThrow('useGame must be used inside a <GameView>');
  });

  it('returns context when provided', () => {
    const fakeCtx = {
      world: {},
      camera: {},
      input: {},
      audio: {},
      assets: {},
      scenes: {},
      loop: {},
    } as unknown as GameContextValue;
    mockContextValue = fakeCtx;
    const result = useGame();
    expect(result).toBe(fakeCtx);
  });
});

describe('useEntity', () => {
  it('returns initial empty entity list for empty query', () => {
    const query = new InlineQuery();
    const entities = useEntity(query as never);
    expect(entities).toEqual([]);
  });

  it('subscribes to query signals after effects flush', () => {
    const query = new InlineQuery();
    useEntity(query as never);
    flushEffects();

    expect(query.onEntityAdded.handlers.size).toBeGreaterThan(0);
    expect(query.onEntityRemoved.handlers.size).toBeGreaterThan(0);
  });

  it('unsubscribes on cleanup', () => {
    const query = new InlineQuery();
    useEntity(query as never);
    const cleanups = flushEffects();

    for (const cleanup of cleanups) cleanup();

    expect(query.onEntityAdded.handlers.size).toBe(0);
    expect(query.onEntityRemoved.handlers.size).toBe(0);
  });
});

describe('useGameLoop', () => {
  it('registers callback on loop.onUpdate after effects flush', () => {
    const loop = new InlineGameLoop();
    mockContextValue = {
      world: {},
      camera: {},
      input: {},
      audio: {},
      assets: {},
      scenes: {},
      loop,
    };

    let called = false;
    useGameLoop(() => {
      called = true;
    });
    flushEffects();

    loop.onUpdate.emit(0.016);
    expect(called).toBe(true);
  });

  it('unregisters callback on cleanup', () => {
    const loop = new InlineGameLoop();
    mockContextValue = {
      world: {},
      camera: {},
      input: {},
      audio: {},
      assets: {},
      scenes: {},
      loop,
    };

    let callCount = 0;
    useGameLoop(() => {
      callCount++;
    });
    const cleanups = flushEffects();

    loop.onUpdate.emit(0.016);
    expect(callCount).toBe(1);

    for (const cleanup of cleanups) cleanup();

    loop.onUpdate.emit(0.016);
    expect(callCount).toBe(1);
  });
});
