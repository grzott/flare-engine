/**
 * boot scenario — measures the steady-state play-scene render cost.
 *
 * No setup actions: Zone 1 entities are already spawned by startZone() during
 * the play scene's onEnter. The normal game loop ticks player + enemies +
 * postfx for 30 seconds and play.ts brackets the frame work in the perf
 * recorder. The recorded `frame` section p95 is the boot-scenario baseline.
 *
 * This scenario is intentionally empty — its only job is to gate the 30 s
 * measurement window. See createBossSmokFullScenario / createParticleStormScenario
 * for examples that DO setup work each tick.
 */

import { SCENARIO_DURATION_SEC } from './constants';
import type { ScenarioHandle, ScenarioDeps as _ScenarioDeps } from './types';

export function createBootScenario(_deps: _ScenarioDeps): ScenarioHandle {
  return {
    init() {},
    tick(_dt: number, elapsed: number): boolean {
      return elapsed >= SCENARIO_DURATION_SEC;
    },
    finish() {},
  };
}
