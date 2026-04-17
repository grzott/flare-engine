import type { AssetManager } from '@flare-engine/assets';
import type { AudioManager } from '@flare-engine/audio';
import type { GameLoop } from '@flare-engine/core';
import type { World } from '@flare-engine/ecs';
import type { InputManager } from '@flare-engine/input';
import type { Camera2D, Renderer, SpriteBatch } from '@flare-engine/render';
import type { SceneManager } from '@flare-engine/scene';
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
