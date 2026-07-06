---
"@flare-engine/render": patch
"@flare-engine/render-web": patch
---

render: fix the camera-rotation unit. `Camera2D.rotation` is radians, but both Skia backends (RN-Skia `SkCanvas`, CanvasKit) take degrees, so a nonzero camera rotation was applied ~57× too small (radians treated as degrees). The `CanvasLike` / `DrawSurfaceLike` `rotate` contract is now **degrees**, forwarded verbatim everywhere; `Renderer.applyCamera` converts radians→degrees once at the single camera seam.

render-web: the CanvasKit bridges (`createWebSurface`, `createWebSkiaModule`) forward `rotate` verbatim — now correct under the degrees contract; dropped the stale "dormant mismatch" comments.
