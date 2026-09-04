import { describe, expect, test } from 'bun:test';
import { CollisionWorld } from '../src/collision-world.js';
import { AABB, CircleShape } from '../src/shape.js';

/**
 * OSS-M11 — the standalone `raycast()` takes a caller-supplied target array, so
 * it sees neither the world's colliders nor the broadphase. `CollisionWorld`
 * now has its own, filtered by the `layer`/`mask` bits colliders already carry.
 */

describe('CollisionWorld.raycast — hits and ordering', () => {
  test('returns the nearest hit along the ray, not the first tested', () => {
    const world = new CollisionWorld();
    world.add(1, AABB(10, 10), 50, 0);
    world.add(2, AABB(10, 10), 20, 0); // nearer
    world.add(3, AABB(10, 10), 80, 0);

    const hit = world.raycast(0, 0, 1, 0, 200);
    expect(hit).not.toBeNull();
    expect(hit!.entity).toBe(2);
    expect(hit!.distance).toBeCloseTo(15, 6); // 20 - half-width 5
  });

  test('misses return null', () => {
    const world = new CollisionWorld();
    world.add(1, AABB(10, 10), 0, 100);
    expect(world.raycast(0, 0, 1, 0, 200)).toBeNull();
  });

  test('respects maxDist', () => {
    const world = new CollisionWorld();
    world.add(1, AABB(10, 10), 100, 0);
    expect(world.raycast(0, 0, 1, 0, 50)).toBeNull();
    expect(world.raycast(0, 0, 1, 0, 200)).not.toBeNull();
  });

  test('reports a hit point and a unit normal', () => {
    const world = new CollisionWorld();
    world.add(1, AABB(10, 10), 20, 0);
    const hit = world.raycast(0, 0, 1, 0, 100)!;
    expect(hit.point.x).toBeCloseTo(15, 6);
    expect(hit.point.y).toBeCloseTo(0, 6);
    expect(Math.hypot(hit.normal.x, hit.normal.y)).toBeCloseTo(1, 6);
    expect(hit.normal.x).toBeCloseTo(-1, 6); // facing back down the ray
  });

  test('hits circles as well as boxes', () => {
    const world = new CollisionWorld();
    world.add(1, CircleShape(5), 30, 0);
    const hit = world.raycast(0, 0, 1, 0, 100)!;
    expect(hit.entity).toBe(1);
    expect(hit.distance).toBeCloseTo(25, 6);
  });

  test('finds colliders after they move', () => {
    // The broadphase is only useful if the ray sees current positions.
    const world = new CollisionWorld();
    world.add(1, AABB(10, 10), 20, 0);
    expect(world.raycast(0, 0, 1, 0, 100)).not.toBeNull();
    world.setPosition(1, 0, 500);
    expect(world.raycast(0, 0, 1, 0, 100)).toBeNull();
    expect(world.raycast(0, 0, 0, 1, 1000)).not.toBeNull();
  });
});

describe('CollisionWorld.raycast — layer mask', () => {
  test('a mask selects which layers the ray can hit', () => {
    const world = new CollisionWorld();
    world.add(1, AABB(10, 10), 20, 0, false, 0b001);
    world.add(2, AABB(10, 10), 40, 0, false, 0b010);

    // Layer 1 only — the nearer collider.
    expect(world.raycast(0, 0, 1, 0, 200, 0b001)!.entity).toBe(1);
    // Layer 2 only — skips the nearer one entirely.
    expect(world.raycast(0, 0, 1, 0, 200, 0b010)!.entity).toBe(2);
    // Both.
    expect(world.raycast(0, 0, 1, 0, 200, 0b011)!.entity).toBe(1);
    // Neither.
    expect(world.raycast(0, 0, 1, 0, 200, 0b100)).toBeNull();
  });

  test('the mask defaults to every layer', () => {
    const world = new CollisionWorld();
    world.add(1, AABB(10, 10), 20, 0, false, 0b1000);
    expect(world.raycast(0, 0, 1, 0, 200)).not.toBeNull();
  });
});

describe('CollisionWorld.raycast — allocation contract', () => {
  test('the hit record is reused between calls', () => {
    // Documented explicitly because it is a footgun if unnoticed: holding the
    // record across two casts gives you the second result in the first variable.
    const world = new CollisionWorld();
    world.add(1, AABB(10, 10), 20, 0);
    world.add(2, AABB(10, 10), 60, 0);

    const first = world.raycast(0, 0, 1, 0, 200);
    const second = world.raycast(0, 0, 1, 0, 30);
    expect(second).toBe(first);
  });

  test('a null result does not disturb the previous record', () => {
    const world = new CollisionWorld();
    world.add(1, AABB(10, 10), 20, 0);
    const hit = world.raycast(0, 0, 1, 0, 200)!;
    const entity = hit.entity;
    const distance = hit.distance;

    expect(world.raycast(0, 0, 0, -1, 5)).toBeNull();
    expect(hit.entity).toBe(entity);
    expect(hit.distance).toBe(distance);
  });

  test('repeated casts do not grow the candidate buffer without bound', () => {
    const world = new CollisionWorld();
    for (let i = 0; i < 20; i++) world.add(i, AABB(4, 4), i * 10, 0);
    for (let i = 0; i < 200; i++) {
      const hit = world.raycast(-50, 0, 1, 0, 500);
      expect(hit).not.toBeNull();
    }
    // Nearest collider is entity 0 at x = 0.
    expect(world.raycast(-50, 0, 1, 0, 500)!.entity).toBe(0);
  });
});
