---
'@flare-engine/scene': patch
---

`SceneManager.push(name, data?, options?)` takes a `ScenePushOptions` with `overlay?: boolean`. An
overlay scene is updated and drawn after the scene below instead of replacing it: the scene below
gets no `onExit` on the push and no `onEnter` on the matching `pop()`, and nested overlays update
and draw bottom-up (each scene `onUpdate` then `onDraw`). A transition started while an overlay is
up keeps driving the whole live stack. A plain `push` (no options, `{}` or `{ overlay: false }`) is
unchanged. `update()` stays allocation-free: it walks the existing stack from the lowest scene not
under an overlay, tracked by a parallel flag array kept in lockstep with the stack.
