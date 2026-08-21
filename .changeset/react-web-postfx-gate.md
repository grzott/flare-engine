---
"@flare-engine/react": minor
---

Fix web scene capture blank-canvas regression and gate postfx on web.

**Scene capture (WEB-3 F1).** The single-slot frame-image release introduced at WEB-2 was too
aggressive: RN-Skia's web `<Canvas>` paints on its own rAF, which fires *after* the capture, so
releasing the image on the next capture frees an object the canvas is still painting. Measured at
2560×1215: hold=1 and hold=2 both produce a blank canvas with a per-frame
`BindingError: Cannot pass deleted object as a pointer of type Image const*`; hold=3 renders 1378
frames with zero errors. `createSceneCapture` now uses a FIFO retention ring of depth 3 — the
measured minimum.

**PostFx gate (WEB-3 F2).** `Skia.RuntimeShaderBuilder` and
`ImageFilter.MakeRuntimeShaderWithChildren` both throw `Not implemented on React Native Web` in
RN-Skia 2.4.18, so any `<GameView>` with a non-empty postfx chain would throw on every frame on
web. `GameView` now skips `buildPostFxPasses` and `setPasses` entirely when
`Platform.OS === 'web'`, and emits a one-time `console.warn` naming the reason. Native behaviour is
byte-for-byte unchanged.
