---
"@flare-engine/physics": patch
---

OSS-M11 (additive half): minimum-translation vectors and a broadphase-backed world raycast.

`overlapInto(a, ax, ay, b, bx, by, out)` returns the shortest push separating two overlapping shapes — a unit axis and a penetration depth — with `overlap()` as the allocating twin. `shapeOverlap` previously answered only *whether* two shapes collide, leaving a detection-only consumer with no way to resolve it. Returns `null` when apart, leaving the buffer untouched; concentric circles get a usable axis instead of `NaN`.

`CollisionWorld.raycast(ox, oy, dx, dy, maxDist, mask?)` casts against the world's own colliders, walking only the broadphase cells the ray touches and filtering by the `layer` bits colliders already carry. The standalone `raycast(..., targets)` neither saw the world nor used the index, and allocated a hit record per candidate tested; the new method reuses one record, backed by a new zero-alloc `rayVsShapeInto` primitive.

Also corrects the package README, which still described the broadphase as brute-force — it has been a uniform spatial hash since 0.3.1.
