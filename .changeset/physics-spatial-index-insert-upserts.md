---
"@flare-engine/physics": patch
---

`SpatialIndex.insert` of an item already in the index now replaces its bounds, the same as `update`. Before, a second `insert` of the same item added a second entry and left the first one behind: `size` counted it, `query` over the old bounds kept returning the item, and `remove` dropped only the newer entry, so the stale one stayed until `clear()`. This affected code calling `SpatialIndex.insert` directly; `CollisionWorld.add` already checked for an existing entity and called `update` instead, so `CollisionWorld` users were not affected.
