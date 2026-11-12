---
"@flare-engine/math": patch
---

`rayVsRect`: an axis-parallel ray (`dirX === 0` or `dirY === 0`) whose origin lies exactly on the rect's min or max on that axis returned `NaN` instead of `number | null`. It now returns a finite `t` or `null`: rect edges are inclusive, so a ray running exactly along an edge hits (`rayVsRect(0, -5, 0, 1, { x: 0, y: 0, width: 10, height: 10 })` is `5`), and one pointing away from the rect returns `null`. A zero direction (`dirX === 0 && dirY === 0`) now returns `null`; before, it returned `Infinity` from strictly inside the rect and `NaN` from an edge. Results for every other input are unchanged.
