---
"@flare-engine/postfx": minor
---

postfx: align `createColorGradingLut` to the `create*(id, uniforms)` parameter order shared by the 11 sibling effect factories (was `(uniforms, id?)`). Because `uniforms.lut` is required the `uniforms` argument cannot carry a default, so `id` leads and is now required — callers pass an explicit id (e.g. `createColorGradingLut('color-grading-lut', { lut })`). Behavior-preserving; the returned `Effect` is unchanged.
