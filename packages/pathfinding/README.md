# @flare-engine/pathfinding

Grid pathfinding — A* (`findPath`), Jump-Point Search (`findPathJPS`) for uniform-cost grids, and a polygon navmesh fallback (`findNavMeshPath`). Pure data, no classes. Heuristics (`manhattanDistance`, `octileDistance`, `chebyshevDistance`, `euclideanDistance`) are exported as named functions for tree-shake.

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
