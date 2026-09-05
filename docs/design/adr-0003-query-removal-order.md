# ADR-0003: `Query` removal is O(1) swap-remove, and iteration order is explicitly unspecified

- **Status**: Accepted <!-- owner decision; see "Why this needs a decision at patch level" -->
- **Date**: 2026-09-05
- **Consumer impact**: behaviour-change
- **Release level**: patch

## Context

`Query._remove` was `indexOf` + `splice` — both O(n) — so churn cost grew with
`entities x removals` rather than with removals. XR-7 measured it on a Pixel-free node bench
(5% of the population destroyed and respawned per step, ring-ordered so the victim sits at an
arbitrary offset):

| entities | `ecs.step` | `ecs.churn` | ratio |
| --- | --- | --- | --- |
| 500 | 3.72 us | 28.95 us | 7.8x |
| 1000 | 10.15 us | 96.27 us | 9.5x |
| 2000 | 20.35 us | 228.79 us | 11.2x |
| 5000 | 54.03 us | 782.10 us | **14.5x** |

Steady-state iteration doubles linearly with `n`; churn grows ~3.3x/2.4x/3.4x per doubling. That
is the O(n^2) signature. At 5000 entities churn alone costs 782 us — about 4.7% of a 16.7 ms
frame — and churn is the path a shmup consumer reports as dominating its frame.

**The array was documented "sorted" and never was.** `_check` has always plain-`push`ed, so an
entity that begins matching later is appended regardless of id: spawn 1, 2, 3 and add the missing
component to 3 first and the array reads `[3, 1, 2]`. Verified by direct repro. So the invariant
this decision was believed to threaten did not exist.

## Decision

Replace the `Set` + `indexOf` + `splice` triple with a single `Map<entityId, index>` and
swap-remove: move the last element into the hole, `pop`, and rewrite the moved element's index.
Removal becomes O(1). Document iteration order as **explicitly unspecified**.

## Consumer impact

- **What changes.** Removal no longer preserves the relative order of the remaining entities.
- **Who notices.** `render-system` is the only consumer that reads the order: its
  `sortByDrawOrder` is a **stable insertion sort on `z` alone**, so query order is the tie-break
  between equal-`z` sprites. A consumer with overlapping sprites at the same `z` that destroys
  entities can therefore see a different sprite on top after this change.
- **Migration.** Give overlapping sprites distinct `z` values. That was already the only
  supported way to control draw order; the previous order was incidental, undocumented in truth,
  and not covered by any test.
- **Not affected.** Membership, `count`, `has`, both signals, and iteration *contents* are
  unchanged and covered by new tests in `packages/ecs/tests/query.test.ts`.

## Why this needs a decision at patch level

`check:bump` gates the version word, and this ships as `patch`, so **nothing stops it**. That is
precisely the limitation recorded when the gate was built: level is a proxy for risk, not risk
itself. A behaviour change in a hot path that alters what a consumer sees on screen deserves the
same written decision as a version bump, so it gets one.

## Alternatives considered

- **`Map` + `splice` (order-preserving).** Rejected: it removes the `indexOf` scan but `splice`
  still shifts every later element *and* every shifted index must be rewritten in the map — the
  same O(n), with worse constants than the array scan it replaced. It buys nothing.
- **Tombstones + periodic compaction.** Preserves order and gives O(1) removal, but puts a
  liveness branch in *iteration*. At the measured 5% churn, iteration runs ~20x more often than
  removal, so this slows the hot path to speed up the rare one — and would regress the frozen
  `ecs.step` control suite, the reference row that located the 2026-07 regression in `render`.
- **Leave it.** Rejected: 14.5x at 5000 entities on the path a consumer reports as dominating.

## What would reverse this

1. **A measured render regression.** If `sortByDrawOrder`'s insertion sort degrades on the new
   ordering — it is tuned "O(n) for nearly-sorted" — the render win could offset the ECS win.
   The `render.flush` and `alloc.render ... 8 atlas` rows are the check.
2. **A consumer that genuinely needs stable equal-`z` order** and cannot express it via `z`.
3. **Evidence that churn is not representative** — if real consumers churn far below 5% of
   population per frame, the O(n^2) never bites and the order change buys nothing.
