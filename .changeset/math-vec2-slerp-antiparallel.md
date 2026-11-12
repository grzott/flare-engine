---
"@flare-engine/math": patch
---

`Vec2.slerp`: antiparallel unit inputs no longer collapse. `Vec2.slerp({ x: 1, y: 0 }, { x: -1, y: 0 }, 0.5)` returned `{ x: 0, y: 0 }`, and `t = 0.25` on the same pair returned a vector along `a` instead of 45° from it; an input `1e-7` rad short of antiparallel returned length `1.0002` at `t = 0.25`. When the angle between `a` and `b` is within `1e-6` rad of π, `slerp` now rotates `a` by `t·π`, turning toward `Vec2.perp(a)` (`(-y, x)`, clockwise in y-down screen space), so the result is a unit vector and `t = 0.5` is `Vec2.perp(a)`. In that band `t = 0` returns `a` and `t = 1` returns `b` exactly, and the `out` form writes the same values. Results for every other input are unchanged.
