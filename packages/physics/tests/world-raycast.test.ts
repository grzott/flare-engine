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

describe('CollisionWorld.raycast — unbounded maxDist (F036)', () => {
  // `maxDist = Number.POSITIVE_INFINITY` is the natural "unbounded ray" call —
  // it hangs the JS thread forever pre-fix, so it cannot be called directly.
  // Patch the broadphase's private cell map with an iteration-counter budget:
  // pre-fix this throws fast (proving the walk never bounds itself); post-fix
  // the input guard returns before the broadphase is ever touched (0 calls).
  //
  // A diagonal ray (dx=1, dy=1) is used rather than the finding's literal
  // axis-aligned example (dx=1, dy=0). Measured directly against pre-fix
  // source: an axis-aligned ray with maxDist=Infinity makes the *other* axis's
  // bound `0 * Infinity = NaN`, which collapses that axis's cell range to zero
  // width — but the ray's own axis is still a real (non-NaN) Infinity, so that
  // loop still spins forever with an empty inner body. No call inside that
  // empty body ever runs, so no counter can observe it short of a wall-clock
  // kill — confirmed by running it under an external 10s timeout, which had to
  // terminate the process. The diagonal ray makes *both* axes a real Infinity,
  // so the walk is unbounded on an axis whose loop body does run, which the
  // counter below catches safely. The fix (an unconditional `Number.isFinite`
  // guard before dx/dy are ever used) covers the axis-aligned case identically
  // — it never reaches either loop — so this test still exercises the fix.
  const BUDGET = 200_000;

  function withCellLookupBudget<TReturn>(
    world: CollisionWorld,
    fn: () => TReturn,
  ): { result: TReturn; calls: number } {
    const spatial = (world as unknown as { spatial: { _cells: Map<number, unknown[]> } }).spatial;
    const cells = spatial._cells;
    const realGet = cells.get.bind(cells);
    let calls = 0;
    cells.get = ((key: number) => {
      if (++calls > BUDGET) {
        throw new Error(`cell walk exceeded ${BUDGET} lookups without terminating`);
      }
      return realGet(key);
    }) as typeof cells.get;
    try {
      return { result: fn(), calls };
    } finally {
      cells.get = realGet;
    }
  }

  test('an infinite maxDist returns null instead of hanging the broadphase walk', () => {
    const world = new CollisionWorld();
    world.add(1, AABB(10, 10), 20, 0);

    const { result, calls } = withCellLookupBudget(world, () =>
      world.raycast(0, 0, 1, 1, Number.POSITIVE_INFINITY),
    );

    expect(calls).toBe(0); // the guard rejects before the broadphase runs at all
    expect(result).toBeNull();
  });

  test('a NaN maxDist also returns null rather than reaching the broadphase', () => {
    const world = new CollisionWorld();
    world.add(1, AABB(10, 10), 20, 0);

    const { result, calls } = withCellLookupBudget(world, () =>
      world.raycast(0, 0, 1, 0, Number.NaN),
    );

    expect(calls).toBe(0);
    expect(result).toBeNull();
  });

  test("the finding's own literal repro — an axis-aligned ray, dx=1, dy=0 — returns null, not a hang", () => {
    // Provably hang-free post-fix: the guard returns before dx/dy are read at
    // all, so the axis-aligned "NaN inner range, infinite outer range" case
    // documented above (the one that could not be safely instrumented) is not
    // reachable. A plain assertion is enough here; no budget needed.
    const world = new CollisionWorld();
    world.add(1, AABB(10, 10), 20, 0);

    expect(world.raycast(0, 0, 1, 0, Number.POSITIVE_INFINITY)).toBeNull();
  });

  test("a large-but-finite maxDist (Number.isFinite alone is not enough) still finds the correct hit, bounded by SpatialIndex's clamp", () => {
    // Number.isFinite(1e20) is true, so raycast's own guard does not fire —
    // this pins the *other* half of the fix: SpatialIndex clamps the derived
    // cell range to its packed-key extent (±32768 cells), so the walk here is
    // bounded even though maxDist is not. Without that clamp, `_cMax(1e20)`
    // alone would ask for on the order of 1.5e18 cell lookups on this axis.
    const world = new CollisionWorld();
    world.add(1, AABB(10, 10), 20, 0);

    const { result, calls } = withCellLookupBudget(world, () => world.raycast(0, 0, 1, 0, 1e20));

    expect(calls).toBeLessThan(BUDGET);
    expect(result).not.toBeNull();
    expect(result!.entity).toBe(1);
    expect(result!.distance).toBeCloseTo(15, 6); // 20 - half-width 5
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
