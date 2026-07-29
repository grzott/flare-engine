import { ParticleEmitter } from '@flare-engine/particles';
import { type BenchOverrides, type BenchStats, runBench } from './harness.js';

const DT = 1 / 60;

/**
 * The emitter's LCG seed is stated at every construction site. It defaults to
 * 1, so these suites were reproducible only by accident — a change to that
 * default would have silently altered the workload with no test or compile
 * signal.
 */
const SEED = 1;

function steadyStateEmitter(active: number): ParticleEmitter {
  const em = new ParticleEmitter(
    {
      rate: 0,
      lifetime: 1_000_000,
      speed: 50,
      direction: 0,
      spread: Math.PI,
      gravityY: 0,
      startSize: 4,
      endSize: 0,
      startAlpha: 1,
      endAlpha: 0,
      maxParticles: active,
    },
    { maxParticles: active, seed: SEED },
  );
  em.burst(active);
  em.emitting = false;
  return em;
}

function streamingEmitter(cap: number): ParticleEmitter {
  const em = new ParticleEmitter(
    {
      rate: cap * 2,
      lifetime: 0.5,
      speed: 80,
      direction: 0,
      spread: Math.PI,
      gravityY: 50,
      startSize: 4,
      endSize: 0,
      startAlpha: 1,
      endAlpha: 0,
      maxParticles: cap,
    },
    { maxParticles: cap, seed: SEED },
  );
  // rate x lifetime == cap, so the population saturates at the pool cap; 120
  // frames is 4 lifetimes, enough for the sample window to start saturated.
  for (let i = 0; i < 120; i++) em.update(DT);
  return em;
}

const INTEGRATE_SCENARIOS: readonly { n: number; innerIters: number }[] = [
  { n: 500, innerIters: 360 },
  { n: 1000, innerIters: 205 },
  { n: 2000, innerIters: 115 },
  { n: 5000, innerIters: 43 },
];

const EMIT_SCENARIOS: readonly { n: number; innerIters: number }[] = [
  { n: 500, innerIters: 155 },
  { n: 1000, innerIters: 95 },
  { n: 2000, innerIters: 39 },
];

export function particlesBenches(overrides?: BenchOverrides): BenchStats[] {
  const out: BenchStats[] = [];

  for (const { n, innerIters } of INTEGRATE_SCENARIOS) {
    out.push(
      runBench(
        {
          name: `particles.update  ${n.toString().padStart(4)} integrate-only`,
          setup: () => steadyStateEmitter(n),
          run: (em) => em.update(DT),
          innerIters,
        },
        overrides,
      ),
    );
  }

  for (const { n, innerIters } of EMIT_SCENARIOS) {
    out.push(
      runBench(
        {
          name: `particles.update  ${n.toString().padStart(4)} emit+integrate`,
          setup: () => streamingEmitter(n),
          run: (em) => em.update(DT),
          innerIters,
        },
        overrides,
      ),
    );
  }

  return out;
}
