import type { World } from '@flare-engine/ecs';
import type { BgImageHandle, KenneyAtlasHandle } from '../assets/sprites-loader';
import type { AtlasHandle } from '../spawn';

/** Minimal camera interface — only the viewport dimensions are needed. */
export interface ZoneBgCamera {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
}

export interface ZoneBgDeps {
  world: World;
  atlas: AtlasHandle;
  viewportWidth: number;
  viewportHeight: number;
  /** Live camera reference. tick() reads this each frame to detect the first
   * real layout and resize both BG entities to true full-canvas dimensions.
   * The initial viewportWidth/Height values from s.bounds are the play-area
   * size (safe-area-inset reduced and possibly the 360×640 pre-layout fallback);
   * camera.viewportWidth/Height is the actual canvas size. Without this sync
   * the BG only covers the 2/3-top band on real devices. */
  camera: ZoneBgCamera;
  /** Kenney zone-1 atlas — optional, null until PNG resolves. KG6 uses this
   *  for the 'image' BG kind. */
  kenney?: KenneyAtlasHandle | null;
  /** Kenney background image handle — optional, null until PNG resolves. KG6
   *  uses this to render the zone-1 image background. */
  bg?: BgImageHandle | null;
}

export interface ZoneBgController {
  destroy(): void;
  tick(dt: number): void;
}
