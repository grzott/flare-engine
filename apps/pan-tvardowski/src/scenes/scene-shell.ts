import { World } from '@flare-engine/ecs';
import { Camera2D } from '@flare-engine/render';

/** Satisfies the Scene.world / .camera fields — SceneManager reassigns per-scene. */
export function shellDefaults(): { world: World; camera: Camera2D } {
  return { world: new World(), camera: new Camera2D() };
}
