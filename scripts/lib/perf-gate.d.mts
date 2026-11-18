/**
 * Type surface for `perf-gate.mjs`, hand-written like `pack.d.mts`. Kept
 * narrow: only what `scripts/tests/perf-review-range.test.ts` needs.
 */

export declare function reconcileReviews(input: {
  baselineTouched: boolean;
  srcTouched: boolean;
  oldReviews: unknown;
  newReviews: unknown;
}): string[];
