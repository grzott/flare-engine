---
'@flare-engine/cli': patch
---

Two runtime dependencies of the CLI moved to a new major: commander 13 to 14 and maxrects-packer
2 to 3. Neither changes what the CLI exports or how its commands behave. commander 14 requires
Node 20, which the package already declared in its engines field, so the floor does not move.
maxrects-packer 3 defaults its packer and bin generic to the input-rectangle interface instead of
the Rectangle class, stops copying the first rect's tag onto a non-exclusive bin, and closes deep
imports behind its exports map; the atlas packer passes tag off, reads only a rect's x, y and data
plus the bin's width and height, and imports the package by name, so none of those apply.
