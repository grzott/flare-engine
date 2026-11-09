/**
 * Lightweight navmesh pathfinding for polygon-based environments.
 * Supports convex polygon navigation with A* over the polygon graph
 * and the Simple Stupid Funnel Algorithm for path smoothing.
 */

import type { Vec2 } from '@flare-engine/math';

// ─── Types ───────────────────────────────────────────────────────

export interface NavMeshPolygon {
  readonly id: number;
  /** Convex polygon vertices in winding order. */
  readonly vertices: readonly Vec2[];
  /** One `Portal` per adjacent polygon: the shared edge plus that neighbour's id. */
  readonly portals: readonly Portal[];
}

export interface Portal {
  /** Neighbor polygon id. */
  neighborId: number;
  /** Left endpoint of the shared edge (from the perspective of travel). */
  a: Vec2;
  /** Right endpoint of the shared edge. */
  b: Vec2;
}

export interface NavMesh {
  readonly polygons: readonly NavMeshPolygon[];
}

export interface NavMeshPathResult {
  /** Smoothed world-space waypoints. */
  path: Vec2[];
  /** Polygon ids traversed. */
  corridor: number[];
}

// ─── Construction ────────────────────────────────────────────────

export function createNavMesh(polygons: NavMeshPolygon[]): NavMesh {
  return { polygons };
}

// ─── Point-in-polygon ────────────────────────────────────────────

function pointInConvexPolygon(verts: readonly Vec2[], px: number, py: number): boolean {
  const n = verts.length;
  if (n < 3) return false;
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const a = verts[i]!;
    const b = verts[(i + 1) % n]!;
    const cross = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
    if (cross !== 0) {
      const s = cross > 0 ? 1 : -1;
      if (sign === 0) sign = s;
      else if (sign !== s) return false;
    }
  }
  return true;
}

export function findPolygonAt(mesh: NavMesh, x: number, y: number): number {
  for (let i = 0; i < mesh.polygons.length; i++) {
    if (pointInConvexPolygon(mesh.polygons[i]!.vertices, x, y)) {
      return mesh.polygons[i]!.id;
    }
  }
  return -1;
}

// ─── Per-mesh index ──────────────────────────────────────────────

/**
 * Id → position index plus centroid scratch, kept per mesh object in a WeakMap.
 * The mesh stays the caller's live data: a search rebuilds the index unless
 * every live polygon still sits at the position held for its id, reads polygons
 * and portals from `mesh.polygons`, and derives each centroid it needs from the
 * live vertices — once per polygon per search, marked by a generation stamp.
 */
interface MeshIndex {
  /** Position in `mesh.polygons` per polygon id; the last position wins for a duplicated id. */
  readonly pos: Map<number, number>;
  /** Centroid per position; valid for the current search only where `stamp[i] === gen`. */
  cx: Float64Array;
  cy: Float64Array;
  stamp: Uint32Array;
  /** Generation of the current search; starts at 1 so an untouched stamp (0) never matches. */
  gen: number;
}

// Stamps are Uint32; past this the generation wraps and every stamp is cleared.
const MAX_GEN = 0xffffffff;

const indices = new WeakMap<NavMesh, MeshIndex>();

/** True when `pos` is exactly the id → position map of the live polygon list. */
function isCurrent(index: MeshIndex, polygons: readonly NavMeshPolygon[]): boolean {
  if (index.pos.size !== polygons.length) return false;
  for (let i = 0; i < polygons.length; i++) {
    if (index.pos.get(polygons[i]!.id) !== i) return false;
  }
  return true;
}

function rebuild(index: MeshIndex, polygons: readonly NavMeshPolygon[]): void {
  index.pos.clear();
  for (let i = 0; i < polygons.length; i++) index.pos.set(polygons[i]!.id, i);
  if (index.cx.length < polygons.length) {
    index.cx = new Float64Array(polygons.length);
    index.cy = new Float64Array(polygons.length);
    index.stamp = new Uint32Array(polygons.length);
  }
}

/** The mesh's index, validated against the live polygon list and advanced to a new search generation. */
function acquireIndex(mesh: NavMesh): MeshIndex {
  let index = indices.get(mesh);
  if (index === undefined) {
    index = {
      pos: new Map<number, number>(),
      cx: new Float64Array(0),
      cy: new Float64Array(0),
      stamp: new Uint32Array(0),
      gen: 0,
    };
    indices.set(mesh, index);
  }
  if (!isCurrent(index, mesh.polygons)) rebuild(index, mesh.polygons);
  if (index.gen === MAX_GEN) {
    index.stamp.fill(0);
    index.gen = 1;
  } else {
    index.gen++;
  }
  return index;
}

/** Makes `cx[i]` / `cy[i]` the centroid of the live polygon at `i`, summing its vertices once per search. */
function centroidAt(index: MeshIndex, polygons: readonly NavMeshPolygon[], i: number): void {
  if (index.stamp[i] === index.gen) return;
  const verts = polygons[i]!.vertices;
  let sx = 0;
  let sy = 0;
  for (let j = 0; j < verts.length; j++) {
    sx += verts[j]!.x;
    sy += verts[j]!.y;
  }
  index.cx[i] = sx / verts.length;
  index.cy[i] = sy / verts.length;
  index.stamp[i] = index.gen;
}

// ─── A* over polygon graph ───────────────────────────────────────

function distSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt(distSq(ax, ay, bx, by));
}

/**
 * A* over the polygon graph, then funnel smoothing. Keeps an id index per mesh
 * object (rebuilt when the polygon list changes) and computes each polygon's
 * centroid at most once per search; edits to the mesh between searches are seen
 * by the next one.
 */
export function findNavMeshPath(mesh: NavMesh, start: Vec2, end: Vec2): NavMeshPathResult | null {
  const startPolyId = findPolygonAt(mesh, start.x, start.y);
  const endPolyId = findPolygonAt(mesh, end.x, end.y);
  if (startPolyId === -1 || endPolyId === -1) return null;
  if (startPolyId === endPolyId) {
    return {
      path: [
        { x: start.x, y: start.y },
        { x: end.x, y: end.y },
      ],
      corridor: [startPolyId],
    };
  }

  const polygons = mesh.polygons;
  const index = acquireIndex(mesh);
  const { pos, cx, cy } = index;

  // A* on polygon graph
  const gScore = new Map<number, number>();
  const fScore = new Map<number, number>();
  const cameFrom = new Map<number, number>();

  gScore.set(startPolyId, 0);

  const endPos = pos.get(endPolyId)!;
  centroidAt(index, polygons, endPos);
  const endCx = cx[endPos]!;
  const endCy = cy[endPos]!;
  const startPos = pos.get(startPolyId)!;
  centroidAt(index, polygons, startPos);

  fScore.set(startPolyId, dist(cx[startPos]!, cy[startPos]!, endCx, endCy));

  // Simple array-based open set (fine for typical navmeshes with <1000 polygons)
  const open: number[] = [startPolyId];
  const inOpen = new Set<number>([startPolyId]);
  const closed = new Set<number>();

  while (open.length > 0) {
    // Find lowest f-score
    let bestI = 0;
    let bestF = fScore.get(open[0]!) ?? Number.POSITIVE_INFINITY;
    for (let i = 1; i < open.length; i++) {
      const f = fScore.get(open[i]!) ?? Number.POSITIVE_INFINITY;
      if (f < bestF) {
        bestF = f;
        bestI = i;
      }
    }
    const currentId = open[bestI]!;

    if (currentId === endPolyId) {
      // Reconstruct corridor
      const corridor: number[] = [];
      let id: number | undefined = endPolyId;
      while (id !== undefined) {
        corridor.push(id);
        id = cameFrom.get(id);
      }
      corridor.reverse();
      const path = funnelSmooth(mesh, index, corridor, start, end);
      return { path, corridor };
    }

    // Remove from open
    open[bestI] = open[open.length - 1]!;
    open.length--;
    inOpen.delete(currentId);
    closed.add(currentId);

    const currentPos = pos.get(currentId)!;
    const current = polygons[currentPos]!;
    centroidAt(index, polygons, currentPos);
    const currentCx = cx[currentPos]!;
    const currentCy = cy[currentPos]!;
    const currentG = gScore.get(currentId)!;

    for (let i = 0; i < current.portals.length; i++) {
      const portal = current.portals[i]!;
      const neighborId = portal.neighborId;
      if (closed.has(neighborId)) continue;

      const neighborPos = pos.get(neighborId);
      if (neighborPos === undefined) continue;

      const portalMidX = (portal.a.x + portal.b.x) * 0.5;
      const portalMidY = (portal.a.y + portal.b.y) * 0.5;
      const tentativeG = currentG + dist(currentCx, currentCy, portalMidX, portalMidY);

      const prevG = gScore.get(neighborId);
      if (prevG !== undefined && tentativeG >= prevG) continue;

      gScore.set(neighborId, tentativeG);
      cameFrom.set(neighborId, currentId);

      centroidAt(index, polygons, neighborPos);
      fScore.set(neighborId, tentativeG + dist(cx[neighborPos]!, cy[neighborPos]!, endCx, endCy));

      if (!inOpen.has(neighborId)) {
        open.push(neighborId);
        inOpen.add(neighborId);
      }
    }
  }

  return null;
}

// ─── Simple Stupid Funnel Algorithm ──────────────────────────────

function funnelSmooth(
  mesh: NavMesh,
  index: MeshIndex,
  corridor: number[],
  start: Vec2,
  end: Vec2,
): Vec2[] {
  if (corridor.length <= 1) {
    return [
      { x: start.x, y: start.y },
      { x: end.x, y: end.y },
    ];
  }

  // Build portal list from corridor
  const portalsLeft: Vec2[] = [];
  const portalsRight: Vec2[] = [];

  portalsLeft.push({ x: start.x, y: start.y });
  portalsRight.push({ x: start.x, y: start.y });

  for (let i = 0; i < corridor.length - 1; i++) {
    const polyPos = index.pos.get(corridor[i]!)!;
    const poly = mesh.polygons[polyPos]!;
    const nextId = corridor[i + 1]!;
    // Find the portal to the next polygon
    let found = false;
    for (let j = 0; j < poly.portals.length; j++) {
      if (poly.portals[j]!.neighborId === nextId) {
        portalsLeft.push(poly.portals[j]!.a);
        portalsRight.push(poly.portals[j]!.b);
        found = true;
        break;
      }
    }
    if (!found) {
      // Fallback: straight line through centroids
      centroidAt(index, mesh.polygons, polyPos);
      const c = { x: index.cx[polyPos]!, y: index.cy[polyPos]! };
      portalsLeft.push(c);
      portalsRight.push(c);
    }
  }

  portalsLeft.push({ x: end.x, y: end.y });
  portalsRight.push({ x: end.x, y: end.y });

  // Simple Stupid Funnel Algorithm (Mononen)
  // Walk the portal list and maintain a funnel (apex, left, right).
  const path: Vec2[] = [];

  let apexPt = portalsLeft[0]!; // start point
  let leftPt = portalsLeft[0]!;
  let rightPt = portalsRight[0]!;
  let apexIdx = 0;
  let leftIdx = 0;
  let rightIdx = 0;

  path.push({ x: apexPt.x, y: apexPt.y });

  const n = portalsLeft.length;

  for (let i = 1; i < n; i++) {
    const pL = portalsLeft[i]!;
    const pR = portalsRight[i]!;

    // Try to tighten the right side
    if (triArea2(apexPt, rightPt, pR) <= 0) {
      if (vEqual(apexPt, rightPt) || triArea2(apexPt, leftPt, pR) > 0) {
        // Tighten
        rightPt = pR;
        rightIdx = i;
      } else {
        // Right crossed over left → left becomes new apex
        addUnique(path, leftPt);
        apexPt = leftPt;
        apexIdx = leftIdx;
        // Reset funnel
        leftPt = apexPt;
        rightPt = apexPt;
        leftIdx = apexIdx;
        rightIdx = apexIdx;
        // Restart scan from the portal after the new apex
        i = apexIdx;
        continue;
      }
    }

    // Try to tighten the left side
    if (triArea2(apexPt, leftPt, pL) >= 0) {
      if (vEqual(apexPt, leftPt) || triArea2(apexPt, rightPt, pL) < 0) {
        // Tighten
        leftPt = pL;
        leftIdx = i;
      } else {
        // Left crossed over right → right becomes new apex
        addUnique(path, rightPt);
        apexPt = rightPt;
        apexIdx = rightIdx;
        // Reset funnel
        leftPt = apexPt;
        rightPt = apexPt;
        leftIdx = apexIdx;
        rightIdx = apexIdx;
        // Restart scan from the portal after the new apex
        i = apexIdx;
      }
    }
  }

  addUnique(path, end);

  return path;
}

function addUnique(path: Vec2[], p: Vec2): void {
  const last = path[path.length - 1];
  if (!last || last.x !== p.x || last.y !== p.y) {
    path.push({ x: p.x, y: p.y });
  }
}

/** Twice the signed area of the triangle (a, b, c). Positive = CCW. */
function triArea2(a: Vec2, b: Vec2, c: Vec2): number {
  return (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
}

function vEqual(a: Vec2, b: Vec2): boolean {
  return a.x === b.x && a.y === b.y;
}
