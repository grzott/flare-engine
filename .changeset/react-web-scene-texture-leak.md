---
"@flare-engine/react": minor
---

Fix `<GameView>` painting nothing on web. RN-Skia's web `MakeOffscreen` builds a fresh
`OffscreenCanvas` and WebGL context per call and releases neither, and `GameView` pushes a new
picture every frame — so the per-frame `usePictureAsTexture` allocation crossed Chrome's
16-live-WebGL-context cap within ~16 frames, the on-screen `<Canvas>` was evicted as the oldest
context, and the game loop kept running while nothing rendered.

Scene capture is now platform-branched inside the package. Web captures into a single offscreen
surface reused across frames — reallocated only when the viewport size changes — and detaches each
snapshot with `makeNonTextureImage()`. Native keeps RN-Skia's `usePictureAsTexture` unchanged. Both
hooks run on both platforms, each made inert by a null picture, so hook order never varies. Postfx
composition is untouched and identical on both platforms.

`react-native-web` and `canvaskit-wasm` are declared as optional peer dependencies. No new exported
API.
