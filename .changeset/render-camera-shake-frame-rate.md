---
'@flare-engine/render': patch
---

`Camera2D.shake()` now moves about the same whatever rate `update()` is called at.

Before, every `update()` drew a new, unrelated jitter value, so the camera jumped once per call and a faster display shook harder. Measured as the mean path along X of one `shake(10, 1)`, over 32 runs with frames offset against the shake and frame times varied by up to 3%, it travelled about 201 units when stepped at 60 Hz, 393 at 120 Hz, 478 at 144 Hz and 549 at 165 Hz.

The jitter is now a function of the shake's elapsed time: 30 values per second, eased (smoothstep) from one to the next. Measured the same way, the shake travels about 90 units at 60 Hz, 96 at 120 Hz, 97 at 144 Hz and 97 at 165 Hz. The rates agree within about 8% from 60 Hz up; 60 Hz is a little lower because some peaks fall between its frames. Below 60 Hz, more peaks fall between frames and the path is shorter.

The shake looks different from before. It changes direction about 30 times a second at every rate, instead of once per update, so it is smoother and covers about half the ground per second that the old shake did at 60 Hz. The maximum offset is the same. The per-frame offsets of a given shake are different, so anything that compared `effectiveX` / `effectiveY` during a shake against recorded values needs new values. Intensity, duration, the linear decay and `setMotionScale` behave as before, and `shakePerlin` is unchanged.
