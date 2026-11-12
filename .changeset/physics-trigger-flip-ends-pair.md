---
"@flare-engine/physics": patch
---

`CollisionWorld`: re-adding an entity with a different `isTrigger` while one of its pairs was touching gave that pair a mismatched pair of signals. For example, a pair that began with `onTriggerEnter` ended with `onCollisionEnd`, or one that began with `onCollisionStart` ended with `onTriggerExit`, because the end signal was chosen from the flags at the moment the pair ended. A re-add that flips `isTrigger` now ends each active pair whose kind changes during the `add` / `addCollider` call, with the exit signal of its old kind. If the shapes still overlap, the next `step()` starts the pair again with the enter signal of its new kind. A pair whose other side is a trigger stays a trigger pair and gets no signal. Re-adds that keep `isTrigger` are unchanged, and frames without a re-add do no extra work.
