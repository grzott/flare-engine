---
'@flare-engine/react': patch
---

`GameView` now picks up a pixel-ratio change after it mounts.

The frame loop used the `PixelRatio.get()` value read at mount for the whole life of the view, so a scale change that arrived later left the scene rendered at the old ratio. `GameView` now re-reads `PixelRatio.get()` on every render and whenever React Native's `Dimensions` emits `change`, and the frame loop uses the current value from the next frame on.

With the new ratio, the frame is recorded at the new physical size, the scene capture is taken at that size (the offscreen surface is reallocated once, when the size changes), and on web the postfx passes are compiled for that size.

A scale change is only seen when it causes a `GameView` render or a `Dimensions` `change` event.

<!-- Third-party names: React Native's PixelRatio.get and Dimensions. -->
<!-- symbols-ok: PixelRatio.get, Dimensions -->
