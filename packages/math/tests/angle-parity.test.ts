import { describe, expect, it } from 'bun:test';
import { SeededRNG, Vec2, angleDelta, rotateTowards, vec2 } from '../src/index.js';

// Verbatim reference extracted from PT homing.ts:53-63.
// Do NOT simplify these operations — byte-identity is the contract.
function refHomingStep(
  bvx: number,
  bvy: number,
  nearestDx: number,
  nearestDy: number,
  rate: number,
  dt: number,
): { x: number; y: number } {
  const speed = Math.hypot(bvx, bvy);
  const targetAng = Math.atan2(nearestDy, nearestDx);
  const curAng = Math.atan2(bvy, bvx);
  let diff = targetAng - curAng;
  if (diff > Math.PI) diff -= 2 * Math.PI;
  else if (diff < -Math.PI) diff += 2 * Math.PI;
  const maxTurn = rate * dt;
  const turn = diff > maxTurn ? maxTurn : diff < -maxTurn ? -maxTurn : diff;
  const newAng = curAng + turn;
  return { x: Math.cos(newAng) * speed, y: Math.sin(newAng) * speed };
}

// Reference for angleDelta alone (targetAng - curAng branch-normalised).
function refAngleDelta(a: number, b: number): number {
  let diff = a - b;
  if (diff > Math.PI) diff -= 2 * Math.PI;
  else if (diff < -Math.PI) diff += 2 * Math.PI;
  return diff;
}

// Reference for rotateTowards (curAng + clamped turn).
function refRotateTowards(cur: number, target: number, maxStep: number): number {
  let diff = target - cur;
  if (diff > Math.PI) diff -= 2 * Math.PI;
  else if (diff < -Math.PI) diff += 2 * Math.PI;
  const turn = diff > maxStep ? maxStep : diff < -maxStep ? -maxStep : diff;
  return cur + turn;
}

const SEED = 0xdeadbeef;
const RANDOM_SAMPLES = 2000;

// Deterministic angle grid straddling +/-PI boundaries.
const GRID_ANGLES: number[] = [
  -Math.PI,
  -Math.PI + 1e-10,
  -Math.PI + 0.001,
  -Math.PI / 2,
  -0.001,
  0,
  0.001,
  Math.PI / 4,
  Math.PI / 2,
  Math.PI - 0.001,
  Math.PI - 1e-10,
  Math.PI,
];

describe('angle-parity: angleDelta vs reference', () => {
  it('grid of boundary angles', () => {
    for (const a of GRID_ANGLES) {
      for (const b of GRID_ANGLES) {
        const got = angleDelta(a, b);
        const want = refAngleDelta(a, b);
        expect(Object.is(got, want)).toBe(true);
      }
    }
  });

  it(`${RANDOM_SAMPLES} random samples`, () => {
    const rng = new SeededRNG(SEED);
    for (let i = 0; i < RANDOM_SAMPLES; i++) {
      const a = (rng.next() * 2 - 1) * Math.PI;
      const b = (rng.next() * 2 - 1) * Math.PI;
      const got = angleDelta(a, b);
      const want = refAngleDelta(a, b);
      expect(Object.is(got, want)).toBe(true);
    }
  });
});

describe('angle-parity: rotateTowards vs reference', () => {
  it('grid of boundary angles', () => {
    const maxSteps = [0, 1e-6, 0.01, 0.5, Math.PI, Math.PI * 2];
    for (const cur of GRID_ANGLES) {
      for (const target of GRID_ANGLES) {
        for (const maxStep of maxSteps) {
          const got = rotateTowards(cur, target, maxStep);
          const want = refRotateTowards(cur, target, maxStep);
          expect(Object.is(got, want)).toBe(true);
        }
      }
    }
  });

  it(`${RANDOM_SAMPLES} random samples`, () => {
    const rng = new SeededRNG(SEED + 1);
    for (let i = 0; i < RANDOM_SAMPLES; i++) {
      const cur = (rng.next() * 2 - 1) * Math.PI;
      const target = (rng.next() * 2 - 1) * Math.PI;
      const maxStep = rng.next() * Math.PI * 2;
      const got = rotateTowards(cur, target, maxStep);
      const want = refRotateTowards(cur, target, maxStep);
      expect(Object.is(got, want)).toBe(true);
    }
  });
});

describe('angle-parity: turnVelocityToward vs reference homing step', () => {
  const out = vec2();

  it('grid of boundary angle combinations', () => {
    const speeds = [0, 1, 5, 300];
    const maxSteps = [0, 0.01, 0.5, Math.PI];
    for (const curAng of GRID_ANGLES) {
      for (const targetAng of GRID_ANGLES) {
        for (const speed of speeds) {
          for (const maxStep of maxSteps) {
            const vx = Math.cos(curAng) * speed;
            const vy = Math.sin(curAng) * speed;
            const dx = Math.cos(targetAng);
            const dy = Math.sin(targetAng);
            Vec2.turnVelocityToward(vx, vy, dx, dy, maxStep, out);
            // rate * dt = maxStep (dt=1, rate=maxStep)
            const want = refHomingStep(vx, vy, dx, dy, maxStep, 1);
            expect(Object.is(out.x, want.x)).toBe(true);
            expect(Object.is(out.y, want.y)).toBe(true);
          }
        }
      }
    }
  });

  it(`${RANDOM_SAMPLES} random samples`, () => {
    const rng = new SeededRNG(SEED + 2);
    for (let i = 0; i < RANDOM_SAMPLES; i++) {
      const speed = rng.next() * 400;
      const curAng = (rng.next() * 2 - 1) * Math.PI;
      const targetAng = (rng.next() * 2 - 1) * Math.PI;
      const maxStep = rng.next() * Math.PI * 2;
      const vx = Math.cos(curAng) * speed;
      const vy = Math.sin(curAng) * speed;
      const dx = Math.cos(targetAng);
      const dy = Math.sin(targetAng);
      Vec2.turnVelocityToward(vx, vy, dx, dy, maxStep, out);
      const want = refHomingStep(vx, vy, dx, dy, maxStep, 1);
      expect(Object.is(out.x, want.x)).toBe(true);
      expect(Object.is(out.y, want.y)).toBe(true);
    }
  });
});
