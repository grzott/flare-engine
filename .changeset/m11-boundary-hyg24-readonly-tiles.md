---
'@flare-engine/physics': patch
'@flare-engine/tilemap': patch
---

Exactly-touching shapes never collide; `TileLayer.tiles` is `readonly`. Per ADR-0004.

`shapeOverlap` tested box-vs-circle with `<=` while box-vs-box and circle-vs-circle used `<`, so a
circle resting exactly on a box face or corner collided (raising `onEnter`) where two touching boxes
did not. All three pairs are now strict. `overlapInto` already was, except for a zero-radius circle
exactly on a box edge, which returned a depth-0 overlap and now returns `null` — so `shapeOverlap`
and `overlapInto(...) !== null` agree on every input. A zero-radius circle strictly inside a box
still collides, as a zero-size box does.

`TileLayer.tiles` gains the `readonly` modifier `SolidGrid.solid` already carries. Assigning a new
array to `layer.tiles` stops compiling; writing cells (`layer.tiles[i] = gid`) is unchanged.
