---
'@flare-engine/physics': patch
'@flare-engine/tilemap': patch
---

HYG13/HYG16-PRE: bound the raycast broadphase walk; select AutoLayer tiles by `__type`. Per ADR-0004.

`CollisionWorld.raycast` now rejects a non-finite `maxDist` (returns `null`) instead of reaching
`SpatialIndex`'s cell-range loop with an infinite bound. `SpatialIndex.query`/`insert`/`update` also
clamp the derived cell range to the packed key's supported extent (±2,097,152 world units), so an
entity positioned at an infinite coordinate (`setPosition(e, Infinity, y)`) no longer hangs the JS
thread or grows a broadphase bucket without bound. An unbounded ray must now pass a large finite
`maxDist` (e.g. the map's diagonal) — "cast until it leaves the world" is not a supported contract
for a uniform-grid broadphase.

`parseLDtk` selected an AutoLayer's tiles with `layer.gridTiles ?? layer.autoLayerTiles`, which never
falls through to `autoLayerTiles` because a real AutoLayer's `gridTiles` is `[]`, not `null`/`undefined`
— every LDtk AutoLayer (the standard way to author auto-tiled terrain) parsed as an empty, all-zero
layer with no error. Selection is now keyed on `layer.__type === 'AutoLayer'`, matching the field LDtk
itself keys on; `gridTiles`/`autoLayerTiles` on the parser's internal `LDtkLayerInstance` type are no
longer optional, documenting that real LDtk output always carries both arrays. This is accurate
self-documentation, not a typecheck guardrail: `parseLDtk(json: unknown)` narrows via a bare
`as LDtkJSON` assertion, so a fixture omitting either field still compiles.
