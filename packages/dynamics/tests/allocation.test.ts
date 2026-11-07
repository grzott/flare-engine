import { describe, expect, it } from 'bun:test';
import { addBody, createBody, createTimeline, createWorld, isAtRest, step } from '../src/index.js';

describe('step allocation', () => {
  it('does not grow the heap in steady state', () => {
    const world = createWorld({ gravity: { x: 0, y: 1800 } });
    addBody(
      world,
      createBody({ position: { x: 0, y: 100 }, half: { x: 500, y: 10 }, static: true }),
    );
    for (let i = 0; i < 12; i++) {
      addBody(world, createBody({ position: { x: i * 9 - 40, y: -i * 13 }, half: { x: 5, y: 5 } }));
    }

    // Warm up: let the pools reach steady-state capacity and the pile settle.
    for (let i = 0; i < 600; i++) step(world, 1 / 120);

    Bun.gc(true);
    const before = process.memoryUsage().heapUsed;
    for (let i = 0; i < 20_000; i++) step(world, 1 / 120);
    Bun.gc(true);
    const after = process.memoryUsage().heapUsed;

    expect(after - before).toBeLessThan(256 * 1024);
  });

  it('does not grow the heap with sleeping on while bodies sleep and wake', () => {
    const world = createWorld({
      gravity: { x: 0, y: 1800 },
      sleep: { linearThreshold: 14, angularThreshold: 1.5, steps: 30 },
    });
    addBody(
      world,
      createBody({ position: { x: 0, y: 100 }, half: { x: 500, y: 10 }, static: true }),
    );
    for (let i = 0; i < 3; i++) {
      addBody(world, createBody({ position: { x: 0, y: 85 - i * 11 }, half: { x: 5, y: 5 } }));
    }
    const dropped = addBody(
      world,
      createBody({ position: { x: 3, y: -40 }, half: { x: 5, y: 5 } }),
    );
    // Every 400 steps the landed box is put back above the stack by writing
    // its state (a write wake), so each cycle lands on the sleeping stack
    // (contact wake, one level per step) and everything sleeps again.
    const redrop = (): void => {
      dropped.position.x = 3;
      dropped.position.y = -40;
      dropped.angle = 0;
      dropped.velocity.x = 0;
      dropped.velocity.y = 0;
      dropped.angularVelocity = 0;
    };

    // Warm up: pools reach capacity, the stack sleeps, one full drop cycle runs.
    for (let i = 0; i < 600; i++) step(world, 1 / 120);
    expect(isAtRest(world)).toBe(true);

    let sleptCycles = 0;
    Bun.gc(true);
    const before = process.memoryUsage().heapUsed;
    for (let i = 0; i < 20_000; i++) {
      if (i % 400 === 0) {
        if (isAtRest(world)) sleptCycles++;
        redrop();
      }
      step(world, 1 / 120);
    }
    Bun.gc(true);
    const after = process.memoryUsage().heapUsed;

    expect(after - before).toBeLessThan(256 * 1024);
    // The measured loop really did sleep and wake: every cycle ended at rest.
    expect(sleptCycles).toBe(50);
  });
});

describe('sampleInto allocation', () => {
  it('does not grow the heap across repeated samples', () => {
    const t = createTimeline(16, 1 / 60, { maxFrames: 120 });
    t.record(
      (buf, base) => {
        for (let o = 0; o < 48; o++) buf[base + o] = base + o;
      },
      () => false,
    );
    const out = new Float32Array(48);

    for (let i = 0; i < 1_000; i++) t.sampleInto((i % 101) / 100, out);

    Bun.gc(true);
    const before = process.memoryUsage().heapUsed;
    for (let i = 0; i < 20_000; i++) t.sampleInto((i % 101) / 100, out);
    Bun.gc(true);
    const after = process.memoryUsage().heapUsed;

    expect(after - before).toBeLessThan(256 * 1024);
  });
});
