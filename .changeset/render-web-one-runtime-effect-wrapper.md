---
'@flare-engine/render-web': patch
---

Internal refactor: the frame renderer module and the postfx surface now share one CanvasKit `RuntimeEffect` wrapper, so each wrapped effect carries both `makeShader` with uniform reflection and `makeShaderWithChildren`; no change to the exported types or to the calls made to CanvasKit.
