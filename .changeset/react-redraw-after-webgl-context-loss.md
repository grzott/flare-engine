---
'@flare-engine/react': patch
---

On the web, `<GameView>` now draws again after the on-screen canvas loses its WebGL context (#583).
Nothing listened for the loss before, so the field stayed black while the loop and the overlay
children kept running.

`GameView` finds the on-screen `<canvas>` under its container view and listens for
`webglcontextlost` (calling `preventDefault()`) and `webglcontextrestored` on it. At the restore, or
on the first frame after a loss when no restore has arrived by then, it disposes the scene capture,
so the next frame builds a new offscreen surface, and remounts `<Canvas>` under a new `key`, which
gives it a new `<canvas>` element and context. The listeners come off the old canvas before that
remount.

Only a loss of the on-screen canvas's context is detected. The capture surface's canvas is internal
to RN-Skia's `MakeOffscreen`, so a loss of that context alone is still not seen. The recovery is
covered by tests that fire mocked events on a fake canvas; it has not been run against a real
context loss in a browser.

Native is unchanged. No exported symbol or signature changes.
