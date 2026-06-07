import type { Query, World } from '@flare-engine/engine';
import type { LeszyForm, MinibossPattern, MinibossPhase } from '../../components';
import type { SpawnCtx } from '../../spawn';

export interface MinibossDeps {
  spawnCtx: SpawnCtx;
  query: Query;
  playerX: number;
  playerY: number;
  bounds: { width: number; height: number };
  onPhaseChange?: (phase: MinibossPhase) => void;
  onDefeated?: () => void;
  onExplosion?: (x: number, y: number) => void;
  /** Leszy: fired the instant `form` changes. */
  onFormChange?: (form: LeszyForm) => void;
  /** Nocny Łowca: spawn one homing hound at (x, y). Re-summoned when pack dies. */
  onSpawnHound?: (x: number, y: number) => void;
  /** Nocny Łowca: count of live hounds in the world right now. */
  countHounds?: () => number;
  /** Madej: spawn a spike-lane ground hazard at column `laneX`. */
  onSpawnSpikeLane?: (laneX: number) => void;
}

export interface MinibossStatus {
  alive: boolean;
  hp: number;
  hpMax: number;
  phase: MinibossPhase;
  pattern: MinibossPattern | null;
  rootProgress: number;
  form: LeszyForm;
  hounds: number;
  spikeIndex: number;
}

export interface MinibossCtx {
  world: World;
  id: number;
  deps: MinibossDeps;
}

export interface MinibossBehavior {
  onUpdate(dt: number, c: MinibossCtx): void;
  onActiveEnter?(c: MinibossCtx): void;
}
