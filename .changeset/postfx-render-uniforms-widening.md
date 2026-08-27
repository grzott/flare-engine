---
'@flare-engine/postfx': patch
'@flare-engine/render': patch
---

Widen `makeShaderWithChildren` uniforms parameter to `Float32Array | number[]` in both `SkiaRuntimeEffectLike` (postfx) and `FrameRendererCompiledPass.shader` (render), making `PostFxRuntime` structurally assignable to `FrameRendererPostFxRuntime` without a type bridge.
