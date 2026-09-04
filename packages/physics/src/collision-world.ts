import { Signal } from '@flare-engine/events';
import type { Rect } from '@flare-engine/math';
import type { RaycastHit } from './raycast.js';
import { rayVsShapeInto } from './raycast.js';
import type { Shape } from './shape.js';
import { shapeBoundsInto, shapeOverlap } from './shape.js';
import { SpatialIndex } from './spatial-index.js';

/** Collision pair data emitted by collision signals. */
export interface CollisionPair {
  readonly entityA: number;
  readonly entityB: number;
}

/** Per-entity collision data stored in the world. */
interface CollisionEntry {
  entity: number;
  shape: Shape;
  x: number;
  y: number;
  isTrigger: boolean;
  layer: number;
  mask: number;
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
 */
export class CollisionWorld {
  readonly onCollisionStart = new Signal<CollisionPair>();
  readonly onCollisionEnd = new Signal<CollisionPair>();
  readonly onTriggerEnter = new Signal<CollisionPair>();
  readonly onTriggerExit = new Signal<CollisionPair>();

  private entries = new Map<number, CollisionEntry>();
  private spatial = new SpatialIndex<number>();
  /**
   * Two pre-allocated pair buffers — swapped each step (no per-frame allocation).
   * Keys are packed numbers via `encodePair(a, b)`.
   */
  private pairBufA = new Set<number>();
  private pairBufB = new Set<number>();
  private activePairs: Set<number> = this.pairBufA;
  /** Reusable query result buffer. */
  private queryBuf: number[] = [];
  /** Reusable bounds rect — avoids per-entity Rect allocation in step(). */
  private boundsBuf: Rect = { x: 0, y: 0, width: 0, height: 0 };

  /** Add an entity with a shape. */
  add(
    entity: number,
    shape: Shape,
    x: number,
    y: number,
    isTrigger = false,
    layer = 1,
    mask = 0xffffffff,
  ): void {
    const entry: CollisionEntry = { entity, shape, x, y, isTrigger, layer, mask };
    const exists = this.entries.has(entity);
    this.entries.set(entity, entry);
    shapeBoundsInto(shape, x, y, this.boundsBuf);
    if (exists) {
      this.spatial.update(entity, this.boundsBuf);
    } else {
      this.spatial.insert(entity, this.boundsBuf);
    }
  }

  /** Remove an entity from the world. Emits exit signals for any active pairs. */
  remove(entity: number): void {
    const entry = this.entries.get(entity);
    if (!entry) return;

    this.entries.delete(entity);
    this.spatial.remove(entity);

    // Fire exit signals for all active pairs involving this entity
    for (const key of this.activePairs) {
      const lo = decodeLo(key);
      const hi = decodeHi(key);
      if (lo !== entity && hi !== entity) continue;
      this.activePairs.delete(key);
      const otherEntity = lo === entity ? hi : lo;
      const otherEntry = this.entries.get(otherEntity);
      const pair: CollisionPair = { entityA: lo, entityB: hi };
      if (entry.isTrigger || otherEntry?.isTrigger) {
        this.onTriggerExit.emit(pair);
      } else {
        this.onCollisionEnd.emit(pair);
      }
    }
  }

  /** Update an entity's position. */
  setPosition(entity: number, x: number, y: number): void {
    const entry = this.entries.get(entity);
    if (!entry) return;
    entry.x = x;
    entry.y = y;
    shapeBoundsInto(entry.shape, x, y, this.boundsBuf);
    this.spatial.update(entity, this.boundsBuf);
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

    for (const entryA of this.entries.values()) {
      const entityA = entryA.entity;
      shapeBoundsInto(entryA.shape, entryA.x, entryA.y, this.boundsBuf);
      this.queryBuf.length = 0;
      this.spatial.query(this.boundsBuf, this.queryBuf);

      for (let i = 0; i < this.queryBuf.length; i++) {
        const entityB = this.queryBuf[i]!;
        if (entityB <= entityA) continue; // Avoid self and duplicates

        const entryB = this.entries.get(entityB);
        if (!entryB) continue;

        // Layer/mask filtering
        if ((entryA.layer & entryB.mask) === 0 && (entryB.layer & entryA.mask) === 0) continue;

        // Narrowphase
        if (!shapeOverlap(entryA.shape, entryA.x, entryA.y, entryB.shape, entryB.x, entryB.y)) {
          continue;
        }

        newPairs.add(encodePair(entityA, entityB));
      }
    }

    // Enter/start events — pair objects are allocated here only on state transitions.
    for (const key of newPairs) {
      if (!this.activePairs.has(key)) {
        const lo = decodeLo(key);
        const hi = decodeHi(key);
        const a = this.entries.get(lo);
        const b = this.entries.get(hi);
        const pair: CollisionPair = { entityA: lo, entityB: hi };
        if (a?.isTrigger || b?.isTrigger) {
          this.onTriggerEnter.emit(pair);
        } else {
          this.onCollisionStart.emit(pair);
        }
      }
    }

    // Exit/end events
    for (const key of this.activePairs) {
      if (!newPairs.has(key)) {
        const lo = decodeLo(key);
        const hi = decodeHi(key);
        const a = this.entries.get(lo);
        const b = this.entries.get(hi);
        const pair: CollisionPair = { entityA: lo, entityB: hi };
        if (a?.isTrigger || b?.isTrigger) {
          this.onTriggerExit.emit(pair);
        } else {
          this.onCollisionEnd.emit(pair);
        }
      }
    }

    this.activePairs = newPairs;
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
    this.spatial.clear();
    this.pairBufA.clear();
    this.pairBufB.clear();
    this.activePairs = this.pairBufA;
  }

  /** Reused across raycasts — see `raycast`. */
  private raycastBounds: Rect = { x: 0, y: 0, width: 0, height: 0 };
  private raycastCandidates: number[] = [];
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
   * The returned record is **reused between calls**: read it, or copy what you
   * need, before casting again. That is what keeps a per-frame ray allocation-
   * free, and it is why the standalone helper's fresh-object-per-candidate cost
   * was worth removing.
   */
  raycast(
    ox: number,
    oy: number,
    dx: number,
    dy: number,
    maxDist: number,
    mask = 0xffffffff,
  ): RaycastHit | null {
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
    this.raycastBounds.x = minX - RAY_BOUNDS_PAD;
    this.raycastBounds.y = minY - RAY_BOUNDS_PAD;
    this.raycastBounds.width = Math.abs(ex - ox) + RAY_BOUNDS_PAD * 2;
    this.raycastBounds.height = Math.abs(ey - oy) + RAY_BOUNDS_PAD * 2;

    this.raycastCandidates.length = 0;
    this.spatial.query(this.raycastBounds, this.raycastCandidates);

    let bestDist = Number.POSITIVE_INFINITY;
    let found = false;
    for (let i = 0; i < this.raycastCandidates.length; i++) {
      const entry = this.entries.get(this.raycastCandidates[i]!);
      if (entry === undefined) continue;
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
