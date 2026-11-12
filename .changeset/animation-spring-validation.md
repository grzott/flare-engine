---
"@flare-engine/animation": patch
---

`spring(value, target, config)` now throws a `RangeError` naming the field when `mass` is not above 0, `stiffness` or `damping` is negative, or any of the three is `NaN` or infinite. Before, these were accepted, and `updateSpring` then produced `NaN`, a value that ran away without bound, or (with `stiffness: 0`) motion that ignored the damping or never moved; none of them ever gave a usable spring. `stiffness: 0` and `damping: 0` are still valid. Only the config passed to `spring()` is checked: later edits to `s.config` are not, so `updateSpring` stays check-free.
