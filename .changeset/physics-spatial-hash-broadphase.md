---
"@flare-engine/physics": patch
---

Replace brute-force linear scan in `SpatialIndex` with a uniform spatial hash: O(1) `remove`/`update` via item-to-slot map, O(cells-touched) `query` via cell buckets, zero-alloc duplicate suppression via monotone stamp counter. Also drops the per-entity 2-element array allocation in `CollisionWorld.step` by iterating `entries.values()`.
