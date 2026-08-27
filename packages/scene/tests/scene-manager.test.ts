import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import type { Scene } from '../src/scene.js';
import { SceneManager } from '../src/scene-manager.js';
import { fadeTransition } from '../src/transition.js';

function createTestScene(name: string, log: string[]): Scene {
  return {
    name,
    world: null!,
    camera: null!,
    onPreload() {
      log.push(`${name}:preload`);
    },
    onInit() {
      log.push(`${name}:init`);
    },
    onEnter(data?: unknown) {
      log.push(`${name}:enter${data ? `:${data}` : ''}`);
    },
    onUpdate(dt: number) {
      log.push(`${name}:update:${dt}`);
    },
    onDraw() {
      log.push(`${name}:draw`);
    },
    onExit() {
      log.push(`${name}:exit`);
    },
    onDestroy() {
      log.push(`${name}:destroy`);
    },
  };
}

describe('SceneManager', () => {
  it('starts with no current scene', () => {
    const mgr = new SceneManager();
    expect(mgr.current).toBeUndefined();
    expect(mgr.stackSize).toBe(0);
  });

  it('registers and navigates to a scene', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('menu', () => createTestScene('menu', log));
    await mgr.go('menu');
    expect(mgr.current?.name).toBe('menu');
    expect(mgr.stackSize).toBe(1);
    expect(log).toEqual(['menu:preload', 'menu:init', 'menu:enter']);
  });

  it('passes data to onEnter via go', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('play', () => createTestScene('play', log));
    await mgr.go('play', 'level1');
    expect(log).toContain('play:enter:level1');
  });

  it('injects World and Camera on creation', async () => {
    const mgr = new SceneManager();
    let capturedScene: Scene | undefined;
    mgr.register('test', () => {
      const s = createTestScene('test', []);
      capturedScene = s;
      return s;
    });
    await mgr.go('test');
    expect(capturedScene!.world).toBeDefined();
    expect(capturedScene!.camera).toBeDefined();
  });

  it('calls onExit and onDestroy when switching scenes', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('a', () => createTestScene('a', log));
    mgr.register('b', () => createTestScene('b', log));
    await mgr.go('a');
    log.length = 0;
    await mgr.go('b');
    expect(log).toEqual(['a:exit', 'a:destroy', 'b:preload', 'b:init', 'b:enter']);
  });

  it('update calls onUpdate and onDraw on current scene', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('game', () => createTestScene('game', log));
    await mgr.go('game');
    log.length = 0;
    mgr.update(0.016);
    expect(log).toEqual(['game:update:0.016', 'game:draw']);
  });

  it('update does nothing with no scene', () => {
    const mgr = new SceneManager();
    // Should not throw
    mgr.update(0.016);
  });

  it('ignores go to unregistered scene', async () => {
    const mgr = new SceneManager();
    await mgr.go('nonexistent');
    expect(mgr.current).toBeUndefined();
  });
});

describe('SceneManager — stack', () => {
  it('pushes a scene onto the stack', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('a', () => createTestScene('a', log));
    mgr.register('b', () => createTestScene('b', log));
    await mgr.go('a');
    log.length = 0;
    await mgr.push('b');
    expect(mgr.current?.name).toBe('b');
    expect(mgr.stackSize).toBe(2);
    expect(log).toEqual(['a:exit', 'b:preload', 'b:init', 'b:enter']);
  });

  it('passes data when pushing', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('a', () => createTestScene('a', log));
    mgr.register('b', () => createTestScene('b', log));
    await mgr.go('a');
    log.length = 0;
    await mgr.push('b', 'hello');
    expect(log).toContain('b:enter:hello');
  });

  it('pops a scene and resumes the one below', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('a', () => createTestScene('a', log));
    mgr.register('b', () => createTestScene('b', log));
    await mgr.go('a');
    await mgr.push('b');
    log.length = 0;
    mgr.pop();
    expect(mgr.current?.name).toBe('a');
    expect(mgr.stackSize).toBe(1);
    expect(log).toEqual(['b:exit', 'b:destroy', 'a:enter']);
  });

  it('does not pop the last scene', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('a', () => createTestScene('a', log));
    await mgr.go('a');
    log.length = 0;
    mgr.pop();
    expect(mgr.stackSize).toBe(1);
    expect(log).toEqual([]);
  });

  it('go clears the entire stack', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('a', () => createTestScene('a', log));
    mgr.register('b', () => createTestScene('b', log));
    mgr.register('c', () => createTestScene('c', log));
    await mgr.go('a');
    await mgr.push('b');
    log.length = 0;
    await mgr.go('c');
    expect(mgr.stackSize).toBe(1);
    expect(mgr.current?.name).toBe('c');
    // Both a and b should be destroyed
    expect(log).toContain('b:exit');
    expect(log).toContain('b:destroy');
    expect(log).toContain('a:exit');
    expect(log).toContain('a:destroy');
  });
});

describe('SceneManager — transitions', () => {
  it('runs a fade transition between scenes', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.setTransition(fadeTransition(1));
    mgr.register('a', () => createTestScene('a', log));
    mgr.register('b', () => createTestScene('b', log));
    await mgr.go('a');
    log.length = 0;

    // Start transition to b
    await mgr.go('b');
    expect(mgr.isTransitioning).toBe(true);
    expect(mgr.transitionPhase).toBe('out');

    // Update through 'out' phase
    mgr.update(1.0); // Completes 'out', switches scene, starts 'in'
    expect(log).toContain('a:exit');
    expect(log).toContain('a:destroy');
    expect(log).toContain('b:enter');
    expect(mgr.transitionPhase).toBe('in');

    // Update through 'in' phase
    log.length = 0;
    mgr.update(1.0); // Completes 'in'
    expect(mgr.isTransitioning).toBe(false);
    expect(mgr.current?.name).toBe('b');
  });

  it('reports correct transition progress', async () => {
    const mgr = new SceneManager();
    mgr.setTransition(fadeTransition(1));
    mgr.register('a', () => createTestScene('a', []));
    mgr.register('b', () => createTestScene('b', []));
    await mgr.go('a');
    await mgr.go('b');

    expect(mgr.transitionProgress).toBe(0);
    mgr.update(0.5);
    expect(mgr.transitionProgress).toBeCloseTo(0.5, 5);
  });

  it('no transition when first scene is loaded', async () => {
    const mgr = new SceneManager();
    mgr.setTransition(fadeTransition(1));
    mgr.register('a', () => createTestScene('a', []));
    await mgr.go('a');
    expect(mgr.isTransitioning).toBe(false);
  });
});

describe('SceneManager — destroy', () => {
  it('destroys all scenes on destroy', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('a', () => createTestScene('a', log));
    mgr.register('b', () => createTestScene('b', log));
    await mgr.go('a');
    await mgr.push('b');
    log.length = 0;
    mgr.destroy();
    expect(mgr.stackSize).toBe(0);
    expect(mgr.current).toBeUndefined();
    expect(log).toContain('b:exit');
    expect(log).toContain('b:destroy');
    expect(log).toContain('a:exit');
    expect(log).toContain('a:destroy');
  });

  it('allows re-use after destroy', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('a', () => createTestScene('a', log));
    await mgr.go('a');
    mgr.destroy();
    log.length = 0;
    await mgr.go('a');
    expect(mgr.current?.name).toBe('a');
    // Should re-init since it was destroyed
    expect(log).toContain('a:preload');
    expect(log).toContain('a:init');
  });
});

describe('SceneManager — restart', () => {
  it('instant path: go(sameScene) builds fresh World and instance', async () => {
    const mgr = new SceneManager();
    const instances: Scene[] = [];
    mgr.register('game', () => {
      const s = createTestScene('game', []);
      instances.push(s);
      return s;
    });

    await mgr.go('game');
    const firstWorld = instances[0]!.world;
    const e1 = firstWorld.spawn();
    expect(instances.length).toBe(1);

    await mgr.go('game');
    expect(instances.length).toBe(2);
    expect(instances[1]).not.toBe(instances[0]);

    // Fresh World: distinct object, entity counter restarted
    const secondWorld = instances[1]!.world;
    expect(secondWorld).not.toBe(firstWorld);
    const e2 = secondWorld.spawn();
    // Both worlds start from the same initial ID — proves second world is fresh
    expect(e2).toBe(e1);
  });

  it('instant path: restart calls full lifecycle on new instance', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('game', () => createTestScene('game', log));

    await mgr.go('game');
    log.length = 0;
    await mgr.go('game');

    expect(log).toEqual(['game:exit', 'game:destroy', 'game:preload', 'game:init', 'game:enter']);
  });

  it('transition path: go(sameScene) builds fresh instance', async () => {
    const mgr = new SceneManager();
    mgr.setTransition(fadeTransition(1));
    const instances: Scene[] = [];
    mgr.register('game', () => {
      const s = createTestScene('game', []);
      instances.push(s);
      return s;
    });

    await mgr.go('game');
    expect(instances.length).toBe(1);

    // Restart via transition
    void mgr.go('game');
    expect(instances.length).toBe(2);
    expect(instances[1]).not.toBe(instances[0]);

    // Complete the transition
    mgr.update(1.0); // 'out' done → switch
    mgr.update(1.0); // 'in' done
    expect(mgr.current?.name).toBe('game');
    expect(mgr.current).toBe(instances[1]);
  });

  it('transition restart: push after restart does not re-init the live instance', async () => {
    const mgr = new SceneManager();
    mgr.setTransition(fadeTransition(1));
    const instances: Scene[] = [];
    const initCounts: number[] = [];

    mgr.register('game', () => {
      const idx = instances.length;
      initCounts.push(0);
      const s: Scene = {
        name: 'game',
        world: null!,
        camera: null!,
        onInit() {
          initCounts[idx] = (initCounts[idx] ?? 0) + 1;
        },
      };
      instances.push(s);
      return s;
    });

    // First entry via instant path (no current scene → no transition)
    await mgr.go('game');
    expect(initCounts[0]).toBe(1);

    // Restart via transition
    void mgr.go('game');
    mgr.update(1.0); // 'out' done → switch; instances[1].onInit fires
    mgr.update(1.0); // 'in' done
    expect(initCounts[1]).toBe(1);

    // push(sameScene) must short-circuit via _initIfNeeded — fix keeps it in _initialized
    await mgr.push('game');
    expect(initCounts[1]).toBe(1);
  });
});

describe('SceneManager — async preload', () => {
  it('instant path: awaits onPreload before onInit and onEnter', async () => {
    const log: string[] = [];
    let resolvePreload!: () => void;
    const preloadPromise = new Promise<void>((r) => {
      resolvePreload = r;
    });

    const mgr = new SceneManager();
    mgr.register('slow', () => ({
      name: 'slow',
      world: null!,
      camera: null!,
      onPreload() {
        log.push('slow:preload');
        return preloadPromise;
      },
      onInit() {
        log.push('slow:init');
      },
      onEnter() {
        log.push('slow:enter');
      },
    }));

    const goPromise = mgr.go('slow');
    // Preload started but not resolved — init/enter must not have fired
    expect(log).toEqual(['slow:preload']);

    resolvePreload();
    await goPromise;
    expect(log).toEqual(['slow:preload', 'slow:init', 'slow:enter']);
  });

  it('transition path: awaits onPreload before onInit and onEnter', async () => {
    const log: string[] = [];
    let resolvePreload!: () => void;
    const preloadPromise = new Promise<void>((r) => {
      resolvePreload = r;
    });

    const mgr = new SceneManager();
    mgr.setTransition(fadeTransition(1));
    mgr.register('a', () => createTestScene('a', log));
    mgr.register('b', () => ({
      name: 'b',
      world: null!,
      camera: null!,
      onPreload() {
        log.push('b:preload');
        return preloadPromise;
      },
      onInit() {
        log.push('b:init');
      },
      onEnter() {
        log.push('b:enter');
      },
    }));

    await mgr.go('a');
    log.length = 0;

    // Start transition — preload begins concurrently with fade-out
    void mgr.go('b');
    expect(log).toContain('b:preload');

    // Complete 'out' phase — preload not done, should hold
    mgr.update(1.0);
    expect(log).not.toContain('b:init');
    expect(log).not.toContain('b:enter');

    // Resolve preload and let the microtask run
    resolvePreload();
    await Promise.resolve();

    // Next update — switch should complete
    mgr.update(0);
    expect(log).toContain('b:init');
    expect(log).toContain('b:enter');
    // init must precede enter
    expect(log.indexOf('b:init')).toBeLessThan(log.indexOf('b:enter'));
  });

  it('transition path: rejecting onPreload unblocks the transition (no hang)', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.setTransition(fadeTransition(1));
    mgr.register('a', () => createTestScene('a', log));
    mgr.register('b', () => ({
      name: 'b',
      world: null!,
      camera: null!,
      onPreload(): Promise<void> {
        return Promise.reject(new Error('asset fail'));
      },
      onInit() {
        log.push('b:init');
      },
      onEnter() {
        log.push('b:enter');
      },
    }));

    await mgr.go('a');
    log.length = 0;

    void mgr.go('b');

    // 'out' done — rejection handler hasn't run yet (microtask queue)
    mgr.update(1.0);
    expect(log).not.toContain('b:enter');

    // Let the rejection handler settle
    await Promise.resolve();
    await Promise.resolve();

    // Switch proceeds despite rejection
    mgr.update(0);
    mgr.update(1.0); // 'in' done
    expect(log).toContain('b:enter');
    expect(mgr.isTransitioning).toBe(false);
    expect(mgr.current?.name).toBe('b');
  });
});

describe('SceneManager — dev warning', () => {
  const g = globalThis as unknown as Record<string, unknown>;
  let originalDev: unknown;

  beforeEach(() => {
    originalDev = g.__DEV__;
    g.__DEV__ = true;
  });

  afterEach(() => {
    g.__DEV__ = originalDev;
  });

  it('warns with unknown scene name and registered names', async () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    const mgr = new SceneManager();
    mgr.register('menu', () => createTestScene('menu', []));
    mgr.register('play', () => createTestScene('play', []));

    await mgr.go('ghost');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const msg = warnSpy.mock.calls[0]![0] as string;
    expect(msg).toContain('ghost');
    expect(msg).toContain('menu');
    expect(msg).toContain('play');

    warnSpy.mockRestore();
  });

  it('does not warn when __DEV__ is false', async () => {
    g.__DEV__ = false;
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    const mgr = new SceneManager();

    await mgr.go('ghost');

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('SceneManager — overlapping transitions / stall fix', () => {
  it('activates superseding scene when its preload settles even if update() stops', async () => {
    let resolveCPreload!: () => void;
    const cPreload = new Promise<void>((r) => {
      resolveCPreload = r;
    });

    const mgr = new SceneManager();
    mgr.setTransition(fadeTransition(1));
    mgr.register('a', () => ({ name: 'a', world: null!, camera: null! }));
    // b has a never-resolving preload, simulating a long concurrent load
    mgr.register('b', () => ({
      name: 'b',
      world: null!,
      camera: null!,
      onPreload: () => new Promise<void>(() => {}),
    }));
    mgr.register('c', () => ({
      name: 'c',
      world: null!,
      camera: null!,
      onPreload: () => cPreload,
    }));

    await mgr.go('a');
    void mgr.go('b'); // first animated go (gen 1)
    void mgr.go('c'); // supersedes b (gen 2, pendingScene = c)

    // Drive out-phase to completion with a large dt
    mgr.update(2.0);

    // Out-phase done but c's preload not resolved — held at the guard
    expect(mgr.current?.name).toBe('a');

    // update() stops (simulating backgrounding). Resolve c's preload.
    resolveCPreload();
    await Promise.resolve();

    // Settle handler must re-drive activation without a further update() call.
    expect(mgr.current?.name).toBe('c');
  });

  it('stale handler from superseded go() does not resolve the guard for the live transition', async () => {
    let resolveBPreload!: () => void;
    let resolveCPreload!: () => void;
    const bPreload = new Promise<void>((r) => {
      resolveBPreload = r;
    });
    const cPreload = new Promise<void>((r) => {
      resolveCPreload = r;
    });
    const log: string[] = [];

    const mgr = new SceneManager();
    mgr.setTransition(fadeTransition(1));
    mgr.register('a', () => ({ name: 'a', world: null!, camera: null! }));
    mgr.register('b', () => ({
      name: 'b',
      world: null!,
      camera: null!,
      onPreload: () => bPreload,
    }));
    mgr.register('c', () => ({
      name: 'c',
      world: null!,
      camera: null!,
      onPreload: () => cPreload,
      onEnter: () => log.push('c:enter'),
    }));

    await mgr.go('a');
    void mgr.go('b'); // gen 1
    void mgr.go('c'); // gen 2 — supersedes b

    // Resolve b's stale preload first
    resolveBPreload();
    await Promise.resolve();

    // Drive out-phase to completion
    mgr.update(2.0);

    // c must NOT have entered — its own preload is still pending
    expect(log).not.toContain('c:enter');
    expect(mgr.current?.name).not.toBe('c');

    // Resolve c's preload — activation should complete via settle handler
    resolveCPreload();
    await Promise.resolve();

    expect(mgr.current?.name).toBe('c');
    expect(log).toContain('c:enter');
  });
});
