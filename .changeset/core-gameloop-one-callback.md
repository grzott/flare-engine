---
"@flare-engine/core": patch
---

`GameLoop` now hands the same frame callback to `requestAnimationFrame` (or a custom `tick`) on every frame, instead of creating a new closure per frame, so a running loop allocates nothing per frame for scheduling. Frame timing, the one-frame-chain guarantee and stop/start behaviour are unchanged.
