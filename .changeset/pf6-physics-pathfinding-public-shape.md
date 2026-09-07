---
"@flare-engine/physics": patch
"@flare-engine/pathfinding": patch
---

PF-6: settle the published surface of `physics` and `pathfinding` before the 0.4.0 freeze. Per ADR-0004.

- `findPathJPS` now does what its header and the API spec already promised: when any tile costs more than 1 it delegates to weighted A* (`findPath` with `diagonal: true`, forwarding `maxIterations` and `heuristic`). Nothing in JPS read tile costs before, so a weighted grid got a path straight through expensive tiles with the cost reported as if every tile cost 1. Detection is one linear scan of `grid.data` per call.
- `CollisionWorld.addCollider(entity, collider, x, y)` — additive; the seven-positional `add` is unchanged. The collider's `shape` / `isTrigger` / `layer` / `mask` are copied at add time (re-add to change them), so `createCollider` finally has a consumer and one collider can seed many entities. The README example had hard-coded `false` for `isTrigger` while passing the collider's other fields — copied under a trigger collider it silently produced a solid body — and now uses `addCollider`.
- `NavMeshPolygon.neighbors` removed. Nothing read it; adjacency comes from `portals[].neighborId`, so every mesh author was filling a dead field.
- `SpatialEntry<T>` is no longer exported. No public signature produced or accepted it.
- `SolidGrid.solid` is a `Uint8Array` of `width * height` cells (`row * width + col`, non-zero = solid) instead of a `Set<number>`. `buildSolidGrid` and its `readonly SolidTile[]` input are unchanged. This is a type decision for bulk data; there is no solid-grid benchmark, so the runtime effect is unmeasured.
