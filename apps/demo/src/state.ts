import { Signal } from '@flare-engine/events';

export type SceneName = 'boot' | 'menu' | 'base' | 'dialogue' | 'play' | 'game-over' | 'victory';

export type EnemyKind = 'straight' | 'sine' | 'diagonal' | 'boss';

export interface RunStats {
  score: number;
  kills: { straight: number; sine: number; diagonal: number; boss: number };
  bombsUsed: number;
  damageTaken: number;
  durationSec: number;
}

export function createRunStats(): RunStats {
  return {
    score: 0,
    kills: { straight: 0, sine: 0, diagonal: 0, boss: 0 },
    bombsUsed: 0,
    damageTaken: 0,
    durationSec: 0,
  };
}

export interface Settings {
  sfxVolume: number;
  musicVolume: number;
  screenShake: boolean;
}

export function defaultSettings(): Settings {
  return { sfxVolume: 1, musicVolume: 1, screenShake: true };
}

export interface SlotMeta {
  index: number;
  savedAt: number;
  runs: number;
  bestScore: number;
  lastScore: number;
  totalKills: number;
  bossDefeated: boolean;
  firstRunSeen: boolean;
  pendingVictoryDialogue: boolean;
}

export function createSlot(index: number): SlotMeta {
  return {
    index,
    savedAt: 0,
    runs: 0,
    bestScore: 0,
    lastScore: 0,
    totalKills: 0,
    bossDefeated: false,
    firstRunSeen: false,
    pendingVictoryDialogue: false,
  };
}

export interface GameState {
  score: number;
  playerHp: number;
  playerHpMax: number;
  bombCharges: number;
  bombFlashAlpha: number;
  bossHp: number;
  bossHpMax: number;
  bossActive: boolean;
  gameOver: boolean;
  victory: boolean;
  paused: boolean;
  currentScene: SceneName;
  menuReady: boolean;
  activeSlot: number | null;
  slots: (SlotMeta | null)[];
  lastSlotIndex: number | null;
  settings: Settings;
  runStats: RunStats;
}

export const gameState: GameState = {
  score: 0,
  playerHp: 3,
  playerHpMax: 3,
  bombCharges: 3,
  bombFlashAlpha: 0,
  bossHp: 0,
  bossHpMax: 0,
  bossActive: false,
  gameOver: false,
  victory: false,
  paused: false,
  currentScene: 'boot',
  menuReady: false,
  activeSlot: null,
  slots: [null, null, null],
  lastSlotIndex: null,
  settings: defaultSettings(),
  runStats: createRunStats(),
};

export const stateChanged = new Signal<void>();

export function resetRunState(): void {
  gameState.score = 0;
  gameState.playerHp = gameState.playerHpMax;
  gameState.bombCharges = 3;
  gameState.bombFlashAlpha = 0;
  gameState.bossHp = 0;
  gameState.bossHpMax = 0;
  gameState.bossActive = false;
  gameState.gameOver = false;
  gameState.victory = false;
  gameState.paused = false;
  gameState.menuReady = false;
  gameState.runStats = createRunStats();
  stateChanged.emit();
}

export function notifyStateChanged(): void {
  stateChanged.emit();
}

export interface JoystickState {
  dx: number;
  dy: number;
  active: boolean;
}

export const joystickState: JoystickState = { dx: 0, dy: 0, active: false };

export interface ButtonState {
  isPressed: boolean;
  justPressed: boolean;
}

export const bombButtonState: ButtonState = {
  isPressed: false,
  justPressed: false,
};

export function resetBombButtonFrame(): void {
  bombButtonState.justPressed = false;
}
