---
'@flare-engine/render': patch
'@flare-engine/tilemap': patch
---

A frame renderer now draws a flipped sprite with its `rotation`: it rotates about the anchor point,
as the atlas path does, and then mirrors about the sprite centre — still one `drawImageRect` per
flipped sprite. Before, a `flipX`/`flipY` command drew mirrored but unrotated, whatever its
`rotation`. A flip with zero rotation draws exactly as before; stretch without flip is unchanged.
Tiled's diagonal-only and all-three-bits tiles, which `TilemapRenderer` queues as a flip plus a
quarter turn, now draw with the turn.
