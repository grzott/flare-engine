import { Signal } from '@flare-engine/events';
import { PLAYER_HP_MAX, START_BOMBS } from './config/gameplay';
import type { ZoneId } from './events';

export type SceneName = 'boot' | 'play' | 'game-over' | 'victory';

export type KillKind =
  | 'skrzat'
  | 'latawiec'
  | 'czart'
  | 'bies'
  | 'topielec'
  | 'strzyga'
  | 'mamuna'
  | 'licho'
  | 'nocnica'
  | 'dziwozona'
  | 'wapierz'
  | 'poludnica'
  | 'hound'
  | 'miniboss'
  | 'boss';

export interface RunStats {
  score: number;
  kills: {
    skrzat: number;
    latawiec: number;
    czart: number;
    bies: number;
    topielec: number;
    strzyga: number;
    mamuna: number;
    licho: number;
    nocnica: number;
    dziwozona: number;
    wapierz: number;
    poludnica: number;
    hound: number;
    miniboss: number;
    boss: number;
  };
  bombsUsed: number;
  damageTaken: number;
  durationSec: number;
}

export function createRunStats(): RunStats {
  return {
    score: 0,
    kills: {
      skrzat: 0,
      latawiec: 0,
      czart: 0,
      bies: 0,
      topielec: 0,
      strzyga: 0,
      mamuna: 0,
      licho: 0,
      nocnica: 0,
      dziwozona: 0,
      wapierz: 0,
      poludnica: 0,
      hound: 0,
      miniboss: 0,
      boss: 0,
    },
    bombsUsed: 0,
    damageTaken: 0,
    durationSec: 0,
  };
}

export interface Settings {
  screenShake: boolean;
  reducedMotion: boolean;
  locale: 'en' | 'pl';
}
export function defaultSettings(): Settings {
  return { screenShake: true, reducedMotion: false, locale: 'en' };
}

export interface ZoneBannerInfo {
  visible: boolean;
  opacity: number;
  nameKey: string;
  subtitleKey: string;
}

/**
 * Dialogue overlay state published by the dialogue runner. Presence of a
 * non-null value pauses gameplay; overlay reads `speakerKey` + `textKey`
 * and resolves them via the LocalizationManager at render time.
 */
export interface DialogueHudState {
  graphId: string;
  speakerKey: string;
  textKey: string;
}

export interface GameState {
  score: number;
  playerHp: number;
  playerHpMax: number;
  bombCharges: number;
  bossHp: number;
  bossHpMax: number;
  bossActive: boolean;
  bossNameKey: string;
  minibossHp: number;
  minibossHpMax: number;
  minibossActive: boolean;
  minibossNameKey: string;
  /** Wodnik bubble shield is up — HUD shows indicator, player shots blocked. */
  bossShieldActive: boolean;
  /** Bazyliszek phase-1 stone-gaze is active — HUD indicator + player slow. */
  bossGazeActive: boolean;
  gameOver: boolean;
  victory: boolean;
  currentScene: SceneName;
  currentZone: ZoneId;
  zoneBanner: ZoneBannerInfo;
  settings: Settings;
  runStats: RunStats;
  /** Active dialogue line; null = gameplay runs, non-null = paused. */
  dialogue: DialogueHudState | null;
}

export const gameState: GameState = {
  score: 0,
  playerHp: PLAYER_HP_MAX,
  playerHpMax: PLAYER_HP_MAX,
  bombCharges: START_BOMBS,
  bossHp: 0,
  bossHpMax: 0,
  bossActive: false,
  bossNameKey: 'bosses.smok-krzemionkowski.name',
  minibossHp: 0,
  minibossHpMax: 0,
  minibossActive: false,
  minibossNameKey: 'minibosses.rokita.name',
  bossShieldActive: false,
  bossGazeActive: false,
  gameOver: false,
  victory: false,
  currentScene: 'boot',
  currentZone: 'z1',
  zoneBanner: {
    visible: false,
    opacity: 0,
    nameKey: 'zones.1.name',
    subtitleKey: 'zones.1.subtitle',
  },
  settings: defaultSettings(),
  runStats: createRunStats(),
  dialogue: null,
};

export const stateChanged = new Signal<void>();
export function notifyStateChanged(): void {
  stateChanged.emit();
}

/** Shared joystick state (updated by `<VirtualJoystick>` in `App.tsx`). */
export const joystickState = { dx: 0, dy: 0, active: false };

/** Shared bomb-button state — `justPressed` is cleared each frame by the loop. */
export const bombButtonState = { justPressed: false, isPressed: false };
export function resetBombButtonFrame(): void {
  bombButtonState.justPressed = false;
}

/**
 * Reset all module-level game state to first-boot defaults. Called on
 * runtime dispose (app teardown / component unmount) so a remount cannot
 * inherit residual flags from a prior run (gameOver, bossActive, etc.).
 * Settings are preserved — those live in the save store.
 */
export function resetGameState(): void {
  const settings = gameState.settings;
  gameState.score = 0;
  gameState.playerHp = PLAYER_HP_MAX;
  gameState.playerHpMax = PLAYER_HP_MAX;
  gameState.bombCharges = START_BOMBS;
  gameState.bossHp = 0;
  gameState.bossHpMax = 0;
  gameState.bossActive = false;
  gameState.bossNameKey = 'bosses.smok-krzemionkowski.name';
  gameState.minibossHp = 0;
  gameState.minibossHpMax = 0;
  gameState.minibossActive = false;
  gameState.minibossNameKey = 'minibosses.rokita.name';
  gameState.bossShieldActive = false;
  gameState.bossGazeActive = false;
  gameState.gameOver = false;
  gameState.victory = false;
  gameState.currentScene = 'boot';
  gameState.currentZone = 'z1';
  gameState.zoneBanner.visible = false;
  gameState.zoneBanner.opacity = 0;
  gameState.zoneBanner.nameKey = 'zones.1.name';
  gameState.zoneBanner.subtitleKey = 'zones.1.subtitle';
  gameState.settings = settings;
  gameState.runStats = createRunStats();
  gameState.dialogue = null;
  joystickState.dx = 0;
  joystickState.dy = 0;
  joystickState.active = false;
  bombButtonState.justPressed = false;
  bombButtonState.isPressed = false;
}
