import { describe, expect, it } from 'bun:test';
import { type CollisionPair, CollisionWorld } from '../src/collision-world.js';
import { AABB, CircleShape, type Shape, shapeBounds, shapeOverlap } from '../src/shape.js';

// The broadphase behind CollisionWorld (#579): which pairs a step reports must
// not depend on which bodies it chose to query from, nor on whether a move
// relinked the body.

const SHIP = 1;
const SHOT = 2;
const ENEMY = 4;

function pairLog(world: CollisionWorld): string[] {
  const log: string[] = [];
  const rec = (event: string) => (p: CollisionPair) =>
    log.push(`${event} ${p.entityA}-${p.entityB}`);
  world.onCollisionStart.add(rec('start'));
  world.onCollisionEnd.add(rec('end'));
  world.onTriggerEnter.add(rec('enter'));
  world.onTriggerExit.add(rec('exit'));
  return log;
}

describe('CollisionWorld layer/mask pairing (#579)', () => {
  it('pairs when only the low id’s layer is in the high id’s mask', () => {
    const world = new CollisionWorld();
    const log = pairLog(world);
    // 1 wants nothing; 2 wants layer 1.
    world.add(1, AABB(20, 20), 0, 0, false, 1, 0);
    world.add(2, AABB(20, 20), 5, 0, false, 2, 1);
    world.step();
    expect(log).toEqual(['start 1-2']);
  });

  it('pairs when only the high id’s layer is in the low id’s mask', () => {
    const world = new CollisionWorld();
    const log = pairLog(world);
    world.add(1, AABB(20, 20), 0, 0, false, 2, 1);
    world.add(2, AABB(20, 20), 5, 0, false, 1, 0);
    world.step();
    expect(log).toEqual(['start 1-2']);
  });

  it('does not pair bodies whose layers and masks miss in both directions', () => {
    const world = new CollisionWorld();
    const log = pairLog(world);
    world.add(1, AABB(20, 20), 0, 0, false, ENEMY, SHIP | SHOT);
    world.add(2, AABB(20, 20), 5, 0, false, ENEMY, SHIP | SHOT);
    world.add(3, AABB(20, 20), 5, 5, false, 8, 0);
    world.step();
    expect(log).toEqual([]);
  });

  it('a body that wants nothing is still paired by whatever wants it, at any id order', () => {
    // The wall has mask 0. Bolts around it never collide with each other, so
    // they are bodies a step need not query from — except that the wall is in
    // their cell.
    for (const wallId of [1, 50, 99]) {
      const world = new CollisionWorld();
      const log = pairLog(world);
      for (let id = 1; id <= 99; id++) {
        if (id === wallId) world.add(id, AABB(4, 4), 30, 30, false, SHIP, 0);
        else world.add(id, AABB(4, 4), 10 + (id % 2) * 40, 10, false, ENEMY, SHIP);
      }
      const hitter = wallId === 1 ? 2 : 1;
      world.setPosition(hitter, 31, 31);
      world.step();
      const lo = Math.min(hitter, wallId);
      const hi = Math.max(hitter, wallId);
      expect(log).toEqual([`start ${lo}-${hi}`]);
    }
  });

  it('bolts sharing a cell with a far-away ship are reported only when they touch it', () => {
    const world = new CollisionWorld();
    const log = pairLog(world);
    world.add(1, AABB(8, 8), 6, 6, false, ENEMY, SHIP | SHOT);
    world.add(2, AABB(8, 8), 8, 8, false, ENEMY, SHIP | SHOT);
    world.add(3, AABB(8, 8), 50, 50, false, SHIP, ENEMY);
    world.step();
    expect(log).toEqual([]);

    // Same cell throughout: enter and exit come from moves that never relink.
    world.setPosition(1, 46, 46);
    world.step();
    expect(log).toEqual(['start 1-3']);
    world.setPosition(1, 6, 6);
    world.step();
    expect(log).toEqual(['start 1-3', 'end 1-3']);
  });
});

describe('CollisionWorld re-add reaches the broadphase (#579)', () => {
  it('a re-add that changes layer in place starts pairs its old layer could not', () => {
    const world = new CollisionWorld();
    const log = pairLog(world);
    world.add(1, AABB(20, 20), 0, 0, false, ENEMY, SHIP);
    world.add(2, AABB(20, 20), 5, 0, false, ENEMY, SHIP);
    world.add(3, AABB(20, 20), 0, 5, false, ENEMY, SHIP);
    world.step();
    expect(log).toEqual([]);

    // Same position, same cells: only the layer changes.
    world.add(2, AABB(20, 20), 5, 0, false, SHIP, 0);
    world.step();
    expect(log).toEqual(['start 1-2', 'start 2-3']);
  });

  it('a re-add that changes mask in place starts and ends pairs', () => {
    const world = new CollisionWorld();
    const log = pairLog(world);
    world.add(1, AABB(20, 20), 0, 0, false, 1, 0);
    world.add(2, AABB(20, 20), 5, 0, false, 2, 0);
    world.step();
    expect(log).toEqual([]);

    world.add(1, AABB(20, 20), 0, 0, false, 1, 2);
    world.step();
    expect(log).toEqual(['start 1-2']);

    world.add(1, AABB(20, 20), 0, 0, false, 1, 0);
    world.step();
    expect(log).toEqual(['start 1-2', 'end 1-2']);
  });

  it('a re-add that changes the shape in place changes what it overlaps', () => {
    const world = new CollisionWorld();
    const log = pairLog(world);
    world.add(1, AABB(4, 4), 10, 10);
    world.add(2, AABB(4, 4), 30, 10);
    world.step();
    expect(log).toEqual([]);

    world.add(1, CircleShape(25), 10, 10);
    world.step();
    expect(log).toEqual(['start 1-2']);

    // Grown across cell boundaries: found from cells it did not occupy before.
    world.add(3, AABB(4, 4), 150, 150);
    world.add(1, AABB(400, 400), 10, 10);
    world.step();
    expect(log).toEqual(['start 1-2', 'start 1-3']);

    world.add(1, AABB(4, 4), 10, 10);
    world.step();
    expect(log).toEqual(['start 1-2', 'start 1-3', 'end 1-2', 'end 1-3']);
  });

  it('removing the only body others could hit, then adding it back, still pairs', () => {
    const world = new CollisionWorld();
    const log = pairLog(world);
    world.add(1, AABB(8, 8), 10, 10, false, ENEMY, SHIP);
    world.add(2, AABB(8, 8), 12, 12, false, ENEMY, SHIP);
    world.add(3, AABB(8, 8), 11, 11, false, SHIP, ENEMY);
    world.step();
    expect(log).toEqual(['start 1-3', 'start 2-3']);

    world.remove(3);
    expect(log.slice(2).sort()).toEqual(['end 1-3', 'end 2-3']);
    world.step();
    world.step();
    expect(log.length).toBe(4);

    world.add(3, AABB(8, 8), 11, 11, false, SHIP, ENEMY);
    world.step();
    expect(log.slice(4)).toEqual(['start 1-3', 'start 2-3']);
    expect(world.broadphaseSize).toBe(3);
  });

  it('a body parked at a non-finite position pairs again once it is back', () => {
    const world = new CollisionWorld();
    const log = pairLog(world);
    world.add(1, AABB(20, 20), 0, 0);
    world.add(2, AABB(20, 20), 5, 0);
    world.step();
    expect(log).toEqual(['start 1-2']);

    world.setPosition(2, Number.NaN, 0);
    world.step();
    world.setPosition(2, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY);
    world.step();
    expect(log).toEqual(['start 1-2', 'end 1-2']);

    world.setPosition(2, 5, 0);
    world.step();
    expect(log).toEqual(['start 1-2', 'end 1-2', 'start 1-2']);
  });
});

describe('CollisionWorld against a brute-force pair check (#579)', () => {
  type Body = {
    shape: Shape;
    x: number;
    y: number;
    isTrigger: boolean;
    layer: number;
    mask: number;
  };

  function rng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // What a step must report: layer/mask in either direction, bounding boxes
  // strictly overlapping, and the narrowphase agreeing.
  function expectedPairs(model: Map<number, Body>): string[] {
    const ids = [...model.keys()].sort((a, b) => a - b);
    const out: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = model.get(ids[i]!)!;
        const b = model.get(ids[j]!)!;
        if ((a.layer & b.mask) === 0 && (b.layer & a.mask) === 0) continue;
        const ra = shapeBounds(a.shape, a.x, a.y);
        const rb = shapeBounds(b.shape, b.x, b.y);
        const boxes =
          ra.x + ra.width > rb.x &&
          ra.x < rb.x + rb.width &&
          ra.y + ra.height > rb.y &&
          ra.y < rb.y + rb.height;
        if (!boxes) continue;
        if (!shapeOverlap(a.shape, a.x, a.y, b.shape, b.x, b.y)) continue;
        out.push(`${ids[i]}-${ids[j]}`);
      }
    }
    return out.sort();
  }

  function run(seed: number, field: number, layers: readonly number[]): void {
    const next = rng(seed);
    const pick = <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]!;
    const masks = [0, ...layers, layers[0]! | layers[1]!, 0xffffffff];

    const world = new CollisionWorld();
    const model = new Map<number, Body>();
    const open = new Map<string, 'trigger' | 'collision'>();
    const problems: string[] = [];
    const opened = (family: 'trigger' | 'collision') => (p: CollisionPair) => {
      const key = `${p.entityA}-${p.entityB}`;
      if (p.entityA >= p.entityB) problems.push(`unordered pair ${key}`);
      if (open.has(key)) problems.push(`${key} started twice`);
      open.set(key, family);
    };
    const closed = (family: 'trigger' | 'collision') => (p: CollisionPair) => {
      const key = `${p.entityA}-${p.entityB}`;
      if (open.get(key) !== family) problems.push(`${key} ended as ${family} without that start`);
      open.delete(key);
    };
    world.onCollisionStart.add(opened('collision'));
    world.onTriggerEnter.add(opened('trigger'));
    world.onCollisionEnd.add(closed('collision'));
    world.onTriggerExit.add(closed('trigger'));

    const randomBody = (): Body => {
      const roll = next();
      const shape =
        roll < 0.6
          ? AABB(2 + next() * 20, 2 + next() * 20)
          : roll < 0.9
            ? CircleShape(1 + next() * 12)
            : AABB(60 + next() * 120, 60 + next() * 120);
      return {
        shape,
        x: next() * field - field / 2,
        y: next() * field - field / 2,
        isTrigger: next() < 0.2,
        layer: pick(layers),
        mask: pick(masks),
      };
    };
    const put = (id: number, body: Body) => {
      world.add(id, body.shape, body.x, body.y, body.isTrigger, body.layer, body.mask);
      model.set(id, body);
    };

    const IDS = 90;
    for (let id = 1; id <= 60; id++) put(id, randomBody());

    for (let frame = 0; frame < 250; frame++) {
      // Small moves, as a frame makes: most stay in the cells they were in.
      for (const [id, body] of model) {
        if (next() < 0.2) continue;
        const far = next() < 0.03;
        body.x += far ? next() * 300 - 150 : next() * 8 - 4;
        body.y += far ? next() * 300 - 150 : next() * 8 - 4;
        world.setPosition(id, body.x, body.y);
      }
      for (let k = 0; k < 4; k++) {
        const id = 1 + Math.floor(next() * IDS);
        const roll = next();
        const current = model.get(id);
        if (roll < 0.35) {
          world.remove(id);
          model.delete(id);
        } else if (roll < 0.6 || current === undefined) {
          put(id, randomBody());
        } else {
          // Re-add in place: same position, new layer, mask, trigger flag or shape.
          const fresh = randomBody();
          put(id, { ...fresh, x: current.x, y: current.y });
        }
      }

      world.step();
      expect([...open.keys()].sort()).toEqual(expectedPairs(model));
      for (const [key, family] of open) {
        const [lo, hi] = key.split('-').map(Number) as [number, number];
        const trigger = model.get(lo)!.isTrigger || model.get(hi)!.isTrigger;
        if ((family === 'trigger') !== trigger) problems.push(`${key} is open as ${family}`);
      }
      expect(problems).toEqual([]);
      expect(world.size).toBe(model.size);
      expect(world.broadphaseSize).toBe(model.size);
    }
  }

  it('a crowded field of three layers', () => {
    run(0xc0ffee, 220, [SHIP, SHOT, ENEMY]);
  });

  it('a sparse field spanning many cells', () => {
    run(0xbadc0de, 1200, [SHIP, SHOT, ENEMY]);
  });

  it('layers above bit 30', () => {
    run(0xfeed, 220, [0x80000000, 0x40000000, 1]);
  });

  it('a bullet curtain: enemy bodies that never pair with each other', () => {
    const next = rng(0xb017);
    const world = new CollisionWorld();
    const model = new Map<number, Body>();
    const open = new Set<string>();
    world.onCollisionStart.add((p) => open.add(`${p.entityA}-${p.entityB}`));
    world.onCollisionEnd.add((p) => open.delete(`${p.entityA}-${p.entityB}`));

    const put = (id: number, shape: Shape, layer: number, mask: number) => {
      const body = { shape, x: next() * 192, y: next() * 256, isTrigger: false, layer, mask };
      model.set(id, body);
      world.add(id, shape, body.x, body.y, false, layer, mask);
    };
    // The ship and the shots get ids below, between and above the bolts.
    put(1, AABB(24, 24), SHIP, ENEMY);
    for (let id = 2; id <= 300; id++) {
      if (id % 30 === 0) put(id, AABB(4, 12), SHOT, ENEMY);
      else put(id, AABB(8, 8), ENEMY, SHIP | SHOT);
    }
    put(301, AABB(4, 12), SHOT, ENEMY);

    let seen = 0;
    for (let frame = 0; frame < 200; frame++) {
      for (const [id, body] of model) {
        body.y += body.layer === SHOT ? -6 : body.layer === ENEMY ? 1 + (id % 3) : 0;
        body.x += body.layer === SHIP ? 2 : 0;
        if (body.y < 0) body.y += 256;
        else if (body.y >= 256) body.y -= 256;
        if (body.x >= 192) body.x -= 192;
        world.setPosition(id, body.x, body.y);
      }
      world.step();
      const want = expectedPairs(model);
      expect([...open].sort()).toEqual(want);
      seen += want.length;
    }
    expect(seen).toBeGreaterThan(200);
  });
});
