import type { GameContextValue, Query, SFXPool } from '@flare-engine/engine';
import type { CollisionWorld } from '@flare-engine/engine';
import type { AtlasHandle, SpawnCtx } from '../../spawn';
import type { BombFlashState } from '../../systems/bomb';
import type { SpawnEvent, SpawnerState } from '../../systems/spawner';

export interface SfxRef {
  current: SFXPool | null;
}

export interface PlaySceneDeps {
  ctx: GameContextValue;
  atlas: AtlasHandle;
  sfx: SfxRef;
}

/** Per-scene-instance state. Queries, spawn context, and mutable runtime flags
 *  live here so `onUpdate` does no per-frame allocation. */
export interface PlayState {
  coll: CollisionWorld;
  spawner: SpawnerState;
  playerId: number;
  bossId: number;
  bossSpawned: boolean;
  spawnEvents: SpawnEvent[];
  /** Pre-allocated spawn context — re-used every frame to avoid GC churn. */
  spawnCtx: SpawnCtx;
  flash: BombFlashState;
  shipQuery: Query;
  enemyQuery: Query;
  bulletQuery: Query;
  posQuery: Query;
  bossQuery: Query;
  /** Flag set by collision callbacks — consumed in onUpdate to fire camera shake. */
  playerHitShake: boolean;
  /** Cached viewport dimensions — refreshed every frame from the camera. */
  bounds: { width: number; height: number };
}
