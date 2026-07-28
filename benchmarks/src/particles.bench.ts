import { ParticleEmitter } from '@flare-engine/particles';
import { type BenchOverrides, type BenchStats, runBench } from './harness.js';

const DT = 1 / 60;

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
    { maxParticles: active },
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
    { maxParticles: cap },
  );
  for (let i = 0; i < 120; i++) em.update(DT);
  return em;
}

export function particlesBenches(overrides?: BenchOverrides): BenchStats[] {
  const out: BenchStats[] = [];

  for (const n of [500, 1000, 2000, 5000]) {
    out.push(
      runBench(
        {
          name: `particles.update  ${n.toString().padStart(4)} integrate-only`,
          setup: () => steadyStateEmitter(n),
          run: (em) => em.update(DT),
          innerIters: 200,
          samples: 30,
        },
        overrides,
      ),
    );
  }

  for (const n of [500, 1000, 2000]) {
    out.push(
      runBench(
        {
          name: `particles.update  ${n.toString().padStart(4)} emit+integrate`,
          setup: () => streamingEmitter(n),
          run: (em) => em.update(DT),
          innerIters: 200,
          samples: 30,
        },
        overrides,
      ),
    );
  }

  return out;
}
