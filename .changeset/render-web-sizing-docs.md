---
'@flare-engine/render-web': patch
---

Document who owns canvas sizing. No behaviour change.

The README gains a "Sizing" section, and the `createPostFxSurface` and `createWebSurface` JSDoc say the same: both surfaces take their size from `canvas.width` and `canvas.height` (device pixels) when they are created, and nothing in the package watches `devicePixelRatio` or the element's size. The caller sizes the backing store to the CSS size times `devicePixelRatio`, watches the element with a `ResizeObserver` and the ratio with a `matchMedia` resolution query, and calls `PostFxSurface.resize()` — or, for a `WebSurface`, which has no `resize()`, disposes it and creates a new one. The README carries a compiled example.
