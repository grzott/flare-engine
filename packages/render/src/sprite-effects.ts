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

/**
 * Drop-shadow effect — a single offset, blurred, tinted copy of the sprite drawn
 * beneath it for ship / boss grounding. Time-invariant. Applied via a Skia
 * `ImageFilter.MakeDropShadow` on a reused paint (sprite + shadow in one pass);
 * the offset, blur, and tint all live in the filter, so no extra draw pass.
 */
export interface DropShadowEffect extends SpriteEffect {
  readonly type: 'drop-shadow';
  /** Horizontal shadow offset in design px. */
  readonly offsetX: number;
  /** Vertical shadow offset in design px; positive = downward (grounding). */
  readonly offsetY: number;
  /** Gaussian blur sigma applied to the shadow. 0 = hard edge. */
  readonly blur: number;
  /** Shadow color; `a` is the shadow opacity. */
  readonly color: SpriteColor;
}

// ---------------------------------------------------------------------------
// Zone background effects — procedural-silhouette SkSL bg layers
// ---------------------------------------------------------------------------

/** Rooftop city skyline — AABB silhouettes via SDF hash fields. */
export interface RoofsCityEffect extends SpriteEffect {
  readonly type: 'roofs-city';
  readonly skyColor: SpriteColor;
  readonly roofColor: SpriteColor;
  readonly scrollOffsetY: number;
  readonly density: number;
  /** Destination render width in logical pixels — used as shader resolution.x. */
  readonly resolutionW: number;
  /** Destination render height in logical pixels — used as shader resolution.y. */
  readonly resolutionH: number;
}

/** Forest canopy — value-noise tree line. */
export interface ForestCanopyEffect extends SpriteEffect {
  readonly type: 'forest-canopy';
  readonly skyColor: SpriteColor;
  readonly leafColor: SpriteColor;
  readonly scrollOffsetY: number;
  readonly density: number;
  readonly resolutionW: number;
  readonly resolutionH: number;
}

/** River surface — 1D height-field wave with foam crests. */
export interface RiverWaveEffect extends SpriteEffect {
  readonly type: 'river-wave';
  readonly waterColor: SpriteColor;
  readonly foamColor: SpriteColor;
  readonly scrollOffsetY: number;
  readonly waveScale: number;
  readonly resolutionW: number;
  readonly resolutionH: number;
}

/** Moon surface — polar-SDF craters on a flat disc. */
export interface MoonCraterEffect extends SpriteEffect {
  readonly type: 'moon-crater';
  readonly moonColor: SpriteColor;
  readonly craterColor: SpriteColor;
  readonly scrollOffsetY: number;
  readonly craterCount: number;
  readonly resolutionW: number;
  readonly resolutionH: number;
}

/** Cave interior — stalactites hanging from the top edge. */
export interface CaveInteriorEffect extends SpriteEffect {
  readonly type: 'cave-interior';
  readonly caveColor: SpriteColor;
  readonly glowColor: SpriteColor;
  readonly scrollOffsetY: number;
  readonly stalactiteCount: number;
  readonly resolutionW: number;
  readonly resolutionH: number;
}

/** Mountain / hill ridge — FBM height-field silhouette. */
export interface MountainHillsEffect extends SpriteEffect {
  readonly type: 'mountain-hills';
  readonly skyColor: SpriteColor;
  readonly hillColor: SpriteColor;
  readonly scrollOffsetY: number;
  readonly ridgeScale: number;
  readonly resolutionW: number;
  readonly resolutionH: number;
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
  | FireEffect
  | DropShadowEffect
  | RoofsCityEffect
  | ForestCanopyEffect
  | RiverWaveEffect
  | MoonCraterEffect
  | CaveInteriorEffect
  | MountainHillsEffect;

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

/** Create a drop-shadow effect. Defaults to a soft shadow offset downward for
 *  grounding; `color.a` is the shadow opacity. */
export function dropShadow(opts: {
  color: SpriteColor;
  offsetX?: number;
  offsetY?: number;
  blur?: number;
}): DropShadowEffect {
  return {
    type: 'drop-shadow',
    color: opts.color,
    offsetX: opts.offsetX ?? 0,
    offsetY: opts.offsetY ?? 6,
    blur: opts.blur ?? 4,
  };
}

/** Create a rooftop city skyline effect. */
export function roofsCity(opts: {
  skyColor: SpriteColor;
  roofColor: SpriteColor;
  scrollOffsetY?: number;
  density?: number;
  resolutionW?: number;
  resolutionH?: number;
}): RoofsCityEffect {
  return {
    type: 'roofs-city',
    skyColor: opts.skyColor,
    roofColor: opts.roofColor,
    scrollOffsetY: opts.scrollOffsetY ?? 0,
    density: opts.density ?? 6,
    resolutionW: opts.resolutionW ?? 0,
    resolutionH: opts.resolutionH ?? 0,
  };
}

/** Create a forest canopy effect. */
export function forestCanopy(opts: {
  skyColor: SpriteColor;
  leafColor: SpriteColor;
  scrollOffsetY?: number;
  density?: number;
  resolutionW?: number;
  resolutionH?: number;
}): ForestCanopyEffect {
  return {
    type: 'forest-canopy',
    skyColor: opts.skyColor,
    leafColor: opts.leafColor,
    scrollOffsetY: opts.scrollOffsetY ?? 0,
    density: opts.density ?? 5,
    resolutionW: opts.resolutionW ?? 0,
    resolutionH: opts.resolutionH ?? 0,
  };
}

/** Create a river wave surface effect. */
export function riverWave(opts: {
  waterColor: SpriteColor;
  foamColor: SpriteColor;
  scrollOffsetY?: number;
  waveScale?: number;
  resolutionW?: number;
  resolutionH?: number;
}): RiverWaveEffect {
  return {
    type: 'river-wave',
    waterColor: opts.waterColor,
    foamColor: opts.foamColor,
    scrollOffsetY: opts.scrollOffsetY ?? 0,
    waveScale: opts.waveScale ?? 2,
    resolutionW: opts.resolutionW ?? 0,
    resolutionH: opts.resolutionH ?? 0,
  };
}

/** Create a moon crater surface effect. */
export function moonCrater(opts: {
  moonColor: SpriteColor;
  craterColor: SpriteColor;
  scrollOffsetY?: number;
  craterCount?: number;
  resolutionW?: number;
  resolutionH?: number;
}): MoonCraterEffect {
  return {
    type: 'moon-crater',
    moonColor: opts.moonColor,
    craterColor: opts.craterColor,
    scrollOffsetY: opts.scrollOffsetY ?? 0,
    craterCount: opts.craterCount ?? 4,
    resolutionW: opts.resolutionW ?? 0,
    resolutionH: opts.resolutionH ?? 0,
  };
}

/** Create a cave interior effect. */
export function caveInterior(opts: {
  caveColor: SpriteColor;
  glowColor: SpriteColor;
  scrollOffsetY?: number;
  stalactiteCount?: number;
  resolutionW?: number;
  resolutionH?: number;
}): CaveInteriorEffect {
  return {
    type: 'cave-interior',
    caveColor: opts.caveColor,
    glowColor: opts.glowColor,
    scrollOffsetY: opts.scrollOffsetY ?? 0,
    stalactiteCount: opts.stalactiteCount ?? 8,
    resolutionW: opts.resolutionW ?? 0,
    resolutionH: opts.resolutionH ?? 0,
  };
}

/** Create a mountain / hill ridge effect. */
export function mountainHills(opts: {
  skyColor: SpriteColor;
  hillColor: SpriteColor;
  scrollOffsetY?: number;
  ridgeScale?: number;
  resolutionW?: number;
  resolutionH?: number;
}): MountainHillsEffect {
  return {
    type: 'mountain-hills',
    skyColor: opts.skyColor,
    hillColor: opts.hillColor,
    scrollOffsetY: opts.scrollOffsetY ?? 0,
    ridgeScale: opts.ridgeScale ?? 1.5,
    resolutionW: opts.resolutionW ?? 0,
    resolutionH: opts.resolutionH ?? 0,
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
