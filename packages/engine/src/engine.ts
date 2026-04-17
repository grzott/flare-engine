import type { AssetLoader } from '@flare-engine/assets';
import { AssetManager } from '@flare-engine/assets';
import { AudioManager } from '@flare-engine/audio';
import { GameLoop } from '@flare-engine/core';
import type { GameLoopConfig } from '@flare-engine/core';
import { World } from '@flare-engine/ecs';
import { InputManager } from '@flare-engine/input';
import { Camera2D, Renderer, SpriteBatch } from '@flare-engine/render';
import { SceneManager } from '@flare-engine/scene';

/** Configuration for createGame(). */
export interface GameConfig extends GameLoopConfig {
  /** Asset loader for the AssetManager. Defaults to a no-op loader. */
  assetLoader?: AssetLoader;
}

/** The game instance returned by createGame(). */
export interface GameInstance {
  /** ECS world. */
  world: World;
  /** Primary 2D camera. */
  camera: Camera2D;
  /** Renderer (manages Skia canvas lifecycle). */
  renderer: Renderer;
  /** Sprite batch — queue draw commands, flushed by the render-loop owner. */
  batch: SpriteBatch;
  /** Input manager. */
  input: InputManager;
  /** Audio manager. */
  audio: AudioManager;
  /** Asset manager. */
  assets: AssetManager;
  /** Scene manager. */
  scenes: SceneManager;
  /** Game loop. */
  loop: GameLoop;
  /** Start the game loop. */
  start(): void;
  /** Stop the game loop. */
  stop(): void;
}

/**
 * createGame — convenience factory that wires all core subsystems together.
 *
 * Creates a World, Camera2D, Renderer, InputManager, AudioManager,
 * AssetManager, SceneManager, and GameLoop. Returns a GameInstance with
 * `start()` and `stop()` helpers.
 */
export function createGame(config?: GameConfig): GameInstance {
  const noop: AssetLoader = () => Promise.resolve(null);

  const world = new World();
  const camera = new Camera2D();
  const renderer = new Renderer();
  const batch = new SpriteBatch();
  const input = new InputManager();
  const audio = new AudioManager();
  const assets = new AssetManager(config?.assetLoader ?? noop);
  const scenes = new SceneManager();
  const loop = new GameLoop({ fixedDt: config?.fixedDt, maxDt: config?.maxDt });

  return {
    world,
    camera,
    renderer,
    batch,
    input,
    audio,
    assets,
    scenes,
    loop,
    start() {
      loop.start();
    },
    stop() {
      loop.stop();
    },
  };
}
