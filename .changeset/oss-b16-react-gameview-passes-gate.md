---
"@flare-engine/react": patch
---

GameView no longer churns postfx state every frame. `setPasses` is now gated on a shallow pass signature (length + per-pass `id` + shader ref + child-image refs + uniform values), an empty chain collapses to a shared `EMPTY_PASSES` constant, and the `RuntimeShader` element array, the four responder handlers, and the container style are memoized. Animated effects (hit-flash decay, timed triggers) still propagate because uniform values are part of the signature; a postfx-free or steady chain now triggers zero re-renders from passes after the first frame. No API change.
