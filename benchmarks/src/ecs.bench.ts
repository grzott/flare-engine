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
  /**
   * Component payloads, one pair per ring slot, reused on every respawn.
   *
   * `World.add` stores the reference it is given (`world.ts:64`), so a fresh
   * object literal per spawn would allocate `2 * churn` objects per step and
   * make these rows GC-bound: measured that way, run-to-run spread was 15-27%
   * and `bench:promote`'s 10% fold guard refused the window outright, while
   * lengthening the samples only produced proportionally more garbage. Pooling
   * is also what the workload being modelled actually does — a bullet-heavy
   * game recycles payloads rather than allocating per shot. The slot's previous
   * occupant is destroyed before the object is handed to its successor, so no
   * two live entities ever share one.
   */
  readonly posPool: { x: number; y: number }[];
  readonly velPool: { x: number; y: number }[];
  cursor: number;
};

function buildChurnWorld(entities: number): ChurnWorld {
  const world = buildWorld(entities);
  const alive: number[] = [];
  for (const id of world.query(Position, Velocity)) alive.push(id);
  const posPool = alive.map(() => ({ x: 0, y: 0 }));
  const velPool = alive.map(() => ({ x: 1, y: 1 }));
  return { world, alive, posPool, velPool, cursor: 0 };
}

function churnStep(state: ChurnWorld, churn: number): void {
  const { world, alive, posPool, velPool } = state;
  for (let i = 0; i < churn; i++) {
    const slot = state.cursor;
    world.destroy(alive[slot] as number);
    const id = world.spawn();
    const pos = posPool[slot] as { x: number; y: number };
    pos.x = 0;
    pos.y = 0;
    world.add(id, Position, pos);
    world.add(id, Velocity, velPool[slot] as { x: number; y: number });
    alive[slot] = id;
    state.cursor = (slot + 1) % alive.length;
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
