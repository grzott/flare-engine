import { describe, expect, it } from 'bun:test';
import { AABB, CircleShape, shapeBounds, shapeOverlap } from '../src/shape.js';

describe('Shape', () => {
  describe('AABB factory', () => {
    it('creates aabb with half-extents', () => {
      const s = AABB(20, 10);
      expect(s.type).toBe('aabb');
      expect(s.hw).toBe(10);
      expect(s.hh).toBe(5);
    });
  });

  describe('CircleShape factory', () => {
    it('creates circle shape', () => {
      const s = CircleShape(15);
      expect(s.type).toBe('circle');
      expect(s.radius).toBe(15);
    });
  });

  describe('shapeBounds', () => {
    it('returns bounds for AABB', () => {
      const b = shapeBounds(AABB(20, 10), 50, 30);
      expect(b).toEqual({ x: 40, y: 25, width: 20, height: 10 });
    });

    it('returns bounds for circle', () => {
      const b = shapeBounds(CircleShape(10), 50, 30);
      expect(b).toEqual({ x: 40, y: 20, width: 20, height: 20 });
    });
  });

  describe('shapeOverlap', () => {
    it('detects AABB vs AABB overlap', () => {
      const a = AABB(20, 20);
      const b = AABB(20, 20);
      expect(shapeOverlap(a, 0, 0, b, 15, 0)).toBe(true);
      expect(shapeOverlap(a, 0, 0, b, 25, 0)).toBe(false);
    });

    it('detects circle vs circle overlap', () => {
      const a = CircleShape(10);
      const b = CircleShape(10);
      expect(shapeOverlap(a, 0, 0, b, 15, 0)).toBe(true);
      expect(shapeOverlap(a, 0, 0, b, 21, 0)).toBe(false);
    });

    it('detects AABB vs circle overlap', () => {
      const box = AABB(20, 20);
      const circle = CircleShape(5);
      expect(shapeOverlap(box, 0, 0, circle, 14, 0)).toBe(true);
      expect(shapeOverlap(box, 0, 0, circle, 16, 0)).toBe(false);
    });

    it('detects circle vs AABB overlap (reversed order)', () => {
      const box = AABB(20, 20);
      const circle = CircleShape(5);
      expect(shapeOverlap(circle, 14, 0, box, 0, 0)).toBe(true);
      expect(shapeOverlap(circle, 16, 0, box, 0, 0)).toBe(false);
    });

    it('handles exact touching AABB (not overlapping)', () => {
      const a = AABB(10, 10);
      const b = AABB(10, 10);
      // touching at edge: distance = 5+5 = 10, abs diff = 10 — not less than, so no overlap
      expect(shapeOverlap(a, 0, 0, b, 10, 0)).toBe(false);
    });

    it('handles zero-size shape', () => {
      const a = AABB(0, 0);
      const b = AABB(10, 10);
      // point at origin always within the half-extents of b centered at origin
      expect(shapeOverlap(a, 0, 0, b, 0, 0)).toBe(true);
    });
  });
});
