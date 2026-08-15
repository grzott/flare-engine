---
'@flare-engine/render-web': minor
---

Take explicit ownership of the WebGL context so `dispose()` frees the `GrDirectContext` and the
context handle instead of leaking one per surface; self-heal on `webglcontextlost` /
`webglcontextrestored`; add `isLost()`; set `Src` blend on the composite blit so a pass cannot
composite stale ping-pong content; and make `loadCanvasKit` retry after a failed load instead of
caching the rejection, bounded by stall and deadline timers.

`onscreenCanvas()` and `sceneCanvas()` now return `Canvas | null` — both are null while the WebGL
context is lost.
