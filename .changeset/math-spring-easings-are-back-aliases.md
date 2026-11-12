---
"@flare-engine/math": patch
---

`springIn`, `springOut` and `springInOut` are now documented as what they are: the Back curves under a second name — one overshoot, no oscillation, not damped springs. `springIn` and `springOut` call `easeInBack` and `easeOutBack` instead of repeating their expressions; `springInOut` keeps its own body. All three names stay exported and no result changes.
