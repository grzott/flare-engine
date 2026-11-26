---
'@flare-engine/physics': patch
---

`CollisionWorld.setPosition` and `CollisionWorld.step` do less work in a crowded world, and
`SpatialIndex.update` no longer relinks an item that stays in the same cells. No exported symbol
or signature changes.

- **`SpatialIndex.update`** always stores the new bounds, but leaves the buckets alone when the
  item's cell range is unchanged. When the range does change, removal from a bucket is O(1): each
  item records its position in every bucket it occupies, so nothing is searched. It was an
  `indexOf` per cell on every call.
- **`CollisionWorld`** has its own broadphase grid now (same 64-unit cells), which links the
  world's entries directly and groups them, per cell, by `(layer, mask)`. `setPosition` skips the
  relink in the same way. `step` tests layer and mask once per group instead of once per candidate
  after a `Map` lookup, so a body never walks the bodies in its cells that it cannot pair with.
  Each pair is still recorded once, from its lower entity id, after the same bounding-box and
  shape tests. `raycast` reads the same grid.

Which pairs a step reports, and which signal each gets, is unchanged. Two orders that were never
specified can differ from before: the order in which one `step` emits pairs that share their lower
entity id, and which of two colliders `raycast` returns when both are hit at exactly the same
distance.

Measured on the new `physics.curtain` bench rows — 2000 enemy-layer bodies that do not collide
with each other, 100 player shots and one ship in a 384x768 field — on a shared Linux CI runner
(Bun 1.3.11), two runs each side, so read the ratios and not the absolute figures:

| row | before | after |
| --- | --- | --- |
| `setPosition` pass (2101 calls) | 322-343 us | 138-142 us |
| `step()` on a still frame | 1.27 ms | 117-126 us |
| both, one frame | 1.67-1.69 ms | 341-352 us |

The existing `physics.step` rows, where every body can hit every other, also got faster on the
same runner (1000 dense: 958-992 us before, 708-728 us after).
