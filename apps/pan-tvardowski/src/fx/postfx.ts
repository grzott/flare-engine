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
import { RIM_LIGHT_CHAIN, type RimLightRuntime, createRimLightRuntime } from '../lighting';

export type { PostFxController };

export interface PanPostFxController extends PostFxController {
  triggerChromaticAb(decayMs: number): void;
  triggerHitFlash(decayRate?: number): void;
  triggerGrayscaleHold(durationMs: number): void;
  triggerBloomPulse(durationMs: number): void;
  setCrtEnabled(enabled: boolean): void;
  setVignetteColor(r: number, g: number, b: number): void;
  /** Enable the rim-light pass and update light + boss positions this frame. */
  setRimLight(lightX: number, lightY: number, bossX: number, bossY: number): void;
  /** Disable the rim-light pass (boss defeated or budget watchdog triggered). */
  disableRimLight(): void;
  /** True when the rim-light pass is active. */
  readonly rimLightEnabled: boolean;
  /** The rim-light runtime — used by play.ts render hook for the second applyPostFx call. */
  readonly rimLight: RimLightRuntime;
  /** The trivial chain for the rim-light pass. */
  readonly rimLightChain: typeof RIM_LIGHT_CHAIN;
}

// Default rim-light parameters for smok-krzemionkowski (Zone 1).
// Light color: warm amber. Boss disc radius: 48 px (matches hull sub-shape).
const RIM_LIGHT_R = 1.0;
const RIM_LIGHT_G = 0.72;
const RIM_LIGHT_B = 0.25;
const RIM_LIGHT_INTENSITY = 1.8;
const RIM_LIGHT_FALLOFF_RADIUS = 160;
const BOSS_DISC_RADIUS = 48;

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

  const rimLight = createRimLightRuntime(skia);
  let rimLightEnabled = false;

  const bloomBaseline = 0.5;

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
    get rimLightEnabled() {
      return rimLightEnabled;
    },
    get rimLight() {
      return rimLight;
    },
    get rimLightChain() {
      return RIM_LIGHT_CHAIN;
    },
    setRimLight(lightX: number, lightY: number, bossX: number, bossY: number): void {
      rimLightEnabled = true;
      rimLight.updateUniforms(
        lightX,
        lightY,
        RIM_LIGHT_R,
        RIM_LIGHT_G,
        RIM_LIGHT_B,
        RIM_LIGHT_INTENSITY,
        RIM_LIGHT_FALLOFF_RADIUS,
        bossX,
        bossY,
        BOSS_DISC_RADIUS,
      );
    },
    disableRimLight(): void {
      rimLightEnabled = false;
    },
    triggerHitFlash(decayRate?: number): void {
      flashIntensity = 1;
      flashDecayRate = decayRate ?? 12.5;
      base.chain.setUniforms('grayscale-flash', { kind: 'grayscale-flash', intensity: 1 });
    },
    triggerChromaticAb(decayMs: number): void {
      base.triggerTimed?.('chromatic-aberration', decayMs);
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
      base.update(dt);
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
