---
"@flare-engine/physics": patch
---

Ray vs AABB: an axis-parallel ray (`dx === 0` or `dy === 0`) whose origin lies exactly on the box's min or max on that axis made `raycast()` and `rayVsShapeInto` return a hit with `NaN` `distance` and `point`, whichever way the ray pointed. They now return a finite hit when the ray reaches the box and no hit when it points away from it, so a ray running exactly along a box edge hits the box, and `CollisionWorld.raycast` reports that hit. A zero-length direction (`dx === 0 && dy === 0`) now returns no hit for an AABB.
