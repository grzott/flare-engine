/** Color as RGBA (0-1 per channel). */
export interface SpriteColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

/** A sprite effect that can be applied during rendering. */
export interface SpriteEffect {
  readonly type: string;
}

/** Tint effect — blend a color onto the sprite. */
export interface TintEffect extends SpriteEffect {
  readonly type: 'tint';
  readonly color: SpriteColor;
  readonly amount: number;
}

/** Flash effect — overlay a solid color that decays. */
export interface FlashEffect extends SpriteEffect {
  readonly type: 'flash';
  readonly color: SpriteColor;
  readonly duration: number;
  readonly elapsed: number;
}

/** Grayscale effect — desaturate the sprite. */
export interface GrayscaleEffect extends SpriteEffect {
  readonly type: 'grayscale';
  readonly amount: number;
}

/** Outline effect — draw an outline around the sprite. */
export interface OutlineEffect extends SpriteEffect {
  readonly type: 'outline';
  readonly color: SpriteColor;
  readonly width: number;
}

/**
 * Opaque pre-compiled shader program. Typically a Skia `RuntimeEffect` built
 * once at asset load time via `Skia.RuntimeEffect.Make(sksl)`. The render
 * package stays Skia-agnostic; the `@flare-engine/react` layer narrows this to the
 * concrete Skia type when applying the effect.
 */
export type CompiledShader = object;

/** Uniform values keyed by name. Scalars for floats, arrays for vec/mat. */
export type ShaderUniforms = Record<string, number | readonly number[]>;

/** Custom shader effect — apply a pre-compiled runtime shader with uniforms. */
export interface CustomShaderEffect extends SpriteEffect {
  readonly type: 'custom';
  readonly shader: CompiledShader;
  readonly uniforms: ShaderUniforms;
}

/** Water surface effect — animated UV-displaced sprite with foam crests. */
export interface WaterEffect extends SpriteEffect {
  readonly type: 'water';
  readonly color: SpriteColor;
  readonly foamColor: SpriteColor;
  readonly waveSpeed: number;
  readonly waveAmplitude: number;
}

/** Fog / volumetric haze effect — animated FBM noise layered over a sprite. */
export interface FogEffect extends SpriteEffect {
  readonly type: 'fog';
  readonly color: SpriteColor;
  readonly density: number;
  readonly speed: number;
  readonly scale: number;
}

/** Fire / flame effect — value-noise FBM flame rising upward from a sprite. */
export interface FireEffect extends SpriteEffect {
  readonly type: 'fire';
  readonly color: SpriteColor;
  readonly tipColor: SpriteColor;
  readonly speed: number;
  readonly intensity: number;
}

/** Any concrete sprite effect. */
export type AnySpriteEffect =
  | TintEffect
  | FlashEffect
  | GrayscaleEffect
  | OutlineEffect
  | CustomShaderEffect
  | WaterEffect
  | FogEffect
  | FireEffect;

/** Create a tint effect. */
export function tint(color: SpriteColor, amount: number): TintEffect {
  return { type: 'tint', color, amount };
}

/** Create a flash effect. */
export function flash(color: SpriteColor, durationSec: number): FlashEffect {
  return { type: 'flash', color, duration: durationSec, elapsed: 0 };
}

/** Create a grayscale effect. */
export function grayscale(amount: number): GrayscaleEffect {
  return { type: 'grayscale', amount };
}

/** Create an outline effect. */
export function outline(color: SpriteColor, width: number): OutlineEffect {
  return { type: 'outline', color, width };
}

/** Create a custom shader effect. `shader` must be pre-compiled; compiling
 *  SkSL per frame is expensive. `uniforms` may be mutated externally between
 *  frames to animate parameters. */
export function custom(shader: CompiledShader, uniforms: ShaderUniforms): CustomShaderEffect {
  return { type: 'custom', shader, uniforms };
}

/** Create a water surface effect. Time is passed to the renderer each frame
 *  via `beginFrame(w, h, time)` — the effect itself is time-invariant. */
export function water(
  color: SpriteColor,
  foamColor: SpriteColor,
  waveSpeed: number,
  waveAmplitude: number,
): WaterEffect {
  return { type: 'water', color, foamColor, waveSpeed, waveAmplitude };
}

/** Create a fog / volumetric haze effect. Time is passed to the renderer each
 *  frame via `beginFrame(w, h, time)` — the effect itself is time-invariant. */
export function fog(color: SpriteColor, density = 0.5, speed = 0.3, scale = 2.0): FogEffect {
  return { type: 'fog', color, density, speed, scale };
}

/** Create a fire / flame effect. Time is passed to the renderer each
 *  frame via `beginFrame(w, h, time)` — the effect itself is time-invariant. */
export function fire(opts: {
  color: SpriteColor;
  tipColor: SpriteColor;
  speed?: number;
  intensity?: number;
}): FireEffect {
  return {
    type: 'fire',
    color: opts.color,
    tipColor: opts.tipColor,
    speed: opts.speed ?? 1.0,
    intensity: opts.intensity ?? 0.8,
  };
}

/**
 * Advance a time-based effect by `dt` seconds.
 *
 * Returns a new effect object if state changed (e.g. flash elapsed time
 * advances), the same reference if the effect is time-invariant (tint,
 * grayscale, outline, custom), or `null` if the effect has expired.
 *
 * Effects are immutable — callers must replace their reference with the
 * returned value. Sharing an effect instance across entities is safe.
 */
export function updateEffect(effect: AnySpriteEffect, dt: number): AnySpriteEffect | null {
  if (effect.type === 'flash') {
    const elapsed = effect.elapsed + dt;
    if (elapsed >= effect.duration) return null;
    return { type: 'flash', color: effect.color, duration: effect.duration, elapsed };
  }
  if (effect.type === 'fire') {
    return effect;
  }
  return effect;
}

/**
 * Get the current intensity of a flash effect (1 at start, 0 at end).
 */
export function flashIntensity(effect: FlashEffect): number {
  if (effect.duration <= 0) return 0;
  const t = effect.elapsed / effect.duration;
  return Math.max(0, 1 - t);
}
