---
'@flare-engine/tilemap': patch
---

`TilemapRenderer` now draws Tiled's flip bits instead of stripping them: a horizontally or
vertically flipped GID queues the tile with the sprite batch's `flipX` / `flipY`, and the diagonal
bit becomes a quarter turn about the tile centre combined with the flip Tiled defines (D+H is 90°
clockwise, D+V is 90° counter-clockwise). Before, every tile drew unflipped. Tileset resolution and
collider extraction already handled flipped GIDs and are unchanged. The two combinations that need
both a flip and a turn (the diagonal bit alone, and all three bits) queue the correct command, but
`@flare-engine/render`'s flip draw path does not yet apply `rotation`, so they still draw without
the turn until that lands.
