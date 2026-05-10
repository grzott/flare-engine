import { beforeEach, describe, expect, test } from 'bun:test';
import { Position } from '@flare-engine/ecs';
import { easeInCubic } from '@flare-engine/math';
import { CollisionWorld } from '@flare-engine/physics';
import { Sprite } from '@flare-engine/render';
import { createTestWorld } from '@flare-engine/testing';
import { SpiralCollapse } from '../src/components';
import { _resetSpiralPoolForTest, triggerSpiralCollapse } from '../src/fx/explosions';
import { cleanup } from '../src/systems/cleanup';

describe('triggerSpiralCollapse', () => {
  beforeEach(() => {
    _resetSpiralPoolForTest();
  });

  test('attaches SpiralCollapse component with correct origin and elapsed=0, duration=1.2', () => {
    const { world } = createTestWorld();
    const id = world.spawn();

    const attached = triggerSpiralCollapse(world, id, 120, 200, false, null);

    expect(attached).toBe(true);
    const sc = world.get(id, SpiralCollapse);
    expect(sc).toBeDefined();
    expect(sc?.originX).toBe(120);
    expect(sc?.originY).toBe(200);
    expect(sc?.elapsed).toBe(0);
    expect(sc?.duration).toBe(1.2);
  });

  test('reducedMotion=true destroys entity immediately, no SpiralCollapse attached, chromatic-ab fired', () => {
    const { world } = createTestWorld();
    const id = world.spawn();

    let chromAbFired = false;
    const fakePostfx = {
      triggerChromaticAb(decayMs: number): void {
        expect(decayMs).toBe(100);
        chromAbFired = true;
      },
    };

    const attached = triggerSpiralCollapse(world, id, 80, 150, true, fakePostfx);

    expect(attached).toBe(false);
    expect(world.exists(id)).toBe(false);
    expect(chromAbFired).toBe(true);
  });

  test('second call on same entity is idempotent (SpiralCollapse already attached)', () => {
    const { world } = createTestWorld();
    const id = world.spawn();

    triggerSpiralCollapse(world, id, 50, 50, false, null);
    const second = triggerSpiralCollapse(world, id, 50, 50, false, null);

    expect(second).toBe(false);
    const sc = world.get(id, SpiralCollapse);
    expect(sc?.elapsed).toBe(0);
  });

  test('returns false for non-existent entity', () => {
    const { world } = createTestWorld();
    const result = triggerSpiralCollapse(world, 9999, 0, 0, false, null);
    expect(result).toBe(false);
  });
});

describe('SpiralCollapse per-frame visual update', () => {
  // Shared minimal frame dims for scale assertions.
  const FRAME_W = 16;
  const FRAME_H = 16;

  function makeCleanupDeps(world: ReturnType<typeof createTestWorld>['world']) {
    const coll = new CollisionWorld();
    return {
      coll,
      bulletQuery: world.query(Position),
      enemyQuery: world.query(SpiralCollapse), // empty — no Enemy entities
      shipQuery: world.query(SpiralCollapse), // empty — no Ship entities
      lifetimeQuery: world.query(SpiralCollapse), // empty — no Lifetime entities
      spiralCollapseQuery: world.query(SpiralCollapse),
      bounds: { width: 360, height: 640 },
      onEnemyKilled: () => {},
      onPlayerDown: () => {},
      onEliteDeath: () => false,
    };
  }

  beforeEach(() => {
    _resetSpiralPoolForTest();
  });

  test('at t=0.5 Position is displaced from origin and Sprite is scaled to half', () => {
    const { world } = createTestWorld();
    const id = world.spawn();

    const ORIGIN_X = 100;
    const ORIGIN_Y = 200;
    const DURATION = 1.2;
    const INITIAL_RADIUS = 24;

    // Attach SpiralCollapse component with known params.
    world.add(id, SpiralCollapse, {
      originX: ORIGIN_X,
      originY: ORIGIN_Y,
      elapsed: 0,
      duration: DURATION,
      turns: 3,
      initialRadius: INITIAL_RADIUS,
      scaleFrom: 1.0,
      scaleTo: 0.0,
      alphaFrom: 1.0,
      alphaTo: 0.0,
    });
    world.add(id, Position, { x: ORIGIN_X, y: ORIGIN_Y });
    world.add(id, Sprite, {
      image: {} as never,
      frame: { name: 'test', x: 0, y: 0, w: FRAME_W, h: FRAME_H },
      z: 10,
    });

    const deps = makeCleanupDeps(world);

    // Advance elapsed to exactly 0.5 duration in one step.
    const dt = DURATION * 0.5;
    cleanup(world, dt, deps);

    const pos = world.get(id, Position);
    const sprite = world.get(id, Sprite);

    expect(pos).toBeDefined();
    expect(sprite).toBeDefined();

    // t = 0.5 → ease = easeInCubic(0.5) = 0.125
    // angle = 3 * 2π * 0.5 = 3π  → cos(3π) = -1, sin(3π) ≈ 0
    // radius = 24 * (1 - 0.125) = 21
    const t = 0.5;
    const ease = easeInCubic(t);
    const radius = INITIAL_RADIUS * (1 - ease);
    const angle = 3 * 2 * Math.PI * t;
    const expectedX = ORIGIN_X + Math.cos(angle) * radius;
    const expectedY = ORIGIN_Y + Math.sin(angle) * radius;

    expect(pos!.x).toBeCloseTo(expectedX, 5);
    expect(pos!.y).toBeCloseTo(expectedY, 5);

    // Displacement from origin must be non-zero (radius > 0 at t=0.5).
    const dx = pos!.x - ORIGIN_X;
    const dy = pos!.y - ORIGIN_Y;
    expect(Math.abs(dx) + Math.abs(dy)).toBeGreaterThan(0.1);

    // Scale at t=0.5: lerp(1, 0, 0.5) = 0.5
    expect(sprite!.width).toBeCloseTo(FRAME_W * 0.5, 5);
    expect(sprite!.height).toBeCloseTo(FRAME_H * 0.5, 5);

    // Alpha at t=0.5: lerp(alphaFrom=1, alphaTo=0, 0.5) = 0.5
    expect(sprite!.alpha).toBeCloseTo(0.5, 5);

    // Entity still alive — duration not reached.
    expect(world.exists(id)).toBe(true);
  });

  test('at t>=1.0 entity is destroyed', () => {
    const { world } = createTestWorld();
    const id = world.spawn();

    const DURATION = 1.2;

    world.add(id, SpiralCollapse, {
      originX: 50,
      originY: 50,
      elapsed: 0,
      duration: DURATION,
      turns: 3,
      initialRadius: 24,
      scaleFrom: 1.0,
      scaleTo: 0.0,
      alphaFrom: 1.0,
      alphaTo: 0.0,
    });
    world.add(id, Position, { x: 50, y: 50 });
    world.add(id, Sprite, {
      image: {} as never,
      frame: { name: 'test', x: 0, y: 0, w: FRAME_W, h: FRAME_H },
      z: 10,
    });

    const deps = makeCleanupDeps(world);

    // Single step past the full duration.
    cleanup(world, DURATION + 0.01, deps);

    expect(world.exists(id)).toBe(false);
  });
});
