# @flare-engine/pathfinding

Grid pathfinding — A* (`findPath`), Jump-Point Search (`findPathJPS`) for uniform-cost grids (a weighted grid delegates to A*, see below), and a polygon navmesh fallback (`findNavMeshPath`). Pure data, no classes. Heuristics (`manhattanDistance`, `octileDistance`, `chebyshevDistance`, `euclideanDistance`) are exported as named functions for tree-shake.

> **Status: beta — no production consumer yet.** Every other `@flare-engine/*` package is exercised
> by a shipping game; this one is not. The API is covered by tests and the algorithms are correct
> for the cases below, but it has not been through the shakedown that real use provides. Treat
> signatures as stable and behaviour as less battle-tested than the rest of the scope.

## `findPath` and `findPathJPS` disagree about corner cutting

They are **not** drop-in replacements for each other. Given a diagonal step whose two shared
cardinal neighbours are both blocked:

```
. X .     start (0,0), goal (1,1)
X . .     findPath      → null   (refuses to squeeze the corner)
. . .     findPathJPS   → [{x:0,y:0},{x:1,y:1}]   (takes the diagonal)
```

`findPath` requires both cardinal neighbours of a diagonal to be walkable; `findPathJPS` does not.
Swapping one for the other to gain speed therefore changes movement semantics, and on a map with
tight diagonal gaps it changes which routes exist at all. Pinned by tests in
`tests/jps.test.ts`. If your game's collision shape is a circle or box wider than a point, you
almost certainly want `findPath`'s rule.

## `findPathJPS` on weighted grids

JPS pruning is only correct when every walkable tile costs 1. If any tile's cost is above 1,
`findPathJPS` detects it with one linear scan of `grid.data` and delegates the call to `findPath`
with `diagonal: true`, forwarding `maxIterations` and `heuristic`. The result is a cost-correct
weighted A* path — with A*'s corner-cutting rule above, not JPS's — never a JPS path that ignored
the costs. A grid whose tiles all share a cost above 1 (`createGrid({ defaultCost: 2 })`) delegates
on every call too: same path as JPS, `cost` doubled to the true weighted total, and no JPS speed-up.
Keep every cost at 1 to get the JPS speed-up.

## Install

```sh
bun add @flare-engine/pathfinding
```

## Usage

```ts
import { createGrid, setWalkable, findPathJPS, octileDistance } from '@flare-engine/pathfinding';

const grid = createGrid({ width: 32, height: 32 });
setWalkable(grid, 5, 5, false);

const result = findPathJPS(grid, 0, 0, 30, 30, {
  heuristic: octileDistance,
});
if (result !== null) console.log(result.path);
```

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-enginepathfinding--8kb-gzip).

## License

Apache-2.0
