---
'@flare-engine/pathfinding': patch
---

`findNavMeshPath` builds a mesh's id index and polygon centroids once, on the first search of a
`NavMesh` object (kept in a WeakMap), instead of rebuilding the index per call and recomputing a
centroid per visited polygon; a mesh must not be mutated after its first search. `findPathJPS`
collects each expanded node's jump points in an 8-slot buffer kept in the per-grid scratch instead
of allocating an array per node, and its jump scan is a loop instead of one recursive frame per
cell, so a long open corridor no longer overflows the stack on engines without proper tail calls
(V8, Hermes). Results are unchanged.
