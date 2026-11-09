---
'@flare-engine/animation': patch
---

`updateSpring` advances with the exact damped-oscillator solution instead of one semi-implicit
Euler step of the whole `dt`, so a clamped 0.25 s hitch frame no longer blows a default spring up
(one such frame carried a displacement of 1 to −5.25 and the series diverged; now the spring's
energy never grows, so a spring released from rest stays within its starting displacement) and n
steps of `dt` equal one step of n·`dt`. Trajectories at
ordinary frame rates differ slightly from the old Euler steps; settle thresholds and `atRest`
behaviour are unchanged.
