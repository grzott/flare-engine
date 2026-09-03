---
"@flare-engine/math": patch
---

OSS-M9: curves, segment intersection points, and RNG state.

New `curves.ts` — `bezier2` / `bezier3` / `catmullRom` point sampling with `…Into` twins for per-frame use, plus `bezier2Length` / `bezier3Length` / `catmullRomLength` chord-approximated arc length. Control points are loose numbers rather than `Vec2`, so coordinates already in a `Float32Array` sample without temporaries; `t` is clamped rather than extrapolating.

`intersection.ts` could previously only answer *whether* things intersect. `segmentIntersection` / `segmentIntersectionInto` now answer *where* two segments cross, returning `null` when there is no single point (missing, parallel or collinear) and leaving `out` untouched in that case. `segmentsIntersect` is the boolean companion and reports collinear overlap as `true`.

`SeededRNG.getState()` / `setState(state)` expose the generator's whole state as one JSON-safe int32, so a save file or replay can resume the exact sequence.
