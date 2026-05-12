/**
 * SkSL runtime-effect shaders used by the postfx stack.
 *
 * Each source declares a `uniform shader src;` plus per-effect uniforms. They
 * are sampled as `src.eval(fragCoord)` against the scene's offscreen surface.
 *
 * Shader strings are emitted from the package as-is. Fallback: when
 * `Skia.RuntimeEffect.Make` is unavailable, `runtime.ts` short-circuits the
 * chain to a passthrough.
 */

export const VIGNETTE_SKSL = /* sksl */ `
uniform shader src;
uniform float2 resolution;
uniform float intensity;
uniform float radius;
uniform float3 color;

half4 main(float2 coord) {
  half4 c = src.eval(coord);
  float2 uv = coord / resolution;
  float2 centered = uv - 0.5;
  float d = length(centered);
  float v = smoothstep(radius, radius * 0.5, d);
  return half4(mix(half3(color), c.rgb, mix(1.0 - intensity, 1.0, v)), c.a);
}
`;

export const GRAYSCALE_FLASH_SKSL = /* sksl */ `
uniform shader src;
uniform float intensity;

half4 main(float2 coord) {
  half4 c = src.eval(coord);
  float luma = dot(c.rgb, half3(0.299, 0.587, 0.114));
  half3 gray = half3(luma);
  half3 mixed = mix(c.rgb, gray, half(intensity));
  return half4(mixed, c.a);
}
`;

export const CHROMATIC_ABERRATION_SKSL = /* sksl */ `
uniform shader src;
uniform float2 resolution;
uniform float amount;

half4 main(float2 coord) {
  float2 uv = coord / resolution;
  float2 offset = (uv - 0.5) * amount;
  half r = src.eval((uv - offset) * resolution).r;
  half g = src.eval(coord).g;
  half b = src.eval((uv + offset) * resolution).b;
  half a = src.eval(coord).a;
  return half4(r, g, b, a);
}
`;

export const CRT_SKSL = /* sksl */ `
uniform shader src;
uniform float2 resolution;
uniform float scanlineIntensity;
uniform float curvature;

half4 main(float2 coord) {
  float2 uv = coord / resolution;
  float2 centered = uv - 0.5;
  float2 warp = centered * (1.0 + dot(centered, centered) * curvature);
  float2 warpedUv = warp + 0.5;
  if (warpedUv.x < 0.0 || warpedUv.x > 1.0 || warpedUv.y < 0.0 || warpedUv.y > 1.0) {
    return half4(0, 0, 0, 1);
  }
  half4 c = src.eval(warpedUv * resolution);
  float scan = 0.5 + 0.5 * sin(warpedUv.y * resolution.y * 3.14159);
  float dim = mix(1.0, scan, scanlineIntensity);
  return half4(c.rgb * dim, c.a);
}
`;

export const BLOOM_SKSL = /* sksl */ `
uniform shader src;
uniform float2 resolution;
uniform float threshold;
uniform float intensity;

half4 main(float2 coord) {
  half4 c = src.eval(coord);
  float luma = dot(c.rgb, half3(0.299, 0.587, 0.114));
  float mask = smoothstep(threshold, 1.0, luma);
  half3 boost = c.rgb * mask * intensity;
  return half4(c.rgb + boost, c.a);
}
`;

// Trilinear LUT lookup against a 64³ identity stored as a 4096×64 strip.
// src is the scene; lut is the 4096×64 RGBA image passed as a child texture.
export const COLOR_GRADING_LUT_SKSL = /* sksl */ `
uniform shader src;
uniform shader lut;
uniform float intensity;

half4 main(float2 coord) {
  half4 scene = src.eval(coord);

  float r = float(scene.r) * 63.0;
  float g = float(scene.g) * 63.0;
  float b = float(scene.b) * 63.0;

  float bFloor = floor(b);
  float bCeil  = min(bFloor + 1.0, 63.0);
  float bFrac  = b - bFloor;

  float2 uvFloor = float2((bFloor * 64.0 + r + 0.5) / 4096.0,
                          (g + 0.5) / 64.0);
  float2 uvCeil  = float2((bCeil  * 64.0 + r + 0.5) / 4096.0,
                          (g + 0.5) / 64.0);

  half3 lutFloor = lut.eval(uvFloor * float2(4096.0, 64.0)).rgb;
  half3 lutCeil  = lut.eval(uvCeil  * float2(4096.0, 64.0)).rgb;

  half3 graded = mix(lutFloor, lutCeil, half(bFrac));
  half3 result = mix(scene.rgb, graded, half(intensity));

  return half4(result, scene.a);
}
`;

// Single-pass volumetric light scattering (GPU Gems 3, Ch. 13).
// MAX_SAMPLES is a compile-time constant to satisfy SkSL's loop-count rules;
// the runtime-provided u_samples float drives an early break so the actual
// sample count is configurable without recompilation.
export const GOD_RAYS_SKSL = /* sksl */ `
uniform shader src;
uniform float2 resolution;
uniform float2 u_lightPos;
uniform float3 u_color;
uniform float u_intensity;
uniform float u_decay;
uniform float u_density;
uniform float u_weight;
uniform float u_samples;

const int MAX_SAMPLES = 64;

half4 main(float2 coord) {
  float2 uv = coord / resolution;
  float2 delta = (u_lightPos - uv) * u_density / float(MAX_SAMPLES);
  float2 sampleUv = uv;
  float illuminationDecay = 1.0;
  half3 accumulated = half3(0.0);

  for (int i = 0; i < MAX_SAMPLES; i++) {
    if (float(i) >= u_samples) break;
    sampleUv += delta;
    half3 s = src.eval(sampleUv * resolution).rgb;
    accumulated += s * half(illuminationDecay) * half(u_weight);
    illuminationDecay *= u_decay;
  }

  half4 orig = src.eval(coord);
  half3 rays = accumulated * half3(u_color) * half(u_weight) * half(u_intensity);
  return half4(orig.rgb + rays, orig.a);
}
`;
