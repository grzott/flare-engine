import type { Rect } from '@flare-engine/math';

/** Item stored in the spatial index. */
export interface SpatialEntry<T> {
  readonly item: T;
  /** Bounding rect (minX, minY, maxX, maxY). */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// Internal entry: extends the public shape with a per-query stamp for zero-alloc dedup.
interface _Entry<T> extends SpatialEntry<T> {
  _stamp: number;
}

// Uniform grid cell size in world units. Tuned for typical game-object sizes (16–64 px).
const CELL = 64;

// Packed cell-key encoding.  Supports cell coords in [-32768, 32767],
// i.e. world coordinates ±2 097 152.  All keys fit within Number.MAX_SAFE_INTEGER.
const KEY_RANGE = 65536; // 2^16
const KEY_OFFSET = 32768; // 2^15

function _key(cx: number, cy: number): number {
  return (cx + KEY_OFFSET) * KEY_RANGE + (cy + KEY_OFFSET);
}

// Inclusive min cell that contains world coordinate v.
function _cMin(v: number): number {
  return Math.floor(v / CELL);
}

// Inclusive max cell that contains world coordinate v (exclusive-end: a coord
// falling exactly on a cell boundary is NOT part of the adjacent cell — matches
// the strict-inequality overlap semantics of query()).
function _cMax(v: number): number {
  return Math.ceil(v / CELL) - 1;
}

/**
 * Uniform spatial-hash broadphase.
 * `insert`, `remove`, and `update` are O(cells touched) — O(1) for typical entities.
 * `query` walks only the cells overlapping the given rect; result order is unspecified.
 * Zero-alloc in the query hot-path: duplicate suppression uses a monotone stamp counter,
 * not a per-call Set.
 */
export class SpatialIndex<T> {
  private _data: _Entry<T>[] = [];
  private _slots = new Map<T, number>(); // item → dense-array slot
  private _cells = new Map<number, _Entry<T>[]>(); // packed cell key → bucket
  private _gen = 0; // monotone query-generation counter

  /** Number of items in the index. */
  get size(): number {
    return this._data.length;
  }

  /** Insert an item with a bounding rect. */
  insert(item: T, bounds: Rect): void {
    const entry: _Entry<T> = {
      item,
      minX: bounds.x,
      minY: bounds.y,
      maxX: bounds.x + bounds.width,
      maxY: bounds.y + bounds.height,
      _stamp: 0,
    };
    this._slots.set(item, this._data.length);
    this._data.push(entry);
    this._link(entry);
  }

  /** Remove an item. Returns false when the item was not present. */
  remove(item: T): boolean {
    const slot = this._slots.get(item);
    if (slot === undefined) return false;
    const entry = this._data[slot]!;
    this._unlink(entry);
    this._slots.delete(item);
    // Swap-remove: plug the hole with the last element.
    const last = this._data.pop()!;
    if (slot < this._data.length) {
      this._data[slot] = last;
      this._slots.set(last.item, slot);
    }
    return true;
  }

  /** Update the bounds for an existing item. No-op when the item is absent. */
  update(item: T, bounds: Rect): void {
    const slot = this._slots.get(item);
    if (slot === undefined) return;
    const entry = this._data[slot]!;
    this._unlink(entry);
    entry.minX = bounds.x;
    entry.minY = bounds.y;
    entry.maxX = bounds.x + bounds.width;
    entry.maxY = bounds.y + bounds.height;
    this._link(entry);
  }

  /**
   * Query all items whose bounds overlap the given rect.
   * Result order is unspecified.  Appends to `result` when provided and returns it.
   */
  query(bounds: Rect, result?: T[]): T[] {
    const out = result ?? [];
    const gen = ++this._gen;

    const qMinX = bounds.x;
    const qMinY = bounds.y;
    const qMaxX = bounds.x + bounds.width;
    const qMaxY = bounds.y + bounds.height;

    const cxMin = _cMin(qMinX);
    const cxMax = _cMax(qMaxX);
    const cyMin = _cMin(qMinY);
    const cyMax = _cMax(qMaxY);

    for (let cx = cxMin; cx <= cxMax; cx++) {
      for (let cy = cyMin; cy <= cyMax; cy++) {
        const bucket = this._cells.get(_key(cx, cy));
        if (bucket === undefined) continue;
        for (let i = 0; i < bucket.length; i++) {
          const e = bucket[i]!;
          if (e._stamp === gen) continue; // already emitted this query
          e._stamp = gen;
          if (e.maxX > qMinX && e.minX < qMaxX && e.maxY > qMinY && e.minY < qMaxY) {
            out.push(e.item);
          }
        }
      }
    }
    return out;
  }

  /** Remove all items. */
  clear(): void {
    this._data.length = 0;
    this._slots.clear();
    this._cells.clear();
  }

  // Register entry in all grid cells it overlaps.
  private _link(entry: _Entry<T>): void {
    const cxMin = _cMin(entry.minX);
    const cxMax = _cMax(entry.maxX);
    const cyMin = _cMin(entry.minY);
    const cyMax = _cMax(entry.maxY);
    for (let cx = cxMin; cx <= cxMax; cx++) {
      for (let cy = cyMin; cy <= cyMax; cy++) {
        const k = _key(cx, cy);
        let b = this._cells.get(k);
        if (b === undefined) {
          b = [];
          this._cells.set(k, b);
        }
        b.push(entry);
      }
    }
  }

  // Remove entry from all grid cells it currently occupies.
  private _unlink(entry: _Entry<T>): void {
    const cxMin = _cMin(entry.minX);
    const cxMax = _cMax(entry.maxX);
    const cyMin = _cMin(entry.minY);
    const cyMax = _cMax(entry.maxY);
    for (let cx = cxMin; cx <= cxMax; cx++) {
      for (let cy = cyMin; cy <= cyMax; cy++) {
        const b = this._cells.get(_key(cx, cy));
        if (b === undefined) continue;
        const i = b.indexOf(entry);
        if (i !== -1) {
          // Swap-remove within the bucket.
          const last = b.pop()!;
          if (i < b.length) b[i] = last;
        }
      }
    }
  }
}
