---
"@flare-engine/react": patch
---

Internal refactor: `useOverlayFade` and `useCountUp` now run through one shared private `requestAnimationFrame` tween instead of two copies of the same code. No behaviour or API change: the fade still eases linearly over 300 ms by default, the count-up still eases out cubically over 600 ms, both still snap to the target when `requestAnimationFrame` is absent, and an interrupted tween still continues from the value on screen.
