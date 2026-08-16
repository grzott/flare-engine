import { AABB, CollisionWorld } from '@flare-engine/physics';
import { createBenchSession } from '@flare-engine/testing';
import { type BenchOverrides, type BenchStats, runBench } from './harness.js';
import { PHYSICS_SCENARIOS } from './scenarios/physics.js';

export type PhysicsState = {
  world: CollisionWorld;
  positions: { x: number; y: number; vx: number; vy: number }[];
  /** Edge length of the square play field the colliders wrap inside. */
  area: number;
};

const DT = 1 / 60;

/**
 * Density is set by the field size, and the field is now a hard boundary:
 * colliders wrap at the edges. Previously positions integrated without bounds,
 * so a "dense" run thinned out into a sparse one over the sample window and the
 * measured cost depended on how many frames had already run.
 */
export function buildWorld(colliders: number, density: 'sparse' | 'dense'): PhysicsState {
  const session = createBenchSession({ seed: 0xc011 });
  try {
    const world = new CollisionWorld();
    const positions: PhysicsState['positions'] = new Array(colliders);
    const area = density === 'sparse' ? 2000 : 500;

    for (let i = 0; i < colliders; i++) {
      const x = session.rng.float(0, area);
      const y = session.rng.float(0, area);
      positions[i] = {
        x,
        y,
        vx: session.rng.float(-50, 50),
        vy: session.rng.float(-50, 50),
      };
      world.add(i + 1, AABB(16, 16), x, y);
    }

    return { world, positions, area };
  } finally {
    session.end();
  }
}

export function stepAndMove(state: PhysicsState): void {
  const { world, positions, area } = state;
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    if (!p) continue;
    p.x += p.vx * DT;
    p.y += p.vy * DT;
    if (p.x < 0) p.x += area;
    else if (p.x >= area) p.x -= area;
    if (p.y < 0) p.y += area;
    else if (p.y >= area) p.y -= area;
    world.setPosition(i + 1, p.x, p.y);
  }
  world.step();
}

/** Machine-checked stationarity — see integration.bench.ts:outOfBoundsCount. */
export function outOfBoundsCount(state: PhysicsState): number {
  let escaped = 0;
  for (const p of state.positions) {
    if (p.x < 0 || p.x >= state.area || p.y < 0 || p.y >= state.area) escaped++;
  }
  return escaped;
}

export function physicsBenches(overrides?: BenchOverrides): BenchStats[] {
  return PHYSICS_SCENARIOS.map(({ name, n, density, innerIters }) =>
    runBench(
      {
        name,
        setup: () => buildWorld(n, density),
        run: stepAndMove,
        innerIters,
      },
      overrides,
    ),
  );
}
