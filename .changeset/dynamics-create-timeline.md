---
'@flare-engine/dynamics': patch
---

`createTimeline(elementCount, dt, opts?)` records a fixed-step simulation once into a pre-allocated
`Float32Array` and replays it by sampling. `opts.stride` (default 3: dx, dy, angle) sets the floats
per element per frame and `opts.maxFrames` (default 900) the cap; the buffer is sized at creation.
`record(writer, until?)` writes frames until `until()` returns true or the buffer is full, exactly one
frame when `until` is omitted, and never calls the writer once full or when `elementCount` is 0; the
writer gets `(buf, frameBase)` with element `i` at `frameBase + i * stride`. `sampleInto(progress,
out)` clamps `progress` to `[0, 1]` (NaN reads as 0), lerps the two bracketing frames into `out`
without allocating, writes zeros before the first frame and copies a lone frame; values are stored as
written, so cumulative angles lerp forward across multi-turn spins. `frameCount` and `duration`
(`(frameCount - 1) * dt`, 0 below two frames) are read-only getters. A non-integer or negative
`elementCount`, a non-finite or non-positive `dt`, or a `stride` / `maxFrames` below 1 throws a
`RangeError` naming the argument. `Timeline`, `TimelineOptions` and `TimelineWriter` are exported.
