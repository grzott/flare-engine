/**
 * Pure-data pathfinding scenario matrix — no grid, no closure. Consumed by
 * `../pathfinding.bench.ts`, which binds each row to a real `Grid` and one
 * corner-to-corner search per op.
 *
 * `innerIters` puts one sample near 1.5 ms pinned to P-cores, the window the
 * other suites use; measured 2026-11-12 across five pinned processes.
 */
export type PathfindingAlgorithm = 'astar' | 'jps';
export type PathfindingLayout = 'open' | 'maze';

export type PathfindingScenario = {
  readonly name: string;
  readonly algorithm: PathfindingAlgorithm;
  readonly layout: PathfindingLayout;
  readonly innerIters: number;
};

export const PATHFINDING_SCENARIOS: readonly PathfindingScenario[] = [
  {
    name: 'pathfinding.astar  128x128 open',
    algorithm: 'astar',
    layout: 'open',
    innerIters: 175,
  },
  {
    name: 'pathfinding.astar  128x128 maze',
    algorithm: 'astar',
    layout: 'maze',
    innerIters: 29,
  },
  {
    name: 'pathfinding.jps    128x128 open',
    algorithm: 'jps',
    layout: 'open',
    innerIters: 15,
  },
  {
    name: 'pathfinding.jps    128x128 maze',
    algorithm: 'jps',
    layout: 'maze',
    innerIters: 24,
  },
];
