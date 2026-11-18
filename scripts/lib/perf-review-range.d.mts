/** Type surface for `perf-review-range.mjs`, hand-written like `pack.d.mts`. */

export type ReviewRange = {
  baseRef: string | null;
  baselineTouched: boolean;
  srcTouched: boolean;
  oldReviews: unknown[];
};

export declare function resolveBaseRef(
  requested: string | undefined,
  git: (...args: string[]) => string,
): string | null;

export declare function reviewRange(requested: string | undefined, cwd: string): ReviewRange;
