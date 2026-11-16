import type { RectLike } from './placement';

/** How a toast stack is laid out, in Sonner's vocabulary. */
export interface ToastStackOptions {
  /** The viewport edge the stack grows from. The `-left` / `-right` part does not affect y. */
  position: 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Space between neighbouring toasts. */
  gap: number;
  /** Distance of the first toast from the viewport edge. */
  offset: number;
  /** How many toasts are shown at once. */
  visible: number;
}

/**
 * Write the y (top edge) of each of the first `count` toasts to `out` and return how many are
 * visible: `count` capped by `o.visible`.
 *
 * Toast 0 is the one nearest the viewport edge; later ones stack away from it, downward for the
 * top positions and upward for the bottom ones. A toast past the visible count is not given a
 * slot of its own: it sits behind the last visible toast, sharing the edge that faces the
 * viewport edge (or in the first slot when nothing is visible). Entries of `out` from `count` on
 * are left alone.
 *
 * Throws a `RangeError` when `count` exceeds the length of `heights` or `out`.
 */
export function layoutToastStackInto(
  heights: Float32Array,
  count: number,
  viewport: RectLike,
  o: ToastStackOptions,
  out: Float32Array,
): number {
  if (count > heights.length || count > out.length) {
    throw new RangeError(
      `layoutToastStackInto: count ${count} exceeds heights (${heights.length}) or out (${out.length})`,
    );
  }
  const visible = Math.max(0, Math.min(count, Math.floor(o.visible)));
  const fromTop = o.position === 'top' || o.position === 'top-left' || o.position === 'top-right';

  // `edge` is the side of the current slot that faces the viewport edge: its top when stacking
  // down, its bottom when stacking up.
  let edge = fromTop ? viewport.y + o.offset : viewport.y + viewport.height - o.offset;
  let lastEdge = edge;
  for (let i = 0; i < count; i++) {
    const height = heights[i]!;
    if (i < visible) {
      lastEdge = edge;
      edge += fromTop ? height + o.gap : -(height + o.gap);
    }
    out[i] = fromTop ? lastEdge : lastEdge - height;
  }
  return visible;
}
