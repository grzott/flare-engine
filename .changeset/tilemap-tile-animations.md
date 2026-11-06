---
'@flare-engine/tilemap': patch
---

`parseTiled` reads Tiled per-tile animations (`tiles[].animation`) onto `TilesetRef.animations`, an
optional `Map<localId, TileAnimation>` set only when a tileset has an animated tile. A
`TileAnimation` holds `frames: Uint32Array` (local ids), cumulative `ends: Float64Array` in seconds
and the cycle `duration`; Tiled's millisecond durations are summed and converted once. A frame
`tileid` that is not an integer in `[0, tilecount)` or a negative or non-finite `duration` throws
`TilemapParseError` naming the tileset and tile; an empty animation or one whose durations sum to 0
is not registered. `TilemapDrawOptions` gains `time?: number` (seconds): with a finite `time`,
`drawInto` / `draw` source each animated tile from the frame at `time mod duration` (a boundary
belongs to the next frame, negative time wraps forward) while flip bits still come from the authored
gid, with no allocation in the tile loop. Without `time` the authored tile draws as before; colliders
and `getTileAt` are unchanged. `TileAnimation` is exported. LDtk is untouched.
