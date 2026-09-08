---
'@flare-engine/react': patch
---

Document `GameConfig.opaque` as recommended on Android, with the device measurement behind it: the
default TextureView path logs RN-Skia's `LegacySurfaceTexture` / `updateAndRelease` pair 22,028
times per 60s — 90% of all logcat output — where `opaque: true` logs it zero times. Rendering is
correct either way and native memory is flat across a 6-minute soak on both paths, so this is log
noise and TextureView overhead rather than a correctness fix.

<!-- symbols-ok: LegacySurfaceTexture, updateAndRelease -->
<!-- reason: both are @shopify/react-native-skia internals, not Flare exports. Named because the
     Android guidance is about behaviour originating in that dependency. -->
