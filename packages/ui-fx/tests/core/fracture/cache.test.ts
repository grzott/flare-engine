import { describe, expect, test } from 'bun:test';
import { createFractureCache } from '../../../src/core/fracture/cache';
import { generateFracture } from '../../../src/core/fracture/generate';
import { fragmentSpec } from '../../support/fracture';

describe('createFractureCache', () => {
  test('the same spec and size return the identical mesh', () => {
    const cache = createFractureCache();
    const first = generateFracture(fragmentSpec({ seed: 5 }), 300, 200, cache);
    expect(generateFracture(fragmentSpec({ seed: 5 }), 300, 200, cache)).toBe(first);
  });

  test('without a cache every call builds a new mesh', () => {
    const spec = fragmentSpec();
    expect(generateFracture(spec, 300, 200)).not.toBe(generateFracture(spec, 300, 200));
  });

  test('the aspect is rounded to 2 dp: 1.004 and 1.0 share an entry', () => {
    const cache = createFractureCache();
    const spec = fragmentSpec();
    const square = generateFracture(spec, 1000, 1000, cache);
    expect(generateFracture(spec, 1004, 1000, cache)).toBe(square);
    expect(generateFracture(spec, 500, 500, cache)).toBe(square);
    expect(generateFracture(spec, 1010, 1000, cache)).not.toBe(square);
  });

  test('a mesh does not depend on which of two sizes sharing an aspect built it', () => {
    const spec = fragmentSpec();
    const fromExact = generateFracture(spec, 1000, 1000);
    const fromNear = generateFracture(spec, 1004, 1000);
    expect(Array.from(fromNear.vertices)).toEqual(Array.from(fromExact.vertices));
  });

  test('every field that shapes the mesh is part of the key', () => {
    const cache = createFractureCache();
    const base = generateFracture(fragmentSpec(), 300, 200, cache);
    for (const over of [
      { seed: 2 },
      { count: 41 },
      { jitter: 0.25 },
      { pattern: 'triangles' },
      { focus: { x: 0.2, y: 0.5 } },
      { gap: 2 },
    ] as const) {
      expect(generateFracture(fragmentSpec(over), 300, 200, cache)).not.toBe(base);
    }
  });

  test('a gap is in pixels, so sizes sharing an aspect do not share a gapped mesh', () => {
    const cache = createFractureCache();
    const spec = fragmentSpec({ gap: 4 });
    const small = generateFracture(spec, 300, 200, cache);
    expect(generateFracture(spec, 600, 400, cache)).not.toBe(small);
    expect(generateFracture(spec, 300, 200, cache)).toBe(small);
  });

  test('cells are sized in pixels, so sizes sharing an aspect do not share a cell mesh', () => {
    const cache = createFractureCache();
    const spec = fragmentSpec({ pattern: 'cells', cell: 8 });
    const small = generateFracture(spec, 160, 80, cache);
    const large = generateFracture(spec, 320, 160, cache);
    expect(large).not.toBe(small);
    expect(large.count).toBe(small.count * 4);
  });

  test('evicts the least recently used entry at capacity', () => {
    const cache = createFractureCache(2);
    const one = generateFracture(fragmentSpec({ seed: 1 }), 300, 200, cache);
    const two = generateFracture(fragmentSpec({ seed: 2 }), 300, 200, cache);
    // Reading seed 1 makes seed 2 the oldest.
    expect(generateFracture(fragmentSpec({ seed: 1 }), 300, 200, cache)).toBe(one);
    generateFracture(fragmentSpec({ seed: 3 }), 300, 200, cache);
    expect(generateFracture(fragmentSpec({ seed: 1 }), 300, 200, cache)).toBe(one);
    expect(generateFracture(fragmentSpec({ seed: 2 }), 300, 200, cache)).not.toBe(two);
  });

  test('defaults to 32 entries', () => {
    const cache = createFractureCache();
    const first = generateFracture(fragmentSpec({ seed: 0 }), 300, 200, cache);
    for (let seed = 1; seed < 32; seed++) {
      generateFracture(fragmentSpec({ seed }), 300, 200, cache);
    }
    expect(generateFracture(fragmentSpec({ seed: 0 }), 300, 200, cache)).toBe(first);
    generateFracture(fragmentSpec({ seed: 32 }), 300, 200, cache);
    // Seed 1 is now the oldest of 33, so it was evicted.
    const again = generateFracture(fragmentSpec({ seed: 0 }), 300, 200, cache);
    expect(again).toBe(first);
  });

  test('rejects a capacity that is not a positive integer', () => {
    expect(() => createFractureCache(0)).toThrow(RangeError);
    expect(() => createFractureCache(1.5)).toThrow(RangeError);
    expect(() => createFractureCache(Number.NaN)).toThrow(RangeError);
  });
});
