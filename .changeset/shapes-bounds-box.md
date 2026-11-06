---
'@flare-engine/shapes': patch
---

`shapeBoundsBox(specs)` and the zero-alloc `shapeBoundsBoxInto(specs, out)` return a `ShapeBoundsBox`
`{ minX, minY, maxX, maxY }` in the composition-local frame: the union of every spec's extents at its
`ox`/`oy`, each widened by the same `+2` + stroke + glow margin `shapeBoundsRadius` adds. Unrotated
geometry is exact (a `ship` unions its hull, weapons and engine); a spec with a non-zero `rot` falls
back to its radial reach, so the box never exceeds the radius on any axis. Empty `specs` give zeros.
