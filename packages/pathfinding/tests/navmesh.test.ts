import { describe, expect, test } from 'bun:test';
import {
  type NavMeshPolygon,
  createNavMesh,
  findNavMeshPath,
  findPolygonAt,
} from '../src/navmesh.js';

// ─── Test helpers ────────────────────────────────────────────────

function makeSquareMesh(): NavMeshPolygon[] {
  // Two adjacent squares sharing an edge at x=5
  //
  //  Polygon 0: (0,0)-(5,0)-(5,10)-(0,10)
  //  Polygon 1: (5,0)-(10,0)-(10,10)-(5,10)
  //
  return [
    {
      id: 0,
      vertices: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 10 },
        { x: 0, y: 10 },
      ],
      neighbors: [1],
      portals: [{ neighborId: 1, a: { x: 5, y: 0 }, b: { x: 5, y: 10 } }],
    },
    {
      id: 1,
      vertices: [
        { x: 5, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 5, y: 10 },
      ],
      neighbors: [0],
      portals: [{ neighborId: 0, a: { x: 5, y: 10 }, b: { x: 5, y: 0 } }],
    },
  ];
}

function makeThreePolyMesh(): NavMeshPolygon[] {
  // Three polygons in a row:
  //  0: (0,0)-(4,0)-(4,4)-(0,4)
  //  1: (4,0)-(8,0)-(8,4)-(4,4)
  //  2: (8,0)-(12,0)-(12,4)-(8,4)
  return [
    {
      id: 0,
      vertices: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
      ],
      neighbors: [1],
      portals: [{ neighborId: 1, a: { x: 4, y: 0 }, b: { x: 4, y: 4 } }],
    },
    {
      id: 1,
      vertices: [
        { x: 4, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 4 },
        { x: 4, y: 4 },
      ],
      neighbors: [0, 2],
      portals: [
        { neighborId: 0, a: { x: 4, y: 4 }, b: { x: 4, y: 0 } },
        { neighborId: 2, a: { x: 8, y: 0 }, b: { x: 8, y: 4 } },
      ],
    },
    {
      id: 2,
      vertices: [
        { x: 8, y: 0 },
        { x: 12, y: 0 },
        { x: 12, y: 4 },
        { x: 8, y: 4 },
      ],
      neighbors: [1],
      portals: [{ neighborId: 1, a: { x: 8, y: 4 }, b: { x: 8, y: 0 } }],
    },
  ];
}

// ─── Tests ───────────────────────────────────────────────────────

describe('createNavMesh', () => {
  test('wraps polygons', () => {
    const polys = makeSquareMesh();
    const mesh = createNavMesh(polys);
    expect(mesh.polygons).toBe(polys);
  });
});

describe('findPolygonAt', () => {
  test('finds correct polygon for interior point', () => {
    const mesh = createNavMesh(makeSquareMesh());
    expect(findPolygonAt(mesh, 2, 5)).toBe(0);
    expect(findPolygonAt(mesh, 7, 5)).toBe(1);
  });

  test('returns -1 for point outside all polygons', () => {
    const mesh = createNavMesh(makeSquareMesh());
    expect(findPolygonAt(mesh, -1, 5)).toBe(-1);
    expect(findPolygonAt(mesh, 15, 5)).toBe(-1);
  });
});

describe('findNavMeshPath', () => {
  test('path within same polygon', () => {
    const mesh = createNavMesh(makeSquareMesh());
    const result = findNavMeshPath(mesh, { x: 1, y: 1 }, { x: 3, y: 8 });
    expect(result).not.toBeNull();
    expect(result!.path.length).toBe(2);
    expect(result!.path[0]).toEqual({ x: 1, y: 1 });
    expect(result!.path[1]).toEqual({ x: 3, y: 8 });
    expect(result!.corridor).toEqual([0]);
  });

  test('path across two polygons', () => {
    const mesh = createNavMesh(makeSquareMesh());
    const result = findNavMeshPath(mesh, { x: 2, y: 5 }, { x: 8, y: 5 });
    expect(result).not.toBeNull();
    expect(result!.corridor).toEqual([0, 1]);
    expect(result!.path[0]).toEqual({ x: 2, y: 5 });
    expect(result!.path[result!.path.length - 1]).toEqual({ x: 8, y: 5 });
  });

  test('path across three polygons', () => {
    const mesh = createNavMesh(makeThreePolyMesh());
    const result = findNavMeshPath(mesh, { x: 1, y: 2 }, { x: 11, y: 2 });
    expect(result).not.toBeNull();
    expect(result!.corridor).toEqual([0, 1, 2]);
    expect(result!.path[0]).toEqual({ x: 1, y: 2 });
    expect(result!.path[result!.path.length - 1]).toEqual({ x: 11, y: 2 });
  });

  test('returns null when start is outside mesh', () => {
    const mesh = createNavMesh(makeSquareMesh());
    expect(findNavMeshPath(mesh, { x: -5, y: 5 }, { x: 8, y: 5 })).toBeNull();
  });

  test('returns null when end is outside mesh', () => {
    const mesh = createNavMesh(makeSquareMesh());
    expect(findNavMeshPath(mesh, { x: 2, y: 5 }, { x: 20, y: 5 })).toBeNull();
  });

  test('returns null when polygons are disconnected', () => {
    // Two polygons with no neighbor links
    const polys: NavMeshPolygon[] = [
      {
        id: 0,
        vertices: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 4 },
          { x: 0, y: 4 },
        ],
        neighbors: [],
        portals: [],
      },
      {
        id: 1,
        vertices: [
          { x: 10, y: 0 },
          { x: 14, y: 0 },
          { x: 14, y: 4 },
          { x: 10, y: 4 },
        ],
        neighbors: [],
        portals: [],
      },
    ];
    const mesh = createNavMesh(polys);
    expect(findNavMeshPath(mesh, { x: 2, y: 2 }, { x: 12, y: 2 })).toBeNull();
  });

  test('funnel produces smooth path (no backtracking)', () => {
    const mesh = createNavMesh(makeThreePolyMesh());
    const result = findNavMeshPath(mesh, { x: 1, y: 2 }, { x: 11, y: 2 });
    expect(result).not.toBeNull();
    // Path should be monotonically increasing in x
    for (let i = 1; i < result!.path.length; i++) {
      expect(result!.path[i]!.x).toBeGreaterThanOrEqual(result!.path[i - 1]!.x);
    }
  });
});
