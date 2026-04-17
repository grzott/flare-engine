import { Signal } from '@flare-engine/events';
import type { Rect } from '@flare-engine/math';
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
    this.entries.set(entity, entry);
    shapeBoundsInto(shape, x, y, this.boundsBuf);
    this.spatial.insert(entity, this.boundsBuf);
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

  /** Run one collision detection step. */
  step(): void {
    const newPairs = this.activePairs === this.pairBufA ? this.pairBufB : this.pairBufA;
    newPairs.clear();

    for (const [entityA, entryA] of this.entries) {
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

  /** Remove all entities. */
  clear(): void {
    this.entries.clear();
    this.spatial.clear();
    this.pairBufA.clear();
    this.pairBufB.clear();
    this.activePairs = this.pairBufA;
  }
}
