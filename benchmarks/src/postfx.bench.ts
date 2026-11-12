import {
  createBloom,
  createChromaticAberration,
  createCrt,
  createGodRays,
  createGrayscaleFlash,
  createPostFxController,
  createPostFxRuntime,
  createVignette,
  createWeatherClouds,
  createWeatherRain,
  type Effect,
  EffectChain,
  type PostFxController,
  type PostFxRuntime,
} from '@flare-engine/postfx';
import { type BenchOverrides, type BenchStats, runBench } from './harness.js';
import { POSTFX_SCENARIOS, type PostFxScenario } from './scenarios/postfx.js';
import { createPostFxSkiaStub, type PostFxSkiaStub } from './skia-stub.js';

const DT = 1 / 60;
const VIEW_W = 800;
const VIEW_H = 600;

const FLASH_ID = 'grayscale-flash';
const TIMED_IDS = ['chromatic-aberration', 'god-rays', 'weather-clouds', 'crt'] as const;

/**
 * Rates that outlive any capture. The controller's per-frame cost depends on
 * whether the flash and each timed effect are still live, never on how far
 * they have decayed, so these keep every live branch running for the whole
 * sample window instead of letting the row fall back to two empty checks
 * a quarter-second in.
 */
const FLASH_DECAY_PER_SECOND = 1e-9;
const TIMED_DECAY_MS = 1e15;

/**
 * Eight effects, five enabled. Built fresh per scenario: effects are mutable
 * objects the controller writes into, so sharing one stack across rows would
 * let one row's state leak into the next.
 */
export function buildStack(): Effect[] {
  const effects = [
    createVignette(),
    createBloom(),
    createChromaticAberration(),
    createCrt(),
    createGrayscaleFlash(FLASH_ID),
    createGodRays(),
    createWeatherRain(),
    createWeatherClouds(),
  ];
  for (const e of effects) {
    if (e.id === 'chromatic-aberration' || e.id === 'god-rays' || e.id === 'weather-clouds') {
      e.enabled = false;
    }
  }
  return effects;
}

export function buildController(): PostFxController {
  const controller = createPostFxController({
    effects: buildStack(),
    flash: { id: FLASH_ID, decay: FLASH_DECAY_PER_SECOND },
  });
  controller.triggerHitFlash();
  for (const id of TIMED_IDS) controller.triggerTimed(id, TIMED_DECAY_MS);
  return controller;
}

export type EnabledState = { readonly chain: EffectChain; visited: number };

export function buildEnabledState(): EnabledState {
  const chain = new EffectChain();
  for (const e of buildStack()) chain.add(e);
  return { chain, visited: 0 };
}

export function enabledRun(state: EnabledState): void {
  let visited = 0;
  for (const _effect of state.chain.enabled()) visited++;
  state.visited = visited;
}

export type BuildPassState = {
  readonly chain: EffectChain;
  readonly runtime: PostFxRuntime;
  readonly stub: PostFxSkiaStub;
  passes: number;
};

export function buildPassState(): BuildPassState {
  const chain = new EffectChain();
  for (const e of buildStack()) chain.add(e);
  const stub = createPostFxSkiaStub();
  const runtime = createPostFxRuntime(stub.module);
  // Compile once outside the timed region: the steady-state frame reads every
  // shader from the runtime's cache, and that is the path this row measures.
  runtime.buildPass(chain, VIEW_W, VIEW_H);
  return { chain, runtime, stub, passes: 0 };
}

export function buildPassRun(state: BuildPassState): void {
  state.passes = state.runtime.buildPass(state.chain, VIEW_W, VIEW_H).length;
}

function benchFor(scenario: PostFxScenario, overrides?: BenchOverrides): BenchStats {
  const { name, innerIters } = scenario;
  switch (scenario.kind) {
    case 'update':
      return runBench(
        { name, setup: buildController, run: (c) => c.update(DT), innerIters },
        overrides,
      );
    case 'enabled':
      return runBench({ name, setup: buildEnabledState, run: enabledRun, innerIters }, overrides);
    case 'buildPass':
      return runBench({ name, setup: buildPassState, run: buildPassRun, innerIters }, overrides);
  }
}

export function postfxBenches(overrides?: BenchOverrides): BenchStats[] {
  return POSTFX_SCENARIOS.map((scenario) => benchFor(scenario, overrides));
}
