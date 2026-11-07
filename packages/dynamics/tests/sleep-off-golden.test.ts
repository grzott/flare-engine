import { describe, expect, it } from 'bun:test';
import { createBody } from '../src/body.js';
import { addBody, createWorld, step } from '../src/world.js';

const DT = 1 / 60;
const STEPS = 600;
const LANES = 6;

/** Golden captured on the unmodified sleep-off solver before sleeping was
 *  added. The default `createWorld()` has sleeping off, so this scenario
 *  must stay bit-identical for every consumer that never opts in. */
const GOLDEN_FNV1A64 = 'b0e5e12b1d9569a6';

/** FNV-1a, 64-bit, over the raw bytes; dependency-free and byte-exact. */
function fnv1a64Hex(bytes: Uint8Array): string {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < bytes.length; i++) {
    h ^= BigInt(bytes[i]!);
    h = (h * prime) & mask;
  }
  return h.toString(16).padStart(16, '0');
}

/** Static floor, a resting stack of three boxes, and one box dropped onto the
 *  stack from above, off-centre so the impact spins it. */
function scenario() {
  const world = createWorld();
  addBody(world, createBody({ position: { x: 0, y: 100 }, half: { x: 500, y: 10 }, static: true }));
  for (let i = 0; i < 3; i++) {
    addBody(world, createBody({ position: { x: 0, y: 85 - i * 11 }, half: { x: 5, y: 5 } }));
  }
  addBody(world, createBody({ position: { x: 3, y: -40 }, half: { x: 5, y: 5 } }));
  return world;
}

describe('sleep-off golden', () => {
  it('keeps every step of the default (no sleep) path bit-identical', () => {
    const world = scenario();
    const n = world.bodies.length;
    const state = new Float64Array(STEPS * n * LANES);
    for (let s = 0; s < STEPS; s++) {
      step(world, DT);
      for (let i = 0; i < n; i++) {
        const b = world.bodies[i]!;
        const o = (s * n + i) * LANES;
        state[o] = b.position.x;
        state[o + 1] = b.position.y;
        state[o + 2] = b.angle;
        state[o + 3] = b.velocity.x;
        state[o + 4] = b.velocity.y;
        state[o + 5] = b.angularVelocity;
      }
    }
    const hash = fnv1a64Hex(new Uint8Array(state.buffer, state.byteOffset, state.byteLength));
    expect(hash).toBe(GOLDEN_FNV1A64);

    // The scenario did something: the dropped box landed and rotated.
    const dropped = world.bodies[4]!;
    expect(dropped.position.y).toBeGreaterThan(0);
    expect(dropped.angle).not.toBe(0);
  });
});
