---
'@flare-engine/shapes': patch
---

PF-4: settle the published surface of `shapes` before the 0.4.0 freeze. Per ADR-0004.

`drawShip`'s engine block now routes through `drawShape` instead of calling `drawRect` directly, so
`ShipSpec.engine`'s `ox`/`oy`/`rot` are actually applied and its `glow` ring is actually drawn — both
were silently dropped before, painting the engine on the hull centre regardless of its offset.

`shapeBoundsRadius` adds a stroke-width margin (`max(2, strokeWidth / 2)`, on top of the existing
`+2`, only where a stroke is actually painted — always for `ring`/`polyline`, otherwise only when
`stroke` is set) and the full extent of a `glow` ring (+5.5 friendly, +2.25 hazard). The documented
contract already promised stroke widths were counted; they weren't, and neither was the glow ring
`drawShape` paints, so a tile sized from the old value could clip a stroke or lose the glow ring
entirely. The no-stroke, no-glow case is unchanged.

`applyFriendlyGlow` / `applyHazardGlow` drop their unused leading `Skia` parameter.
