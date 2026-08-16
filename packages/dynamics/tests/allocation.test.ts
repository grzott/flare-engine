import { describe, expect, it } from 'bun:test';
import { addBody, createBody, createWorld, step } from '../src/index.js';

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
});
