---
'@flare-engine/audio': patch
---

`PlaySFXOptions` gains an optional `delay` in seconds. When it is a finite number above 0,
`SFXPool.play` passes `ctx.currentTime + delay` to the source's `start`, so a cue scheduled ahead
lands on the audio clock instead of the next frame; the voice counts toward polyphony from `play`
and the handle's `stop()` cancels a not-yet-started source. A missing, non-positive or non-finite
delay calls `start()` with no argument, as before.
