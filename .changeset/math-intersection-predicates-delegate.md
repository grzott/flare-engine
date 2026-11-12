---
"@flare-engine/math": patch
---

`pointInRect`, `pointInCircle`, `rectVsRect`, `rectVsCircle` and `circleVsCircle` now call `Rect.contains`, `Circle.contains`, `Rect.intersects`, `Circle.intersectsRect` and `Circle.intersects` instead of repeating the same expressions, so each predicate has one body. Internal only: no exported name, signature or result changes.
