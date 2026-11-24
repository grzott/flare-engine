---
'@flare-engine/pathfinding': patch
---

`findPathJPS` no longer cuts corners, so `findPath` and `findPathJPS` now share one rule (#507). A diagonal step is taken only when both cardinal neighbours it passes are walkable.

**What was wrong.** On a uniform-cost grid, JPS stepped diagonally past a wall's tip, where `findPath` went round. JPS also switched to `findPath`'s rule whenever any tile cost more than 1, even a tile off the route. So a game that checked reachability with one function and moved units with the other could send units through a gap the check had reported as sealed.

**What now holds.**
- On a uniform grid, `findPathJPS` returns a path of the same cost as `findPath`.
- Both return `null` for a start and goal that only a corner cut would connect.
- Both docstrings and the README state the rule.

**What can change for you.** A `findPathJPS` path on a uniform grid may be longer than before, by `2 - √2` for each corner it used to cut, and may go round where it used to squeeze through.

**Speed.** Measured on 256×256 maps, JPS takes about 1.3-1.9× longer per search than before, because it no longer takes the shortcuts. It still searches 2.3× faster than A* on a rooms-and-corridors map and 1.3-1.4× faster with 10-20% scattered walls.
