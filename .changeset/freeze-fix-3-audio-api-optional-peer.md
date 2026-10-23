---
'@flare-engine/audio': patch
'@flare-engine/engine': patch
---

FREEZE-FIX-3: `react-native-audio-api` is now an optional peer of `@flare-engine/audio` and
`@flare-engine/engine`. Per ADR-0010.

Neither package imports it: `AudioManager` types the audio context structurally and the app passes
one in. As a required peer, npm and bun installed it into every app that depends on
`@flare-engine/engine`, all three starter templates included, and Expo autolinked and compiled it
whether or not the app played a sound. On Windows that native build cannot complete with the stock
Android toolchain (its object paths run past the 260-character limit), so a fresh scaffold could not
build for Android there.

If your app plays audio on native and relied on that automatic install, add the package yourself
(`bun add react-native-audio-api`). Until you do, bundling fails with "Unable to resolve module
react-native-audio-api". Apps that never used it drop an unused native module. No exported name,
signature or type changes.
