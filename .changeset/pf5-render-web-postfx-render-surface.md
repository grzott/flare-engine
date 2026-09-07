---
"@flare-engine/render-web": patch
"@flare-engine/postfx": patch
"@flare-engine/render": patch
---

PF-5: settle the render-web, postfx and render surface before the freeze. Per ADR-0004.

`createWebSurface` now returns a `WebSurface` handle — `{ canvas, ckCanvas, flush(), dispose() }` — instead of a bare `CanvasLike`. The previous return hid the CanvasKit surface, so nothing drawn through it could be presented or freed; the README presentation example now goes through the function instead of around it.

`PostFxSurface.composite(globalIntensity?)` takes its argument optionally and writes it into the chain only when given. Every frame it used to overwrite `chain.globalIntensity`, undoing a reduced-motion scale set through `PostFxController.setMotionScale` or the a11y bridge; the README recipe that taught `composite(1)` now calls `composite()`.

`COMPOSITE_SKSL`'s clouds branch honours `weatherDirection` with the same rotated scroll as `WEATHER_CLOUDS_SKSL`; it had stayed on the X-only scroll when the standalone shader gained a direction. Rendering changes for anyone on the composite clouds path with a non-zero direction.

`PostFxController.triggerTimed` is required on the interface (it was always implemented). `render` no longer exports `ColorLike`, an alias nothing referenced.
