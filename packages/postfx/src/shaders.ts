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

half4 main(float2 coord) {
  half4 c = src.eval(coord);
  float2 uv = coord / resolution;
  float2 centered = uv - 0.5;
  float d = length(centered);
  float v = smoothstep(radius, radius * 0.5, d);
  return half4(c.rgb * mix(1.0 - intensity, 1.0, v), c.a);
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
