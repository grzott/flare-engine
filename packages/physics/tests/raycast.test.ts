import { describe, expect, it } from 'bun:test';
import { type RaycastTarget, raycast } from '../src/raycast.js';
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
