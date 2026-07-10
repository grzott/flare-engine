import { describe, expect, it } from 'bun:test';
import type { Drawable } from '../src/draw-order.js';
import { drawOrderCompare, sortByDrawOrder } from '../src/draw-order.js';

describe('DrawOrder', () => {
  describe('sortByDrawOrder', () => {
    it('sorts by z ascending', () => {
      const items: Drawable[] = [{ z: 3 }, { z: 1 }, { z: 2 }];
      sortByDrawOrder(items);
      expect(items.map((i) => i.z)).toEqual([1, 2, 3]);
    });

    it('handles empty array', () => {
      const items: Drawable[] = [];
      sortByDrawOrder(items);
      expect(items).toEqual([]);
    });

    it('handles single element', () => {
      const items: Drawable[] = [{ z: 5 }];
      sortByDrawOrder(items);
      expect(items[0]?.z).toBe(5);
    });

    it('handles already sorted array', () => {
      const items: Drawable[] = [{ z: 0 }, { z: 1 }, { z: 2 }];
      sortByDrawOrder(items);
      expect(items.map((i) => i.z)).toEqual([0, 1, 2]);
    });

    it('handles negative z values', () => {
      const items: Drawable[] = [{ z: 0 }, { z: -5 }, { z: 10 }];
      sortByDrawOrder(items);
      expect(items.map((i) => i.z)).toEqual([-5, 0, 10]);
    });

    it('handles equal z values (stable)', () => {
      const a = { z: 1, id: 'a' };
      const b = { z: 1, id: 'b' };
      const c = { z: 0, id: 'c' };
      const items = [a, b, c];
      sortByDrawOrder(items);
      // c should be first, then a and b in original relative order
      expect(items[0]).toBe(c);
      expect(items[1]).toBe(a);
      expect(items[2]).toBe(b);
    });

    it('mutates and returns same array', () => {
      const items: Drawable[] = [{ z: 2 }, { z: 1 }];
      const result = sortByDrawOrder(items);
      expect(result).toBe(items);
    });
  });

  describe('drawOrderCompare', () => {
    it('returns negative when a < b', () => {
      expect(drawOrderCompare({ z: 1 }, { z: 2 })).toBeLessThan(0);
    });

    it('returns positive when a > b', () => {
      expect(drawOrderCompare({ z: 5 }, { z: 3 })).toBeGreaterThan(0);
    });

    it('returns 0 when equal', () => {
      expect(drawOrderCompare({ z: 4 }, { z: 4 })).toBe(0);
    });
  });
});
