import { describe, expect, test } from 'bun:test';
import { SeededRNG } from '@flare-engine/math';
import { createScalarField, createStigmergy } from '../src/index.js';

const BASE_CFG = {
  count: 64,
  sensorAngle: 0.5,
  sensorDist: 9,
  rotateAngle: 0.45,
  stepSize: 2,
  depositAmount: 1,
  chaos: 0.05,
};

describe('AgentField (stigmergy)', () => {
  test('determinism — identical seeds produce bit-exact px/py/heading', () => {
    const steps = 20;

    const f1 = createScalarField(200, 200, 4);
    const a1 = createStigmergy(f1, BASE_CFG, new SeededRNG(42));

    const f2 = createScalarField(200, 200, 4);
    const a2 = createStigmergy(f2, BASE_CFG, new SeededRNG(42));

    for (let i = 0; i < steps; i++) {
      f1.step(0.4, 0.95, Number.POSITIVE_INFINITY);
      a1.update();
      f2.step(0.4, 0.95, Number.POSITIVE_INFINITY);
      a2.update();
    }

    for (let i = 0; i < BASE_CFG.count; i++) {
      expect(Object.is(a1.px[i] ?? 0, a2.px[i] ?? 0)).toBe(true);
      expect(Object.is(a1.py[i] ?? 0, a2.py[i] ?? 0)).toBe(true);
      expect(Object.is(a1.heading[i] ?? 0, a2.heading[i] ?? 0)).toBe(true);
    }
  });

  test('deposit raises field mass above zero after several updates', () => {
    const f = createScalarField(200, 200, 4);
    const agents = createStigmergy(f, BASE_CFG, new SeededRNG(7));

    // Confirm the field starts empty.
    expect(f.meanValue(1)).toBe(0);

    for (let i = 0; i < 10; i++) agents.update();

    // forEachAgent visits every agent at the default stride.
    let visited = 0;
    agents.forEachAgent(() => visited++);
    expect(visited).toBe(BASE_CFG.count);

    // Field mass must be strictly positive after agents deposited.
    expect(f.meanValue(1)).toBeGreaterThan(0);
  });

  test('trail-following — maxValue climbs well above meanValue after sustained diffuse+decay', () => {
    const f = createScalarField(200, 200, 4);
    const agents = createStigmergy(f, { ...BASE_CFG, count: 200 }, new SeededRNG(13));

    // Run enough steps for emergent veins to form (coagulation is visible within ~200 steps).
    for (let i = 0; i < 300; i++) {
      f.step(0.4, 0.97, Number.POSITIVE_INFINITY);
      agents.update();
    }

    const mean = f.meanValue(1);
    const max = f.maxValue(1);

    // In a vein-forming system max >> mean; require at least 3× ratio.
    expect(mean).toBeGreaterThan(0);
    expect(max / mean).toBeGreaterThan(3);
  });

  test('onSense hook pulls mean agent position measurably toward target vs no-hook control', () => {
    const targetX = 170;
    const targetY = 30;
    const steps = 80;

    // Control — no hook.
    const fCtrl = createScalarField(200, 200, 4);
    const aCtrl = createStigmergy(fCtrl, BASE_CFG, new SeededRNG(99));
    for (let i = 0; i < steps; i++) {
      fCtrl.step(0.4, 0.95, Number.POSITIVE_INFINITY);
      aCtrl.update();
    }
    let ctrlMeanX = 0;
    let ctrlMeanY = 0;
    for (let i = 0; i < BASE_CFG.count; i++) {
      ctrlMeanX += aCtrl.px[i] ?? 0;
      ctrlMeanY += aCtrl.py[i] ?? 0;
    }
    ctrlMeanX /= BASE_CFG.count;
    ctrlMeanY /= BASE_CFG.count;

    // Experimental — onSense steers toward (targetX, targetY).
    const fExp = createScalarField(200, 200, 4);
    const hookCfg = {
      ...BASE_CFG,
      onSense: (_i: number, x: number, y: number, _hd: number): number => {
        const dx = targetX - x;
        const dy = targetY - y;
        const ang = Math.atan2(dy, dx);
        // Bounded delta: clamp to ±0.3 rad/step toward target.
        const delta = ang - _hd;
        // Wrap delta to [-pi, pi].
        const wrapped =
          ((((delta + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
        return Math.max(-0.3, Math.min(0.3, wrapped));
      },
    };
    const aExp = createStigmergy(fExp, hookCfg, new SeededRNG(99));
    for (let i = 0; i < steps; i++) {
      fExp.step(0.4, 0.95, Number.POSITIVE_INFINITY);
      aExp.update();
    }
    let expMeanX = 0;
    let expMeanY = 0;
    for (let i = 0; i < BASE_CFG.count; i++) {
      expMeanX += aExp.px[i] ?? 0;
      expMeanY += aExp.py[i] ?? 0;
    }
    expMeanX /= BASE_CFG.count;
    expMeanY /= BASE_CFG.count;

    // The hooked run must end measurably closer to the target.
    const distCtrl = Math.hypot(ctrlMeanX - targetX, ctrlMeanY - targetY);
    const distExp = Math.hypot(expMeanX - targetX, expMeanY - targetY);
    expect(distExp).toBeLessThan(distCtrl);
  });
});
