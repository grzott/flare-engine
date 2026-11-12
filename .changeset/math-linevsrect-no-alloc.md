---
"@flare-engine/math": patch
---

`lineVsRect` no longer allocates four edge objects and an iterator on every call. It clips against the same four edges in the same order with the same parallel-edge tolerance, so its result is unchanged for every input, including non-finite coordinates.
