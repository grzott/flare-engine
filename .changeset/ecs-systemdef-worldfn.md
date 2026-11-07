---
'@flare-engine/ecs': patch
---

`SystemDef` gains `worldFn`, the public name for the wrapper to pass to `world.addSystem` /
`removeSystem`; it is the same function reference as `_worldFn`, which is now `@deprecated` and stays
until the next planned minor.
