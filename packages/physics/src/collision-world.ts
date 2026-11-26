import { Signal } from '@flare-engine/events';
import type { Rect } from '@flare-engine/math';
import type { Collider } from './collider.js';
import {
  type CollisionEntry,
  createCollisionGrid,
  gridClear,
  gridInsert,
  gridMove,
  gridQuery,
  gridRelink,
  gridRemove,
  gridUnlink,
} from './collision-grid.js';
import type { RaycastHit } from './raycast.js';
import { rayVsShapeInto } from './raycast.js';
import type { Shape } from './shape.js';
import { shapeBoundsInto, shapeOverlap } from './shape.js';

/** Collision pair data emitted by collision signals. */
export interface CollisionPair {
  readonly entityA: number;
  readonly entityB: number;
}

// Packed pair-key layout: `lo * ENTITY_SHIFT + hi`, lo = min(a,b), hi = max(a,b).
// 2^26 fits within Number.MAX_SAFE_INTEGER for 26+26 bits → max entity id ~67M.
const ENTITY_SHIFT = 2 ** 26;

/** Padding applied to a ray's query AABB — see `CollisionWorld.raycast`. */
const RAY_BOUNDS_PAD = 1e-6;

function encodePair(a: number, b: number): number {
  const lo = a < b ? a : b;
  const hi = a < b ? b : a;
  return lo * ENTITY_SHIFT + hi;
}

function decodeLo(key: number): number {
  return Math.floor(key / ENTITY_SHIFT);
}

function decodeHi(key: number): number {
  return key - Math.floor(key / ENTITY_SHIFT) * ENTITY_SHIFT;
}

/**
 * AABB collision world. Manages entities with shapes, detects overlaps each step,
 * and emits collision/trigger signals.
 *
 * The broadphase is a uniform grid of fixed 64-world-unit cells, with no option to
 * change it. It suits colliders of roughly 16-64 units. In a world of one unit per
 * tile, colliders crowd a few cells and `step` and `raycast` approach a scan of
 * every collider, so scale world units up to match.
 */
export class CollisionWorld {
  readonly onCollisionStart = new Signal<CollisionPair>();
  readonly onCollisionEnd = new Signal<CollisionPair>();
  readonly onTriggerEnter = new Signal<CollisionPair>();
  readonly onTriggerExit = new Signal<CollisionPair>();

  private entries = new Map<number, CollisionEntry>();
  private spatial = createCollisionGrid();
  /**
   * Two pre-allocated pair buffers — swapped each step (no per-frame allocation).
   * Keys are packed numbers via `encodePair(a, b)`.
   */
  private pairBufA = new Set<number>();
  private pairBufB = new Set<number>();
  private activePairs: Set<number> = this.pairBufA;
  /** Reusable bounds rect — avoids a Rect allocation per add / setPosition. */
  private boundsBuf: Rect = { x: 0, y: 0, width: 0, height: 0 };

  /**
   * Add an entity with a shape. Positional twin of `addCollider`, and re-adding
   * follows the same rules.
   */
  add(
    entity: number,
    shape: Shape,
    x: number,
    y: number,
    isTrigger = false,
    layer = 1,
    mask = 0xffffffff,
  ): void {
    const b = shapeBoundsInto(shape, x, y, this.boundsBuf);
    const existing = this.entries.get(entity);
    if (existing === undefined) {
      const entry: CollisionEntry = {
        entity,
        shape,
        x,
        y,
        isTrigger,
        layer,
        mask,
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0,
        cxMin: 0,
        cxMax: 0,
        cyMin: 0,
        cyMax: 0,
        cellCount: 0,
        cells: [],
        groups: [],
        at: [],
        stamp: 0,
      };
      this.entries.set(entity, entry);
      gridInsert(this.spatial, entry, b.x, b.y, b.x + b.width, b.y + b.height);
      return;
    }

    // A re-add rewrites the entry the grid already links. It is unlinked first
    // and relinked after, even when it stays in the same cells: the grid files
    // an entry under its layer and mask, and both may be changing here.
    const wasTrigger = existing.isTrigger;
    gridUnlink(this.spatial, existing);
    existing.shape = shape;
    existing.x = x;
    existing.y = y;
    existing.isTrigger = isTrigger;
    existing.layer = layer;
    existing.mask = mask;
    gridRelink(this.spatial, existing, b.x, b.y, b.x + b.width, b.y + b.height);
    if (wasTrigger === isTrigger) return;

    // A pair is a trigger pair when either side is a trigger, so flipping this
    // side changes the kind only of pairs whose other side is solid. End those
    // now in their old family; the next step starts them in the new one.
    for (const key of this.activePairs) {
      const lo = decodeLo(key);
      const hi = decodeHi(key);
      if (lo !== entity && hi !== entity) continue;
      const other = this.entries.get(lo === entity ? hi : lo);
      if (other?.isTrigger) continue;
      this.activePairs.delete(key);
      this.emitPair(lo, hi, wasTrigger, false);
    }
  }

  /**
   * Add an entity from a `Collider`. Its `shape`, `isTrigger`, `layer` and `mask`
   * are copied at add time — later edits to the collider do not reach the world;
   * re-add to change them. Re-adding an existing entity replaces its data.
   *
   * A re-add that flips `isTrigger` ends, during this call, every active pair
   * whose kind that changes, with the exit signal of its old kind
   * (`onTriggerExit` or `onCollisionEnd`). If the shapes still overlap, the next
   * `step` starts the pair again with the enter signal of its new kind. A pair
   * whose other side is a trigger stays a trigger pair and is left alone.
   */
  addCollider(entity: number, collider: Collider, x: number, y: number): void {
    this.add(entity, collider.shape, x, y, collider.isTrigger, collider.layer, collider.mask);
  }

  /** Remove an entity from the world. Emits exit signals for any active pairs. */
  remove(entity: number): void {
    const entry = this.entries.get(entity);
    if (!entry) return;

    this.entries.delete(entity);
    gridRemove(this.spatial, entry);

    // Fire exit signals for all active pairs involving this entity
    for (const key of this.activePairs) {
      const lo = decodeLo(key);
      const hi = decodeHi(key);
      if (lo !== entity && hi !== entity) continue;
      this.activePairs.delete(key);
      const other = this.entries.get(lo === entity ? hi : lo);
      // The removed entry is passed in: it is already gone from `entries`.
      this.emitPair(lo, hi, entry.isTrigger || other?.isTrigger === true, false);
    }
  }

  /** Update an entity's position. */
  setPosition(entity: number, x: number, y: number): void {
    const entry = this.entries.get(entity);
    if (!entry) return;
    entry.x = x;
    entry.y = y;
    const b = shapeBoundsInto(entry.shape, x, y, this.boundsBuf);
    gridMove(this.spatial, entry, b.x, b.y, b.x + b.width, b.y + b.height);
  }

  /** Number of entities in the world. */
  get size(): number {
    return this.entries.size;
  }

  /** Number of broadphase records (one per live entity after add/remove). Diagnostic for broadphase growth. */
  get broadphaseSize(): number {
    return this.spatial.size;
  }

  /** Run one collision detection step. */
  step(): void {
    const newPairs = this.activePairs === this.pairBufA ? this.pairBufB : this.pairBufA;
    newPairs.clear();
    const grid = this.spatial;

    // A pair is recorded from its lower id, so `a` only looks for higher ids.
    for (const a of this.entries.values()) {
      const entityA = a.entity;
      const layerA = a.layer;
      const maskA = a.mask;
      const cells = a.cells;
      const cellCount = a.cellCount;
      // Two bodies can share several cells; one cell needs no duplicate check.
      const gen = cellCount > 1 ? ++grid.gen : 0;

      for (let c = 0; c < cellCount; c++) {
        const groups = cells[c]!.groups;
        for (let g = 0; g < groups.length; g++) {
          const group = groups[g]!;
          // Layer/mask filtering, once for the whole group: every body in it
          // carries exactly this layer and mask, so a group that fails holds
          // no pair for `a`, and one that passes is walked in full.
          if ((layerA & group.mask) === 0 && (group.layer & maskA) === 0) continue;

          const items = group.items;
          for (let i = 0; i < items.length; i++) {
            const b = items[i]!;
            if (b.entity <= entityA) continue; // Avoid self and duplicates

            if (cellCount > 1) {
              if (b.stamp === gen) continue;
              b.stamp = gen;
            }

            // Bounding boxes (strictly overlapping), then narrowphase
            const boxes = b.maxX > a.minX && b.minX < a.maxX && b.maxY > a.minY && b.minY < a.maxY;
            if (!boxes) continue;
            if (!shapeOverlap(a.shape, a.x, a.y, b.shape, b.x, b.y)) continue;

            newPairs.add(encodePair(entityA, b.entity));
          }
        }
      }
    }

    // Enter/start events — pair objects are allocated here only on state transitions.
    for (const key of newPairs) {
      if (!this.activePairs.has(key)) {
        const lo = decodeLo(key);
        const hi = decodeHi(key);
        this.emitPair(lo, hi, this.isTriggerPair(lo, hi), true);
      }
    }

    // Exit/end events
    for (const key of this.activePairs) {
      if (!newPairs.has(key)) {
        const lo = decodeLo(key);
        const hi = decodeHi(key);
        this.emitPair(lo, hi, this.isTriggerPair(lo, hi), false);
      }
    }

    this.activePairs = newPairs;
  }

  /** A pair is a trigger pair when either of its entities is a trigger. */
  private isTriggerPair(lo: number, hi: number): boolean {
    return this.entries.get(lo)?.isTrigger === true || this.entries.get(hi)?.isTrigger === true;
  }

  /**
   * The one place that emits a pair's enter or exit signal, in the trigger or
   * the collision family. `trigger` is passed in rather than looked up because
   * `remove` and a re-add classify by data `entries` no longer holds: the
   * removed entry, and the `isTrigger` the entity had before the re-add.
   */
  private emitPair(lo: number, hi: number, trigger: boolean, entering: boolean): void {
    const pair: CollisionPair = { entityA: lo, entityB: hi };
    if (trigger) {
      if (entering) this.onTriggerEnter.emit(pair);
      else this.onTriggerExit.emit(pair);
    } else if (entering) {
      this.onCollisionStart.emit(pair);
    } else {
      this.onCollisionEnd.emit(pair);
    }
  }

  /** Zero-alloc collider bounds — writes the AABB of entity's shape into `out`. Returns null when entity is absent. */
  getColliderBoundsInto(entity: number, out: Rect): Rect | null {
    const entry = this.entries.get(entity);
    if (!entry) return null;
    shapeBoundsInto(entry.shape, entry.x, entry.y, out);
    return out;
  }

  /** Allocating convenience wrapper — returns a fresh Rect or null when entity is absent. */
  getColliderBounds(entity: number): Rect | null {
    const entry = this.entries.get(entity);
    if (!entry) return null;
    return shapeBoundsInto(entry.shape, entry.x, entry.y, { x: 0, y: 0, width: 0, height: 0 });
  }

  /** Remove all entities. */
  clear(): void {
    this.entries.clear();
    gridClear(this.spatial);
    this.pairBufA.clear();
    this.pairBufB.clear();
    this.activePairs = this.pairBufA;
  }

  /** Reused across raycasts — see `raycast`. */
  private raycastCandidates: CollisionEntry[] = [];
  private raycastHit: RaycastHit = {
    entity: -1,
    distance: 0,
    point: { x: 0, y: 0 },
    normal: { x: 0, y: 0 },
  };

  /**
   * Cast a ray against the colliders in this world.
   *
   * The standalone `raycast()` export tests a caller-supplied target array, so
   * it neither sees the world's colliders nor benefits from the broadphase — an
   * O(n) scan sitting beside an O(1) index. This walks only the cells the ray's
   * bounding box touches.
   *
   * `mask` is a layer bitmask filtered against each collider's `layer`, using the
   * bits colliders already carry; it defaults to every layer. Triggers are
   * included — a ray asking "what is over there" wants them.
   *
   * A ray that starts inside a collider hits that collider at its exit
   * distance, not at 0. The hit's `normal` is then the outward normal of the
   * face the ray entered through behind its origin for a box, and the outward
   * normal at the exit point for a circle. To skip the collider a ray starts in,
   * put it on a layer `mask` leaves out, or start the ray just past its edge: a
   * ray that starts exactly on the edge still hits it, at distance 0.
   *
   * The returned record is **reused between calls**: read it, or copy what you
   * need, before casting again. That is what keeps a per-frame ray allocation-
   * free; the standalone helper by contrast returns a fresh hit from each call
   * that hits, which the caller may keep.
   *
   * `maxDist` must be finite — this requires a bounded ray, not the
   * `Number.POSITIVE_INFINITY` "unbounded ray" idiom some engines accept. The
   * broadphase below is a uniform grid: an infinite `maxDist` derives an
   * infinite cell range and never terminates the walk. Pass a large finite
   * bound instead (e.g. the map's diagonal) to cast "until it leaves the
   * populated area". A non-finite `maxDist` returns `null`.
   */
  raycast(
    ox: number,
    oy: number,
    dx: number,
    dy: number,
    maxDist: number,
    mask = 0xffffffff,
  ): RaycastHit | null {
    if (!Number.isFinite(maxDist)) return null;

    // Bounding box of the whole ray — the broadphase is rect-based, so this is
    // a conservative prefilter, not the intersection test itself.
    const ex = ox + dx * maxDist;
    const ey = oy + dy * maxDist;
    const minX = ox < ex ? ox : ex;
    const minY = oy < ey ? oy : ey;
    // Padded so the rect always has non-zero extent on both axes. An axis-
    // aligned ray is otherwise degenerate — a horizontal ray has height 0 — and
    // SpatialIndex derives its cell range with an exclusive end (`_cMax` is
    // `ceil(v / CELL) - 1`), so a zero-height rect yields cyMin 0 > cyMax -1 and
    // the cell loop never runs. The broadphase is a conservative prefilter
    // anyway, so over-including by a hair costs nothing: the exact ray test
    // below rejects the extras.
    const qMinX = minX - RAY_BOUNDS_PAD;
    const qMinY = minY - RAY_BOUNDS_PAD;
    const qMaxX = qMinX + (Math.abs(ex - ox) + RAY_BOUNDS_PAD * 2);
    const qMaxY = qMinY + (Math.abs(ey - oy) + RAY_BOUNDS_PAD * 2);

    const candidates = this.raycastCandidates;
    candidates.length = 0;
    gridQuery(this.spatial, qMinX, qMinY, qMaxX, qMaxY, candidates);

    let bestDist = Number.POSITIVE_INFINITY;
    let found = false;
    for (let i = 0; i < candidates.length; i++) {
      const entry = candidates[i]!;
      if ((entry.layer & mask) === 0) continue;
      const hit = rayVsShapeInto(
        ox,
        oy,
        dx,
        dy,
        maxDist,
        entry.entity,
        entry.shape,
        entry.x,
        entry.y,
        this.scratchHit,
      );
      if (hit !== null && hit.distance < bestDist) {
        bestDist = hit.distance;
        found = true;
        this.raycastHit.entity = hit.entity;
        this.raycastHit.distance = hit.distance;
        this.raycastHit.point.x = hit.point.x;
        this.raycastHit.point.y = hit.point.y;
        this.raycastHit.normal.x = hit.normal.x;
        this.raycastHit.normal.y = hit.normal.y;
      }
    }
    return found ? this.raycastHit : null;
  }

  /** Scratch record handed to `rayVsShapeInto` per candidate. */
  private scratchHit: RaycastHit = {
    entity: -1,
    distance: 0,
    point: { x: 0, y: 0 },
    normal: { x: 0, y: 0 },
  };
}
