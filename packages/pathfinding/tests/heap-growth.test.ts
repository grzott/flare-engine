import { describe, expect, test } from 'bun:test';
import { findPath } from '../src/astar.js';
import { findPathJPS } from '../src/jps.js';

/**
 * OSS-B18 — the open-set heap was allocated at `min(total, 4096)` and never
 * grew, while `heapPush` incremented `size` and wrote unconditionally.
 *
 * A typed array does not throw on an out-of-range write; the store is silently
 * dropped. So past 4096 entries the heap kept counting, wrote nothing, and every
 * later comparison read `undefined`. **Nothing crashed and no NaN reached the
 * caller** — the search simply lost its ordering guarantee and returned a
 * valid-looking, contiguous, but non-optimal path. That is why these tests
 * assert on *cost* rather than on validity: validity never broke.
 *
 * Both fixtures are deterministic (weights from a fixed hash) and sized from a
 * measurement, not a guess: cost diverges precisely when the true peak heap size
 * crosses 4096. Measured peaks for the A* fixture — 512: 2623, 640: 4843,
 * 768: 3132, 896: 3866 — and the returned cost differs from optimal at exactly
 * the sizes that exceed the cap.
 */

function hashWeights(n: number, modulo: number): Uint8Array {
  const d = new Uint8Array(n * n);
  for (let i = 0; i < d.length; i++) d[i] = 1 + (((i * 2654435761) >>> 0) % modulo);
  return d;
}

describe('open-set heap growth (B18)', () => {
  test('A* stays optimal when the open set exceeds the old 4096 cap', () => {
    const n = 640; // true peak heap 4843 — over the cap
    const data = hashWeights(n, 200);
    const result = findPath({ width: n, height: n, data }, 0, 0, n - 1, n - 1, {
      heuristic: () => 0, // zero heuristic ⇒ Dijkstra ⇒ the result is the optimum
    });
    expect(result).not.toBeNull();

    let cost = 0;
    for (let i = 1; i < result!.path.length; i++) {
      const p = result!.path[i]!;
      cost += data[p.y * n + p.x]!;
    }
    // 20706 is the Dijkstra optimum. The unfixed heap returned 21201 — a
    // silently worse path, with no error and no NaN.
    expect(cost).toBe(20706);
  });

  test('JPS stays optimal when the open set exceeds the old 4096 cap', () => {
    const n = 2048; // true peak heap 6258 — over the cap
    const data = new Uint8Array(n * n).fill(1);
    for (let i = 0; i < data.length; i++) if (((i * 2654435761) >>> 0) % 5 === 0) data[i] = 0;
    data[0] = 1;
    data[n * n - 1] = 1;

    const result = findPathJPS({ width: n, height: n, data }, 0, 0, n - 1, n - 1);
    expect(result).not.toBeNull();
    // Unfixed: 3064.1874 over 2337 nodes. Fixed: the shorter route below.
    expect(result!.cost).toBeCloseTo(3055.9864, 3);
  });

  test('the returned path is contiguous and finite past the cap', () => {
    const n = 640;
    const data = hashWeights(n, 200);
    const result = findPath({ width: n, height: n, data }, 0, 0, n - 1, n - 1, {
      heuristic: () => 0,
    });
    expect(result).not.toBeNull();
    const path = result!.path;
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: n - 1, y: n - 1 });
    for (let i = 0; i < path.length; i++) {
      const p = path[i]!;
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      if (i > 0) {
        const q = path[i - 1]!;
        expect(Math.abs(p.x - q.x) <= 1 && Math.abs(p.y - q.y) <= 1).toBe(true);
      }
    }
  });
});
