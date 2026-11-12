import { Mat3, Transform2D, Vec2 } from '@flare-engine/math';
import { createBenchSession } from '@flare-engine/testing';
import { type BenchOverrides, type BenchStats, runBench } from './harness.js';
import { MATH_SCENARIOS, type MathScenario } from './scenarios/math.js';

const SPEED = 120;
const MAX_TURN = 0.05;

/**
 * Inputs are written once in setup and only ever read; every op writes into a
 * per-agent output. Each frame therefore computes exactly what the previous one
 * did, so no branch inside `clampLength` or `scaleToLengthInto` can drift as the
 * samples go by.
 */
export type Vec2State = {
  readonly pos: Vec2[];
  readonly target: Vec2[];
  readonly vel: Vec2[];
  readonly desired: Vec2[];
  readonly steer: Vec2[];
  readonly next: Vec2[];
  readonly side: Vec2[];
};

function points(n: number, seed: number, min: number, max: number): Vec2[] {
  const session = createBenchSession({ seed });
  try {
    const out: Vec2[] = new Array(n);
    for (let i = 0; i < n; i++) {
      out[i] = { x: session.rng.float(min, max), y: session.rng.float(min, max) };
    }
    return out;
  } finally {
    session.end();
  }
}

const zeros = (n: number): Vec2[] => Array.from({ length: n }, () => ({ x: 0, y: 0 }));

export function buildVec2State(n: number): Vec2State {
  return {
    pos: points(n, 0x7ec2, 0, 1000),
    target: points(n, 0x7ec3, 0, 1000),
    vel: points(n, 0x7ec4, -SPEED, SPEED),
    desired: zeros(n),
    steer: zeros(n),
    next: zeros(n),
    side: zeros(n),
  };
}

/** Seek-and-turn steering: the six out-param ops a homing agent runs per frame. */
export function vec2Run(state: Vec2State): void {
  const { pos, target, vel, desired, steer, next, side } = state;
  for (let i = 0; i < pos.length; i++) {
    const p = pos[i] as Vec2;
    const v = vel[i] as Vec2;
    const d = desired[i] as Vec2;
    const s = steer[i] as Vec2;
    Vec2.sub(target[i] as Vec2, p, d);
    Vec2.scaleToLengthInto(d.x, d.y, SPEED, d);
    Vec2.turnVelocityTowardInto(v.x, v.y, d.x, d.y, MAX_TURN, s);
    Vec2.clampLength(s, SPEED, s);
    Vec2.add(p, s, next[i] as Vec2);
    Vec2.perp(s, side[i] as Vec2);
  }
}

export type TransformState = {
  readonly transforms: Transform2D[];
  readonly local: Vec2[];
  sink: number;
};

function transforms(n: number): Transform2D[] {
  const session = createBenchSession({ seed: 0x7f2d });
  try {
    const out: Transform2D[] = new Array(n);
    for (let i = 0; i < n; i++) {
      out[i] = Transform2D.create(
        session.rng.float(0, 1000),
        session.rng.float(0, 1000),
        session.rng.float(-Math.PI, Math.PI),
        session.rng.float(0.5, 2),
        session.rng.float(0.5, 2),
      );
    }
    return out;
  } finally {
    session.end();
  }
}

export function buildTransformState(n: number): TransformState {
  return { transforms: transforms(n), local: points(n, 0x7f2e, -16, 16), sink: 0 };
}

/**
 * Both directions per point, the pair a hit test runs. Neither has an out-param
 * form, so the two result objects per point are the engine's own allocation;
 * summing them keeps either call from being dropped as dead.
 */
export function transformRun(state: TransformState): void {
  const { transforms: ts, local } = state;
  let sink = 0;
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i] as Transform2D;
    const world = Transform2D.localToWorld(t, local[i] as Vec2);
    const back = Transform2D.worldToLocal(t, world);
    sink += back.x + back.y;
  }
  state.sink = sink;
}

export type Mat3State = {
  readonly transforms: Transform2D[];
  readonly parent: Mat3;
  readonly local: Mat3;
  readonly world: Mat3[];
};

export function buildMat3State(n: number): Mat3State {
  const parent = Mat3.create();
  Mat3.fromTransform(Transform2D.create(400, 300, 0.25, 1.5, 1.5), parent);
  return {
    transforms: transforms(n),
    parent,
    local: Mat3.create(),
    world: Array.from({ length: n }, () => Mat3.create()),
  };
}

/** Scene-graph compose: each child's TRS into a matrix, then under its parent. */
export function mat3Run(state: Mat3State): void {
  const { transforms: ts, parent, local, world } = state;
  for (let i = 0; i < ts.length; i++) {
    Mat3.fromTransform(ts[i] as Transform2D, local);
    Mat3.multiply(parent, local, world[i] as Mat3);
  }
}

function benchFor(scenario: MathScenario, overrides?: BenchOverrides): BenchStats {
  const { name, n, innerIters } = scenario;
  switch (scenario.kind) {
    case 'vec2':
      return runBench(
        { name, setup: () => buildVec2State(n), run: vec2Run, innerIters },
        overrides,
      );
    case 'transform2d':
      return runBench(
        { name, setup: () => buildTransformState(n), run: transformRun, innerIters },
        overrides,
      );
    case 'mat3':
      return runBench(
        { name, setup: () => buildMat3State(n), run: mat3Run, innerIters },
        overrides,
      );
  }
}

export function mathBenches(overrides?: BenchOverrides): BenchStats[] {
  return MATH_SCENARIOS.map((scenario) => benchFor(scenario, overrides));
}
