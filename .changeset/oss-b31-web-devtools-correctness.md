---
"@flare-engine/render-web": minor
"@flare-engine/devtools": minor
---

render-web: `createPostFxSurface`'s composite blit now binds each pass's extra sampler children (the `color-grading-lut` LUT `SkImage`, wrapped as a shader) after the source shader before `makeShaderWithChildren`, so LUT color grading renders on the CanvasKit web backend instead of leaving the LUT sampler unbound. The reused children buffer is resized in place (no per-pass allocation) and each wrapped child shader is freed after the draw. Latent fix — no shipping consumer wires `color-grading-lut` into a web chain today.

devtools: `TimeScrubber.resume()` restores the timescale captured at `pause()` instead of hardcoding `1`, so resuming an active slow-motion (e.g. 0.5×) returns to that rate. `pause()` only records a non-zero timescale, so a double pause (including the internal `pause()` in `rewind()`) can't store `0` and freeze the loop on resume. Mirrors `@flare-engine/debug`'s `TimeControl`.
