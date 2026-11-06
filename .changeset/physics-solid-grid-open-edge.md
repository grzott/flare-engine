---
'@flare-engine/physics': patch
---

`buildSolidGrid(width, height, tileSize, tiles, options?)` takes a `SolidGridOptions` with
`outside?: 'solid' | 'open'` (default `'solid'`), stored on the returned `SolidGrid` as `outside`.
With `'open'`, `isBlockedAABB` treats cells outside the grid as empty and tests only the in-grid
cells the box overlaps, so `moveAndSlideInto` lets a body walk off the map edge — for seams between
adjacent region maps. A grid built without the option is unchanged: leaving the map still blocks.
The `SolidGridOptions` and `SolidGridOutside` types are exported.
