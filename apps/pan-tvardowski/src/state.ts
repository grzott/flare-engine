import { Signal } from '@flare-engine/events';
import { PLAYER_HP_MAX, START_BOMBS } from './config/gameplay';
import type { ZoneId } from './events';

export type SceneName = 'boot' | 'play' | 'game-over' | 'victory';

export type KillKind = 'skrzat' | 'latawiec' | 'czart' | 'bies' | 'miniboss' | 'boss';

export interface RunStats {
  score: number;
  kills: {
    skrzat: number;
    latawiec: number;
    czart: number;
    bies: number;
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
    kills: { skrzat: 0, latawiec: 0, czart: 0, bies: 0, miniboss: 0, boss: 0 },
    bombsUsed: 0,
    damageTaken: 0,
    durationSec: 0,
  };
}

export interface Settings {
  screenShake: boolean;
  locale: 'en' | 'pl';
}
export function defaultSettings(): Settings {
  return { screenShake: true, locale: 'en' };
}

export interface ZoneBannerInfo {
  visible: boolean;
  opacity: number;
  nameKey: string;
  subtitleKey: string;
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
  gameOver: boolean;
  victory: boolean;
  currentScene: SceneName;
  currentZone: ZoneId;
  zoneBanner: ZoneBannerInfo;
  settings: Settings;
  runStats: RunStats;
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
