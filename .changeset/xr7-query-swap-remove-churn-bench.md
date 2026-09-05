---
'@flare-engine/ecs': patch
---

`Query` removal is now O(1). It was `indexOf` + `splice` — both O(n) — so churn cost grew with
`entities x removals`; a single `Map<entityId, index>` now serves membership and position, and
removal swaps the last element into the hole. Measured on the new `ecs.churn` bench rows
(5%/step): the path was 14.5x steady-state iteration at 5000 entities before this.

**Behaviour change, per ADR-0003:** removal no longer preserves the relative order of the
remaining entities, and iteration order is now documented as explicitly unspecified. The array was
previously documented "sorted" but never was — `_check` has always appended, so an entity that
begins matching later landed after higher ids. The only consumer that reads the order is
`render-system`, whose sort is stable on `z` alone, so query order is the tie-break between
equal-`z` sprites: give overlapping sprites distinct `z` values, which was already the only
supported way to control draw order.
