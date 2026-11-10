---
'@flare-engine/simulation': patch
---

`NBodySystem.step` now advances the system by calling the exported `verletStep` instead of carrying
its own copy of the same drift / acceleration / half-kick loops, so the package has one
velocity-Verlet implementation. No behaviour change: `verletStep` itself is untouched, and a seeded
8-body run of 200 steps (with and without the `gr` precession term) produces bit-identical
`px/py/vx/vy` to the previous integrator. The step still allocates nothing.
