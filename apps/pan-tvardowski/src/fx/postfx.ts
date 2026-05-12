import {
  type CompiledPass,
  type PostFxController,
  type SkiaPostFxModuleLike,
  createBloom,
  createChromaticAberration,
  createCrt,
  createGrayscaleFlash,
  createPostFxController,
  createVignette,
} from '@flare-engine/postfx';

export type { PostFxController };

export interface PanPostFxController extends PostFxController {
  triggerChromaticAb(decayMs: number): void;
  triggerHitFlash(decayRate?: number): void;
  triggerGrayscaleHold(durationMs: number): void;
  triggerBloomPulse(durationMs: number): void;
  setCrtEnabled(enabled: boolean): void;
  setVignetteColor(r: number, g: number, b: number): void;
}

export function createPanTvardowskiPostFx(skia: SkiaPostFxModuleLike | null): PanPostFxController {
  const chromaticAb = createChromaticAberration('chromatic-aberration', { amount: 0.012 });
  chromaticAb.enabled = false;

  const crtEffect = createCrt('crt', { scanlineIntensity: 0.25, curvature: 0.12 });
  crtEffect.enabled = false;

  const base = createPostFxController({
    effects: [
      createVignette('vignette', { intensity: 0.35, radius: 0.82 }),
      createBloom('bloom', { threshold: 0.72, intensity: 0.5 }),
      createGrayscaleFlash('grayscale-flash', { intensity: 0 }),
      chromaticAb,
      crtEffect,
    ],
    skia,
  });

  const bloomBaseline = 0.5;

  let chromAbTimerMs = 0;
  let flashIntensity = 0;
  let flashDecayRate = 12.5;
  let grayscaleHoldMs = 0;
  let bloomPulseMs = 0;

  const ctrl: PanPostFxController = {
    get chain() {
      return base.chain;
    },
    get runtime() {
      return base.runtime;
    },
    triggerHitFlash(decayRate?: number): void {
      flashIntensity = 1;
      flashDecayRate = decayRate ?? 12.5;
      base.chain.setUniforms('grayscale-flash', { kind: 'grayscale-flash', intensity: 1 });
    },
    triggerChromaticAb(decayMs: number): void {
      chromAbTimerMs = decayMs;
      const ab = base.chain.get('chromatic-aberration');
      if (ab) {
        ab.enabled = true;
        base.chain.setUniforms('chromatic-aberration', {
          kind: 'chromatic-aberration',
          amount: 0.012,
        });
      }
    },
    triggerGrayscaleHold(durationMs: number): void {
      grayscaleHoldMs = durationMs;
    },
    triggerBloomPulse(durationMs: number): void {
      bloomPulseMs = durationMs;
      base.chain.setUniforms('bloom', {
        kind: 'bloom',
        threshold: 0.72,
        intensity: 1.2,
      });
    },
    setCrtEnabled(enabled: boolean): void {
      const crt = base.chain.get('crt');
      if (crt) crt.enabled = enabled;
    },
    setVignetteColor(r: number, g: number, b: number): void {
      base.chain.setUniforms('vignette', {
        kind: 'vignette',
        intensity: 0.35,
        radius: 0.82,
        color: [r, g, b],
      });
    },
    update(dt: number): void {
      if (flashIntensity > 0) {
        flashIntensity = Math.max(0, flashIntensity - flashDecayRate * dt);
        if (grayscaleHoldMs > 0) {
          flashIntensity = Math.max(flashIntensity, 0.6);
        }
        base.chain.setUniforms('grayscale-flash', {
          kind: 'grayscale-flash',
          intensity: flashIntensity,
        });
      }
      if (chromAbTimerMs > 0) {
        chromAbTimerMs -= dt * 1000;
        if (chromAbTimerMs <= 0) {
          chromAbTimerMs = 0;
          const ab = base.chain.get('chromatic-aberration');
          if (ab) {
            ab.enabled = false;
            base.chain.setUniforms('chromatic-aberration', {
              kind: 'chromatic-aberration',
              amount: 0,
            });
          }
        }
      }
      if (grayscaleHoldMs > 0) {
        grayscaleHoldMs -= dt * 1000;
        if (grayscaleHoldMs <= 0) {
          grayscaleHoldMs = 0;
        }
      }
      if (bloomPulseMs > 0) {
        bloomPulseMs -= dt * 1000;
        if (bloomPulseMs <= 0) {
          bloomPulseMs = 0;
          base.chain.setUniforms('bloom', {
            kind: 'bloom',
            threshold: 0.72,
            intensity: bloomBaseline,
          });
        }
      }
    },
    buildPass(width: number, height: number): readonly CompiledPass[] {
      return base.buildPass(width, height);
    },
    setMotionScale(k: number): void {
      base.setMotionScale(k);
    },
  };

  return ctrl;
}

export type { CompiledPass };
