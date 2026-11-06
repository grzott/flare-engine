---
'@flare-engine/audio': patch
---

Fix `SFXPool` and `Music` registering the end-of-playback callback as `onended` while
`react-native-audio-api` exposes it as `onEnded`, so the library never called it: finished voices
were never released (`activeCount` over-reported, per-voice gains stayed connected, and at
`maxPolyphony` every `play()` cut off a possibly still-playing sound) and `Music.playing` stayed set
after a non-looping track ended. Both now register through whichever accessor the node exposes.
`AudioBufferSourceNodeLike` gains an optional `onEnded` member; `onended` is unchanged.
