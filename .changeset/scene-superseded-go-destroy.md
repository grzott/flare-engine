---
'@flare-engine/scene': patch
---

`SceneManager`: a `go()` issued while an animated `go()` is still fading out now destroys the
superseded target (`onDestroy`, never `onInit` / `onEnter`) and drops it from the cache, so a later
`push()` or `go()` of that name builds and initializes a fresh instance instead of reviving an
uninitialized one. `destroy()` does the same to a pending target. An instant `go()` now ends any
transition in progress: a pending fade-out is cancelled, so the stale target can no longer replace
the new scene, and a running fade-in stops.
