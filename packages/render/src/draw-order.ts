/** A drawable item with a z-order for sorting. */
export interface Drawable {
  /** Z-index for draw ordering. Higher values draw on top. */
  z: number;
}

/**
 * Sort an array of drawables by z-index (ascending = back to front).
 * Uses insertion sort which is fast for nearly-sorted arrays
 * (typical in game rendering where order rarely changes).
 *
 * Mutates the input array in place. Returns the same array.
 *
 * @param items The array to sort in place.
 * @param length Optional upper bound — when provided, only sorts `items[0..length)`.
 *               Use this when passing a pooled array that may hold stale tail entries.
 */
export function sortByDrawOrder<T extends Drawable>(items: T[], length?: number): T[] {
  const n = length ?? items.length;
  // Insertion sort — O(n) for nearly-sorted, no allocations
  for (let i = 1; i < n; i++) {
    const item = items[i]!;
    let j = i - 1;
    while (j >= 0 && items[j]!.z > item.z) {
      items[j + 1] = items[j]!;
      j--;
    }
    items[j + 1] = item;
  }
  return items;
}

/**
 * Compare function for use with Array.sort when insertion sort isn't desired.
 * Stable relative order for equal z values (returns 0).
 */
export function drawOrderCompare(a: Drawable, b: Drawable): number {
  return a.z - b.z;
}
