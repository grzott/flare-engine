/**
 * Cross-package integration tests.
 * Exercises multiple @flare-engine/* packages working together.
 * No real Skia canvas — mocks any renderer-facing calls.
 */
import { describe, expect, it } from 'bun:test';
import {
  createSpriteAnimator,
  createTweenManager,
  playAnimation,
  tween,
  updateAnimator,
  updateTweens,
} from '@flare-engine/animation';
import { createSpriteSheet } from '@flare-engine/assets';
import { GameLoop } from '@flare-engine/core';
import {
  _resetComponentIds,
  defineComponent,
  defineSystem,
  World as ECSWorld,
  Position,
  Velocity,
  World,
} from '@flare-engine/ecs';
import type { CollisionPair } from '@flare-engine/physics';
import { AABB, CollisionWorld } from '@flare-engine/physics';
import { Camera2D } from '@flare-engine/render';
import type { Scene } from '@flare-engine/scene';
import { SceneManager } from '@flare-engine/scene';

// ─── 1. ECS + Physics ────────────────────────────────────────────────────────

describe('ECS + Physics: entity positions drive collision world', () => {
  it('collision fires when ECS positions overlap', () => {
    _resetComponentIds();
    const world = new World();
    const cworld = new CollisionWorld();

    const e1 = world.spawn();
    const e2 = world.spawn();

    world.add(e1, Position, { x: 0, y: 0 });
    world.add(e2, Position, { x: 5, y: 0 });

    cworld.add(e1, AABB(20, 20), 0, 0);
    cworld.add(e2, AABB(20, 20), 5, 0);

    const starts: CollisionPair[] = [];
    cworld.onCollisionStart.add((p) => starts.push(p));

    cworld.step();
    expect(starts.length).toBe(1);
  });

  it('collision end fires when ECS entity destroyed', () => {
    _resetComponentIds();
    const world = new World();
    const cworld = new CollisionWorld();

    const e1 = world.spawn();
    const e2 = world.spawn();

    world.add(e1, Position, { x: 0, y: 0 });
    world.add(e2, Position, { x: 5, y: 0 });
    cworld.add(e1, AABB(20, 20), 0, 0);
    cworld.add(e2, AABB(20, 20), 5, 0);

    cworld.step(); // start collision

    const ends: CollisionPair[] = [];
    cworld.onCollisionEnd.add((p) => ends.push(p));

    // Destroying ECS entity and removing from physics should fire exit signal
    world.destroy(e2);
    cworld.remove(e2);

    expect(ends.length).toBe(1);
  });

  it('move system syncs ECS positions into collision world', () => {
    _resetComponentIds();
    const world = new World();
    const cworld = new CollisionWorld();

    const e1 = world.spawn();
    const e2 = world.spawn();

    world.add(e1, Position, { x: 0, y: 0 });
    world.add(e2, Position, { x: 100, y: 0 });
    cworld.add(e1, AABB(20, 20), 0, 0);
    cworld.add(e2, AABB(20, 20), 100, 0);

    const starts: CollisionPair[] = [];
    cworld.onCollisionStart.add((p) => starts.push(p));

    // Sync system: read ECS Position → update collision world
    const posQuery = world.query(Position);
    const syncSystem = defineSystem(posQuery, (entities) => {
      for (const id of entities) {
        const pos = world.get(id, Position)!;
        cworld.setPosition(id, pos.x, pos.y);
      }
    });
    world.addSystem(syncSystem._worldFn);

    // Move e2 to overlap
    const pos2 = world.get(e2, Position)!;
    pos2.x = 5;

    world.step(0); // sync positions
    cworld.step(); // detect collision
    expect(starts.length).toBe(1);
  });
});

// ─── 2. ECS + Animation ──────────────────────────────────────────────────────

describe('ECS + Animation: SpriteAnimator ticks via world', () => {
  it('animator frame advances when world steps', () => {
    _resetComponentIds();

    const sheet = createSpriteSheet();
    // Add 3 frames
    sheet.frames.push(
      { name: 'f0', x: 0, y: 0, w: 16, h: 16 },
      { name: 'f1', x: 16, y: 0, w: 16, h: 16 },
      { name: 'f2', x: 32, y: 0, w: 16, h: 16 },
    );
    sheet.animations.set('walk', {
      name: 'walk',
      frameIndices: [0, 1, 2],
      frameDuration: 0.1,
      loop: true,
    });

    const Anim = defineComponent('Anim', () => createSpriteAnimator(sheet));
    const world = new World();
    const e = world.spawn();
    world.add(e, Anim);

    const animState = world.get(e, Anim)!;
    playAnimation(animState, 'walk');
    expect(animState.frameIndex).toBe(0);

    // Advance past one frame duration
    updateAnimator(animState, 0.15);
    expect(animState.frameIndex).toBe(1);

    // Advance two more frames
    updateAnimator(animState, 0.2);
    expect(animState.frameIndex).toBe(0); // looped back
  });
});

// ─── 3. TweenManager driven by GameLoop ──────────────────────────────────────

describe('TweenManager + GameLoop: values update each frame', () => {
  it('tween reaches target when loop steps enough dt', () => {
    const mgr = createTweenManager();
    const tw = tween(0, 100, 1.0); // 0 → 100 over 1 second
    mgr.tweens.push(tw);

    // Step past duration (floating point: 10 × 0.1 ≠ 1.0 exactly)
    updateTweens(mgr, 0.5);
    updateTweens(mgr, 0.6); // total 1.1s > 1.0s duration

    expect(tw.done).toBe(true);
    expect(tw.value).toBe(100);
  });

  it('tween auto-removed from manager after completion', () => {
    const mgr = createTweenManager();
    const tw = tween(0, 1, 0.5);
    mgr.tweens.push(tw);

    updateTweens(mgr, 1.0); // complete in one step
    expect(mgr.tweens.length).toBe(0);
  });

  it('GameLoop onUpdate drives tween manager', () => {
    const loop = new GameLoop({ maxDt: 1 });
    const mgr = createTweenManager();
    const tw = tween(0, 60, 1.0);
    mgr.tweens.push(tw);

    loop.onUpdate.add((dt) => updateTweens(mgr, dt));

    // Simulate two 0.5s frames
    loop.step(0.5);
    loop.step(0.5);

    expect(tw.done).toBe(true);
    expect(tw.value).toBe(60);
  });
});

// ─── 4. Scene lifecycle order ─────────────────────────────────────────────────

describe('SceneManager: lifecycle hooks fire in order', () => {
  it('go(): onExit current → onPreload → onInit → onEnter new', async () => {
    const mgr = new SceneManager();
    const log: string[] = [];

    const makeScene = (name: string): Scene => ({
      name,
      world: new ECSWorld(),
      camera: new Camera2D(),
      onPreload() {
        log.push(`${name}:preload`);
      },
      onInit() {
        log.push(`${name}:init`);
      },
      onEnter() {
        log.push(`${name}:enter`);
      },
      onExit() {
        log.push(`${name}:exit`);
      },
      onDestroy() {
        log.push(`${name}:destroy`);
      },
    });

    mgr.register('A', () => makeScene('A'));
    mgr.register('B', () => makeScene('B'));

    await mgr.go('A');
    expect(log).toEqual(['A:preload', 'A:init', 'A:enter']);

    log.length = 0;
    await mgr.go('B');
    expect(log).toEqual(['A:exit', 'A:destroy', 'B:preload', 'B:init', 'B:enter']);
  });

  it('push/pop: current onExit → new onEnter → pop restores previous', async () => {
    const mgr = new SceneManager();
    const log: string[] = [];

    const makeScene = (name: string): Scene => ({
      name,
      world: new ECSWorld(),
      camera: new Camera2D(),
      onEnter() {
        log.push(`${name}:enter`);
      },
      onExit() {
        log.push(`${name}:exit`);
      },
      onDestroy() {
        log.push(`${name}:destroy`);
      },
    });

    mgr.register('A', () => makeScene('A'));
    mgr.register('B', () => makeScene('B'));

    await mgr.go('A');
    log.length = 0;

    await mgr.push('B');
    expect(log).toEqual(['A:exit', 'B:enter']);

    log.length = 0;
    mgr.pop();
    expect(log).toEqual(['B:exit', 'B:destroy', 'A:enter']);
  });
});

// ─── 5. Full loop: GameLoop → World + CollisionWorld + TweenManager ──────────

describe('Full loop: GameLoop drives ECS + physics + tweens in one frame', () => {
  it('all systems update in a single loop.step()', () => {
    _resetComponentIds();

    const loop = new GameLoop({ fixedDt: 1 / 60, maxDt: 2.0 }); // maxDt high enough for 1s step
    const world = new World();
    const cworld = new CollisionWorld();
    const tweens = createTweenManager();

    // ECS entities
    const e1 = world.spawn();
    const e2 = world.spawn();
    world.add(e1, Position, { x: 0, y: 0 });
    world.add(e1, Velocity, { x: 100, y: 0 });
    world.add(e2, Position, { x: 50, y: 0 });

    // Physics
    cworld.add(e1, AABB(10, 10), 0, 0);
    cworld.add(e2, AABB(10, 10), 50, 0);

    // Tween
    const valueTween = tween(0, 1, 1.0);
    tweens.tweens.push(valueTween);

    let collisionFired = false;
    cworld.onCollisionStart.add(() => {
      collisionFired = true;
    });

    // Wire into loop
    loop.onFixedUpdate.add((fixedDt) => {
      // Move e1 by velocity
      const pos = world.get(e1, Position)!;
      const vel = world.get(e1, Velocity)!;
      pos.x += vel.x * fixedDt;
      cworld.setPosition(e1, pos.x, pos.y);
      world.step(fixedDt);
      cworld.step(); // physics runs every fixed step
    });
    loop.onUpdate.add((dt) => {
      updateTweens(tweens, dt);
    });

    // Run 60 frames worth of fixed steps via a single 1s step
    loop.step(1.0);

    const finalPos = world.get(e1, Position)!;
    expect(finalPos.x).toBeGreaterThan(40); // moved significantly
    expect(collisionFired).toBe(true); // collided with e2
    expect(valueTween.done).toBe(true); // tween completed
  });
});
