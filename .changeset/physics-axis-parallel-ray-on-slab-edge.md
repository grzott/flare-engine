---
"@flare-engine/physics": patch
---

Ray vs AABB: an axis-parallel ray (`dx === 0` or `dy === 0`) whose origin lies exactly on the box's min or max on that axis made `raycast()` and `rayVsShapeInto` return a hit with `NaN` `distance` and `point`. They now return a finite hit, so a ray running exactly along a box edge hits the box, and `CollisionWorld.raycast` reports that hit. A zero-length direction (`dx === 0 && dy === 0`) now returns no hit for an AABB.
