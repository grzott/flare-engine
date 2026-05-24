/**
 * Shared types for E3 perf scenario library.
 *
 * ScenarioDeps is constructed once per bench run from play.ts state —
 * all queries are pre-created outside the loop (zero-alloc rule).
 */
import type { PerfRecorderHandle } from '@flare-engine/debug';
import type { Query, World } from '@flare-engine/engine';
import type { CollisionWorld } from '@flare-engine/physics';
import type { BossPattern } from '../../components';
import type { AtlasHandle, SpawnCtx } from '../../spawn';

export interface ScenarioDeps {
  readonly recorder: PerfRecorderHandle;
  readonly world: World;
  readonly spawnCtx: SpawnCtx;
  readonly coll: CollisionWorld;
  readonly atlas: AtlasHandle;
  readonly bounds: { width: number; height: number };
  /** Pre-created query — never call world.query() inside a scenario tick. */
  readonly enemyQuery: Query;
  readonly bulletQuery: Query;
  readonly lifetimeQuery: Query;
  /** Full render pipeline spawn — adds Sprite + atlas frame. Headless tests
   *  omit this; boss scenarios fall back to _spawnBossEntity in that case. */
  readonly spawnBoss?: (pattern: BossPattern, x: number, y: number, hpMax: number) => number;
}

export interface ScenarioHandle {
  /** Called once before the first tick. */
  init(): void;
  /**
   * Called every frame.
   * @param dt   Scaled delta-time in seconds.
   * @param elapsed  Total elapsed seconds since scenario start.
   * @returns true when the scenario is complete (~30 s).
   */
  tick(dt: number, elapsed: number): boolean;
  /** Called once after the last tick. Flushes the recorder. */
  finish(): void;
}
