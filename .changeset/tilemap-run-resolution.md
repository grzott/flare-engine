---
"@flare-engine/tilemap": patch
---

`TilemapRenderer` now resolves the tileset and its image once per run of consecutive tiles from the same tileset, instead of scanning `map.tilesets` and looking the image up by name for every visible tile. The images are read by name once per draw, so `setTilesetImage` still takes effect on the next draw. Internal only: no exported name or signature changes, and the queued draw commands are unchanged.
