import { directionInto, type Vec2Out } from './conventions';
import type { DustPreset } from './presets';

/**
 * The dust dissolve, for a rect that reaches `u_spread` beyond the element on every side. `xy` is
 * measured from that rect's corner, and `image` is the capture, sampled in layout pixels from the
 * element's corner. A noisy front crosses the element along `u_dir` as `u_progress` goes from 0
 * to 1; what it has passed drifts along `u_dir` and fades, behind a rim of `u_edgeColor`.
 *
 * The place along the sweep is clamped to 0..1. Around the element, and in the far corners of a
 * diagonal sweep, it would otherwise pass 1, where the front never arrives: a rest of the capture
 * would still be drawn at progress 1.
 */
export const DUST_SKSL = `uniform shader image; uniform float u_progress; uniform float2 u_dir; uniform float u_softness;
uniform float u_noiseScale; uniform float u_noiseAmount; uniform float u_edgeWidth;
uniform half4 u_edgeColor; uniform float2 u_size; uniform float u_spread; uniform float u_seed;
float hash(float2 p) { return fract(sin(dot(p, float2(12.9898, 78.233)) + u_seed) * 43758.5453); }
float vnoise(float2 p) { float2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+float2(1,0)), f.x), mix(hash(i+float2(0,1)), hash(i+float2(1,1)), f.x), f.y); }
half4 main(float2 xy) {
  float2 uv0 = (xy - u_spread) / u_size;
  float sweep = clamp(dot(uv0 - 0.5, u_dir) + 0.5, 0.0, 1.0);
  float field = mix(sweep, vnoise(uv0 * u_noiseScale), u_noiseAmount);
  float edge = u_progress * (1.0 + u_softness) - u_softness;
  float gone = smoothstep(edge, edge + u_softness, field);      // 1 = still solid
  float2 drift = u_dir * u_spread * (1.0 - gone) * u_progress;   // grains drift along the sweep
  half4 c = image.eval(xy - u_spread - drift);
  half rim = half(1.0 - smoothstep(0.0, u_edgeWidth, abs(field - edge)));
  return half4(c.rgb + u_edgeColor.rgb * rim * c.a, c.a) * half(gone);
}
`;

/** The uniforms of {@link DUST_SKSL}, in the order it declares them. */
export const DUST_UNIFORMS = [
  'u_progress',
  'u_dir',
  'u_softness',
  'u_noiseScale',
  'u_noiseAmount',
  'u_edgeWidth',
  'u_edgeColor',
  'u_size',
  'u_spread',
  'u_seed',
] as const;

/** How many floats each of {@link DUST_UNIFORMS} takes, in the same order. */
export const DUST_UNIFORM_SIZES = [1, 2, 1, 1, 1, 1, 4, 2, 1, 1] as const;

/** The length of the block `packDustUniformsInto` fills. */
export const DUST_UNIFORM_FLOATS = 15;

// `smoothstep` is undefined when its two edges are equal.
const MIN_BAND = 1e-4;

// `hash` adds the seed to a float before taking its sine: past a few thousand the sum loses the
// fraction the noise is made of.
const SEED_RANGE = 4096;

const _dir: Vec2Out = { x: 0, y: 0 };

/** The value of the hex digit with character code `code`, or -1. */
function hexDigit(code: number): number {
  if (code >= 48 && code <= 57) return code - 48;
  if (code >= 97 && code <= 102) return code - 87;
  if (code >= 65 && code <= 70) return code - 55;
  return -1;
}

/**
 * Write `color` as r, g, b, a in 0..1 into `out` at `o`. It reads `#rgb`, `#rgba`, `#rrggbb` and
 * `#rrggbbaa`; anything else is written as opaque white.
 */
function hexColorInto(color: string, out: Float32Array, o: number): void {
  out[o] = 1;
  out[o + 1] = 1;
  out[o + 2] = 1;
  out[o + 3] = 1;
  const digits = color.length - 1;
  if (color.charCodeAt(0) !== 35 || (digits !== 3 && digits !== 4 && digits !== 6 && digits !== 8))
    return;
  for (let i = 1; i <= digits; i++) if (hexDigit(color.charCodeAt(i)) < 0) return;
  const wide = digits > 4;
  const channels = wide ? digits / 2 : digits;
  for (let c = 0; c < channels; c++) {
    const high = hexDigit(color.charCodeAt(wide ? 1 + c * 2 : 1 + c));
    const low = wide ? hexDigit(color.charCodeAt(2 + c * 2)) : high;
    out[o + c] = (high * 16 + low) / 255;
  }
}

/**
 * Fill `out` with the uniforms of {@link DUST_SKSL} for `p` at `progress`, 0 whole to 1 gone, in
 * the {@link DUST_UNIFORMS} order, and return it. `w` and `h` are the element's size in layout
 * pixels. It allocates nothing.
 *
 * `u_dir` is `directionInto(p.sweepAngle)`. A `softness` or `edgeWidth` of 0 is packed as a very
 * small band instead, and the seed is folded into 0..4095, where the shader's noise keeps its
 * precision. `edgeColor` is read as hex (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`); any other
 * string packs as white.
 *
 * Throws a `RangeError` when `out` holds fewer than `DUST_UNIFORM_FLOATS` floats.
 */
export function packDustUniformsInto(
  p: DustPreset,
  progress: number,
  w: number,
  h: number,
  out: Float32Array,
): Float32Array {
  if (out.length < DUST_UNIFORM_FLOATS) {
    throw new RangeError(
      `packDustUniformsInto: out needs ${DUST_UNIFORM_FLOATS} numbers, got ${out.length}`,
    );
  }
  directionInto(p.sweepAngle, _dir);
  out[0] = progress;
  out[1] = _dir.x;
  out[2] = _dir.y;
  out[3] = p.softness > MIN_BAND ? p.softness : MIN_BAND;
  out[4] = p.noiseScale;
  out[5] = p.noiseAmount;
  out[6] = p.edgeWidth > MIN_BAND ? p.edgeWidth : MIN_BAND;
  hexColorInto(p.edgeColor, out, 7);
  out[11] = w;
  out[12] = h;
  out[13] = p.spread;
  out[14] = p.seed % SEED_RANGE;
  return out;
}
