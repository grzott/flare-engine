---
'@flare-engine/pathfinding': patch
---

`findPath` and `findPathJPS` keep their search scratch (g scores, came-from links, generation
stamps and the open-set heap) per `Grid` object in a WeakMap and reuse it on every later search of
that grid, so a repeat search skips the per-call fill and allocates no typed arrays unless its open
set outgrows the kept heap; results are unchanged. A heuristic that re-enters a search on the same grid gets its own temporary scratch, and
a heuristic that throws leaves the stored one reusable. The open-set heap is now one shared module
instead of a copy in each search.
