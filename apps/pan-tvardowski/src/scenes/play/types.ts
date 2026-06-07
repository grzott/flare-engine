import type { Tween } from '@flare-engine/animation';
import type { GameContextValue } from '@flare-engine/engine';
import type { CollisionWorld } from '@flare-engine/physics';
import type { ZoneBgController } from '../../bg/create-zone-bg';
import type { ZoneConfig } from '../../config/zones';
import type { ZoneBannerState } from '../../hud/zone-banner';
import type { SpawnCtx } from '../../spawn';
import type { BombFlashState } from '../../systems/bomb';
import type { SpawnEvent, SpawnerState } from '../../systems/spawner';

// Pre-computed sub-shape counts per atlas frame: hull(1) + weapons.length + engine(1).
// Derived from SHAPE_CATALOGUE entries. Update if new ship entries are added.
export const SHIP_SUB_SHAPES: Record<string, number> = {
  // enemies
  skrzat: 3,
  latawiec: 4,
  czart: 4,
  bies: 4,
  licho: 3,
  strzyga: 4,
  topielec: 4,
  mamuna: 4,
  nocnica: 3,
  poludnica: 4,
  wapierz: 4,
  hound: 4,
  dziwozona: 4,
  'moon-wraith': 3,
  // minibosses
  rokita: 4,
  leszy: 5,
  'nocny-lowca': 5,
  madej: 4,
  // bosses
  'smok-krzemionkowski': 4,
  'borowy-krol': 5,
  'wodnik-wislanny': 4,
  boruta: 6,
  'baba-jaga': 4,
  'bazyliszek-warszawski': 6,
  mefistofeles: 5,
  'lucyper-ksiezycowy': 6,
  // player ships
  'kogut-zloty': 4,
  alembik: 4,
  zwierciadlo: 4,
};

export interface PlayState {
  zone: ZoneConfig;
  coll: CollisionWorld;
  spawnCtx: SpawnCtx;
  spawner: SpawnerState;
  schedule: ReturnType<ZoneConfig['buildSchedule']>;
  spawnEvents: SpawnEvent[];
  playerId: number;
  bossId: number;
  bossSpawned: boolean;
  minibossId: number;
  minibossSpawned: boolean;
  minibossDefeated: boolean;
  elapsed: number;
  flash: BombFlashState;
  banner: ZoneBannerState;
  shipQuery: ReturnType<GameContextValue['world']['query']>;
  enemyQuery: ReturnType<GameContextValue['world']['query']>;
  bulletQuery: ReturnType<GameContextValue['world']['query']>;
  posQuery: ReturnType<GameContextValue['world']['query']>;
  bossQuery: ReturnType<GameContextValue['world']['query']>;
  minibossQuery: ReturnType<GameContextValue['world']['query']>;
  lifetimeQuery: ReturnType<GameContextValue['world']['query']>;
  mirrorTwinQuery: ReturnType<GameContextValue['world']['query']>;
  spiralCollapseQuery: ReturnType<GameContextValue['world']['query']>;
  exhaustQuery: ReturnType<GameContextValue['world']['query']>;
  explosionFireQuery: ReturnType<GameContextValue['world']['query']>;
  bounds: { width: number; height: number };
  /** Pending shake level for this frame. null = none; 'x1' = bullet hit (6, 0.2); 'x2' = ship collision or bomb (12, 0.4). Stronger wins. */
  pendingShake: 'x1' | 'x2' | null;
  viewportReady: boolean;
  zoneBg: ZoneBgController | null;
  /** Previous-frame playerHp — used to detect damage and flash postfx. */
  lastPlayerHp: number;
  /** Set in onExit — deferred / signal-driven callbacks bail out when true
   *  so a zone-transition or scene.go() mid-frame can't touch a stale world. */
  disposed: boolean;
  /** Accumulated seconds since last auto-save. Resets on each persist call. */
  autoSaveAccum: number;
  /** Folio XIV M2: boss-bar fade-in tween (easeOutExpo 600 ms). */
  bossBarTween: Tween;
  /** Folio XIV M2: game-over overlay fade-in tween (easeInCubic 1200 ms). */
  gameOverTween: Tween;
  /** Folio XIV M1 item 5: combo-pulse tween (easeOutBack 120 ms). */
  comboPulseTween: Tween;
  /** Session #173: Tier-V cataclysm slow-mo ramp — 1.0→0.3 over 0.8 s (easeInCubic). */
  slowDownTween: Tween;
  /** Session #173: Tier-V cataclysm recovery ramp — 0.3→1.0 over 0.4 s (easeOutCubic). */
  recoveryTween: Tween;
}
