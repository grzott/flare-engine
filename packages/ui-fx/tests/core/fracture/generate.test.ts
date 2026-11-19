import { describe, expect, test } from 'bun:test';
import { generateFracture } from '../../../src/core/fracture/generate';
import type { FractureMesh } from '../../../src/core/fracture/types';
import type { FragmentSpec } from '../../../src/core/presets';
import { fragmentSpec, polygonArea, sumAreas, worstTurn } from '../../support/fracture';

const PATTERNS = ['grid', 'jittered-grid', 'triangles', 'radial-glass', 'cells'] as const;
/** The patterns that draw from the seed; `grid` and `cells` are fully regular. */
const SEEDED = ['jittered-grid', 'triangles', 'radial-glass'] as const;
const SEEDS = [1, 2, 3] as const;
const W = 320;
const H = 200;
// Vertices are stored as Float32, so a turn between collinear edges can read as far as one
// rounding step of a unit-length edge to the wrong side.
const TURN_TOLERANCE = 1e-6;

const spec = (over: Partial<FragmentSpec>): FragmentSpec =>
  fragmentSpec({ count: 40, cell: 8, focus: { x: 0.35, y: 0.6 }, ...over });

const expectWellFormed = (mesh: FractureMesh): void => {
  expect(mesh.count).toBeGreaterThan(0);
  expect(mesh.vertexStart).toBeInstanceOf(Uint32Array);
  expect(mesh.vertexStart.length).toBe(mesh.count + 1);
  expect(mesh.vertexStart[0]).toBe(0);
  expect(mesh.vertices).toBeInstanceOf(Float32Array);
  expect(mesh.vertices.length).toBe(mesh.vertexStart[mesh.count]! * 2);
  expect(mesh.centroids.length).toBe(mesh.count * 2);
  expect(mesh.areas.length).toBe(mesh.count);
  expect(mesh.bounds.length).toBe(mesh.count * 4);
  for (let i = 0; i < mesh.count; i++) {
    expect(mesh.vertexStart[i + 1]! - mesh.vertexStart[i]!).toBeGreaterThanOrEqual(3);
  }
};

const expectInUnitSquare = (mesh: FractureMesh): void => {
  for (let i = 0; i < mesh.vertices.length; i++) {
    expect(mesh.vertices[i]!).toBeGreaterThanOrEqual(0);
    expect(mesh.vertices[i]!).toBeLessThanOrEqual(1);
  }
};

for (const pattern of PATTERNS) {
  describe(`${pattern} invariants`, () => {
    for (const seed of SEEDS) {
      test(`seed ${seed}, gap 0: the pieces tile the unit square`, () => {
        const mesh = generateFracture(spec({ pattern, seed }), W, H);
        expectWellFormed(mesh);
        expect(Math.abs(sumAreas(mesh) - 1)).toBeLessThan(1e-6);
        expect(worstTurn(mesh)).toBeLessThan(TURN_TOLERANCE);
        expectInUnitSquare(mesh);
      });

      test(`seed ${seed}, gap 4: the pieces shrink and stay convex`, () => {
        const mesh = generateFracture(spec({ pattern, seed, gap: 4 }), W, H);
        expectWellFormed(mesh);
        expect(sumAreas(mesh)).toBeLessThan(1);
        expect(sumAreas(mesh)).toBeGreaterThan(0);
        expect(worstTurn(mesh)).toBeLessThan(TURN_TOLERANCE);
        expectInUnitSquare(mesh);
      });

      test(`seed ${seed}, full jitter: the pieces still tile and stay convex`, () => {
        const mesh = generateFracture(spec({ pattern, seed, jitter: 1 }), W, H);
        expect(Math.abs(sumAreas(mesh) - 1)).toBeLessThan(1e-6);
        expect(worstTurn(mesh)).toBeLessThan(TURN_TOLERANCE);
        expectInUnitSquare(mesh);
      });

      test(`seed ${seed}: the same seed gives identical vertices`, () => {
        const a = generateFracture(spec({ pattern, seed }), W, H);
        const b = generateFracture(spec({ pattern, seed }), W, H);
        expect(b).not.toBe(a);
        expect(Array.from(b.vertexStart)).toEqual(Array.from(a.vertexStart));
        expect(Array.from(b.vertices)).toEqual(Array.from(a.vertices));
      });
    }

    test('areas, centroids and bounds describe the stored vertices', () => {
      for (const gap of [0, 4]) {
        const mesh = generateFracture(spec({ pattern, seed: 2, gap }), W, H);
        for (let i = 0; i < mesh.count; i++) {
          expect(Math.abs(mesh.areas[i]! - polygonArea(mesh, i))).toBeLessThan(1e-7);
          const minX = mesh.bounds[i * 4]!;
          const minY = mesh.bounds[i * 4 + 1]!;
          const maxX = mesh.bounds[i * 4 + 2]!;
          const maxY = mesh.bounds[i * 4 + 3]!;
          let seenMinX = 1;
          let seenMinY = 1;
          let seenMaxX = 0;
          let seenMaxY = 0;
          for (let v = mesh.vertexStart[i]!; v < mesh.vertexStart[i + 1]!; v++) {
            seenMinX = Math.min(seenMinX, mesh.vertices[v * 2]!);
            seenMaxX = Math.max(seenMaxX, mesh.vertices[v * 2]!);
            seenMinY = Math.min(seenMinY, mesh.vertices[v * 2 + 1]!);
            seenMaxY = Math.max(seenMaxY, mesh.vertices[v * 2 + 1]!);
          }
          expect([minX, minY, maxX, maxY]).toEqual([seenMinX, seenMinY, seenMaxX, seenMaxY]);
          expect(mesh.centroids[i * 2]!).toBeGreaterThanOrEqual(minX);
          expect(mesh.centroids[i * 2]!).toBeLessThanOrEqual(maxX);
          expect(mesh.centroids[i * 2 + 1]!).toBeGreaterThanOrEqual(minY);
          expect(mesh.centroids[i * 2 + 1]!).toBeLessThanOrEqual(maxY);
        }
      }
    });
  });
}

describe('seeds', () => {
  for (const pattern of SEEDED) {
    test(`${pattern}: a different seed moves at least one vertex`, () => {
      for (const [a, b] of [
        [1, 2],
        [2, 3],
        [1, 3],
      ] as const) {
        const first = generateFracture(spec({ pattern, seed: a }), W, H);
        const second = generateFracture(spec({ pattern, seed: b }), W, H);
        expect(Array.from(second.vertices)).not.toEqual(Array.from(first.vertices));
      }
    });
  }

  test('grid and cells are regular, so the seed does not change them', () => {
    for (const pattern of ['grid', 'cells'] as const) {
      const first = generateFracture(spec({ pattern, seed: 1 }), W, H);
      const second = generateFracture(spec({ pattern, seed: 2 }), W, H);
      expect(Array.from(second.vertices)).toEqual(Array.from(first.vertices));
    }
  });
});

describe('grid', () => {
  test('count 12 on a 2:1 element gives 12 rectangular pieces, 6 by 2', () => {
    const mesh = generateFracture(fragmentSpec({ pattern: 'grid', count: 12 }), 400, 200);
    expect(mesh.count).toBe(12);
    expect(mesh.rectangular).toBe(true);
    for (let i = 0; i < 12; i++) {
      expect(mesh.vertexStart[i + 1]! - mesh.vertexStart[i]!).toBe(4);
      expect(mesh.bounds[i * 4 + 2]! - mesh.bounds[i * 4]!).toBeCloseTo(1 / 6, 6);
      expect(mesh.bounds[i * 4 + 3]! - mesh.bounds[i * 4 + 1]!).toBeCloseTo(1 / 2, 6);
      expect(mesh.areas[i]!).toBeCloseTo(1 / 12, 6);
    }
  });

  test('never gives more pieces than count', () => {
    for (const count of [2, 3, 7, 40, 97, 300]) {
      for (const [w, h] of [
        [100, 100],
        [300, 100],
        [100, 700],
      ] as const) {
        const mesh = generateFracture(fragmentSpec({ pattern: 'grid', count }), w, h);
        expect(mesh.count).toBeLessThanOrEqual(count);
        expect(mesh.count).toBeGreaterThan(count / 2);
      }
    }
  });

  test('a gap of 4 px leaves exactly 4 px between neighbouring rectangles', () => {
    const mesh = generateFracture(fragmentSpec({ pattern: 'grid', count: 12, gap: 4 }), 400, 200);
    expect(mesh.rectangular).toBe(true);
    // Piece 0 and piece 1 sit side by side on the first row.
    const rightOfFirst = mesh.bounds[2]! * 400;
    const leftOfSecond = mesh.bounds[4]! * 400;
    expect(leftOfSecond - rightOfFirst).toBeCloseTo(4, 3);
    expect(mesh.bounds[0]! * 400).toBeCloseTo(2, 3);
    expect(mesh.bounds[1]! * 200).toBeCloseTo(2, 3);
  });
});

describe('jittered-grid and triangles', () => {
  test('only grid and cells report rectangular pieces', () => {
    for (const pattern of PATTERNS) {
      const mesh = generateFracture(spec({ pattern }), W, H);
      expect(mesh.rectangular).toBe(pattern === 'grid' || pattern === 'cells');
    }
  });

  test('jittered-grid keeps border points on the edge and moves interior ones', () => {
    const regular = generateFracture(spec({ pattern: 'grid' }), W, H);
    const jittered = generateFracture(spec({ pattern: 'jittered-grid', jitter: 1 }), W, H);
    expect(jittered.count).toBe(regular.count);
    let moved = 0;
    for (let i = 0; i < regular.vertices.length; i += 2) {
      const x = regular.vertices[i]!;
      const y = regular.vertices[i + 1]!;
      const onBorder = x === 0 || x === 1 || y === 0 || y === 1;
      if (onBorder) {
        expect(jittered.vertices[i]).toBe(x);
        expect(jittered.vertices[i + 1]).toBe(y);
      } else if (jittered.vertices[i] !== x || jittered.vertices[i + 1] !== y) {
        moved++;
      }
    }
    expect(moved).toBeGreaterThan(0);
  });

  test('jitter 0 leaves the jittered grid regular', () => {
    const regular = generateFracture(spec({ pattern: 'grid' }), W, H);
    const still = generateFracture(spec({ pattern: 'jittered-grid', jitter: 0 }), W, H);
    expect(Array.from(still.vertices)).toEqual(Array.from(regular.vertices));
  });

  test('triangles gives two triangles per quad and at most count pieces', () => {
    const mesh = generateFracture(spec({ pattern: 'triangles', count: 40 }), W, H);
    expect(mesh.count % 2).toBe(0);
    expect(mesh.count).toBeLessThanOrEqual(40);
    for (let i = 0; i < mesh.count; i++) {
      expect(mesh.vertexStart[i + 1]! - mesh.vertexStart[i]!).toBe(3);
    }
  });
});

describe('radial-glass', () => {
  test('pieces near the focus are smaller than pieces far from it', () => {
    for (const seed of SEEDS) {
      const mesh = generateFracture(
        fragmentSpec({ pattern: 'radial-glass', count: 40, focus: { x: 0.2, y: 0.5 }, seed }),
        W,
        H,
      );
      const byDistance = Array.from({ length: mesh.count }, (_, i) => ({
        area: mesh.areas[i]!,
        distance: Math.hypot(
          (mesh.centroids[i * 2]! - 0.2) * W,
          (mesh.centroids[i * 2 + 1]! - 0.5) * H,
        ),
      })).sort((a, b) => a.distance - b.distance);
      const quarter = Math.floor(mesh.count / 4);
      expect(quarter).toBeGreaterThan(0);
      const mean = (items: readonly { area: number }[]): number =>
        items.reduce((sum, item) => sum + item.area, 0) / items.length;
      expect(mean(byDistance.slice(0, quarter))).toBeLessThan(mean(byDistance.slice(-quarter)));
    }
  });

  test('gives at most count pieces from 8 rays up, and no empty ones', () => {
    for (const count of [8, 40, 150, 300]) {
      const mesh = generateFracture(fragmentSpec({ pattern: 'radial-glass', count }), W, H);
      expect(mesh.count).toBeLessThanOrEqual(count);
      expect(mesh.count).toBeGreaterThanOrEqual(8);
      for (let i = 0; i < mesh.count; i++) expect(mesh.areas[i]!).toBeGreaterThan(0);
    }
  });

  test("'press' and 'center' both break around the centre", () => {
    const press = generateFracture(fragmentSpec({ pattern: 'radial-glass', focus: 'press' }), W, H);
    const center = generateFracture(
      fragmentSpec({ pattern: 'radial-glass', focus: 'center' }),
      W,
      H,
    );
    const explicit = generateFracture(
      fragmentSpec({ pattern: 'radial-glass', focus: { x: 0.5, y: 0.5 } }),
      W,
      H,
    );
    expect(Array.from(press.vertices)).toEqual(Array.from(center.vertices));
    expect(Array.from(explicit.vertices)).toEqual(Array.from(center.vertices));
  });

  test('a focus outside the element still tiles it', () => {
    const mesh = generateFracture(
      fragmentSpec({ pattern: 'radial-glass', focus: { x: -0.4, y: 1.3 } }),
      W,
      H,
    );
    expect(Math.abs(sumAreas(mesh) - 1)).toBeLessThan(1e-6);
    expect(worstTurn(mesh)).toBeLessThan(TURN_TOLERANCE);
  });

  test('tiles tall and wide elements', () => {
    for (const [w, h] of [
      [1080, 1920],
      [1080, 192],
      [40, 900],
    ] as const) {
      for (const count of [40, 300]) {
        const mesh = generateFracture(fragmentSpec({ pattern: 'radial-glass', count }), w, h);
        expect(Math.abs(sumAreas(mesh) - 1)).toBeLessThan(1e-6);
        expect(worstTurn(mesh)).toBeLessThan(TURN_TOLERANCE);
      }
    }
  });
});

describe('cells', () => {
  test('cuts the element into cell-sized rectangles', () => {
    const mesh = generateFracture(fragmentSpec({ pattern: 'cells', cell: 8 }), 320, 200);
    expect(mesh.count).toBe(40 * 25);
    expect(mesh.rectangular).toBe(true);
    expect((mesh.bounds[2]! - mesh.bounds[0]!) * 320).toBeCloseTo(8, 4);
    expect((mesh.bounds[3]! - mesh.bounds[1]!) * 200).toBeCloseTo(8, 4);
  });

  test('a 360x64 element at 3x with cell 4 stays within 3,000 cells', () => {
    const mesh = generateFracture(fragmentSpec({ pattern: 'cells', cell: 4 }), 360 * 3, 64 * 3);
    expect(mesh.count).toBeLessThanOrEqual(3000);
    expect(mesh.count).toBeGreaterThan(1500);
    expect(Math.abs(sumAreas(mesh) - 1)).toBeLessThan(1e-6);
  });
});

describe('generateFracture arguments', () => {
  test('rejects a size that is not positive and finite', () => {
    for (const [w, h] of [
      [0, 100],
      [100, 0],
      [-1, 100],
      [Number.NaN, 100],
      [100, Number.POSITIVE_INFINITY],
    ] as const) {
      expect(() => generateFracture(fragmentSpec(), w, h)).toThrow(RangeError);
    }
  });
});
