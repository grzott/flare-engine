import { describe, expect, it } from 'bun:test';
import { SceneManager } from '../src/scene-manager.js';
import type { Scene } from '../src/scene.js';
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
