import { describe, expect, it } from 'bun:test';
import { createCollider } from '../src/collider.js';
import { AABB, CircleShape } from '../src/shape.js';

describe('Collider', () => {
  it('creates collider with defaults', () => {
    const c = createCollider(AABB(20, 10));
    expect(c.shape.type).toBe('aabb');
    expect(c.isTrigger).toBe(false);
    expect(c.layer).toBe(1);
    expect(c.mask).toBe(0xffffffff);
  });

  it('creates collider with custom options', () => {
    const c = createCollider(CircleShape(5), {
      isTrigger: true,
      layer: 2,
      mask: 0b0011,
    });
    expect(c.shape.type).toBe('circle');
    expect(c.isTrigger).toBe(true);
    expect(c.layer).toBe(2);
    expect(c.mask).toBe(3);
  });

  it('partial options only override specified fields', () => {
    const c = createCollider(AABB(10, 10), { isTrigger: true });
    expect(c.isTrigger).toBe(true);
    expect(c.layer).toBe(1);
    expect(c.mask).toBe(0xffffffff);
  });
});
