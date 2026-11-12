---
'@flare-engine/render': patch
---

Internal refactor: the frame renderer's six zone-background effects (`roofsCity`, `forestCanopy`,
`riverWave`, `moonCrater`, `caveInterior`, `mountainHills`) are now driven by one internal table and
one code path instead of six copies of the same code. No exported symbol changes. Each effect
compiles the same shader string and receives the same ten uniform values in the same order as
before, and a run whose shader is unavailable is still skipped with a single `console.warn` per
renderer.
