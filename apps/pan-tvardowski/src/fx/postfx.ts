import {
  type CompiledPass,
  type CompositeUniforms,
  type PostFxController,
  type SkiaPostFxModuleLike,
  createPostFxComposite,
  createPostFxController,
} from '@flare-engine/postfx';
import { SHADOW_RIM_CHAIN, type ShadowRimRuntime, createShadowRimRuntime } from '../lighting';
import { RIM_LIGHT_DEFS } from '../visual-spec/lighting';
import { BASELINE_POSTFX, resolvePostFx } from '../visual-spec/postfx';
import type { PostFxPresetDef, RimLightDef, ZoneFxDef } from '../visual-spec/types';

export type { PostFxController };

export interface PanPostFxController extends PostFxController {
  triggerChromaticAb(decayMs: number): void;
  triggerHitFlash(decayRate?: number): void;
  triggerGrayscaleHold(durationMs: number): void;
  triggerBloomPulse(durationMs: number): void;
  setCrtEnabled(enabled: boolean): void;
  setVignetteColor(r: number, g: number, b: number): void;
  /** Cache a RimLightDef for this boss encounter; call on phase-enter. */
  setRimLightDef(def: RimLightDef): void;
  /** Enable the shadow-rim pass and update light + boss positions this frame. */
  setRimLight(lightX: number, lightY: number, bossX: number, bossY: number): void;
  /** Disable the shadow-rim pass (boss defeated or budget watchdog triggered). */
  disableRimLight(): void;
  /** True when the shadow-rim pass is active. */
  readonly rimLightEnabled: boolean;
  /** The shadow-rim runtime — used by play.ts render hook for the second applyPostFx call. */
  readonly rimLight: ShadowRimRuntime;
  /** The trivial chain for the shadow-rim pass. */
  readonly rimLightChain: typeof SHADOW_RIM_CHAIN;
  /** Activate the per-zone weather FX pass. Pass undefined to deactivate. */
  setZoneFxDef(def: ZoneFxDef | undefined): void;
}

// weatherKind integer mapping
const WEATHER_KIND: Record<ZoneFxDef['kind'], 1 | 2 | 3 | 4> = {
  rain: 1,
  'sun-shaft': 2,
  'dark-vignette': 3,
  clouds: 4,
};

export function createPanTvardowskiPostFx(
  skia: SkiaPostFxModuleLike | null,
  preset?: Partial<PostFxPresetDef>,
): PanPostFxController {
  const p = resolvePostFx(BASELINE_POSTFX, preset);

  const compositeEffect = createPostFxComposite('composite', {
    vignetteIntensity: p.vignette.intensity,
    vignetteRadius: p.vignette.radius,
    vignetteColor: [0, 0, 0],
    bloomThreshold: p.bloom.threshold,
    bloomIntensity: p.bloom.intensity,
    flashIntensity: 0,
    chromaAmount: 0,
    crtScanlineIntensity: p.crt.scanlineIntensity,
    crtCurvature: p.crt.curvature,
    crtEnabled: false,
    weatherKind: 0,
    weatherIntensity: 0,
    weatherDirection: 0,
    weatherScrollX: 0,
    weatherScrollY: 0,
  });

  const base = createPostFxController({
    effects: [compositeEffect],
    skia,
  });

  // Mutable alias — uniforms object is shared by reference; fields are mutated in place.
  const u = compositeEffect.uniforms as { kind: 'composite' } & CompositeUniforms;

  const rimLight = createShadowRimRuntime(skia);
  let rimLightEnabled = false;
  // Cached per-boss rim-light def. Defaults to smok so existing call sites are
  // unchanged before any boss calls setRimLightDef.
  let activeRimDef: RimLightDef = RIM_LIGHT_DEFS['smok-krzemionkowski'] as RimLightDef;

  const bloomBaseline = p.bloom.intensity;

  let flashIntensity = 0;
  let flashDecayRate = p.flashDecayRate;
  let grayscaleHoldMs = 0;
  let bloomPulseMs = 0;
  // Decay in ms; linearly decays chromaAmount → 0 over this window.
  let chromaDecayMs = 0;

  let activeZoneFxDef: ZoneFxDef | null = null;
  let zoneFxScrollOffsetY = 0;
  let zoneFxScrollOffsetX = 0;

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
      return SHADOW_RIM_CHAIN;
    },
    setRimLightDef(def: RimLightDef): void {
      activeRimDef = def;
    },
    setRimLight(lightX: number, lightY: number, bossX: number, bossY: number): void {
      rimLightEnabled = true;
      rimLight.updateUniforms(
        lightX,
        lightY,
        activeRimDef.colorR,
        activeRimDef.colorG,
        activeRimDef.colorB,
        activeRimDef.intensity,
        activeRimDef.falloffRadius,
        bossX,
        bossY,
        activeRimDef.bossDiscRadius,
      );
      rimLight.updateOccluders(bossX, bossY);
    },
    disableRimLight(): void {
      rimLightEnabled = false;
    },
    setZoneFxDef(def: ZoneFxDef | undefined): void {
      if (def === undefined) {
        u.weatherKind = 0;
        u.weatherIntensity = 0;
        activeZoneFxDef = null;
        zoneFxScrollOffsetY = 0;
        zoneFxScrollOffsetX = 0;
        return;
      }
      u.weatherKind = WEATHER_KIND[def.kind];
      u.weatherIntensity = def.intensity;
      u.weatherDirection = def.direction;
      u.weatherScrollX = 0;
      u.weatherScrollY = 0;
      zoneFxScrollOffsetY = 0;
      zoneFxScrollOffsetX = 0;
      activeZoneFxDef = def;
    },
    triggerHitFlash(decayRate?: number): void {
      flashIntensity = 1;
      flashDecayRate = decayRate ?? p.flashDecayRate;
      u.flashIntensity = 1;
    },
    triggerChromaticAb(decayMs: number): void {
      u.chromaAmount = p.chroma.amount;
      chromaDecayMs = decayMs;
    },
    triggerGrayscaleHold(durationMs: number): void {
      grayscaleHoldMs = durationMs;
    },
    triggerBloomPulse(durationMs: number): void {
      bloomPulseMs = durationMs;
      u.bloomIntensity = 1.2;
    },
    setCrtEnabled(enabled: boolean): void {
      u.crtEnabled = enabled;
    },
    setVignetteColor(r: number, g: number, b: number): void {
      u.vignetteColor = [r, g, b];
    },
    update(dt: number): void {
      base.update(dt);

      if (flashIntensity > 0) {
        flashIntensity = Math.max(0, flashIntensity - flashDecayRate * dt);
        if (grayscaleHoldMs > 0) flashIntensity = Math.max(flashIntensity, 0.6);
        u.flashIntensity = flashIntensity;
      }

      if (grayscaleHoldMs > 0) {
        grayscaleHoldMs -= dt * 1000;
        if (grayscaleHoldMs <= 0) grayscaleHoldMs = 0;
      }

      if (bloomPulseMs > 0) {
        bloomPulseMs -= dt * 1000;
        if (bloomPulseMs <= 0) {
          bloomPulseMs = 0;
          u.bloomIntensity = bloomBaseline;
        }
      }

      // Linearly decays chromaAmount → 0 over chromaDecayMs ms.
      if (chromaDecayMs > 0) {
        chromaDecayMs -= dt * 1000;
        if (chromaDecayMs <= 0) {
          chromaDecayMs = 0;
          u.chromaAmount = 0;
        }
      }

      if (activeZoneFxDef !== null) {
        const def = activeZoneFxDef;
        if (def.kind === 'rain') {
          zoneFxScrollOffsetY += def.speed * dt;
          u.weatherScrollY = zoneFxScrollOffsetY;
        } else if (def.kind === 'clouds') {
          const rad = (def.direction * Math.PI) / 180;
          zoneFxScrollOffsetX += def.speed * dt * Math.cos(rad);
          u.weatherScrollX = zoneFxScrollOffsetX;
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
