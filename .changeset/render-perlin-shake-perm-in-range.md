---
'@flare-engine/render': patch
---

`Camera2D.shakePerlin` no longer reads past the end of its noise permutation table. The table held
256 entries while the nested lookups reach index 511; an out-of-range read fell back to the first
gradient direction, which biased the noise in the affected cells. The table now stores the same
256-entry shuffle twice, so every lookup is in range.

One visible difference: the Y offset of a Perlin shake (`effectiveY`) takes different values at some
points in time. The X offset is unchanged, as are the offset range, the decay and the duration.
