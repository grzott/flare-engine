import { describe, expect, it } from 'bun:test';
import { createBody } from '../src/body.js';
import {
  addBody,
  createWorld,
  type StepUntilResult,
  step,
  stepUntil,
  stepUntilInto,
  type World,
} from '../src/world.js';

const DT = 1 / 120;

/** A clock that advances `msPerCall` on every read, independent of wall time. */
function tickingClock(msPerCall: number): () => number {
  let t = 0;
  return () => {
    const v = t;
    t += msPerCall;
    return v;
  };
}

const frozenClock = (): number => 0;

/** Static floor plus a staggered pile of dynamic boxes (as in allocation.test.ts). */
function pileWorld(): World {
  const world = createWorld({ gravity: { x: 0, y: 1800 } });
  addBody(world, createBody({ position: { x: 0, y: 100 }, half: { x: 500, y: 10 }, static: true }));
  for (let i = 0; i < 8; i++) {
    addBody(world, createBody({ position: { x: i * 9 - 30, y: -i * 13 }, half: { x: 5, y: 5 } }));
  }
  return world;
}

describe('stepUntil', () => {
  it('stops with complete: true once done() returns true, checking it after every step', () => {
    const world = pileWorld();
    let calls = 0;
    const result = stepUntil(world, DT, {
      budgetMs: 1000,
      now: frozenClock,
      done: () => {
        calls++;
        return calls >= 5;
      },
    });
    expect(result).toEqual({ steps: 5, complete: true });
    expect(calls).toBe(5);
  });

  it('stops with complete: false at maxSteps when the budget would allow more', () => {
    const world = pileWorld();
    let calls = 0;
    const result = stepUntil(world, DT, {
      budgetMs: 1000,
      maxSteps: 7,
      now: frozenClock,
      done: () => {
        calls++;
        return false;
      },
    });
    expect(result).toEqual({ steps: 7, complete: false });
    expect(calls).toBe(7);
  });

  it('stops with complete: false once now() - start >= budgetMs', () => {
    const world = pileWorld();
    // start reads 0; the k-th post-step read returns k, so the 3rd step trips a 3 ms budget.
    const result = stepUntil(world, DT, { budgetMs: 3, now: tickingClock(1) });
    expect(result).toEqual({ steps: 3, complete: false });
  });

  it('always takes one step, even with budgetMs: 0 and a clock already past the budget', () => {
    const world = pileWorld();
    const free = world.bodies[1]!;
    const result = stepUntil(world, DT, { budgetMs: 0, now: tickingClock(5) });
    expect(result).toEqual({ steps: 1, complete: false });
    expect(free.velocity.y).toBeCloseTo(1800 * DT, 12);
  });

  it('takes exactly one step when done() is already true', () => {
    const world = pileWorld();
    const free = world.bodies[1]!;
    const result = stepUntil(world, DT, { budgetMs: 1000, now: frozenClock, done: () => true });
    expect(result).toEqual({ steps: 1, complete: true });
    expect(free.velocity.y).toBeCloseTo(1800 * DT, 12);
  });

  it('leaves the world bit-identical to the same number of plain step() calls', () => {
    const a = pileWorld();
    const b = pileWorld();
    const n = 300;

    const result = stepUntil(a, DT, { budgetMs: 1000, maxSteps: n, now: frozenClock });
    for (let i = 0; i < n; i++) step(b, DT);

    expect(result.steps).toBe(n);
    expect(a.bodies.length).toBe(b.bodies.length);
    for (let i = 0; i < a.bodies.length; i++) {
      const ba = a.bodies[i]!;
      const bb = b.bodies[i]!;
      expect(ba.position.x).toBe(bb.position.x);
      expect(ba.position.y).toBe(bb.position.y);
      expect(ba.velocity.x).toBe(bb.velocity.x);
      expect(ba.velocity.y).toBe(bb.velocity.y);
      expect(ba.angle).toBe(bb.angle);
      expect(ba.angularVelocity).toBe(bb.angularVelocity);
    }
    // The pile actually moved — the equality above is not comparing untouched worlds.
    expect(a.bodies[1]!.position.y).not.toBe(0);
  });

  it('uses the default clock when now is omitted', () => {
    const world = pileWorld();
    const result = stepUntil(world, DT, { budgetMs: 60_000, maxSteps: 3 });
    expect(result).toEqual({ steps: 3, complete: false });
  });

  describe('stepUntilInto', () => {
    it('returns the same out object and overwrites both fields on a later call', () => {
      const world = pileWorld();
      const out: StepUntilResult = { steps: -1, complete: false };
      let calls = 0;

      const first = stepUntilInto(
        world,
        DT,
        {
          budgetMs: 1000,
          now: frozenClock,
          done: () => {
            calls++;
            return calls >= 2;
          },
        },
        out,
      );
      expect(first).toBe(out);
      expect(out).toEqual({ steps: 2, complete: true });

      const second = stepUntilInto(
        world,
        DT,
        { budgetMs: 1000, maxSteps: 4, now: frozenClock },
        out,
      );
      expect(second).toBe(out);
      expect(out).toEqual({ steps: 4, complete: false });
    });
  });

  describe('validation', () => {
    const base = { budgetMs: 1, now: frozenClock, maxSteps: 1 };

    it('throws RangeError for a non-finite or non-positive dt', () => {
      const world = pileWorld();
      for (const dt of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(() => stepUntil(world, dt, base)).toThrow(RangeError);
        expect(() => stepUntil(world, dt, base)).toThrow(/^stepUntil: dt /);
      }
      expect(world.bodies[1]!.velocity.y).toBe(0);
    });

    it('throws RangeError for a negative or non-finite budgetMs', () => {
      const world = pileWorld();
      for (const budgetMs of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
        const opts = { ...base, budgetMs };
        expect(() => stepUntil(world, DT, opts)).toThrow(RangeError);
        expect(() => stepUntil(world, DT, opts)).toThrow(/^stepUntil: budgetMs /);
      }
      expect(world.bodies[1]!.velocity.y).toBe(0);
    });

    it('throws RangeError for a maxSteps that is not an integer >= 1', () => {
      const world = pileWorld();
      for (const maxSteps of [0, 1.5, Number.NaN]) {
        const opts = { ...base, maxSteps };
        expect(() => stepUntil(world, DT, opts)).toThrow(RangeError);
        expect(() => stepUntil(world, DT, opts)).toThrow(/^stepUntil: maxSteps /);
      }
      expect(world.bodies[1]!.velocity.y).toBe(0);
    });
  });
});
