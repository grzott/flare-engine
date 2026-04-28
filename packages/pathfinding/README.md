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

const result = findPathJPS(grid, { x: 0, y: 0 }, { x: 30, y: 30 }, {
  heuristic: octileDistance,
  diagonal: true,
});
if (result.found) console.log(result.cells);
```

See [API spec](../../docs/design/api-specs.md#flare-enginepathfinding--8kb-gzip) and [skill reference](../../.github/skills/flare-pathfinding/SKILL.md).

## License

MIT
