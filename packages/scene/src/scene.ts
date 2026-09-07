import type { World } from '@flare-engine/ecs';
import type { Camera2D } from '@flare-engine/render';

/**
 * Scene lifecycle hooks. All methods are optional.
 * A scene owns its own ECS World and Camera2D.
 */
export interface Scene {
  /** Scene name (unique identifier). */
  readonly name: string;

  /** ECS World for this scene (created by SceneManager). */
  world: World;

  /** Camera for this scene (created by SceneManager). */
  camera: Camera2D;

  /** Load assets before the scene is initialized. */
  onPreload?(): void | Promise<void>;

  /** Initialize scene entities and systems. Called once after preload. */
  onInit?(): void;

  /** Called every time the scene becomes the active scene. */
  onEnter?(data?: unknown): void;

  /** Called every frame with scaled delta time. */
  onUpdate?(dt: number): void;

  /** Called every frame after update for rendering logic. */
  onDraw?(): void;

  /** Called when the scene is deactivated (pushed or replaced). */
  onExit?(): void;

  /** Called when the scene is permanently removed. Cleanup resources. */
  onDestroy?(): void;
}

/**
 * Factory function type for creating scenes. Receives the `World` and
 * `Camera2D` the manager created for this scene instance, so a factory can
 * populate the world it will actually get before returning it as part of the
 * `Scene`. A zero-argument `() => Scene` factory (ignoring both parameters)
 * remains a valid `SceneFactory`.
 */
export type SceneFactory = (world: World, camera: Camera2D) => Scene;
