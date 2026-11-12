import {
  createGrid,
  findPath,
  findPathJPS,
  type Grid,
  type PathResult,
  setWalkable,
} from '@flare-engine/pathfinding';
import { createBenchSession } from '@flare-engine/testing';
import { type BenchOverrides, type BenchStats, runBench } from './harness.js';
import {
  PATHFINDING_SCENARIOS,
  type PathfindingAlgorithm,
  type PathfindingLayout,
  type PathfindingScenario,
} from './scenarios/pathfinding.js';

const SIZE = 128;

/** Maze cells sit on odd coordinates; the last odd index leaves a wall on the far edges. */
const MAZE_LAST = SIZE - 3;

export type Endpoints = {
  readonly sx: number;
  readonly sy: number;
  readonly ex: number;
  readonly ey: number;
};

export const ENDPOINTS: Readonly<Record<PathfindingLayout, Endpoints>> = {
  open: { sx: 0, sy: 0, ex: SIZE - 1, ey: SIZE - 1 },
  maze: { sx: 1, sy: 1, ex: MAZE_LAST, ey: MAZE_LAST },
};

export function buildOpenGrid(): Grid {
  return createGrid({ width: SIZE, height: SIZE });
}

/**
 * A perfect maze (one route between any two cells) carved by a seeded
 * depth-first backtracker. Corridors are one cell wide, so the corner-to-corner
 * route is long and winding and both searches have to settle a large share of
 * the grid — the opposite end of the cost range from the open row.
 */
export function buildMazeGrid(): Grid {
  const session = createBenchSession({ seed: 0x3a2e });
  try {
    const grid = createGrid({ width: SIZE, height: SIZE, defaultCost: 0 });
    const cellsPerSide = (MAZE_LAST - 1) / 2 + 1;
    const visited = new Uint8Array(cellsPerSide * cellsPerSide);
    const stack: number[] = [0];
    visited[0] = 1;
    setWalkable(grid, 1, 1, true);
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const;
    const options: number[] = [];

    while (stack.length > 0) {
      const cell = stack[stack.length - 1] as number;
      const cx = cell % cellsPerSide;
      const cy = Math.floor(cell / cellsPerSide);
      options.length = 0;
      for (let d = 0; d < dirs.length; d++) {
        const [dx, dy] = dirs[d] as readonly [number, number];
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= cellsPerSide || ny >= cellsPerSide) continue;
        if (visited[ny * cellsPerSide + nx] === 0) options.push(d);
      }
      if (options.length === 0) {
        stack.pop();
        continue;
      }
      const d = options[session.rng.int(0, options.length - 1)] as number;
      const [dx, dy] = dirs[d] as readonly [number, number];
      const nx = cx + dx;
      const ny = cy + dy;
      visited[ny * cellsPerSide + nx] = 1;
      setWalkable(grid, 1 + cx * 2 + dx, 1 + cy * 2 + dy, true);
      setWalkable(grid, 1 + nx * 2, 1 + ny * 2, true);
      stack.push(ny * cellsPerSide + nx);
    }
    return grid;
  } finally {
    session.end();
  }
}

export type SearchState = {
  readonly grid: Grid;
  readonly ends: Endpoints;
  readonly search: typeof findPath | typeof findPathJPS;
  last: PathResult | null;
};

export function buildSearchState(
  algorithm: PathfindingAlgorithm,
  layout: PathfindingLayout,
): SearchState {
  return {
    grid: layout === 'open' ? buildOpenGrid() : buildMazeGrid(),
    ends: ENDPOINTS[layout],
    search: algorithm === 'astar' ? findPath : findPathJPS,
    last: null,
  };
}

/**
 * One search per op. The per-grid scratch the package keeps is warm after the
 * first call, so this is the steady cost a consumer pays per path request; the
 * returned path array is the engine's own allocation.
 */
export function searchRun(state: SearchState): void {
  const { grid, ends } = state;
  state.last = state.search(grid, ends.sx, ends.sy, ends.ex, ends.ey);
}

function benchFor(scenario: PathfindingScenario, overrides?: BenchOverrides): BenchStats {
  const { name, algorithm, layout, innerIters } = scenario;
  return runBench(
    { name, setup: () => buildSearchState(algorithm, layout), run: searchRun, innerIters },
    overrides,
  );
}

export function pathfindingBenches(overrides?: BenchOverrides): BenchStats[] {
  return PATHFINDING_SCENARIOS.map((scenario) => benchFor(scenario, overrides));
}
