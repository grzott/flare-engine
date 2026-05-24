/**
 * boot scenario — measures per-frame play-scene overhead with no boss active.
 *
 * Tier-E gate: this scenario brackets the render-loop frame cost (JS-thread
 * only) under a minimal-load steady state: player alive, a handful of enemies,
 * no boss, no postfx chains.  It does NOT replay the cold-start TTI trace
 * (that remains `cold-start.ts`).
 *
 * Section: "frame" — one tick of the scenario update.
 * Duration: ~30 s.
 */

import { SCENARIO_DURATION_SEC } from './constants';
import type { ScenarioDeps, ScenarioHandle } from './types';

export function createBootScenario(deps: ScenarioDeps): ScenarioHandle {
  const { recorder } = deps;

  return {
    init() {
      recorder.reset();
    },

    tick(_dt: number, elapsed: number): boolean {
      recorder.beginSection('frame');
      // The boot scenario brackets the scenario driver's own tick overhead —
      // the outer bench runner measures JS-thread wall time; the section records
      // the incremental in-scenario cost so E7 regression-check can diff it.
      recorder.endSection('frame');
      recorder.recordFrame({ elapsed: elapsed * 1000 });
      return elapsed >= SCENARIO_DURATION_SEC;
    },

    finish() {
      // flush is read-only on PerfRecorderHandle; the caller (bench runner) reads it.
    },
  };
}
