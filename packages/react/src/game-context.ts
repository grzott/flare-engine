import type { AssetManager } from '@flare/assets';
import type { AudioManager } from '@flare/audio';
import type { GameLoop } from '@flare/core';
import type { World } from '@flare/ecs';
import type { InputManager } from '@flare/input';
import type { Camera2D, Renderer, SpriteBatch } from '@flare/render';
import type { SceneManager } from '@flare/scene';
import { createContext } from 'react';

/** The value exposed via GameContext. */
export interface GameContextValue {
  /** ECS world. */
  world: World;
  /** Primary 2D camera. */
  camera: Camera2D;
  /** Input manager (pointer, touches). */
  input: InputManager;
  /** Audio manager. */
  audio: AudioManager;
  /** Asset manager. */
  assets: AssetManager;
  /** Scene manager. */
  scenes: SceneManager;
  /** Game loop. */
  loop: GameLoop;
  /** Frame renderer (owns the draw phase). */
  renderer: Renderer;
  /** Sprite batch — queue `draw()` calls from systems or custom logic. */
  batch: SpriteBatch;
}

/**
 * React context that provides access to core game objects.
 * Null if accessed outside a <GameView>.
 */
export const GameContext = createContext<GameContextValue | null>(null);
