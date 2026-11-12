---
"@flare-engine/physics": patch
"@flare-engine/tilemap": patch
"@flare-engine/engine": patch
"@flare-engine/create": patch
---

Three new exports for reading and writing one map cell, also re-exported by `@flare-engine/engine`. `setSolidAt(grid, col, row, solid)` in `@flare-engine/physics` marks a `SolidGrid` cell solid or empty and returns `true`; when `col` or `row` is out of range or not an integer it writes nothing and returns `false`. `isSolidAt(grid, col, row)` reads a cell; coordinates that name no cell follow the grid's `outside` rule, so they are solid on an `outside: 'solid'` grid and empty on an `'open'` one. `setTileAt(layer, col, row, gid)` in `@flare-engine/tilemap` writes a raw GID into a `TileLayer` cell that `getTileAt` and the renderer read back, with the same `true` / `false` return. None of them allocates. The `topdown` template's door code and its tests now call these instead of computing the row-major index by hand.
