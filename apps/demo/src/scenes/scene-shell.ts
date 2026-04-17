import { Camera2D, World } from '@flare/engine';

/** SceneManager replaces world/camera on registration — these dummies satisfy the interface. */
export function shellDefaults(): { world: World; camera: Camera2D } {
  return { world: new World(), camera: new Camera2D() };
}
