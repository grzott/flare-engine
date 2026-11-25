import { AABB, CollisionWorld } from '@flare-engine/physics';
import { createBenchSession } from '@flare-engine/testing';
import { type BenchOverrides, type BenchStats, runBench } from './harness.js';
import {
  PHYSICS_CURTAIN_SCENARIOS,
  PHYSICS_SCENARIOS,
  type PhysicsCurtainPass,
} from './scenarios/physics.js';

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

const LAYER_SHIP = 1;
const LAYER_SHOT = 2;
const LAYER_ENEMY = 4;

/** Portrait play field: 6 x 12 broadphase cells, so 2000 bolts fill each bucket about 28 deep. */
const CURTAIN_WIDTH = 384;
const CURTAIN_HEIGHT = 768;

export type CurtainState = {
  world: CollisionWorld;
  /** Bolts first, then shots, then the ship; a body's entity id is its index + 1. */
  bodies: { x: number; y: number; vx: number; vy: number }[];
  width: number;
  height: number;
};

export function buildCurtain(bolts: number, shots: number): CurtainState {
  const session = createBenchSession({ seed: 0xb017 });
  try {
    const world = new CollisionWorld();
    const bodies: CurtainState['bodies'] = [];
    const place = (vx: number, vy: number) => {
      const body = {
        x: session.rng.float(0, CURTAIN_WIDTH),
        y: session.rng.float(0, CURTAIN_HEIGHT),
        vx,
        vy,
      };
      bodies.push(body);
      return body;
    };

    // Enemy bodies hit both player layers and never each other.
    const boltShape = AABB(8, 8);
    for (let i = 0; i < bolts; i++) {
      const b = place(session.rng.float(-20, 20), session.rng.float(60, 180));
      world.add(bodies.length, boltShape, b.x, b.y, false, LAYER_ENEMY, LAYER_SHIP | LAYER_SHOT);
    }
    const shotShape = AABB(4, 12);
    for (let i = 0; i < shots; i++) {
      const s = place(0, -600);
      world.add(bodies.length, shotShape, s.x, s.y, false, LAYER_SHOT, LAYER_ENEMY);
    }
    const ship = place(120, 0);
    world.add(bodies.length, AABB(24, 24), ship.x, ship.y, false, LAYER_SHIP, LAYER_ENEMY);

    return { world, bodies, width: CURTAIN_WIDTH, height: CURTAIN_HEIGHT };
  } finally {
    session.end();
  }
}

export function curtainMove(state: CurtainState): void {
  const { world, bodies, width, height } = state;
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    if (!b) continue;
    b.x += b.vx * DT;
    b.y += b.vy * DT;
    if (b.x < 0) b.x += width;
    else if (b.x >= width) b.x -= width;
    if (b.y < 0) b.y += height;
    else if (b.y >= height) b.y -= height;
    world.setPosition(i + 1, b.x, b.y);
  }
}

export function curtainStep(state: CurtainState): void {
  state.world.step();
}

export function curtainFrame(state: CurtainState): void {
  curtainMove(state);
  state.world.step();
}

export function curtainOutOfBoundsCount(state: CurtainState): number {
  let escaped = 0;
  for (const b of state.bodies) {
    if (b.x < 0 || b.x >= state.width || b.y < 0 || b.y >= state.height) escaped++;
  }
  return escaped;
}

const CURTAIN_RUN: Record<PhysicsCurtainPass, (state: CurtainState) => void> = {
  move: curtainMove,
  step: curtainStep,
  frame: curtainFrame,
};

export function physicsCurtainBenches(overrides?: BenchOverrides): BenchStats[] {
  return PHYSICS_CURTAIN_SCENARIOS.map(({ name, pass, bolts, shots, innerIters }) =>
    runBench(
      {
        name,
        setup: () => buildCurtain(bolts, shots),
        run: CURTAIN_RUN[pass],
        innerIters,
      },
      overrides,
    ),
  );
}
