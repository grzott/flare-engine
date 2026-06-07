import type { PerfRecorderHandle } from '@flare-engine/debug';
import { createPerfRecorder } from '@flare-engine/debug';
import type { GameContextValue } from '@flare-engine/engine';
import {
  getBenchScenarioId,
  isBenchActive,
  markBenchDone,
  setBenchReport,
} from '../../perf/bench-mode';
import {
  createBootScenario,
  createBossLucyperZ8Scenario,
  createBossSmokFullScenario,
  createParticleStormScenario,
  createZoneTransitionsScenario,
} from '../../perf/scenarios';
import type { ScenarioHandle } from '../../perf/scenarios';
import type { AtlasHandle } from '../../spawn';
import { spawnBoss } from '../../spawn';
import type { PlayState } from './types';

export interface BenchRef {
  scenario: ScenarioHandle | null;
  elapsed: number;
  recorder: PerfRecorderHandle | null;
}

export function initBenchmark(s: PlayState, ctx: GameContextValue, atlas: AtlasHandle): BenchRef {
  const ref: BenchRef = { scenario: null, elapsed: 0, recorder: null };
  if (!isBenchActive()) return ref;

  ref.recorder = createPerfRecorder({ label: getBenchScenarioId(), ringSize: 1800 });
  const scenarioDeps = {
    world: ctx.world,
    spawnCtx: s.spawnCtx,
    coll: s.coll,
    atlas,
    bounds: s.bounds,
    enemyQuery: s.enemyQuery,
    bulletQuery: s.bulletQuery,
    lifetimeQuery: s.lifetimeQuery,
    spawnBoss: (pattern: Parameters<typeof spawnBoss>[1], x: number, y: number, hpMax: number) =>
      spawnBoss(s.spawnCtx, pattern, x, y, hpMax),
  };
  const id = getBenchScenarioId();
  if (id === 'boss-smok-full') {
    ref.scenario = createBossSmokFullScenario(scenarioDeps);
  } else if (id === 'boss-lucyper-z8') {
    ref.scenario = createBossLucyperZ8Scenario(scenarioDeps);
  } else if (id === 'particle-storm') {
    ref.scenario = createParticleStormScenario(scenarioDeps);
  } else if (id === 'zone-transitions') {
    ref.scenario = createZoneTransitionsScenario(scenarioDeps);
  } else {
    ref.scenario = createBootScenario(scenarioDeps);
  }
  ref.scenario.init();
  return ref;
}

export function tickBenchPre(ref: BenchRef, dt: number): boolean {
  if (ref.scenario === null) return false;
  const terminating = ref.scenario.tick(dt, ref.elapsed);
  ref.elapsed += dt;
  return terminating;
}

export function recordBenchFrame(ref: BenchRef): void {
  if (ref.recorder !== null) {
    ref.recorder.endSection('frame');
    ref.recorder.recordFrame({ elapsed: ref.elapsed * 1000 });
  }
}

export function finalizeBench(ref: BenchRef, terminating: boolean): void {
  if (!terminating || ref.scenario === null) return;
  ref.scenario.finish();
  if (ref.recorder !== null) {
    setBenchReport(JSON.stringify(ref.recorder.flush()));
    ref.recorder = null;
  }
  ref.scenario = null;
  markBenchDone();
}

export function clearBench(ref: BenchRef): void {
  ref.scenario = null;
  ref.elapsed = 0;
  ref.recorder = null;
}
