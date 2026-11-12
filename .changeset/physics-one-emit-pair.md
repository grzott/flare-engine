---
"@flare-engine/physics": patch
---

Internal refactor: `CollisionWorld` now decides trigger vs collision, and emits the matching enter or exit signal, in one private helper instead of three copies in `remove` and `step`. No behaviour or API change: a pair where either entity is a trigger still emits `onTriggerEnter` / `onTriggerExit`, any other pair still emits `onCollisionStart` / `onCollisionEnd`, in the same order, and a pair object is still allocated only when a pair starts or ends.
