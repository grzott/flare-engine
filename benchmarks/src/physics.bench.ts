import { SeededRNG } from '@flare-engine/math';
import { AABB, CollisionWorld } from '@flare-engine/physics';
import { type BenchOverrides, type BenchStats, runBench } from './harness.js';

type PhysicsState = {
  world: CollisionWorld;
  rng: SeededRNG;
  positions: { x: number; y: number; vx: number; vy: number }[];
};

function buildWorld(colliders: number, density: 'sparse' | 'dense'): PhysicsState {
  const world = new CollisionWorld();
  const rng = new SeededRNG(0xc011);
  const positions: PhysicsState['positions'] = new Array(colliders);
  const area = density === 'sparse' ? 2000 : 500;

  for (let i = 0; i < colliders; i++) {
    const x = rng.float(0, area);
    const y = rng.float(0, area);
    positions[i] = { x, y, vx: rng.float(-50, 50), vy: rng.float(-50, 50) };
    world.add(i + 1, AABB(16, 16), x, y);
  }

  return { world, rng, positions };
}

const DT = 1 / 60;

function stepAndMove(state: PhysicsState): void {
  const { world, positions } = state;
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    if (!p) continue;
    p.x += p.vx * DT;
    p.y += p.vy * DT;
    world.setPosition(i + 1, p.x, p.y);
  }
  world.step();
}

export function physicsBenches(overrides?: BenchOverrides): BenchStats[] {
  const out: BenchStats[] = [];
  for (const n of [100, 500, 1000]) {
    out.push(
      runBench(
        {
          name: `physics.step  ${n.toString().padStart(4)} AABB sparse`,
          setup: () => buildWorld(n, 'sparse'),
          run: stepAndMove,
          innerIters: n >= 1000 ? 50 : 200,
          samples: 30,
        },
        overrides,
      ),
    );
    out.push(
      runBench(
        {
          name: `physics.step  ${n.toString().padStart(4)} AABB dense `,
          setup: () => buildWorld(n, 'dense'),
          run: stepAndMove,
          innerIters: n >= 1000 ? 20 : 100,
          samples: 30,
        },
        overrides,
      ),
    );
  }
  return out;
}
