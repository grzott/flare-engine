---
'@flare-engine/react': patch
---

`GameConfig.opaque` no longer recommends `true` on Android. Docs only: there is no behaviour change, and the default stays `false`.

**What `opaque: true` costs.** On a 90 Hz Pixel 7 it put the game loop on a SurfaceView whose buffer queue stays full.
- `requestAnimationFrame` arrived every other vsync: 45 Hz at 90 Hz, and 30 Hz at 60 Hz.
- Frames reached the screen about 40 ms after they were queued.
- With the default TextureView, an empty GameView loops at the display rate.

**What the default costs.** RN-Skia logs a harmless pair on every render, which the JSDoc tells you how to filter out of logcat.

**What to do.** Keep `opaque: true` only for overlays that a TextureView clips.
