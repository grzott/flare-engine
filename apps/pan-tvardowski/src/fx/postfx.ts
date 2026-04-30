import {
  type CompiledPass,
  type PostFxController,
  type SkiaPostFxModuleLike,
  createBloom,
  createChromaticAberration,
  createGrayscaleFlash,
  createPostFxController,
  createVignette,
} from '@flare-engine/postfx';

export type { PostFxController };

export function createPanTvardowskiPostFx(skia: SkiaPostFxModuleLike | null): PostFxController {
  const chromaticAb = createChromaticAberration('chromatic-aberration', { amount: 0 });
  chromaticAb.enabled = false;
  return createPostFxController({
    effects: [
      createVignette('vignette', { intensity: 0.35, radius: 0.82 }),
      createBloom('bloom', { threshold: 0.72, intensity: 0.5 }),
      createGrayscaleFlash('grayscale-flash', { intensity: 0 }),
      chromaticAb,
    ],
    skia,
    flash: { id: 'grayscale-flash', decay: 4.2 },
  });
}

export type { CompiledPass };
