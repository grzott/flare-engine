import { Signal } from '@flare-engine/engine';

export type SceneName = 'boot' | 'menu' | 'play' | 'game-over' | 'victory';

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
  currentScene: SceneName;
  /** Gates Modal visibility during the arm-timer after scene enter. */
  menuReady: boolean;
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
  currentScene: 'boot',
  menuReady: false,
};

export const stateChanged = new Signal<void>();

export function resetGameState(): void {
  gameState.score = 0;
  gameState.playerHp = gameState.playerHpMax;
  gameState.bombCharges = 3;
  gameState.bombFlashAlpha = 0;
  gameState.bossHp = 0;
  gameState.bossHpMax = 0;
  gameState.bossActive = false;
  gameState.gameOver = false;
  gameState.victory = false;
  gameState.menuReady = false;
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
