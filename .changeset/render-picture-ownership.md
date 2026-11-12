---
"@flare-engine/render": patch
---

The `FrameRenderer` JSDoc now says who owns the picture `endFrame()` returns: the caller draws it and then releases it (with CanvasKit, `delete()`); the renderer never frees it. The `@flare-engine/render-web` README's frame loop now deletes the picture after drawing it, so code copied from it no longer leaks one WASM-side object per frame. Documentation only.
