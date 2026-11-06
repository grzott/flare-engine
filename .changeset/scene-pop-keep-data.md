---
'@flare-engine/scene': patch
---

`SceneManager.pop(options?)` takes a `ScenePopOptions` with `keep?: boolean` and `data?: unknown`.
With `keep: true` the popped scene gets `onExit` only and stays initialized, so the next `push` of
its name goes straight to `onEnter` instead of re-running `onPreload` → `onInit`; a later `go()`
(instant or animated) or `destroy()` still calls `onDestroy` on a kept scene that was never pushed
again, and `go()` to the kept name restarts it from a fresh instance. `data` is forwarded to the
revealed scene's `onEnter`, as `go` and `push` already do; it is dropped when the popped scene was
an overlay, which gives the scene below no `onEnter`. A plain `pop()` (no options, `{}` or
`{ keep: false }`) is unchanged: `onExit` + `onDestroy`, then `onEnter()` below.
