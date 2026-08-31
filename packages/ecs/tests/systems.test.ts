import { describe, expect, it } from 'bun:test';
import { Follower, Lifetime, Position, Velocity } from '../src/components.js';
import type { CullBounds } from '../src/systems.js';
import {
  createBoundsCullSystem,
  createFollowerSystem,
  createLifetimeSystem,
  createMovementSystem,
  createOrphanCullSystem,
} from '../src/systems.js';
import { World } from '../src/world.js';

// ---------------------------------------------------------------------------
// movementSystem
// ---------------------------------------------------------------------------
describe('createMovementSystem', () => {
  it('integrates position by velocity * dt', () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, Position, { x: 0, y: 0 });
    world.add(e, Velocity, { x: 3, y: -2 });

    const sys = createMovementSystem(world);
    world.addSystem(sys._worldFn);
    world.step(1);

    const pos = world.get(e, Position)!;
    expect(pos.x).toBe(3);
    expect(pos.y).toBe(-2);
  });

  it('entity with Position but no Velocity is untouched', () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, Position, { x: 5, y: 7 });

    const sys = createMovementSystem(world);
    world.addSystem(sys._worldFn);
    world.step(1);

    const pos = world.get(e, Position)!;
    expect(pos.x).toBe(5);
    expect(pos.y).toBe(7);
  });

  it('accumulates over multiple steps', () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, Position, { x: 0, y: 0 });
    world.add(e, Velocity, { x: 2, y: 1 });

    const sys = createMovementSystem(world);
    world.addSystem(sys._worldFn);
    world.step(0.5);
    world.step(0.5);

    const pos = world.get(e, Position)!;
    expect(pos.x).toBeCloseTo(2);
    expect(pos.y).toBeCloseTo(1);
  });

  it('no-op with zero matching entities', () => {
    const world = new World();
    const sys = createMovementSystem(world);
    world.addSystem(sys._worldFn);
    expect(() => world.step(1)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// lifetimeSystem
// ---------------------------------------------------------------------------
describe('createLifetimeSystem', () => {
  it('decrements remaining', () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, Lifetime, { remaining: 2 });

    const sys = createLifetimeSystem(world, () => {});
    world.addSystem(sys._worldFn);
    world.step(0.5);

    expect(world.get(e, Lifetime)!.remaining).toBeCloseTo(1.5);
  });

  it('calls onExpire when remaining reaches 0', () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, Lifetime, { remaining: 1 });

    const expired: number[] = [];
    const sys = createLifetimeSystem(world, (id, w) => {
      expired.push(id);
      w.destroy(id);
    });
    world.addSystem(sys._worldFn);
    world.step(1);

    expect(expired).toContain(e);
    expect(world.exists(e)).toBe(false);
  });

  it('BATCH-CULL GUARD: all 5 entities expiring the same step are all destroyed', () => {
    const world = new World();
    const ids: number[] = [];
    for (let i = 0; i < 5; i++) {
      const e = world.spawn();
      world.add(e, Lifetime, { remaining: 1 });
      ids.push(e);
    }

    const destroyed: number[] = [];
    const sys = createLifetimeSystem(world, (id, w) => {
      destroyed.push(id);
      w.destroy(id);
    });
    world.addSystem(sys._worldFn);
    world.step(1);

    expect(destroyed.length).toBe(5);
    for (const id of ids) {
      expect(world.exists(id)).toBe(false);
    }
  });

  it('onExpire receives (id, world)', () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, Lifetime, { remaining: 0.1 });

    let receivedId = -1;
    let receivedWorld: World | null = null;
    const sys = createLifetimeSystem(world, (id, w) => {
      receivedId = id;
      receivedWorld = w;
    });
    world.addSystem(sys._worldFn);
    world.step(0.2);

    expect(receivedId).toBe(e);
    expect(receivedWorld === world).toBe(true);
  });

  it('no-op with zero matching entities', () => {
    const world = new World();
    const sys = createLifetimeSystem(world, () => {});
    world.addSystem(sys._worldFn);
    expect(() => world.step(1)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// boundsCullSystem
// ---------------------------------------------------------------------------
describe('createBoundsCullSystem', () => {
  it('entity inside bounds is NOT culled', () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, Position, { x: 50, y: 50 });

    const bounds: CullBounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const culled: number[] = [];
    const sys = createBoundsCullSystem(world, bounds, (id) => culled.push(id));
    world.addSystem(sys._worldFn);
    world.step(1);

    expect(culled).not.toContain(e);
  });

  it('entity past minX edge IS culled', () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, Position, { x: -1, y: 50 });

    const bounds: CullBounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const culled: number[] = [];
    const sys = createBoundsCullSystem(world, bounds, (id) => culled.push(id));
    world.addSystem(sys._worldFn);
    world.step(1);

    expect(culled).toContain(e);
  });

  it('entity past maxX edge IS culled', () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, Position, { x: 101, y: 50 });

    const bounds: CullBounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const culled: number[] = [];
    const sys = createBoundsCullSystem(world, bounds, (id) => culled.push(id));
    world.addSystem(sys._worldFn);
    world.step(1);

    expect(culled).toContain(e);
  });

  it('entity past minY edge IS culled', () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, Position, { x: 50, y: -1 });

    const bounds: CullBounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const culled: number[] = [];
    const sys = createBoundsCullSystem(world, bounds, (id) => culled.push(id));
    world.addSystem(sys._worldFn);
    world.step(1);

    expect(culled).toContain(e);
  });

  it('entity past maxY edge IS culled', () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, Position, { x: 50, y: 101 });

    const bounds: CullBounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const culled: number[] = [];
    const sys = createBoundsCullSystem(world, bounds, (id) => culled.push(id));
    world.addSystem(sys._worldFn);
    world.step(1);

    expect(culled).toContain(e);
  });

  it('live-bounds mutation: entity becomes outside on next step after mutation', () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, Position, { x: 50, y: 50 });

    const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const culled: number[] = [];
    const sys = createBoundsCullSystem(world, bounds, (id) => culled.push(id));
    world.addSystem(sys._worldFn);

    world.step(1);
    expect(culled).not.toContain(e);

    // Shrink bounds so entity is now outside
    bounds.maxX = 10;
    world.step(1);
    expect(culled).toContain(e);
  });

  it('BATCH-CULL GUARD: all 5 entities outside bounds are culled in one step', () => {
    const world = new World();
    const ids: number[] = [];
    for (let i = 0; i < 5; i++) {
      const e = world.spawn();
      world.add(e, Position, { x: -1 - i, y: 50 });
      ids.push(e);
    }

    const culled: number[] = [];
    const bounds: CullBounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const sys = createBoundsCullSystem(world, bounds, (id, w) => {
      culled.push(id);
      w.destroy(id);
    });
    world.addSystem(sys._worldFn);
    world.step(1);

    expect(culled.length).toBe(5);
    for (const id of ids) {
      expect(world.exists(id)).toBe(false);
    }
  });

  it('INCLUSIVE-BOUNDARY: entities exactly on minX or maxX are NOT culled', () => {
    const world = new World();
    const onMin = world.spawn();
    world.add(onMin, Position, { x: 0, y: 50 });
    const onMax = world.spawn();
    world.add(onMax, Position, { x: 100, y: 50 });

    const culled: number[] = [];
    const bounds: CullBounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const sys = createBoundsCullSystem(world, bounds, (id) => culled.push(id));
    world.addSystem(sys._worldFn);
    world.step(1);

    expect(culled).not.toContain(onMin);
    expect(culled).not.toContain(onMax);
    expect(culled.length).toBe(0);
  });

  it('no-op with zero matching entities', () => {
    const world = new World();
    const bounds: CullBounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const sys = createBoundsCullSystem(world, bounds, () => {});
    world.addSystem(sys._worldFn);
    expect(() => world.step(1)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// followerSystem
// ---------------------------------------------------------------------------
describe('createFollowerSystem', () => {
  it('pins follower to target + offset', () => {
    const world = new World();
    const target = world.spawn();
    world.add(target, Position, { x: 10, y: 20 });

    const follower = world.spawn();
    world.add(follower, Position, { x: 0, y: 0 });
    world.add(follower, Follower, { target, offsetX: 5, offsetY: -3 });

    const sys = createFollowerSystem(world);
    world.addSystem(sys._worldFn);
    world.step(1);

    const pos = world.get(follower, Position)!;
    expect(pos.x).toBe(15);
    expect(pos.y).toBe(17);
  });

  it('tracks target after it moves (movement then follower order)', () => {
    const world = new World();
    const target = world.spawn();
    world.add(target, Position, { x: 0, y: 0 });
    world.add(target, Velocity, { x: 10, y: 0 });

    const follower = world.spawn();
    world.add(follower, Position, { x: 0, y: 0 });
    world.add(follower, Follower, { target, offsetX: 0, offsetY: 0 });

    const moveSys = createMovementSystem(world);
    const followSys = createFollowerSystem(world);
    world.addSystem(moveSys._worldFn, 0);
    world.addSystem(followSys._worldFn, 1);
    world.step(1);

    const pos = world.get(follower, Position)!;
    expect(pos.x).toBe(10);
    expect(pos.y).toBe(0);
  });

  it('follower whose target was destroyed is not moved and does not crash', () => {
    const world = new World();
    const target = world.spawn();
    world.add(target, Position, { x: 100, y: 100 });

    const follower = world.spawn();
    world.add(follower, Position, { x: 0, y: 0 });
    world.add(follower, Follower, { target, offsetX: 0, offsetY: 0 });

    world.destroy(target);

    const sys = createFollowerSystem(world);
    world.addSystem(sys._worldFn);
    expect(() => world.step(1)).not.toThrow();

    const pos = world.get(follower, Position)!;
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
  });

  it('no-op with zero matching entities', () => {
    const world = new World();
    const sys = createFollowerSystem(world);
    world.addSystem(sys._worldFn);
    expect(() => world.step(1)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// orphanCullSystem
// ---------------------------------------------------------------------------
describe('createOrphanCullSystem', () => {
  it('fires onOrphan exactly once when target is destroyed', () => {
    const world = new World();
    const target = world.spawn();
    world.add(target, Position, { x: 0, y: 0 });

    const follower = world.spawn();
    world.add(follower, Follower, { target, offsetX: 0, offsetY: 0 });

    world.destroy(target);

    const orphaned: number[] = [];
    const sys = createOrphanCullSystem(world, (id, w) => {
      orphaned.push(id);
      w.destroy(id);
    });
    world.addSystem(sys._worldFn);
    world.step(1);

    expect(orphaned.length).toBe(1);
    expect(orphaned[0]).toBe(follower);
    expect(world.exists(follower)).toBe(false);
  });

  it('does NOT fire onOrphan when target is alive', () => {
    const world = new World();
    const target = world.spawn();
    world.add(target, Position, { x: 0, y: 0 });

    const follower = world.spawn();
    world.add(follower, Follower, { target, offsetX: 0, offsetY: 0 });

    const orphaned: number[] = [];
    const sys = createOrphanCullSystem(world, (id) => orphaned.push(id));
    world.addSystem(sys._worldFn);
    world.step(1);

    expect(orphaned.length).toBe(0);
  });

  it('CROSS-STEP re-fire: onOrphan fires each step while orphan persists', () => {
    const world = new World();
    const target = world.spawn();
    world.add(target, Position, { x: 0, y: 0 });

    const follower = world.spawn();
    world.add(follower, Follower, { target, offsetX: 0, offsetY: 0 });

    world.destroy(target);

    let callCount = 0;
    const sys = createOrphanCullSystem(world, () => {
      callCount++;
    });
    world.addSystem(sys._worldFn);
    world.step(1);
    world.step(1);

    expect(callCount).toBe(2);
    expect(world.exists(follower)).toBe(true);
  });

  it('no-op with zero matching entities', () => {
    const world = new World();
    const sys = createOrphanCullSystem(world, () => {});
    world.addSystem(sys._worldFn);
    expect(() => world.step(1)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// caller-supplied query (CW7-3)
// ---------------------------------------------------------------------------
describe('createLifetimeSystem — caller-supplied query', () => {
  it('default (no query arg) still expires all Lifetime entities', () => {
    const world = new World();
    const a = world.spawn();
    world.add(a, Lifetime, { remaining: 0.1 });

    const expired: number[] = [];
    const sys = createLifetimeSystem(world, (id) => expired.push(id));
    world.addSystem(sys._worldFn);
    world.step(1);

    expect(expired).toContain(a);
  });

  it('injected narrower query limits entities visited', () => {
    const world = new World();

    const wideOnly = world.spawn();
    world.add(wideOnly, Lifetime, { remaining: 0.1 });

    const narrow = world.spawn();
    world.add(narrow, Lifetime, { remaining: 0.1 });
    world.add(narrow, Velocity, { x: 0, y: 0 });

    const narrowQuery: Query = world.query(Lifetime, Velocity);

    const expired: number[] = [];
    const sys = createLifetimeSystem(world, (id) => expired.push(id), narrowQuery);
    world.addSystem(sys._worldFn);
    world.step(1);

    expect(expired).toContain(narrow);
    expect(expired).not.toContain(wideOnly);
  });

  it('injected query is used at construction time, not per-frame', () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, Lifetime, { remaining: 0.1 });
    world.add(e, Velocity, { x: 0, y: 0 });

    const narrowQuery: Query = world.query(Lifetime, Velocity);
    const sys = createLifetimeSystem(world, () => {}, narrowQuery);

    expect(sys.query === narrowQuery).toBe(true);
  });
});

describe('createBoundsCullSystem — caller-supplied query', () => {
  it('default (no query arg) still culls all out-of-bounds Position entities', () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, Position, { x: -999, y: 0 });

    const culled: number[] = [];
    const bounds: CullBounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const sys = createBoundsCullSystem(world, bounds, (id) => culled.push(id));
    world.addSystem(sys._worldFn);
    world.step(1);

    expect(culled).toContain(e);
  });

  it('injected narrower query limits entities culled', () => {
    const world = new World();

    const wideOnly = world.spawn();
    world.add(wideOnly, Position, { x: -999, y: 0 });

    const narrow = world.spawn();
    world.add(narrow, Position, { x: -999, y: 0 });
    world.add(narrow, Velocity, { x: 0, y: 0 });

    const narrowQuery: Query = world.query(Position, Velocity);

    const culled: number[] = [];
    const bounds: CullBounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const sys = createBoundsCullSystem(world, bounds, (id) => culled.push(id), narrowQuery);
    world.addSystem(sys._worldFn);
    world.step(1);

    expect(culled).toContain(narrow);
    expect(culled).not.toContain(wideOnly);
  });

  it('injected query is used at construction time, not per-frame', () => {
    const world = new World();
    const narrowQuery: Query = world.query(Position, Velocity);
    const bounds: CullBounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const sys = createBoundsCullSystem(world, bounds, () => {}, narrowQuery);

    expect(sys.query === narrowQuery).toBe(true);
  });
});
