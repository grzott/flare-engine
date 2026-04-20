---
name: flare-pathfinding
description: Deep knowledge of the @flare-engine/pathfinding package — A* grid pathfinding, JPS (Jump Point Search), flow fields. Use when implementing enemy AI movement, unit routing, or crowd navigation on a grid-based Flare map.
---

# `@flare-engine/pathfinding`

Layer 3. Pure TS — no native deps. A\* + JPS for point-to-point, flow fields for many-to-one.

## Exports

```ts
import {
  type Grid,
  createGrid,
  setObstacle,
  isWalkable,
  findPath,
  type AStarOptions,
  findPathJPS,
  type JpsOptions,
  createFlowField,
  sampleFlow,
  type FlowField,
} from "@flare-engine/pathfinding";
```

## Usage sketch

```ts
const grid = createGrid(64, 64);
for (const c of levelColliders) setObstacle(grid, c.x, c.y, true);

const path = findPath(grid, { x: 2, y: 2 }, { x: 60, y: 30 });
// or faster on large open grids:
const path2 = findPathJPS(grid, { x: 2, y: 2 }, { x: 60, y: 30 });

const flow = createFlowField(grid, { x: 32, y: 32 });
const dir = sampleFlow(flow, entity.x, entity.y); // all units chase same target
```

## Rules

- `findPath` allocates a new array per call — pool the result arrays in hot code.
- JPS is ~10x faster than plain A\* on uniform open grids, but has no speedup (and slight overhead) on dense obstacle fields. Benchmark both for your map.
- Flow fields scale to many units flowing to one target — don't run A\* per unit if you have >50 agents sharing a goal.

Spec: [docs/design/api-specs.md § @flare-engine/pathfinding](../../../docs/design/api-specs.md).
