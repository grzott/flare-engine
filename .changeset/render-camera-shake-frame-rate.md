---
'@flare-engine/render': patch
---

`Camera2D.shake()` now looks much the same whatever rate `update()` is called at.

Before, every `update()` drew a new, unrelated jitter value, so the camera jumped once per call and a faster display shook harder: the same `shake(10, 1)` travelled about 164 units along X in its one second when stepped at 60 Hz, 393 at 120 Hz and 436 at 144 Hz.

The jitter is now a function of the shake's elapsed time: 60 jitter values per second, with the offset interpolated linearly between neighbouring values. The same shake now travels about 178 units at 60 Hz, 178 at 120 Hz and 160 at 144 Hz. The figures do not match exactly at rates that are not a multiple of 60, because frames that fall between two jitter values round off the peaks; a rate below 60 Hz skips values and travels less.

The per-frame offsets of a given shake are different from before, so anything that compared `effectiveX` / `effectiveY` during a shake against recorded values needs new values. Intensity, duration, the linear decay and `setMotionScale` behave as before, and `shakePerlin` is unchanged.
