---
'@flare-engine/physics': patch
---

Documents two `CollisionWorld.raycast` behaviours that matter in tile-scale worlds (#510). No behaviour changes.

- **The broadphase cell is a fixed 64 world units.** There is no option to change it. In a world of one unit per tile, colliders crowd a few cells, so `raycast` and `step` approach a scan of every collider. The README and the `CollisionWorld` JSDoc now say so.
- **A ray that starts inside a collider hits it at its exit distance**, not at 0. Its `normal` differs by shape: for a box, the face the ray entered through behind its origin; for a circle, the outward normal at the exit point. To skip that collider, use a layer `mask`, or start the ray just past the collider's edge. A ray that starts exactly on the edge still hits it, at distance 0. This is now in the JSDoc of `CollisionWorld.raycast` and of the standalone `raycast`, and in the README.
