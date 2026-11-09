import { describe, expect, test } from 'bun:test';
import type { Vec2 } from '@flare-engine/math';
import { octileDistance } from '../src/astar.js';
import type { Grid } from '../src/grid.js';
import { createGrid, setWalkable } from '../src/grid.js';
import { findPathJPS } from '../src/jps.js';
import { createNavMesh, findNavMeshPath, type NavMeshPolygon } from '../src/navmesh.js';

// ─── #123 — findNavMeshPath caches the id index and centroids per mesh ───

function column(x0: number, x1: number, vertex: (x: number, y: number) => Vec2): Vec2[] {
  return [vertex(x0, 0), vertex(x1, 0), vertex(x1, 4), vertex(x0, 4)];
}

const plain = (x: number, y: number): Vec2 => ({ x, y });

/** Three 4x4 squares in a row, ids 0 | 1 | 2 from x = 0 to x = 12; `order` picks the array order. */
function rowMesh(order: readonly number[], middleVertex: (x: number, y: number) => Vec2) {
  const polys: NavMeshPolygon[] = [
    {
      id: 0,
      vertices: column(0, 4, plain),
      portals: [{ neighborId: 1, a: { x: 4, y: 0 }, b: { x: 4, y: 4 } }],
    },
    {
      id: 1,
      vertices: column(4, 8, middleVertex),
      portals: [
        { neighborId: 0, a: { x: 4, y: 4 }, b: { x: 4, y: 0 } },
        { neighborId: 2, a: { x: 8, y: 0 }, b: { x: 8, y: 4 } },
      ],
    },
    {
      id: 2,
      vertices: column(8, 12, plain),
      portals: [{ neighborId: 1, a: { x: 8, y: 4 }, b: { x: 8, y: 0 } }],
    },
  ];
  return createNavMesh(order.map((i) => polys[i]!));
}

describe('findNavMeshPath per-mesh index (#123)', () => {
  test('a repeat search reads no vertex of a route polygon that findPolygonAt never scans', () => {
    let reads = 0;
    const counted = (x: number, y: number): Vec2 => ({
      get x() {
        reads++;
        return x;
      },
      get y() {
        reads++;
        return y;
      },
    });
    // Array order start, end, middle: findPolygonAt returns for both endpoints
    // before it reaches the middle polygon, so only the search itself can read
    // its vertices (portals are separate objects).
    const mesh = rowMesh([0, 2, 1], counted);
    const start = { x: 1, y: 2 };
    const end = { x: 11, y: 2 };

    const first = findNavMeshPath(mesh, start, end);
    expect(first).not.toBeNull();
    expect(first!.corridor).toEqual([0, 1, 2]);
    // The counter is live: the first search had to read them to build its index.
    expect(reads).toBeGreaterThan(0);

    reads = 0;
    const second = findNavMeshPath(mesh, start, end);
    expect(second).toEqual(first);
    expect(reads).toBe(0);

    // Same result as the same mesh with plain vertices in natural order.
    expect(first).toEqual(findNavMeshPath(rowMesh([0, 1, 2], plain), start, end));
  });
});

// ─── #124 — JPS successors go through a fixed 8-slot buffer ──────

describe('findPathJPS successor buffer (#124)', () => {
  test('a start node with a jump point in every direction yields all eight, in direction order', () => {
    // Four blockers, each two cells from the start, give every one of the eight
    // rays a forced neighbour one step past the start's neighbourhood.
    const grid = createGrid({ width: 7, height: 7 });
    setWalkable(grid, 5, 4, false);
    setWalkable(grid, 1, 2, false);
    setWalkable(grid, 2, 5, false);
    setWalkable(grid, 4, 1, false);

    // The heuristic sees the start, then every pushed successor in push order.
    const seen: [number, number][] = [];
    const heuristic = (ax: number, ay: number, bx: number, by: number): number => {
      seen.push([ax, ay]);
      return octileDistance(ax, ay, bx, by);
    };
    const result = findPathJPS(grid, 3, 3, 6, 6, { heuristic });
    expect(result).not.toBeNull();
    expect(seen.slice(0, 9)).toEqual([
      [3, 3],
      [1, 1],
      [1, 3],
      [1, 5],
      [3, 1],
      [3, 5],
      [5, 1],
      [5, 3],
      [5, 5],
    ]);
    // The goal is reached through the last of the eight; dropping it would cost 2 + sqrt(2) more.
    expect(result!.cost).toBeCloseTo(3 * Math.SQRT2, 12);
    expect(result!.explored).toBe(2);
  });
});

// ─── #125 — the jump scan is a loop, not one frame per cell ──────

describe('findPathJPS jump scan is iterative (#125)', () => {
  // The recursive scan overflowed V8 at a 1x8192 corridor; this is 8x that.
  // Bun's JSC does proper tail calls, so it never overflowed here — the pin is
  // for engines without them (V8, Hermes).
  const N = 1 << 16;

  test(`a 1x${N} open corridor is one expansion`, () => {
    const result = findPathJPS(createGrid({ width: N, height: 1 }), 0, 0, N - 1, 0);
    expect(result).not.toBeNull();
    expect(result!.path.length).toBe(N);
    expect(result!.path[N - 1]).toEqual({ x: N - 1, y: 0 });
    expect(result!.cost).toBe(N - 1);
    expect(result!.explored).toBe(1);
  });

  test(`a ${N}x1 open corridor is one expansion`, () => {
    const result = findPathJPS(createGrid({ width: 1, height: N }), 0, 0, 0, N - 1);
    expect(result).not.toBeNull();
    expect(result!.path.length).toBe(N);
    expect(result!.path[N - 1]).toEqual({ x: 0, y: N - 1 });
    expect(result!.cost).toBe(N - 1);
    expect(result!.explored).toBe(1);
  });
});

// ─── Goldens — successor order and jump points are unchanged ─────

const N64 = 64;

function mix(i: number): number {
  let h = Math.imul(i ^ (i >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

/** 64x64, ~20% blocked, deterministic — the `scratch-reuse` fixture without the cleared endpoints. */
function hashedGrid(): Grid {
  const data = new Uint8Array(N64 * N64).fill(1);
  for (let i = 0; i < data.length; i++) if (mix(i) % 5 === 0) data[i] = 0;
  return createGrid({ width: N64, height: N64, data });
}

function hashPair(k: number): [number, number, number, number] {
  const h = mix(1000 + k);
  return [h & 63, (h >>> 6) & 63, (h >>> 12) & 63, (h >>> 18) & 63];
}

describe('findPathJPS results are unchanged by the buffer and the loop', () => {
  test('cost, explored count and path length match the recorded recursive implementation', () => {
    // [cost, explored, path.length] per pair, recorded before #124/#125; `explored`
    // is sensitive to successor order and to which cell each jump stops at.
    const recorded: ([number, number, number] | null)[] = [
      [54.669047558312116, 101, 42],
      [43.62741699796951, 138, 38],
      [55.9116882454314, 96, 42],
      [44.76955262170046, 92, 35],
      [6.82842712474619, 6, 7],
      [48.59797974644665, 72, 38],
      null,
      [13.727922061357859, 11, 11],
      [54.14213562373094, 89, 51],
      [30.627416997969526, 40, 25],
      null,
      [5.82842712474619, 4, 6],
    ];
    const grid = hashedGrid();
    for (let k = 0; k < recorded.length; k++) {
      const [sx, sy, ex, ey] = hashPair(k);
      const r = findPathJPS(grid, sx, sy, ex, ey);
      expect(r === null ? null : [r.cost, r.explored, r.path.length]).toEqual(recorded[k]!);
    }
  });
});
