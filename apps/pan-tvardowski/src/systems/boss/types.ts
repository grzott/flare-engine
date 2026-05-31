import type { Query, World } from '@flare-engine/engine';
import type { BossPattern, BossPhase } from '../../components';
import type { BossPostFxKind } from '../../fx/boss-postfx';
import type { SpawnCtx } from '../../spawn';

export interface BossDeps {
  spawnCtx: SpawnCtx;
  query: Query;
  playerX: number;
  playerY: number;
  bounds: { width: number; height: number };
  onPhaseChange?: (phase: BossPhase) => void;
  onDefeated?: () => void;
  onExplosion?: (x: number, y: number) => void;
  /** Wodnik: spawn a Topielec shield minion at (x, y). */
  onSpawnShieldMinion?: (x: number, y: number) => void;
  /** Wodnik: count how many live Topielec minions exist. */
  countShieldMinions?: () => number;
  /** Wodnik: fired the instant all minions die and the shield drops. */
  onShieldBroken?: () => void;
  /** Boruta: called once per summoned Bies when entering phase 2. */
  onSpawnSummon?: (x: number, y: number) => void;
  /** Bazyliszek: called whenever the phase-1 stone-gaze state toggles. */
  onGazeChange?: (active: boolean) => void;
  /** Bazyliszek phase 2: drop a persistent venom puddle at (x, y). */
  onSpawnPuddle?: (x: number, y: number) => void;
  /** Mefistofeles phase 2: drop a persistent fire-pit at (x, y). */
  onSpawnFirepit?: (x: number, y: number) => void;
  /** Mefistofeles phase 3: spawn the mirror-twin clone; returns its entity id. */
  onSpawnMirrorTwin?: (x: number, y: number) => number;
  /** Mefistofeles phase 3 / dying: despawn the mirror-twin entity by id. */
  onDespawnMirrorTwin?: (id: number) => void;
  /** Lucyper phase 2: toggle eclipse mode (dim + spotlight postfx on HUD). */
  onEclipseChange?: (active: boolean) => void;
  /** Called on every phase-enter; accent is an ARGB integer for background/boss tint. */
  onPaletteShift?: (phase: BossPhase, accent: number) => void;
  /** Called at phase-break position (x, y) to spawn a detonation-tier particle burst. */
  onPhaseBreak?: (x: number, y: number) => void;
  /** Called at phase-break to chain a named postfx sequence on the HUD. */
  onPhasePostFx?: (chain: BossPostFxKind) => void;
}

export interface BossStatus {
  alive: boolean;
  hp: number;
  hpMax: number;
  phase: BossPhase;
  invulnerable: boolean;
  pattern: BossPattern | null;
}

export interface BossCtx {
  world: World;
  id: number;
  deps: BossDeps;
}

/**
 * A boss's full phase definition. Fire closures are required for phase 1 + 2;
 * phase 3 fields are optional (only 3-phase bosses set them). Lifecycle hooks
 * are per-boss escape hatches the FSM calls without branching on pattern.
 */
export interface PhaseScript {
  sweepSpeed1: number;
  sweepSpeed2: number;
  sweepSpeed3?: number;
  fire1Cooldown: number;
  fire2Cooldown: number;
  fire3Cooldown?: number;
  fire1: (c: BossCtx) => void;
  fire2: (c: BossCtx) => void;
  fire3?: (c: BossCtx) => void;

  // -- lifecycle hooks (optional; most bosses set none) ---------------------
  onPhase1Enter?: (c: BossCtx) => void;
  onPhase1Update?: (dt: number, c: BossCtx) => void;
  onPhase1Exit?: (c: BossCtx) => void;
  onPhase2Enter?: (c: BossCtx) => void;
  onPhase2Update?: (dt: number, c: BossCtx) => void;
  onPhase2Exit?: (c: BossCtx) => void;
  onPhase3Enter?: (c: BossCtx) => void;
  onPhase3Update?: (dt: number, c: BossCtx) => void;
  onPhase3Exit?: (c: BossCtx) => void;
  /** Override default sweep movement in phase 3 (e.g. Bazyliszek teleport). */
  phase3Movement?: (dt: number, c: BossCtx) => void;
  /** Force 3-phase behavior (`phase2 → phase3` at 1/3 HP). */
  threePhase?: boolean;
}
