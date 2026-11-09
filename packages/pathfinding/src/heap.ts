/**
 * Binary min-heap for the A* / JPS open set.
 *
 * Entries are (f, node-index) pairs kept in two parallel typed arrays, so a
 * push allocates nothing. Module-private to the package: not exported from
 * `index.ts`.
 */

export interface Heap {
  f: Float64Array;
  idx: Int32Array;
  size: number;
}

export function heapCreate(capacity: number): Heap {
  return {
    f: new Float64Array(capacity),
    idx: new Int32Array(capacity),
    size: 0,
  };
}

/**
 * Double the heap's backing arrays.
 *
 * Typed arrays do not throw on an out-of-range write — the store is silently
 * dropped — so without this a push past capacity increments `size`, writes
 * nothing, and every later comparison reads `undefined`. The open set then
 * degrades without any error, and the search returns a valid-looking but
 * non-optimal path. Growth is amortized O(1): allocation happens only when
 * capacity is reached, never per push.
 */
export function heapGrow(h: Heap): void {
  const next = h.f.length === 0 ? 16 : h.f.length * 2;
  const f = new Float64Array(next);
  f.set(h.f);
  const idx = new Int32Array(next);
  idx.set(h.idx);
  h.f = f;
  h.idx = idx;
}

export function heapPush(h: Heap, f: number, nodeIdx: number): void {
  if (h.size === h.f.length) heapGrow(h);
  let i = h.size++;
  h.f[i] = f;
  h.idx[i] = nodeIdx;
  // Bubble up
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (h.f[parent]! <= h.f[i]!) break;
    // Swap
    const tf = h.f[parent]!;
    const ti = h.idx[parent]!;
    h.f[parent] = h.f[i]!;
    h.idx[parent] = h.idx[i]!;
    h.f[i] = tf;
    h.idx[i] = ti;
    i = parent;
  }
}

export function heapPop(h: Heap): number {
  const result = h.idx[0]!;
  h.size--;
  if (h.size > 0) {
    h.f[0] = h.f[h.size]!;
    h.idx[0] = h.idx[h.size]!;
    // Sift down
    let i = 0;
    for (;;) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < h.size && h.f[left]! < h.f[smallest]!) smallest = left;
      if (right < h.size && h.f[right]! < h.f[smallest]!) smallest = right;
      if (smallest === i) break;
      const tf = h.f[i]!;
      const ti = h.idx[i]!;
      h.f[i] = h.f[smallest]!;
      h.idx[i] = h.idx[smallest]!;
      h.f[smallest] = tf;
      h.idx[smallest] = ti;
      i = smallest;
    }
  }
  return result;
}
