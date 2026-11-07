---
'@flare-engine/react': patch
'@flare-engine/engine': patch
---

Exports `SkOffscreenSurfaceLike`, the surface `SkiaModuleLike.Surface.Make` and `MakeOffscreen`
return, from `@flare-engine/react` and the `@flare-engine/engine` umbrella, so a host typing a fake
Skia module can name it. It was declared as `SkSurfaceLike` but never exported; the new name avoids
clashing with `@flare-engine/assets`' different `SkSurfaceLike`. Nothing else changes.
