---
'@flare-engine/react': patch
'@flare-engine/render': patch
---

`GameView` runs a bound postfx chain on web. The chain is compiled at physical pixels (w*pd × h*pd,
the offscreen surface's size, so every SkSL resolution uniform matches the space the pass is drawn
in) and composited imperatively inside the scene capture: each pass snapshots the one cached
offscreen surface, binds that snapshot as its first child (extra sampler children such as the
color-grading LUT follow positionally), and draws itself back over the same surface as one
full-surface BlendMode.Src rect; the pass shader, every child shader and the snapshot are released
the same frame. The filtered result reaches the plain Image node through the existing
makeNonTextureImage() + retention ring, so no RN-Skia shader node is mounted on web, no second
surface or WebGL context is created, and RuntimeShaderBuilder / MakeRuntimeShaderWithChildren are
never called. The one-time "postfx chain skipped" warning is gone. Native is unchanged.
`FrameRenderer.compilePostFxPasses(runtime, chain, width, height)` returns the runtime's compiled
passes as built (packed Float32Array uniforms) with the same `runtime ?? bound`, `chain ?? bound`
resolution and empty-array rules as `buildPostFxPasses`, which now derives its descriptors from it.
