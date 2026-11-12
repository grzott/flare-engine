---
'@flare-engine/render': patch
'@flare-engine/react': patch
---

`createRenderSystem` keeps its draw order from one frame to the next. It used to rebuild the list
from `query.entities` and insertion-sort it from that order every frame, so entities whose spawn
order disagreed with their `z` were re-sorted on every frame. It now follows the query through
`onEntityAdded` / `onEntityRemoved`, refreshes each `z` in place and sorts the order it already
holds: a frame in which no `z` changed and nothing joined costs `n - 1` comparisons for `n` sprites.

The returned function now also has a `dispose()` method that drops those two subscriptions (new
exported type `RenderSystem`); without it the system stays subscribed for as long as the query
lives. Its storage stays bounded whether or not the system runs: removed entries are reclaimed on
add as well as on each frame. The type is still assignable to `() => void`. A disposed system queues
nothing. `GameView` calls `dispose()` when it unmounts.

One visible difference: sprites with equal `z` now draw in the order they joined the query, and an
entity that leaves and rejoins moves behind the others at its `z`. Before, equal `z` followed
`query.entities` order as read each frame, which changes when another entity is removed. That order
was never a documented guarantee.
