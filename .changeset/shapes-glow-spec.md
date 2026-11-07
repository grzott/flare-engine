---
'@flare-engine/shapes': patch
---

`BaseSpec.glow` also takes a `GlowSpec` `{ color, width }`: `drawShape` paints one `width` px ring in
`color` (ARGB) with its inner edge 2.5 px outside the body, so `{ color: friendlyGlowArgb(), width: 3 }`
paints exactly what `'friendly'` paints. `shapeBoundsRadius` and `shapeBoundsBox` widen by `2.5 + width`
for the object form; a non-finite or negative `width` paints no ring and adds no reach. `applyGlow(canvas,
paint, cx, cy, r, color, width)` draws the ring directly. `'friendly'` and `'hazard'` are unchanged.
