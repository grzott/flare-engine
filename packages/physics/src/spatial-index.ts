import type { Rect } from '@flare-engine/math';
import { cellKey, cellMax, cellMin } from './cells.js';

// Internal entry: bounding rect (minX, minY, maxX, maxY) plus a per-query stamp
// for zero-alloc dedup.
interface _Entry<T> {
  readonly item: T;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  // The clamped cell range the entry is linked into. Cached so an update can
  // tell "same cells" without touching a bucket. A NaN bound leaves NaN here,
  // which equals nothing — such an entry is linked nowhere and always relinks.
  cxMin: number;
  cxMax: number;
  cyMin: number;
  cyMax: number;
  // This entry's position inside the bucket of each cell it occupies, indexed
  // `(cx - cxMin) * rows + (cy - cyMin)` with rows = cyMax - cyMin + 1. Lets
  // unlink swap-remove without searching the bucket. Grown, never reallocated.
  readonly _at: number[];
  _stamp: number;
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

  /**
   * Insert an item with a bounding rect. Inserting an item already in the index
   * replaces its bounds (upsert) — same as `update`.
   */
  insert(item: T, bounds: Rect): void {
    if (this._slots.has(item)) {
      this.update(item, bounds);
      return;
    }
    const maxX = bounds.x + bounds.width;
    const maxY = bounds.y + bounds.height;
    const entry: _Entry<T> = {
      item,
      minX: bounds.x,
      minY: bounds.y,
      maxX,
      maxY,
      cxMin: cellMin(bounds.x),
      cxMax: cellMax(maxX),
      cyMin: cellMin(bounds.y),
      cyMax: cellMax(maxY),
      _at: [],
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
    const maxX = bounds.x + bounds.width;
    const maxY = bounds.y + bounds.height;
    entry.minX = bounds.x;
    entry.minY = bounds.y;
    entry.maxX = maxX;
    entry.maxY = maxY;

    const cxMin = cellMin(bounds.x);
    const cxMax = cellMax(maxX);
    const cyMin = cellMin(bounds.y);
    const cyMax = cellMax(maxY);
    // Same cells: the buckets already hold this entry, and a query reads the
    // bounds refreshed above.
    if (
      cxMin === entry.cxMin &&
      cxMax === entry.cxMax &&
      cyMin === entry.cyMin &&
      cyMax === entry.cyMax
    ) {
      return;
    }
    this._unlink(entry);
    entry.cxMin = cxMin;
    entry.cxMax = cxMax;
    entry.cyMin = cyMin;
    entry.cyMax = cyMax;
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

    const cxMin = cellMin(qMinX);
    const cxMax = cellMax(qMaxX);
    const cyMin = cellMin(qMinY);
    const cyMax = cellMax(qMaxY);

    for (let cx = cxMin; cx <= cxMax; cx++) {
      for (let cy = cyMin; cy <= cyMax; cy++) {
        const bucket = this._cells.get(cellKey(cx, cy));
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

  // Register entry in every cell of its cached range, recording where in each
  // bucket it landed.
  private _link(entry: _Entry<T>): void {
    const { cxMin, cxMax, cyMin, cyMax, _at } = entry;
    let n = 0;
    for (let cx = cxMin; cx <= cxMax; cx++) {
      for (let cy = cyMin; cy <= cyMax; cy++) {
        const k = cellKey(cx, cy);
        let b = this._cells.get(k);
        if (b === undefined) {
          b = [];
          this._cells.set(k, b);
        }
        _at[n++] = b.length;
        b.push(entry);
      }
    }
  }

  // Remove entry from every cell of its cached range. O(1) per cell: the last
  // entry of the bucket takes the vacated position, and its own record of where
  // it sits in this cell is corrected to match.
  private _unlink(entry: _Entry<T>): void {
    const { cxMin, cxMax, cyMin, cyMax, _at } = entry;
    let n = 0;
    for (let cx = cxMin; cx <= cxMax; cx++) {
      for (let cy = cyMin; cy <= cyMax; cy++) {
        const i = _at[n++]!;
        const b = this._cells.get(cellKey(cx, cy));
        if (b === undefined) continue;
        const last = b.pop()!;
        if (last === entry) continue;
        b[i] = last;
        last._at[(cx - last.cxMin) * (last.cyMax - last.cyMin + 1) + (cy - last.cyMin)] = i;
      }
    }
  }
}
