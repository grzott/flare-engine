import { Position, Velocity, World, _resetComponentIds, defineSystem } from '@flare-engine/ecs';
import { SeededRNG } from '@flare-engine/math';
import { type BenchStats, runBench } from './harness.js';

function buildWorld(entities: number): World {
  _resetComponentIds();
  const world = new World();
  const rng = new SeededRNG(0xbeef);

  for (let i = 0; i < entities; i++) {
    const id = world.spawn();
    world.add(id, Position, { x: rng.float(0, 1000), y: rng.float(0, 1000) });
    world.add(id, Velocity, { x: rng.float(-50, 50), y: rng.float(-50, 50) });
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
}

const DT = 1 / 60;

export function ecsBenches(): BenchStats[] {
  return [500, 1000, 2000, 5000].map((n) =>
    runBench({
      name: `ecs.step  ${n.toString().padStart(4)} entities (Pos+Vel)`,
      setup: () => buildWorld(n),
      run: (world) => world.step(DT),
      innerIters: 200,
      samples: 30,
    }),
  );
}
