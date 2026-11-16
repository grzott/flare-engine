import { drawParticles, ParticleEmitter } from '@flare-engine/particles';
import { createFrameRenderer, type FrameRenderer, SpriteBatch } from '@flare-engine/render';
import { type BenchOverrides, type BenchStats, runBench } from './harness.js';
import {
  PARTICLES_DRAW_SCENARIOS,
  type ParticlesDrawScenario,
} from './scenarios/particles-draw.js';
import { createCountingSkiaStub, makeStubImage, type SkiaStub } from './skia-stub.js';

const DT = 1 / 60;
const VIEW_W = 800;
const VIEW_H = 600;
const FRAME = { x: 0, y: 0, w: 16, h: 16 };

type BatchImage = Parameters<SpriteBatch['drawRaw']>[0];

export type ParticlesDrawState = {
  readonly emitter: ParticleEmitter;
  readonly batch: SpriteBatch;
  readonly renderer: FrameRenderer;
  readonly stub: SkiaStub;
  readonly image: BatchImage;
  /** Sprites queued by the last run, read before the flush empties the batch. */
  queued: number;
};

/**
 * A streaming emitter run to saturation and then frozen: `rate x lifetime`
 * equals the pool cap, so after four lifetimes the pool holds `n` particles of
 * every age. Each therefore has its own interpolated alpha and colour, which is
 * the input that used to cost one draw call per particle. The emitter is not
 * updated while measured, so every sample draws the same particles.
 */
export function buildParticlesDrawState(
  scenario: ParticlesDrawScenario,
  strict = false,
): ParticlesDrawState {
  const cap = scenario.n;
  const emitter = new ParticleEmitter(
    {
      rate: cap * 2,
      lifetime: 0.5,
      speed: 80,
      direction: 0,
      spread: Math.PI,
      gravityY: 50,
      startSize: 16,
      endSize: 4,
      startAlpha: 1,
      endAlpha: 0.05,
      startColor: { r: 1, g: 0.9, b: 0.3, a: 1 },
      endColor: { r: 0.8, g: 0.1, b: 0, a: 1 },
      maxParticles: cap,
    },
    { maxParticles: cap, seed: 1 },
  );
  for (let i = 0; i < 120; i++) emitter.update(DT);

  const stub = createCountingSkiaStub({ strict });
  return {
    emitter,
    batch: new SpriteBatch(),
    renderer: createFrameRenderer(stub.module),
    stub,
    image: makeStubImage(256, 256),
    queued: 0,
  };
}

/** One frame's particle draw: queue every live particle, flush, finish the picture. */
export function particlesDrawRun(state: ParticlesDrawState): void {
  const { emitter, batch, renderer, image } = state;
  renderer.beginFrame(VIEW_W, VIEW_H);
  drawParticles(emitter.pool, batch, image, FRAME);
  state.queued = batch.count;
  batch.flush(renderer.drawAtlas);
  renderer.endFrame();
}

export function particlesDrawBenches(overrides?: BenchOverrides): BenchStats[] {
  return PARTICLES_DRAW_SCENARIOS.map((scenario) =>
    runBench(
      {
        name: scenario.name,
        setup: () => buildParticlesDrawState(scenario),
        run: particlesDrawRun,
        innerIters: scenario.innerIters,
      },
      overrides,
    ),
  );
}
