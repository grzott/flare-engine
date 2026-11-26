---
'@flare-engine/physics': patch
---

Pixel-mask collision: a `MaskShape` and the functions that test one, in a new module beside `Shape`
and `SolidGrid`. Everything here is new; no existing export or signature changes.

`MaskShape` is **not** added to the `Shape` union, and `CollisionWorld`, `shapeOverlap`,
`overlapInto` and `raycast` do not accept one. Keep a box collider for the broadphase and refine the
pairs it reports with the functions below.

- **`MaskShape`** is `{ x, y, w, h, words }`: the bounds of the solid region inside a sprite frame,
  in frame px, and its rows as 32-bit words, `Math.ceil(w / 32)` per row, top row first; bit
  `c & 31` of word `c >>> 5` is column `c` of the bounds. `x` / `y` offset the solid region from the
  frame's corner. `words` is typed as any array-like of numbers, so a `number[]` and a `Uint32Array` both fit.
  `createMaskShape(rows, x?, y?)` builds one from rows of text in which `#` is solid.
- **`MaskPose`** is `{ x, y, cos, sin, px, py, unit }`: world position, cosine and sine of the turn,
  the pivot in frame px, and world units per px. `createMaskPose()` returns an unturned one. A world
  point is taken into the mask's frame by the inverse turn.
- **`isMaskSolidAt(mask, col, row, erode?)`** reads one pixel at integer frame coordinates; with
  `erode` the pixel counts only when its four neighbours are solid too.
- **`maskBoundsInto(mask, pose, out)`** writes the world bounding box of the posed bounds rectangle
  (the box around the turned rectangle, not shrunk to the solid pixels); `maskBounds` allocates one.
- **`maskOverlapsBox(mask, pose, cx, cy, hw, hh, erode?)`** tests a world axis-aligned box. Against
  a turned mask the box is tested by its bounding box in the mask's frame: exact at a multiple of a
  quarter turn, generous by the box's corners at any other.
- **`maskOverlapsSweptBox(mask, pose, x0, y0, x1, y1, hw, hh)`** samples `maskOverlapsBox` along a
  segment, both ends included, at most half a px and at most the box's smaller non-zero half extent
  apart. It takes at most 257 samples, so a segment too long for that spacing is sampled more
  coarsely and can miss.
- **`maskOverlapsCircle(mask, pose, cx, cy, radius)`** tests a circle against each pixel's square in
  the mask's frame, which is exact at any turn. A zero radius hits only strictly inside a pixel.
- **`maskOverlapsMask(a, poseA, b, poseB)`** tests two masks, each turned and scaled on its own.
  Pixels are compared as turned squares by separating axes, not by bounding boxes, so the result is
  exact up to floating-point rounding; for masks at different turns a contact within rounding of
  touching can read either way. It visits the solid pixels of the smaller mask that lie under the
  other's world bounds and, for each, the pixels of the other it can reach.
- **`rayVsMask(mask, pose, ox, oy, dx, dy, len)`** returns the distance along a unit-direction ray
  to the first solid pixel, `0` when the ray starts inside one, `-1` when it meets none within
  `len`. It returns a number only: no hit record, point or normal.
- **`maskStripStop(mask, pose, x0, y0, x1, y1, dirX, dirY)`** returns where a beam filling a world
  rect and travelling along one axis first meets the mask, as a coordinate on that axis, or `NaN`.
  A turned pixel counts by its bounding box, and every pixel of the mask is visited.

In every overlap test, touching is not overlapping. None of the per-frame functions allocates;
`createMaskShape`, `createMaskPose` and `maskBounds` do. `@flare-engine/engine` re-exports all of
it through its existing `export *`.
