import { describe, expect, it } from 'bun:test';
import { type RaycastHit, type RaycastTarget, raycast, rayVsShapeInto } from '../src/raycast.js';
import { AABB, CircleShape } from '../src/shape.js';

describe('raycast', () => {
  it('hits an AABB dead-on', () => {
    const targets: RaycastTarget[] = [{ entity: 1, shape: AABB(10, 10), x: 20, y: 0 }];
    const hit = raycast(0, 0, 1, 0, 100, targets);
    expect(hit).not.toBeNull();
    expect(hit!.entity).toBe(1);
    expect(hit!.distance).toBeCloseTo(15, 5);
    expect(hit!.normal.x).toBe(-1);
    expect(hit!.normal.y).toBe(0);
  });

  it('hits a circle', () => {
    const targets: RaycastTarget[] = [{ entity: 1, shape: CircleShape(5), x: 20, y: 0 }];
    const hit = raycast(0, 0, 1, 0, 100, targets);
    expect(hit).not.toBeNull();
    expect(hit!.entity).toBe(1);
    expect(hit!.distance).toBeCloseTo(15, 5);
    expect(hit!.normal.x).toBeCloseTo(-1, 3);
    expect(hit!.normal.y).toBeCloseTo(0, 3);
  });

  it('returns null when no hit', () => {
    const targets: RaycastTarget[] = [{ entity: 1, shape: AABB(10, 10), x: 20, y: 50 }];
    const hit = raycast(0, 0, 1, 0, 100, targets);
    expect(hit).toBeNull();
  });

  it('returns null when target is beyond maxDist', () => {
    const targets: RaycastTarget[] = [{ entity: 1, shape: AABB(10, 10), x: 200, y: 0 }];
    const hit = raycast(0, 0, 1, 0, 50, targets);
    expect(hit).toBeNull();
  });

  it('returns closest hit among multiple targets', () => {
    const targets: RaycastTarget[] = [
      { entity: 1, shape: AABB(10, 10), x: 30, y: 0 },
      { entity: 2, shape: AABB(10, 10), x: 15, y: 0 },
    ];
    const hit = raycast(0, 0, 1, 0, 100, targets);
    expect(hit).not.toBeNull();
    expect(hit!.entity).toBe(2);
  });

  it('returns null for empty targets', () => {
    const hit = raycast(0, 0, 1, 0, 100, []);
    expect(hit).toBeNull();
  });

  it('returns null when ray points away from target', () => {
    const targets: RaycastTarget[] = [{ entity: 1, shape: AABB(10, 10), x: 20, y: 0 }];
    const hit = raycast(0, 0, -1, 0, 100, targets);
    expect(hit).toBeNull();
  });

  it('hits AABB from top', () => {
    const targets: RaycastTarget[] = [{ entity: 1, shape: AABB(10, 10), x: 0, y: 20 }];
    const hit = raycast(0, 0, 0, 1, 100, targets);
    expect(hit).not.toBeNull();
    expect(hit!.entity).toBe(1);
    expect(hit!.normal.x).toBe(0);
    expect(hit!.normal.y).toBe(-1);
  });

  it('handles ray starting inside AABB', () => {
    const targets: RaycastTarget[] = [{ entity: 1, shape: AABB(20, 20), x: 0, y: 0 }];
    const hit = raycast(0, 0, 1, 0, 100, targets);
    // Should hit the exit face
    expect(hit).not.toBeNull();
    expect(hit!.distance).toBeCloseTo(10, 5);
  });

  it('handles ray starting inside circle', () => {
    const targets: RaycastTarget[] = [{ entity: 1, shape: CircleShape(10), x: 0, y: 0 }];
    const hit = raycast(0, 0, 1, 0, 100, targets);
    expect(hit).not.toBeNull();
    expect(hit!.distance).toBeCloseTo(10, 5);
  });
});

// The box spans x 15..25 and y 15..25.
const BOX: RaycastTarget = { entity: 1, shape: AABB(10, 10), x: 20, y: 20 };

function newHit(): RaycastHit {
  return { entity: -1, distance: -1, point: { x: -1, y: -1 }, normal: { x: -1, y: -1 } };
}

function castInto(ox: number, oy: number, dx: number, dy: number, maxDist = 100) {
  return rayVsShapeInto(ox, oy, dx, dy, maxDist, BOX.entity, BOX.shape, BOX.x, BOX.y, newHit());
}

describe('axis-parallel ray with its origin exactly on a slab edge', () => {
  // [label, ox, oy, dx, dy, distance, px, py, nx, ny]
  const grazing: [
    string,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ][] = [
    ['down the left edge', 15, 0, 0, 1, 15, 15, 15, 0, -1],
    ['down the right edge', 25, 0, 0, 1, 15, 25, 15, 0, -1],
    ['up the left edge', 15, 40, 0, -1, 15, 15, 25, 0, 1],
    ['along the top edge', 0, 15, 1, 0, 15, 15, 15, -1, 0],
    ['along the bottom edge', 0, 25, 1, 0, 15, 15, 25, -1, 0],
    ['back along the top edge', 40, 15, -1, 0, 15, 25, 15, 1, 0],
  ];

  for (const [label, ox, oy, dx, dy, distance, px, py, nx, ny] of grazing) {
    it(`raycast: ${label} is a finite hit`, () => {
      const hit = raycast(ox, oy, dx, dy, 100, [BOX]);
      expect(hit).not.toBeNull();
      expect(hit!.entity).toBe(1);
      expect(hit!.distance).toBe(distance);
      expect(hit!.point).toEqual({ x: px, y: py });
      expect(hit!.normal).toEqual({ x: nx, y: ny });
    });

    it(`rayVsShapeInto: ${label} is a finite hit`, () => {
      const hit = castInto(ox, oy, dx, dy);
      expect(hit).not.toBeNull();
      expect(hit!.entity).toBe(1);
      expect(hit!.distance).toBe(distance);
      expect(hit!.point).toEqual({ x: px, y: py });
      expect(hit!.normal).toEqual({ x: nx, y: ny });
    });
  }

  it('misses when the origin is just outside the slab', () => {
    expect(raycast(14.999, 0, 0, 1, 100, [BOX])).toBeNull();
    expect(raycast(25.001, 0, 0, 1, 100, [BOX])).toBeNull();
    expect(raycast(0, 14.999, 1, 0, 100, [BOX])).toBeNull();
    expect(raycast(0, 25.001, 1, 0, 100, [BOX])).toBeNull();
    expect(castInto(14.999, 0, 0, 1)).toBeNull();
    expect(castInto(25.001, 0, 0, 1)).toBeNull();
    expect(castInto(0, 14.999, 1, 0)).toBeNull();
    expect(castInto(0, 25.001, 1, 0)).toBeNull();
  });

  it('exits through the far face when the origin is on an edge inside the other slab', () => {
    const hit = raycast(15, 20, 0, 1, 100, [BOX]);
    expect(hit!.distance).toBe(5);
    expect(hit!.point).toEqual({ x: 15, y: 25 });
    expect(hit!.normal).toEqual({ x: 0, y: -1 });
    const into = castInto(15, 20, 0, 1);
    expect(into!.distance).toBe(5);
    expect(into!.point).toEqual({ x: 15, y: 25 });
    expect(into!.normal).toEqual({ x: 0, y: -1 });
  });

  it('a grazing target listed first does not shadow a nearer hit', () => {
    const nearer: RaycastTarget = { entity: 2, shape: AABB(10, 10), x: 15, y: 8 };
    const hit = raycast(15, 0, 0, 1, 100, [BOX, nearer]);
    expect(hit!.entity).toBe(2);
    expect(hit!.distance).toBe(3);
  });

  it('a grazing target listed later still wins when it is nearer', () => {
    const farther: RaycastTarget = { entity: 2, shape: AABB(10, 10), x: 15, y: 50 };
    const hit = raycast(15, 0, 0, 1, 100, [farther, BOX]);
    expect(hit!.entity).toBe(1);
    expect(hit!.distance).toBe(15);
  });
});

describe('zero-length direction against an AABB', () => {
  // [label, ox, oy]
  const origins: [string, number, number][] = [
    ['inside the box', 20, 20],
    ['on an edge', 15, 20],
    ['on a corner', 15, 15],
    ['outside the box', 0, 0],
  ];

  for (const [label, ox, oy] of origins) {
    it(`returns null with the origin ${label}`, () => {
      expect(raycast(ox, oy, 0, 0, 100, [BOX])).toBeNull();
      expect(raycast(ox, oy, 0, 0, Number.POSITIVE_INFINITY, [BOX])).toBeNull();
      expect(castInto(ox, oy, 0, 0)).toBeNull();
      expect(castInto(ox, oy, 0, 0, Number.POSITIVE_INFINITY)).toBeNull();
    });
  }
});
