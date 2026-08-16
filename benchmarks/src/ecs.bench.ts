import { _resetComponentIds, defineSystem, Position, Velocity, World } from '@flare-engine/ecs';
import { createBenchSession } from '@flare-engine/testing';
import { type BenchOverrides, type BenchStats, runBench } from './harness.js';
import { ECS_SCENARIOS } from './scenarios/ecs.js';

/**
 * The control suite. Its workload is deliberately left exactly as it was when
 * the 2026-07 render regression was found: entities integrate off the field
 * forever, with no wrap and no reseed. That is safe here and nowhere else —
 * nothing in `world.step` branches on position, so the cost is stationary even
 * though the state is not — and holding it byte-identical is what lets the ECS
 * row stay the reference that showed the regression was in `render`, not in the
 * machine or the harness. The physics and integration suites, whose cost does
 * track position, wrap instead.
 */
function buildWorld(entities: number): World {
  const session = createBenchSession({ seed: 0xbeef });
  try {
    _resetComponentIds();
    const world = new World();

    for (let i = 0; i < entities; i++) {
      const id = world.spawn();
      world.add(id, Position, {
        x: session.rng.float(0, 1000),
        y: session.rng.float(0, 1000),
      });
      world.add(id, Velocity, {
        x: session.rng.float(-50, 50),
        y: session.rng.float(-50, 50),
      });
    }

    const q = world.query(Position, Velocity);
    const moveSys = defineSystem(q, (entities, dt, w) => {
      for (const id of entities) {
        const p = w.get(id, Position);
        const v = w.get(id, Velocity);
        if (p && v) {
          p.x += v.x * dt;
          p.y += v.y * dt;
        }
      }
    });
    world.addSystem(moveSys._worldFn);

    return world;
  } finally {
    session.end();
  }
}

const DT = 1 / 60;

export function ecsBenches(overrides?: BenchOverrides): BenchStats[] {
  return ECS_SCENARIOS.map(({ name, n, innerIters }) =>
    runBench(
      {
        name,
        setup: () => buildWorld(n),
        run: (world) => world.step(DT),
        innerIters,
      },
      overrides,
    ),
  );
}
