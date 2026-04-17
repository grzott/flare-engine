import type { Rect } from '@flare/math';

/** Item stored in the spatial index. */
export interface SpatialEntry<T> {
  readonly item: T;
  /** Bounding rect (minX, minY, width, height). */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Brute-force spatial index for broadphase collision.
 * Suitable for < ~1000 dynamic entities. Upgrade to grid/rbush for more.
 */
export class SpatialIndex<T> {
  private entries: SpatialEntry<T>[] = [];

  /** Number of items in the index. */
  get size(): number {
    return this.entries.length;
  }

  /** Insert an item with a bounding rect. */
  insert(item: T, bounds: Rect): void {
    this.entries.push({
      item,
      minX: bounds.x,
      minY: bounds.y,
      maxX: bounds.x + bounds.width,
      maxY: bounds.y + bounds.height,
    });
  }

  /** Remove an item. */
  remove(item: T): boolean {
    const idx = this.entries.findIndex((e) => e.item === item);
    if (idx === -1) return false;
    // Swap-remove for O(1) removal
    const last = this.entries.pop()!;
    if (idx < this.entries.length) {
      this.entries[idx] = last;
    }
    return true;
  }

  /** Update the bounds for an existing item. */
  update(item: T, bounds: Rect): void {
    const entry = this.entries.find((e) => e.item === item);
    if (entry) {
      entry.minX = bounds.x;
      entry.minY = bounds.y;
      entry.maxX = bounds.x + bounds.width;
      entry.maxY = bounds.y + bounds.height;
    }
  }

  /** Query all items whose bounds overlap the given rect. */
  query(bounds: Rect, result?: T[]): T[] {
    const out = result ?? [];
    const qMinX = bounds.x;
    const qMinY = bounds.y;
    const qMaxX = bounds.x + bounds.width;
    const qMaxY = bounds.y + bounds.height;
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i]!;
      if (e.maxX > qMinX && e.minX < qMaxX && e.maxY > qMinY && e.minY < qMaxY) {
        out.push(e.item);
      }
    }
    return out;
  }

  /** Remove all items. */
  clear(): void {
    this.entries.length = 0;
  }
}
