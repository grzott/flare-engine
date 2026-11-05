---
'@flare-engine/tilemap': patch
---

`TilemapRenderer` now draws `TileLayer.opacity`: every queued tile carries the layer's opacity as its
`alpha`, so a layer authored at 40 % in Tiled or LDtk renders at 40 % instead of fully opaque. Both
parsers already populated the field; the renderer never read it. `drawInto(camera, batch)` and
`draw(camera, flush)` take an optional third argument `{ effect?, alphaScale? }`
(`TilemapDrawOptions`): `effect` is set on every tile command, so one shared `tint()` instance can
cover the ground in the same batch run as the actors, and `alphaScale` multiplies each layer's
opacity (default 1). The two-argument calls are unchanged. No per-tile allocation: the fields pass
positionally into `SpriteBatch.drawRaw`.
