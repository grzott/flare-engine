---
"@flare-engine/audio": patch
---

`Music.stop()` and `Music.play()` called during a crossfade now stop the fading-out track immediately; before, it stayed audible until its scheduled stop, up to the crossfade `duration`. A second `crossfadeTo` while a fade is still running stops the older fading-out track at once and fades out the current one.
