---
'@flare-engine/pathfinding': patch
---

`findNavMeshPath` keeps a per-mesh id index (rebuilt when the polygon list changes) and computes
each polygon's centroid at most once per search into reused per-mesh scratch, instead of rebuilding
the index per call and re-summing a centroid per visited polygon; a mesh edited between searches is
seen by the next search, as before. `findPathJPS` collects each expanded node's jump points in an
8-slot buffer kept in the per-grid scratch instead of allocating an array per node, and its jump
scan is a loop instead of one recursive frame per cell, so a long open corridor no longer overflows
the stack on engines without proper tail calls (V8, Hermes). Results are unchanged.
