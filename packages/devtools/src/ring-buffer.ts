/**
 * Source callback used by `createSnapshotRingBuffer` to produce a snapshot
 * each capture tick. The ring buffer never introspects the snapshot — it is
 * an opaque `T` to this package. A future `World.serialize()` can be passed
 * in directly by consumers.
 */
export type SnapshotSource<T> = () => T;

/**
 * Pre-allocated snapshot ring buffer. Slots are allocated once at
 * construction and the `write` cursor walks in place — zero per-frame
 * allocation. `rewind(framesAgo)` returns the snapshot that was `framesAgo`
 * captures back (0 = latest), or `null` if the requested offset exceeds the
 * number of snapshots currently held.
 */
export interface SnapshotRingBuffer<T> {
  /** Maximum number of snapshots retained. */
  readonly size: number;
  /** Number of snapshots currently held (0…size). */
  readonly length: number;
  /** Most recent snapshot, or `null` if `length === 0`. */
  readonly latest: T | null;
  /** Capture a new snapshot. Overwrites the oldest slot once full. */
  capture(): void;
  /** Return the snapshot from `framesAgo` captures back, or `null`. */
  rewind(framesAgo: number): T | null;
  /** Drop all retained snapshots. */
  reset(): void;
}

export function createSnapshotRingBuffer<T>(
  size: number,
  source: SnapshotSource<T>,
): SnapshotRingBuffer<T> {
  if (size <= 0 || !Number.isFinite(size)) {
    throw new Error(`SnapshotRingBuffer size must be a positive finite number, got ${size}`);
  }
  const capacity = Math.floor(size);
  const slots: (T | null)[] = new Array(capacity).fill(null);
  let head = 0; // next write index
  let count = 0;

  return {
    size: capacity,
    get length(): number {
      return count;
    },
    get latest(): T | null {
      if (count === 0) return null;
      const idx = (head - 1 + capacity) % capacity;
      return slots[idx] ?? null;
    },
    capture(): void {
      slots[head] = source();
      head = (head + 1) % capacity;
      if (count < capacity) count++;
    },
    rewind(framesAgo: number): T | null {
      if (framesAgo < 0 || !Number.isFinite(framesAgo)) return null;
      const offset = Math.floor(framesAgo);
      if (offset >= count) return null;
      const idx = (head - 1 - offset + capacity * 2) % capacity;
      return slots[idx] ?? null;
    },
    reset(): void {
      for (let i = 0; i < capacity; i++) slots[i] = null;
      head = 0;
      count = 0;
    },
  };
}
