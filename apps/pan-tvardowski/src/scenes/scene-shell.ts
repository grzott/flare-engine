import { Camera2D, World } from '@flare-engine/engine';

/** Satisfies the Scene.world / .camera fields — SceneManager reassigns per-scene. */
export function shellDefaults(): { world: World; camera: Camera2D } {
  return { world: new World(), camera: new Camera2D() };
}
