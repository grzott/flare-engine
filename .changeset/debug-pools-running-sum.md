---
'@flare-engine/debug': patch
---

`DebugOverlay` reuses pooled command objects: once the pools are warm, `drawRect` / `drawCircle` /
`drawLine` no longer create a command object per call. The objects in `commands` are reused after
`clear()`, so copy a command to keep it past the frame. `createFrameBudget` keeps a running fps
sum, re-summed each time the ring wraps, instead of re-summing the whole ring on every
`recordFrame`. After a non-finite `dt`, `getAvgFps()` therefore reads 0 until the first wrap after
that sample leaves the ring (under two ring lengths in all, previously one). A finite `dt` above
2^24 s (about 194 days) can leave a slightly inexact reading for the same span, and an absurd one
(1e15 s in testing) a wrong one. The boot trace and the perf recorder share one internal clock
helper; no API change.
