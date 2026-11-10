import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { World } from '@flare-engine/ecs';
import { Camera2D } from '@flare-engine/render';
import type { Scene, SceneFactory } from '../src/scene.js';
import { SceneManager } from '../src/scene-manager.js';
import { fadeTransition, noneTransition } from '../src/transition.js';

function createTestScene(name: string, log: string[]): SceneFactory {
  return (world, camera) => ({
    name,
    world,
    camera,
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
  });
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
    mgr.register('menu', createTestScene('menu', log));
    await mgr.go('menu');
    expect(mgr.current?.name).toBe('menu');
    expect(mgr.stackSize).toBe(1);
    expect(log).toEqual(['menu:preload', 'menu:init', 'menu:enter']);
  });

  it('passes data to onEnter via go', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('play', createTestScene('play', log));
    await mgr.go('play', 'level1');
    expect(log).toContain('play:enter:level1');
  });

  it('passes a real World and Camera2D into the factory', async () => {
    const mgr = new SceneManager();
    let capturedScene: Scene | undefined;
    const factory = createTestScene('test', []);
    mgr.register('test', (world, camera) => {
      const s = factory(world, camera);
      capturedScene = s;
      return s;
    });
    await mgr.go('test');
    expect(capturedScene!.world).toBeDefined();
    expect(capturedScene!.camera).toBeDefined();
  });

  it('a factory that pre-populates its own World keeps it — not overwritten by the manager (F069)', async () => {
    const mgr = new SceneManager();
    const ownWorld = new World();
    const preSpawned = ownWorld.spawn(); // entity added before the scene is returned
    mgr.register('populated', () => ({
      name: 'populated',
      world: ownWorld,
      camera: new Camera2D(),
    }));

    await mgr.go('populated');

    // The exact World instance the factory built and populated must survive —
    // not be silently replaced by a fresh manager-created one.
    expect(mgr.current?.world).toBe(ownWorld);
    // A fresh replacement World would restart its id counter; continuity here
    // (rather than a repeat of preSpawned's id) proves it's the same live world.
    const next = mgr.current?.world.spawn();
    expect(next).not.toBe(preSpawned);
  });

  it('calls onExit and onDestroy when switching scenes', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', createTestScene('b', log));
    await mgr.go('a');
    log.length = 0;
    await mgr.go('b');
    expect(log).toEqual(['a:exit', 'a:destroy', 'b:preload', 'b:init', 'b:enter']);
  });

  it('update calls onUpdate and onDraw on current scene', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('game', createTestScene('game', log));
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
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', createTestScene('b', log));
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
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', createTestScene('b', log));
    await mgr.go('a');
    log.length = 0;
    await mgr.push('b', 'hello');
    expect(log).toContain('b:enter:hello');
  });

  it('pops a scene and resumes the one below', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', createTestScene('b', log));
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
    mgr.register('a', createTestScene('a', log));
    await mgr.go('a');
    log.length = 0;
    mgr.pop();
    expect(mgr.stackSize).toBe(1);
    expect(log).toEqual([]);
  });

  it('go clears the entire stack', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', createTestScene('b', log));
    mgr.register('c', createTestScene('c', log));
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

  it('pop with {} or { keep: false } behaves like a plain pop', async () => {
    for (const options of [{}, { keep: false }]) {
      const log: string[] = [];
      const mgr = new SceneManager();
      mgr.register('a', createTestScene('a', log));
      mgr.register('b', createTestScene('b', log));
      await mgr.go('a');
      await mgr.push('b');
      log.length = 0;
      mgr.pop(options);
      expect(log).toEqual(['b:exit', 'b:destroy', 'a:enter']);
      log.length = 0;
      await mgr.push('b');
      expect(log).toEqual(['a:exit', 'b:preload', 'b:init', 'b:enter']);
    }
  });

  it('pop({ data }) delivers data to the revealed scene', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', createTestScene('b', log));
    await mgr.go('a');
    await mgr.push('b');
    log.length = 0;
    mgr.pop({ data: 'resumed' });
    expect(log).toEqual(['b:exit', 'b:destroy', 'a:enter:resumed']);
  });

  it('push with {} or { overlay: false } behaves like a plain push', async () => {
    for (const options of [{}, { overlay: false }]) {
      const log: string[] = [];
      const mgr = new SceneManager();
      mgr.register('a', createTestScene('a', log));
      mgr.register('b', createTestScene('b', log));
      await mgr.go('a');
      log.length = 0;
      await mgr.push('b', undefined, options);
      expect(log).toEqual(['a:exit', 'b:preload', 'b:init', 'b:enter']);
      log.length = 0;
      mgr.update(0.016);
      expect(log).toEqual(['b:update:0.016', 'b:draw']);
      log.length = 0;
      mgr.pop();
      expect(log).toEqual(['b:exit', 'b:destroy', 'a:enter']);
    }
  });
});

describe('SceneManager — kept pop', () => {
  it('pop({ keep: true }) logs exit without destroy and the next push enters only', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', createTestScene('b', log));
    await mgr.go('a');
    await mgr.push('b');
    log.length = 0;
    mgr.pop({ keep: true });
    expect(mgr.current?.name).toBe('a');
    expect(mgr.stackSize).toBe(1);
    expect(log).toEqual(['b:exit', 'a:enter']);
    log.length = 0;
    await mgr.push('b');
    expect(mgr.current?.name).toBe('b');
    expect(mgr.stackSize).toBe(2);
    expect(log).toEqual(['a:exit', 'b:enter']);
  });

  it('a kept scene is the same instance on the next push', async () => {
    const mgr = new SceneManager();
    const instances: Scene[] = [];
    mgr.register('a', createTestScene('a', []));
    mgr.register('b', (world, camera) => {
      const s = createTestScene('b', [])(world, camera);
      instances.push(s);
      return s;
    });
    await mgr.go('a');
    await mgr.push('b');
    mgr.pop({ keep: true });
    await mgr.push('b');
    expect(instances.length).toBe(1);
    expect(mgr.current).toBe(instances[0]);
  });

  it('pop({ keep: true, data }) delivers data to the revealed scene', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', createTestScene('b', log));
    await mgr.go('a');
    await mgr.push('b');
    log.length = 0;
    mgr.pop({ keep: true, data: 'closed' });
    expect(log).toEqual(['b:exit', 'a:enter:closed']);
  });

  it('keeping a popped overlay logs exit only and no re-enter below', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', createTestScene('b', log));
    await mgr.go('a');
    await mgr.push('b', undefined, { overlay: true });
    log.length = 0;
    mgr.pop({ keep: true, data: 'dropped' });
    expect(log).toEqual(['b:exit']);
    log.length = 0;
    await mgr.push('b', undefined, { overlay: true });
    expect(log).toEqual(['b:enter']);
  });

  it('a kept scene is neither updated nor drawn while off the stack', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', createTestScene('b', log));
    await mgr.go('a');
    await mgr.push('b');
    mgr.pop({ keep: true });
    log.length = 0;
    mgr.update(1);
    expect(log).toEqual(['a:update:1', 'a:draw']);
  });

  it('go() after a kept pop destroys the kept instance', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', createTestScene('b', log));
    mgr.register('c', createTestScene('c', log));
    await mgr.go('a');
    await mgr.push('b');
    mgr.pop({ keep: true });
    log.length = 0;
    await mgr.go('c');
    expect(log).toEqual(['a:exit', 'a:destroy', 'b:destroy', 'c:preload', 'c:init', 'c:enter']);
    log.length = 0;
    await mgr.push('b');
    expect(log).toEqual(['c:exit', 'b:preload', 'b:init', 'b:enter']);
  });

  it('go() to the kept scene itself restarts it from a fresh instance', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    const instances: Scene[] = [];
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', (world, camera) => {
      const s = createTestScene('b', log)(world, camera);
      instances.push(s);
      return s;
    });
    await mgr.go('a');
    await mgr.push('b');
    mgr.pop({ keep: true });
    log.length = 0;
    await mgr.go('b');
    expect(log).toEqual(['a:exit', 'a:destroy', 'b:destroy', 'b:preload', 'b:init', 'b:enter']);
    expect(instances.length).toBe(2);
    expect(mgr.current).toBe(instances[1]);
  });

  it('an animated go() after a kept pop destroys the kept instance when the out phase ends', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.setTransition(fadeTransition(1));
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', createTestScene('b', log));
    mgr.register('c', createTestScene('c', log));
    await mgr.go('a');
    await mgr.push('b');
    mgr.pop({ keep: true });
    log.length = 0;
    void mgr.go('c');
    expect(log).toEqual(['c:preload']);
    mgr.update(1.0); // 'out' done → switch to c, then the tick drives c
    expect(log).toEqual([
      'c:preload',
      'a:exit',
      'a:destroy',
      'b:destroy',
      'c:init',
      'c:enter',
      'c:update:1',
      'c:draw',
    ]);
    mgr.update(1.0); // 'in' done
    log.length = 0;
    await mgr.push('b');
    expect(log).toEqual(['c:exit', 'b:preload', 'b:init', 'b:enter']);
  });

  it('an animated go() to the kept scene itself restarts it from a fresh instance', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.setTransition(fadeTransition(1));
    const instances: Scene[] = [];
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', (world, camera) => {
      const s = createTestScene('b', log)(world, camera);
      instances.push(s);
      return s;
    });
    await mgr.go('a');
    await mgr.push('b');
    mgr.pop({ keep: true });
    log.length = 0;
    void mgr.go('b');
    mgr.update(1.0); // 'out' done → switch, then the tick drives the new b
    expect(log).toEqual([
      'b:preload',
      'a:exit',
      'a:destroy',
      'b:destroy',
      'b:init',
      'b:enter',
      'b:update:1',
      'b:draw',
    ]);
    mgr.update(1.0); // 'in' done
    expect(instances.length).toBe(2);
    expect(mgr.current).toBe(instances[1]);
    log.length = 0;
    await mgr.push('b');
    expect(log).toEqual(['b:exit', 'b:enter']);
  });

  it('destroy() destroys a kept instance and the next go re-inits it', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', createTestScene('b', log));
    await mgr.go('a');
    await mgr.push('b');
    mgr.pop({ keep: true });
    log.length = 0;
    mgr.destroy();
    expect(log).toEqual(['a:exit', 'a:destroy', 'b:destroy']);
    log.length = 0;
    await mgr.go('b');
    expect(log).toEqual(['b:preload', 'b:init', 'b:enter']);
  });
});

describe('SceneManager — overlay push', () => {
  it('overlay push logs no exit on the scene below', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', createTestScene('b', log));
    await mgr.go('a');
    log.length = 0;
    await mgr.push('b', undefined, { overlay: true });
    expect(mgr.current?.name).toBe('b');
    expect(mgr.stackSize).toBe(2);
    expect(log).toEqual(['b:preload', 'b:init', 'b:enter']);
  });

  it('passes data when pushing an overlay', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', createTestScene('b', log));
    await mgr.go('a');
    await mgr.push('b', 'hello', { overlay: true });
    expect(log).toContain('b:enter:hello');
  });

  it('update drives the scene below then the overlay, update-then-draw each', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', createTestScene('b', log));
    await mgr.go('a');
    await mgr.push('b', undefined, { overlay: true });
    log.length = 0;
    mgr.update(0.016);
    expect(log).toEqual(['a:update:0.016', 'a:draw', 'b:update:0.016', 'b:draw']);
  });

  it('nested overlays update and draw bottom-up', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', createTestScene('b', log));
    mgr.register('c', createTestScene('c', log));
    await mgr.go('a');
    await mgr.push('b', undefined, { overlay: true });
    await mgr.push('c', undefined, { overlay: true });
    log.length = 0;
    mgr.update(1);
    expect(log).toEqual(['a:update:1', 'a:draw', 'b:update:1', 'b:draw', 'c:update:1', 'c:draw']);
  });

  it('a plain push on top of an overlay exits the overlay only and hides the stack', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', createTestScene('b', log));
    mgr.register('c', createTestScene('c', log));
    await mgr.go('a');
    await mgr.push('b', undefined, { overlay: true });
    log.length = 0;
    await mgr.push('c');
    expect(log).toEqual(['b:exit', 'c:preload', 'c:init', 'c:enter']);
    log.length = 0;
    mgr.update(1);
    expect(log).toEqual(['c:update:1', 'c:draw']);
  });

  it('pop of an overlay logs no re-enter on the scene below', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', createTestScene('b', log));
    await mgr.go('a');
    await mgr.push('b', undefined, { overlay: true });
    log.length = 0;
    mgr.pop();
    expect(mgr.current?.name).toBe('a');
    expect(mgr.stackSize).toBe(1);
    expect(log).toEqual(['b:exit', 'b:destroy']);
    log.length = 0;
    mgr.update(1);
    expect(log).toEqual(['a:update:1', 'a:draw']);
  });

  it('after popping an overlay above a plain push, only the plain scene is driven', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', createTestScene('b', log));
    mgr.register('c', createTestScene('c', log));
    await mgr.go('a');
    await mgr.push('b');
    await mgr.push('c', undefined, { overlay: true });
    log.length = 0;
    mgr.update(1);
    expect(log).toEqual(['b:update:1', 'b:draw', 'c:update:1', 'c:draw']);
    log.length = 0;
    mgr.pop();
    expect(log).toEqual(['c:exit', 'c:destroy']);
    log.length = 0;
    mgr.update(1);
    expect(log).toEqual(['b:update:1', 'b:draw']);
    log.length = 0;
    mgr.pop();
    expect(log).toEqual(['b:exit', 'b:destroy', 'a:enter']);
  });

  it('go from an overlay stack destroys both scenes and clears the overlay flags', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', createTestScene('b', log));
    mgr.register('c', createTestScene('c', log));
    await mgr.go('a');
    await mgr.push('b', undefined, { overlay: true });
    log.length = 0;
    await mgr.go('c');
    expect(mgr.stackSize).toBe(1);
    expect(log).toEqual([
      'b:exit',
      'b:destroy',
      'a:exit',
      'a:destroy',
      'c:preload',
      'c:init',
      'c:enter',
    ]);
    log.length = 0;
    mgr.update(1);
    expect(log).toEqual(['c:update:1', 'c:draw']);
  });

  it('destroy then re-go does not leak overlay flags', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', createTestScene('b', log));
    await mgr.go('a');
    await mgr.push('b', undefined, { overlay: true });
    mgr.destroy();
    await mgr.go('a');
    await mgr.push('b');
    log.length = 0;
    mgr.update(1);
    expect(log).toEqual(['b:update:1', 'b:draw']);
  });

  it('a fade transition started while an overlay is up still drives the scene below', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.setTransition(fadeTransition(1));
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', createTestScene('b', log));
    mgr.register('c', createTestScene('c', log));
    await mgr.go('a');
    await mgr.push('b', undefined, { overlay: true });
    log.length = 0;
    void mgr.go('c');
    expect(mgr.transitionPhase).toBe('out');
    log.length = 0;
    mgr.update(0.5);
    expect(log).toEqual(['a:update:0.5', 'a:draw', 'b:update:0.5', 'b:draw']);

    mgr.update(0.5); // 'out' done → switch to c
    mgr.update(1.0); // 'in' done
    log.length = 0;
    mgr.update(1);
    expect(log).toEqual(['c:update:1', 'c:draw']);
  });
});

describe('SceneManager — transitions', () => {
  it('runs a fade transition between scenes', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.setTransition(fadeTransition(1));
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', createTestScene('b', log));
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
    mgr.register('a', createTestScene('a', []));
    mgr.register('b', createTestScene('b', []));
    await mgr.go('a');
    await mgr.go('b');

    expect(mgr.transitionProgress).toBe(0);
    mgr.update(0.5);
    expect(mgr.transitionProgress).toBeCloseTo(0.5, 5);
  });

  it('no transition when first scene is loaded', async () => {
    const mgr = new SceneManager();
    mgr.setTransition(fadeTransition(1));
    mgr.register('a', createTestScene('a', []));
    await mgr.go('a');
    expect(mgr.isTransitioning).toBe(false);
  });
});

describe('SceneManager — destroy', () => {
  it('destroys all scenes on destroy', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', createTestScene('b', log));
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
    mgr.register('a', createTestScene('a', log));
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
    mgr.register('game', (world, camera) => {
      const s = createTestScene('game', [])(world, camera);
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
    mgr.register('game', createTestScene('game', log));

    await mgr.go('game');
    log.length = 0;
    await mgr.go('game');

    expect(log).toEqual(['game:exit', 'game:destroy', 'game:preload', 'game:init', 'game:enter']);
  });

  it('transition path: go(sameScene) builds fresh instance', async () => {
    const mgr = new SceneManager();
    mgr.setTransition(fadeTransition(1));
    const instances: Scene[] = [];
    mgr.register('game', (world, camera) => {
      const s = createTestScene('game', [])(world, camera);
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

    mgr.register('game', (world, camera) => {
      const idx = instances.length;
      initCounts.push(0);
      const s: Scene = {
        name: 'game',
        world,
        camera,
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
    mgr.register('slow', (world, camera) => ({
      name: 'slow',
      world,
      camera,
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
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', (world, camera) => ({
      name: 'b',
      world,
      camera,
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
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', (world, camera) => ({
      name: 'b',
      world,
      camera,
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
    mgr.register('menu', createTestScene('menu', []));
    mgr.register('play', createTestScene('play', []));

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
    mgr.register('a', (world, camera) => ({ name: 'a', world, camera }));
    // b has a never-resolving preload, simulating a long concurrent load
    mgr.register('b', (world, camera) => ({
      name: 'b',
      world,
      camera,
      onPreload: () => new Promise<void>(() => {}),
    }));
    mgr.register('c', (world, camera) => ({
      name: 'c',
      world,
      camera,
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
    mgr.register('a', (world, camera) => ({ name: 'a', world, camera }));
    mgr.register('b', (world, camera) => ({
      name: 'b',
      world,
      camera,
      onPreload: () => bPreload,
    }));
    mgr.register('c', (world, camera) => ({
      name: 'c',
      world,
      camera,
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

describe('SceneManager — superseded go()', () => {
  it('go() during the out-phase destroys the pending target and a later push builds a new instance', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.setTransition(fadeTransition(1));
    const aInstances: Scene[] = [];
    mgr.register('first', createTestScene('first', log));
    mgr.register('a', (world, camera) => {
      const s = createTestScene('a', log)(world, camera);
      aInstances.push(s);
      return s;
    });
    mgr.register('b', createTestScene('b', log));
    await mgr.go('first');
    log.length = 0;

    void mgr.go('a');
    expect(aInstances.length).toBe(1);
    void mgr.go('b');
    expect(log).toEqual(['a:preload', 'a:destroy', 'b:preload']);

    mgr.update(1.0); // 'out' done → switch to b
    mgr.update(1.0); // 'in' done
    expect(mgr.isTransitioning).toBe(false);
    expect(mgr.current?.name).toBe('b');
    expect(log.filter((e) => e === 'b:init')).toHaveLength(1);
    expect(log.filter((e) => e === 'b:enter')).toHaveLength(1);
    expect(log).not.toContain('a:init');
    expect(log).not.toContain('a:enter');

    log.length = 0;
    await mgr.push('a');
    expect(aInstances.length).toBe(2);
    expect(mgr.current).toBe(aInstances[1]);
    expect(mgr.current).not.toBe(aInstances[0]);
    expect(log).toEqual(['b:exit', 'a:preload', 'a:init', 'a:enter']);
  });

  it('go(name) twice during one out-phase destroys the first instance and enters the second', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.setTransition(fadeTransition(1));
    const instances: Scene[] = [];
    mgr.register('first', createTestScene('first', log));
    mgr.register('a', (world, camera) => {
      const idx = instances.length;
      const s: Scene = {
        name: 'a',
        world,
        camera,
        onInit() {
          log.push(`a${idx}:init`);
        },
        onEnter() {
          log.push(`a${idx}:enter`);
        },
        onDestroy() {
          log.push(`a${idx}:destroy`);
        },
      };
      instances.push(s);
      return s;
    });
    await mgr.go('first');
    log.length = 0;

    void mgr.go('a');
    void mgr.go('a');
    expect(instances.length).toBe(2);
    expect(log).toEqual(['a0:destroy']);

    mgr.update(1.0); // 'out' done → switch
    mgr.update(1.0); // 'in' done
    expect(mgr.current).toBe(instances[1]);
    expect(log).toEqual(['a0:destroy', 'first:exit', 'first:destroy', 'a1:init', 'a1:enter']);
  });

  it('destroy() with a pending target destroys it once with no onInit/onEnter; a later go() works', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.setTransition(fadeTransition(1));
    mgr.register('first', createTestScene('first', log));
    mgr.register('a', createTestScene('a', log));
    await mgr.go('first');
    log.length = 0;

    void mgr.go('a');
    mgr.destroy();
    expect(log).toEqual(['a:preload', 'a:destroy', 'first:exit', 'first:destroy']);
    expect(mgr.current).toBeUndefined();
    expect(mgr.isTransitioning).toBe(false);

    log.length = 0;
    mgr.update(1.0);
    mgr.update(1.0);
    expect(log).toEqual([]);

    await mgr.go('a');
    expect(mgr.current?.name).toBe('a');
    expect(log).toEqual(['a:preload', 'a:init', 'a:enter']);
  });

  it('a superseded target whose onPreload resolves late is never inited or entered', async () => {
    const log: string[] = [];
    let resolveA!: () => void;
    const aPreload = new Promise<void>((r) => {
      resolveA = r;
    });
    const mgr = new SceneManager();
    mgr.setTransition(fadeTransition(1));
    mgr.register('first', createTestScene('first', log));
    mgr.register('a', (world, camera) => ({
      name: 'a',
      world,
      camera,
      onPreload() {
        log.push('a:preload');
        return aPreload;
      },
      onInit() {
        log.push('a:init');
      },
      onEnter() {
        log.push('a:enter');
      },
      onDestroy() {
        log.push('a:destroy');
      },
    }));
    mgr.register('b', createTestScene('b', log));
    await mgr.go('first');
    log.length = 0;

    void mgr.go('a');
    void mgr.go('b');
    mgr.update(1.0); // 'out' done → switch to b
    mgr.update(1.0); // 'in' done
    expect(mgr.current?.name).toBe('b');

    resolveA();
    await Promise.resolve();
    await Promise.resolve();
    mgr.update(1.0);

    expect(mgr.current?.name).toBe('b');
    expect(mgr.isTransitioning).toBe(false);
    expect(log).not.toContain('a:init');
    expect(log).not.toContain('a:enter');
    expect(log.filter((e) => e === 'a:destroy')).toHaveLength(1);
  });

  it('an instant go() during a fade-out cancels the fade and destroys the pending target', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.setTransition(fadeTransition(1));
    mgr.register('first', createTestScene('first', log));
    mgr.register('a', createTestScene('a', log));
    mgr.register('c', createTestScene('c', log));
    await mgr.go('first');
    log.length = 0;

    void mgr.go('a');
    expect(mgr.transitionPhase).toBe('out');
    mgr.setTransition(noneTransition());
    await mgr.go('c');
    expect(log).toEqual([
      'a:preload',
      'a:destroy',
      'first:exit',
      'first:destroy',
      'c:preload',
      'c:init',
      'c:enter',
    ]);
    expect(mgr.isTransitioning).toBe(false);
    expect(mgr.current?.name).toBe('c');

    log.length = 0;
    mgr.update(1.0);
    mgr.update(1.0);
    expect(mgr.current?.name).toBe('c');
    expect(log).toEqual(['c:update:1', 'c:draw', 'c:update:1', 'c:draw']);
  });

  it('an instant go() during a fade-in ends the fade-in too', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.setTransition(fadeTransition(1));
    mgr.register('first', createTestScene('first', log));
    mgr.register('a', createTestScene('a', log));
    mgr.register('c', createTestScene('c', log));
    await mgr.go('first');

    void mgr.go('a');
    mgr.update(1.0);
    expect(mgr.transitionPhase).toBe('in');
    mgr.setTransition(noneTransition());
    log.length = 0;
    await mgr.go('c');

    expect(log).toEqual(['a:exit', 'a:destroy', 'c:preload', 'c:init', 'c:enter']);
    expect(mgr.isTransitioning).toBe(false);
    expect(mgr.transitionPhase).toBe(null);
    expect(mgr.current?.name).toBe('c');
  });

  it('a pending target pushed onto the stack is destroyed once when a go() supersedes it', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('first', createTestScene('first', log));
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', createTestScene('b', log));
    await mgr.go('first');
    mgr.setTransition(fadeTransition(1));
    void mgr.go('a');
    await mgr.push('a');
    log.length = 0;

    void mgr.go('b');
    mgr.update(1.0); // 'out' done → switch to b
    mgr.update(1.0); // 'in' done
    expect(mgr.current?.name).toBe('b');
    expect(log.filter((e) => e === 'a:destroy')).toHaveLength(1);
  });

  it('a pending target pushed onto the stack is destroyed once by destroy()', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('first', createTestScene('first', log));
    mgr.register('a', createTestScene('a', log));
    await mgr.go('first');
    mgr.setTransition(fadeTransition(1));
    void mgr.go('a');
    await mgr.push('a');
    log.length = 0;

    mgr.destroy();
    expect(mgr.current).toBeUndefined();
    expect(log.filter((e) => e === 'a:destroy')).toHaveLength(1);
  });

  it('a pending target held by a kept pop is destroyed once when a go() supersedes it', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('first', createTestScene('first', log));
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', createTestScene('b', log));
    await mgr.go('first');
    mgr.setTransition(fadeTransition(1));
    void mgr.go('a');
    await mgr.push('a');
    mgr.pop({ keep: true });
    log.length = 0;

    void mgr.go('b');
    mgr.update(1.0); // 'out' done → switch to b
    mgr.update(1.0); // 'in' done
    expect(mgr.current?.name).toBe('b');
    expect(log.filter((e) => e === 'a:destroy')).toHaveLength(1);
  });

  it('a pending target held by a kept pop is destroyed once by destroy()', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('first', createTestScene('first', log));
    mgr.register('a', createTestScene('a', log));
    await mgr.go('first');
    mgr.setTransition(fadeTransition(1));
    void mgr.go('a');
    await mgr.push('a');
    mgr.pop({ keep: true });
    log.length = 0;

    mgr.destroy();
    expect(mgr.current).toBeUndefined();
    expect(log.filter((e) => e === 'a:destroy')).toHaveLength(1);
  });

  it('a pending target pushed then popped is destroyed once when a go() supersedes it', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('first', createTestScene('first', log));
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', createTestScene('b', log));
    await mgr.go('first');
    mgr.setTransition(fadeTransition(1));
    void mgr.go('a');
    await mgr.push('a');
    log.length = 0;

    mgr.pop();
    void mgr.go('b');
    mgr.update(1.0); // 'out' done → switch to b
    mgr.update(1.0); // 'in' done
    expect(mgr.current?.name).toBe('b');
    expect(log.filter((e) => e === 'a:destroy')).toHaveLength(1);
  });

  it('a pending target pushed then popped is destroyed once by destroy()', async () => {
    const log: string[] = [];
    const mgr = new SceneManager();
    mgr.register('first', createTestScene('first', log));
    mgr.register('a', createTestScene('a', log));
    await mgr.go('first');
    mgr.setTransition(fadeTransition(1));
    void mgr.go('a');
    await mgr.push('a');
    log.length = 0;

    mgr.pop();
    mgr.destroy();
    expect(mgr.current).toBeUndefined();
    expect(log.filter((e) => e === 'a:destroy')).toHaveLength(1);
  });
});

describe('SceneManager — stack teardown sequence', () => {
  async function stackAThenB(log: string[]): Promise<SceneManager> {
    const mgr = new SceneManager();
    mgr.register('a', createTestScene('a', log));
    mgr.register('b', createTestScene('b', log));
    mgr.register('c', createTestScene('c', log));
    await mgr.go('a');
    await mgr.push('b');
    log.length = 0;
    return mgr;
  }

  it('instant go() exits and destroys each stacked scene once, top first', async () => {
    const log: string[] = [];
    const mgr = await stackAThenB(log);
    await mgr.go('c');
    expect(log).toEqual([
      'b:exit',
      'b:destroy',
      'a:exit',
      'a:destroy',
      'c:preload',
      'c:init',
      'c:enter',
    ]);
    expect(mgr.stackSize).toBe(1);
    expect(mgr.current?.name).toBe('c');
  });

  it('pop() exits and destroys only the top scene, once', async () => {
    const log: string[] = [];
    const mgr = await stackAThenB(log);
    mgr.pop();
    expect(log).toEqual(['b:exit', 'b:destroy', 'a:enter']);
    expect(mgr.stackSize).toBe(1);
    expect(mgr.current?.name).toBe('a');
  });

  it('destroy() exits and destroys each stacked scene once, top first', async () => {
    const log: string[] = [];
    const mgr = await stackAThenB(log);
    mgr.destroy();
    expect(log).toEqual(['b:exit', 'b:destroy', 'a:exit', 'a:destroy']);
    expect(mgr.stackSize).toBe(0);

    // Nothing is left to tear down a second time.
    log.length = 0;
    mgr.destroy();
    expect(log).toEqual([]);
  });

  it('faded go() exits and destroys each stacked scene once, top first, when the out phase ends', async () => {
    const log: string[] = [];
    const mgr = await stackAThenB(log);
    mgr.setTransition(fadeTransition(1));
    void mgr.go('c');
    expect(log).toEqual(['c:preload']);

    mgr.update(0.5); // mid 'out' — the old stack is still live
    expect(log).toEqual(['c:preload', 'b:update:0.5', 'b:draw']);

    log.length = 0;
    mgr.update(0.5); // 'out' done → switch to c, then the tick drives c
    expect(log).toEqual([
      'b:exit',
      'b:destroy',
      'a:exit',
      'a:destroy',
      'c:init',
      'c:enter',
      'c:update:0.5',
      'c:draw',
    ]);

    log.length = 0;
    mgr.update(1.0); // 'in' done
    expect(mgr.isTransitioning).toBe(false);
    expect(mgr.stackSize).toBe(1);
    expect(mgr.current?.name).toBe('c');
    expect(log).toEqual(['c:update:1', 'c:draw']);
  });
});
