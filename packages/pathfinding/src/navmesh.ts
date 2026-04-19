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
  /** Ids of neighboring polygons (sharing an edge). */
  readonly neighbors: readonly number[];
  /** Shared edge per neighbor: [neighborId] → { a, b } portal endpoints. */
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

// ─── Polygon centroid ────────────────────────────────────────────

function centroid(verts: readonly Vec2[]): Vec2 {
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < verts.length; i++) {
    cx += verts[i]!.x;
    cy += verts[i]!.y;
  }
  const n = verts.length;
  return { x: cx / n, y: cy / n };
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

  // Build index: id → polygon
  const byId = new Map<number, NavMeshPolygon>();
  for (let i = 0; i < mesh.polygons.length; i++) {
    const p = mesh.polygons[i]!;
    byId.set(p.id, p);
  }

  // A* on polygon graph
  const gScore = new Map<number, number>();
  const fScore = new Map<number, number>();
  const cameFrom = new Map<number, number>();

  gScore.set(startPolyId, 0);

  const endPoly = byId.get(endPolyId)!;
  const endCenter = centroid(endPoly.vertices);
  const startPoly = byId.get(startPolyId)!;
  const startCenter = centroid(startPoly.vertices);

  fScore.set(startPolyId, dist(startCenter.x, startCenter.y, endCenter.x, endCenter.y));

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
      const path = funnelSmooth(mesh, byId, corridor, start, end);
      return { path, corridor };
    }

    // Remove from open
    open[bestI] = open[open.length - 1]!;
    open.length--;
    inOpen.delete(currentId);
    closed.add(currentId);

    const current = byId.get(currentId)!;
    const currentCenter = centroid(current.vertices);
    const currentG = gScore.get(currentId)!;

    for (let i = 0; i < current.portals.length; i++) {
      const portal = current.portals[i]!;
      const neighborId = portal.neighborId;
      if (closed.has(neighborId)) continue;

      const neighbor = byId.get(neighborId);
      if (!neighbor) continue;

      const portalMidX = (portal.a.x + portal.b.x) * 0.5;
      const portalMidY = (portal.a.y + portal.b.y) * 0.5;
      const tentativeG = currentG + dist(currentCenter.x, currentCenter.y, portalMidX, portalMidY);

      const prevG = gScore.get(neighborId);
      if (prevG !== undefined && tentativeG >= prevG) continue;

      gScore.set(neighborId, tentativeG);
      cameFrom.set(neighborId, currentId);

      const neighborCenter = centroid(neighbor.vertices);
      fScore.set(
        neighborId,
        tentativeG + dist(neighborCenter.x, neighborCenter.y, endCenter.x, endCenter.y),
      );

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
  _mesh: NavMesh,
  byId: Map<number, NavMeshPolygon>,
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
    const poly = byId.get(corridor[i]!)!;
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
      const c = centroid(poly.vertices);
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
