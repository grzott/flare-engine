---
'@flare-engine/scene': patch
---

`SceneManager.go()` called from a scene's `onEnter` now takes effect under an animated transition.
When the scene entered at the end of a fade-out called `go(name)` from its `onEnter`, the manager
started its fade-in over the fade-out that call had just begun, so the new target was never entered
and stayed pending: `push()` and `pop()` were then ignored. The fade-out to the new target now
runs — the scene that redirected stays current until it ends, then gets `onExit` and `onDestroy`,
and the target gets `onInit` and `onEnter` with the data passed to that `go()`.

Likewise, an instant `go()` (after `setTransition(noneTransition())`) or a `destroy()` made from
that `onEnter` no longer leaves a fade-in running. No exported symbol or signature changes.
