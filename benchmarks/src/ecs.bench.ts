import { _resetComponentIds, defineSystem, Position, Velocity, World } from '@flare-engine/ecs';
import { createBenchSession } from '@flare-engine/testing';
import { type BenchOverrides, type BenchStats, runBench } from './harness.js';
import { ECS_CHURN_SCENARIOS, ECS_SCENARIOS } from './scenarios/ecs.js';

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

/**
 * Steady population with a fixed number of entities recycled per step.
 *
 * The ring is what keeps this honest: destroying the *oldest* live id each
 * step means the entity being removed sits at an arbitrary offset inside
 * `Query.entities`, which is what a real consumer produces. Destroying the
 * most recently spawned would sit at the end of the array and make
 * `indexOf` + `splice` look free — measuring the best case of the very code
 * path this row exists to characterise.
 */
type ChurnWorld = {
  readonly world: World;
  readonly alive: number[];
  cursor: number;
};

function buildChurnWorld(entities: number): ChurnWorld {
  const world = buildWorld(entities);
  const alive: number[] = [];
  for (const id of world.query(Position, Velocity)) alive.push(id);
  return { world, alive, cursor: 0 };
}

function churnStep(state: ChurnWorld, churn: number): void {
  const { world, alive } = state;
  for (let i = 0; i < churn; i++) {
    const victim = alive[state.cursor] as number;
    world.destroy(victim);
    const id = world.spawn();
    world.add(id, Position, { x: 0, y: 0 });
    world.add(id, Velocity, { x: 1, y: 1 });
    alive[state.cursor] = id;
    state.cursor = (state.cursor + 1) % alive.length;
  }
  world.step(DT);
}

export function ecsBenches(overrides?: BenchOverrides): BenchStats[] {
  const steady = ECS_SCENARIOS.map(({ name, n, innerIters }) =>
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

  const churn = ECS_CHURN_SCENARIOS.map(({ name, n, churn: rate, innerIters }) =>
    runBench(
      {
        name,
        setup: () => buildChurnWorld(n),
        run: (state) => churnStep(state, rate),
        innerIters,
      },
      overrides,
    ),
  );

  return [...steady, ...churn];
}
