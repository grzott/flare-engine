---
"@flare-engine/physics": patch
---

The standalone `raycast(ox, oy, dx, dy, maxDist, targets)` now runs every target through `rayVsShapeInto`, the same ray math `CollisionWorld.raycast` uses, and the second, allocating copy of that math is removed. It no longer builds a hit record for each target it tests: a call that hits allocates the one hit it returns, and a call that misses allocates none. Results are unchanged — the closest hit wins, the first of equal-distance targets wins, and the returned hit is still a fresh object the caller may keep.
