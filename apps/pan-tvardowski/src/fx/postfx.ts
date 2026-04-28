import {
  type CompiledPass,
  type PostFxController,
  type SkiaPostFxModuleLike,
  createBloom,
  createGrayscaleFlash,
  createPostFxController,
  createVignette,
} from '@flare-engine/postfx';

export type { PostFxController };

export function createPanTvardowskiPostFx(skia: SkiaPostFxModuleLike | null): PostFxController {
  return createPostFxController({
    effects: [
      createVignette('vignette', { intensity: 0.35, radius: 0.82 }),
      createBloom('bloom', { threshold: 0.72, intensity: 0.5 }),
      createGrayscaleFlash('grayscale-flash', { intensity: 0 }),
    ],
    skia,
    flash: { id: 'grayscale-flash', decay: 4.2 },
  });
}

export type { CompiledPass };
