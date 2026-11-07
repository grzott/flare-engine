---
'@flare-engine/dynamics': patch
---

`createWorld({ sleep: { linearThreshold, angularThreshold, steps } })` opts into per-body sleeping
(off when absent, so existing worlds are unchanged): a dynamic body under both thresholds for
`steps` consecutive steps has its velocities set to exactly 0 and is skipped by integration and by
pair tests against other sleeping or static bodies, until an awake body that moved on the previous
step touches it, its `velocity`, `angularVelocity`, `position` or `angle` is written, or
`wakeBody(world, body)` is called; a world not created by `createWorld` steps with sleeping off.
`isSleeping(world, body)` reads one body and `isAtRest(world)` is true once every dynamic body
sleeps. A negative or non-finite threshold, or a `steps` that is not an integer >= 1, throws a
`RangeError`. `SleepOptions` is exported.
