import { describe, expect, it } from 'bun:test';
import { type Body, createBody } from '../src/body.js';
import type { SleepOptions } from '../src/pool.js';
import {
  addBody,
  createWorld,
  isAtRest,
  isSleeping,
  step,
  type World,
  wakeBody,
} from '../src/world.js';

const DT = 1 / 120;

// A half-5 box resting on two contact points rocks at ±1.12 rad/s peaks in
// this solver's limit cycle (5.8 px/s edge speed over a 5 px half-width), so
// the consumer's 0.6 rad/s would never see 30 consecutive quiet steps here.
// 1.5 clears the measured peak; 14 px/s clears the 5.8 px/s linear peak.
const SLEEP: SleepOptions = { linearThreshold: 14, angularThreshold: 1.5, steps: 30 };

function floorWorld(sleep: SleepOptions | null = SLEEP): World {
  const world = createWorld({ gravity: { x: 0, y: 1800 }, sleep: sleep ?? undefined });
  addBody(world, createBody({ position: { x: 0, y: 100 }, half: { x: 500, y: 10 }, static: true }));
  return world;
}

function box(x: number, y: number): Body {
  return createBody({ position: { x, y }, half: { x: 5, y: 5 } });
}

function settle(world: World, steps: number): void {
  for (let i = 0; i < steps; i++) step(world, DT);
}

/** Steps until `pred()` holds, returning the step count, or -1 past `max`. */
function stepsUntil(world: World, pred: () => boolean, max: number): number {
  for (let n = 1; n <= max; n++) {
    step(world, DT);
    if (pred()) return n;
  }
  return -1;
}

/** Floor + a resting stack of three boxes (optionally sleep off). */
function stackWorld(sleep: SleepOptions | null = SLEEP): { world: World; stack: Body[] } {
  const world = floorWorld(sleep);
  const stack = [];
  for (let i = 0; i < 3; i++) stack.push(addBody(world, box(0, 85 - i * 11)));
  return { world, stack };
}

/** Packs position, angle and both velocities of every body, every step. */
function recordStates(world: World, steps: number): Float64Array {
  const n = world.bodies.length;
  const out = new Float64Array(steps * n * 6);
  for (let s = 0; s < steps; s++) {
    step(world, DT);
    for (let i = 0; i < n; i++) {
      const b = world.bodies[i]!;
      const o = (s * n + i) * 6;
      out[o] = b.position.x;
      out[o + 1] = b.position.y;
      out[o + 2] = b.angle;
      out[o + 3] = b.velocity.x;
      out[o + 4] = b.velocity.y;
      out[o + 5] = b.angularVelocity;
    }
  }
  return out;
}

describe('sleeping', () => {
  it('puts a box dropped on the floor to sleep with exactly zero velocity', () => {
    const world = floorWorld();
    const b = addBody(world, box(0, 0));

    // Measured 91 at these thresholds; the bound leaves headroom for solver drift.
    const slept = stepsUntil(world, () => isSleeping(world, b), 120);
    expect(slept).toBeGreaterThan(30);
    expect(slept).toBeLessThanOrEqual(120);

    expect(b.velocity.x).toBe(0);
    expect(b.velocity.y).toBe(0);
    expect(b.angularVelocity).toBe(0);
    expect(isAtRest(world)).toBe(true);

    // Same band the sleep-off floor test asserts, and it stays put while asleep.
    expect(b.position.y).toBeLessThan(96);
    expect(b.position.y).toBeGreaterThan(78);
    const rested = b.position.y;
    settle(world, 600);
    expect(b.position.y).toBe(rested);
    expect(b.velocity.y).toBe(0);
    expect(isSleeping(world, b)).toBe(true);
  });

  it('sleeps a resting stack, wakes it when a box lands on it, and sleeps again', () => {
    const { world, stack } = stackWorld();
    const [bottom, middle, top] = stack as [Body, Body, Body];

    // Measured 36.
    const rested = stepsUntil(world, () => isAtRest(world), 60);
    expect(rested).toBeGreaterThan(0);
    for (const b of stack) expect(isSleeping(world, b)).toBe(true);

    const dropped = addBody(world, box(3, -40));
    expect(isAtRest(world)).toBe(false);

    // Measured: top wakes at 40 (impact), middle at 41, bottom at 42 — no
    // islands, so the wake walks down the stack one contact per step.
    const topWoke = stepsUntil(world, () => !isSleeping(world, top), 60);
    expect(topWoke).toBeGreaterThan(0);
    expect(isSleeping(world, middle)).toBe(true);
    expect(isSleeping(world, bottom)).toBe(true);
    step(world, DT);
    expect(isSleeping(world, middle)).toBe(false);
    step(world, DT);
    expect(isSleeping(world, bottom)).toBe(false);

    // Measured 126 after the drop (84 after the wake).
    const reRested = stepsUntil(world, () => isAtRest(world), 200);
    expect(reRested).toBeGreaterThan(0);
    for (const b of [...stack, dropped]) {
      expect(isSleeping(world, b)).toBe(true);
      expect(b.velocity.x).toBe(0);
      expect(b.velocity.y).toBe(0);
      expect(b.angularVelocity).toBe(0);
      expect(b.position.y).toBeLessThan(96);
    }
    // The stack is still a stack: bottom on the floor, the others above it.
    expect(bottom.position.y).toBeGreaterThan(middle.position.y);
    expect(middle.position.y).toBeGreaterThan(top.position.y);
  });

  it('is deterministic with sleeping on', () => {
    const run = () => {
      const { world, stack } = stackWorld();
      const dropped = addBody(world, box(3, -40));
      const states = recordStates(world, 600);
      return { states, slept: isAtRest(world), tumbled: dropped.angle !== 0, top: stack[2]! };
    };
    const a = run();
    const b = run();
    expect(a.states).toEqual(b.states);
    // The run covered the sleep paths: the stack slept, woke on impact and slept again.
    expect(a.slept).toBe(true);
    expect(a.tumbled).toBe(true);
    expect(a.states.length).toBe(600 * 5 * 6);
  });

  describe('wake on writes', () => {
    function sleepingBox(): { world: World; b: Body } {
      const world = floorWorld();
      const b = addBody(world, box(0, 0));
      settle(world, 150);
      expect(isSleeping(world, b)).toBe(true);
      return { world, b };
    }

    it('wakes when velocity is written and moves accordingly', () => {
      const { world, b } = sleepingBox();
      const x0 = b.position.x;
      b.velocity.x = 50;
      step(world, DT);
      expect(isSleeping(world, b)).toBe(false);
      expect(b.position.x).toBeGreaterThan(x0);
    });

    it('wakes when angular velocity is written', () => {
      const { world, b } = sleepingBox();
      b.angularVelocity = 2;
      step(world, DT);
      expect(isSleeping(world, b)).toBe(false);
      expect(b.angle).not.toBe(0);
    });

    it('wakes when position is written and falls when unsupported', () => {
      const { world, b } = sleepingBox();
      b.position.y = 0;
      step(world, DT);
      expect(isSleeping(world, b)).toBe(false);
      expect(b.velocity.y).toBeCloseTo(1800 * DT, 12);
      settle(world, 30);
      expect(b.position.y).toBeGreaterThan(10);
    });

    it('wakes when angle is written', () => {
      const { world, b } = sleepingBox();
      b.angle = 0.3;
      step(world, DT);
      expect(isSleeping(world, b)).toBe(false);
      expect(b.velocity.y).not.toBe(0);
    });

    it('wakes via wakeBody and then re-sleeps', () => {
      const { world, b } = sleepingBox();
      wakeBody(world, b);
      expect(isSleeping(world, b)).toBe(false);
      expect(b.velocity.y).toBe(0);
      step(world, DT);
      expect(isSleeping(world, b)).toBe(false);
      expect(b.velocity.y).not.toBe(0);
      expect(stepsUntil(world, () => isSleeping(world, b), 120)).toBeGreaterThan(0);
    });
  });

  describe('removed support', () => {
    it('wakes the sleeper when the removal shifts it to another slot', () => {
      // Floor first, box second: removing the floor moves the box to slot 0,
      // whose owner was the floor, so the slot resets and the box is awake.
      const world = floorWorld();
      const b = addBody(world, box(0, 0));
      settle(world, 150);
      expect(isSleeping(world, b)).toBe(true);
      const y0 = b.position.y;

      world.bodies.splice(0, 1);
      step(world, DT);
      expect(isSleeping(world, b)).toBe(false);
      settle(world, 30);
      expect(b.position.y).toBeGreaterThan(y0 + 10);
    });

    it('leaves the sleeper floating when its slot is unchanged, until wakeBody', () => {
      // Box first, floor second: removing the floor leaves slot 0 bound to the
      // box, so nothing wakes it — it stays asleep in mid-air.
      const world = createWorld({ gravity: { x: 0, y: 1800 }, sleep: SLEEP });
      const b = addBody(world, box(0, 0));
      addBody(
        world,
        createBody({ position: { x: 0, y: 100 }, half: { x: 500, y: 10 }, static: true }),
      );
      settle(world, 150);
      expect(isSleeping(world, b)).toBe(true);
      const y0 = b.position.y;

      world.bodies.splice(1, 1);
      settle(world, 60);
      expect(isSleeping(world, b)).toBe(true);
      expect(isAtRest(world)).toBe(true);
      expect(b.position.y).toBe(y0);

      wakeBody(world, b);
      settle(world, 30);
      expect(isSleeping(world, b)).toBe(false);
      expect(b.position.y).toBeGreaterThan(y0 + 10);
    });
  });

  it('resets the slots shifted by a bodies insertion, which re-sleep', () => {
    const world = floorWorld();
    const b = addBody(world, box(0, 0));
    settle(world, 150);
    expect(isSleeping(world, b)).toBe(true);

    world.bodies.unshift(
      createBody({ position: { x: 0, y: -200 }, half: { x: 500, y: 10 }, static: true }),
    );
    expect(isSleeping(world, b)).toBe(false);
    step(world, DT);
    expect(isSleeping(world, b)).toBe(false);
    expect(b.velocity.y).not.toBe(0);
    expect(stepsUntil(world, () => isSleeping(world, b), 120)).toBeGreaterThan(0);
  });

  describe('sleep off', () => {
    it('never reports sleeping or rest with a dynamic body', () => {
      const world = floorWorld(null);
      const b = addBody(world, box(0, 0));
      settle(world, 1200);
      expect(isSleeping(world, b)).toBe(false);
      expect(isAtRest(world)).toBe(false);
      expect(b.velocity.x !== 0 || b.velocity.y !== 0 || b.angularVelocity !== 0).toBe(true);
    });

    it('reports rest for a world with only static bodies', () => {
      const world = floorWorld(null);
      settle(world, 10);
      expect(isAtRest(world)).toBe(true);
      expect(isAtRest(createWorld())).toBe(true);
    });

    it('makes wakeBody a no-op', () => {
      const world = floorWorld(null);
      const b = addBody(world, box(0, 0));
      settle(world, 600);
      const vy = b.velocity.y;
      wakeBody(world, b);
      wakeBody(world, box(0, 0));
      expect(b.velocity.y).toBe(vy);
      expect(isSleeping(world, b)).toBe(false);
    });
  });

  describe('validation', () => {
    const bad = [-1, Number.NaN, Number.POSITIVE_INFINITY];

    it('throws RangeError for a negative or non-finite linearThreshold', () => {
      for (const linearThreshold of bad) {
        const sleep = { ...SLEEP, linearThreshold };
        expect(() => createWorld({ sleep })).toThrow(RangeError);
        expect(() => createWorld({ sleep })).toThrow(/^createWorld: sleep\.linearThreshold /);
      }
    });

    it('throws RangeError for a negative or non-finite angularThreshold', () => {
      for (const angularThreshold of bad) {
        const sleep = { ...SLEEP, angularThreshold };
        expect(() => createWorld({ sleep })).toThrow(RangeError);
        expect(() => createWorld({ sleep })).toThrow(/^createWorld: sleep\.angularThreshold /);
      }
    });

    it('throws RangeError for a steps that is not an integer >= 1', () => {
      for (const steps of [0, 1.5, Number.NaN]) {
        const sleep = { ...SLEEP, steps };
        expect(() => createWorld({ sleep })).toThrow(RangeError);
        expect(() => createWorld({ sleep })).toThrow(/^createWorld: sleep\.steps /);
      }
    });

    it('accepts zero thresholds and steps 1, and copies the options', () => {
      const sleep = { linearThreshold: 0, angularThreshold: 0, steps: 1 };
      const world = createWorld({ sleep });
      const b = addBody(world, box(0, 0));
      sleep.steps = 0;
      settle(world, 10);
      expect(isSleeping(world, b)).toBe(false);
    });
  });

  it('steps a lazily adopted copy of a sleeping world with sleep off', () => {
    const world = floorWorld();
    const b = addBody(world, box(0, 0));
    const copy = { ...world };
    settle(copy, 1200);
    expect(isSleeping(copy, b)).toBe(false);
    expect(isAtRest(copy)).toBe(false);
    expect(b.velocity.x !== 0 || b.velocity.y !== 0 || b.angularVelocity !== 0).toBe(true);
  });

  it('reports false for a body that is not in the world', () => {
    const world = floorWorld();
    const b = addBody(world, box(0, 0));
    settle(world, 150);
    expect(isSleeping(world, b)).toBe(true);
    expect(isSleeping(world, box(0, 0))).toBe(false);
    expect(isSleeping(floorWorld(), b)).toBe(false);
  });
});
