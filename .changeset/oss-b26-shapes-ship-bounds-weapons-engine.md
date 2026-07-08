---
"@flare-engine/shapes": minor
---

shapes: ShipSpec bounds now include weapons and the engine, not just the hull.

`singleShapeRadius('ship')` and the atlas-tile `boundsR('ship')` returned the hull radius alone, so a wing `RectSpec` mounted at an `ox`/`oy` beyond the hull (or the offset engine `SquareSpec`) was rasterized into a hull-sized atlas tile and clipped by its `drawShape` glow ring. Both now return the max reach across the hull, every weapon (`hypot(ox, oy) + weapon radius`), and the engine, so a wing-weapon ship's atlas tile and glow ring contain the full silhouette.
