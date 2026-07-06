---
"@flare-engine/scene": patch
---

scene: fix restart building stale World/Camera2D, fix transition path skipping onPreload await, add dev-mode warning for unknown scene names.

`go(sameScene)` now destroys and evicts the current instance before calling `_getOrCreate`, so restart always produces a fresh `World` and `Camera2D`. The transition path starts `onPreload` concurrently with the fade-out and holds at end-of-out until the Promise resolves before calling `onInit`/`onEnter` — matching the instant path's existing `await` semantics. Calling `go(unknownName)` emits a `console.warn` listing the unknown name and all registered scene names when `__DEV__` is true.
