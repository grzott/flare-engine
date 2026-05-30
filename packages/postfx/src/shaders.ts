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
    return half4(0.0, 0.0, 0.0, 1.0);
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

export const WEATHER_RAIN_SKSL = /* sksl */ `
uniform shader src;
uniform float2 resolution;
uniform float intensity;
uniform float direction;
uniform float scrollOffsetY;

half4 main(float2 coord) {
  half4 scene = src.eval(coord);
  float2 uv = coord / resolution;
  float rad = direction * 3.14159 / 180.0;
  float sinA = sin(rad), cosA = cos(rad);
  float u = cosA * coord.x - sinA * coord.y;
  float v = sinA * coord.x + cosA * coord.y + scrollOffsetY;
  float streak = fract(u * 0.04);
  float drop = smoothstep(0.0, 0.08, streak) * (1.0 - smoothstep(0.08, 0.12, streak));
  float fade = smoothstep(0.0, 0.3, fract(v * 0.006));
  half rain = half(drop * fade * intensity * 0.6);
  return half4(scene.rgb + half3(rain), scene.a);
}
`;

export const WEATHER_SUN_SHAFT_SKSL = /* sksl */ `
uniform shader src;
uniform float2 resolution;
uniform float intensity;
uniform float direction;

half4 main(float2 coord) {
  half4 scene = src.eval(coord);
  float2 uv = coord / resolution;
  float rad = direction * 3.14159 / 180.0;
  float2 src_point = float2(0.5 + sin(rad) * 0.3, -0.05);
  float2 toFrag = uv - src_point;
  float angle = atan(toFrag.x, toFrag.y);
  float shafts = 0.5 + 0.5 * sin(angle * 8.0);
  float dist = length(toFrag);
  float falloff = 1.0 - smoothstep(0.0, 1.2, dist);
  half shaft = half(shafts * falloff * intensity * 0.35);
  return half4(scene.rgb + half3(shaft * 0.95, shaft * 0.9, shaft * 0.6), scene.a);
}
`;

export const WEATHER_DARK_VIGNETTE_SKSL = /* sksl */ `
uniform shader src;
uniform float2 resolution;
uniform float intensity;

half4 main(float2 coord) {
  half4 scene = src.eval(coord);
  float2 uv = coord / resolution - 0.5;
  float d = length(uv);
  float v = smoothstep(0.3, 0.85, d);
  half dark = half(v * intensity);
  return half4(scene.rgb * (1.0 - dark), scene.a);
}
`;

export const WEATHER_CLOUDS_SKSL = /* sksl */ `
uniform shader src;
uniform float2 resolution;
uniform float intensity;
uniform float scrollOffsetX;

float hash(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }
float vnoise(float2 p) {
  float2 i = floor(p); float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + float2(1.0, 0.0)), u.x),
             mix(hash(i + float2(0.0, 1.0)), hash(i + float2(1.0, 1.0)), u.x), u.y);
}
float fbm(float2 p) { return vnoise(p) * 0.6 + vnoise(p * 2.3) * 0.4; }

half4 main(float2 coord) {
  half4 scene = src.eval(coord);
  float2 uv = coord / resolution;
  float2 cloudUv = float2(uv.x + scrollOffsetX / resolution.x, uv.y * 0.5);
  float cloud = fbm(cloudUv * 3.0);
  float heightFade = smoothstep(0.6, 0.2, uv.y);
  float alpha = cloud * heightFade * intensity * 0.5;
  half3 cloudColor = half3(0.9, 0.9, 0.95);
  return half4(mix(scene.rgb, cloudColor, half(alpha)), scene.a);
}
`;

// Composite single-pass shader combining all always-runnable effects.
//
// Uniform layout (packed in this exact order by packUniforms — 19 floats total):
//   [0]  resolution.x
//   [1]  resolution.y
//   [2]  vignetteIntensity
//   [3]  vignetteRadius
//   [4]  vignetteColor.r
//   [5]  vignetteColor.g
//   [6]  vignetteColor.b
//   [7]  bloomThreshold
//   [8]  bloomIntensity
//   [9]  flashIntensity
//   [10] chromaAmount
//   [11] crtScanlineIntensity
//   [12] crtCurvature
//   [13] crtEnabled       (0.0 or 1.0)
//   [14] weatherKind      (0=none, 1=rain, 2=sun-shaft, 3=dark-vignette, 4=clouds)
//   [15] weatherIntensity
//   [16] weatherDirection  (degrees)
//   [17] weatherScrollX   (clouds x-offset)
//   [18] weatherScrollY   (rain y-offset)

export const COMPOSITE_SKSL = /* sksl */ `
uniform shader src;

uniform float2 resolution;
uniform float vignetteIntensity;
uniform float vignetteRadius;
uniform float3 vignetteColor;
uniform float bloomThreshold;
uniform float bloomIntensity;
uniform float flashIntensity;
uniform float chromaAmount;
uniform float crtScanlineIntensity;
uniform float crtCurvature;
uniform float crtEnabled;
uniform float weatherKind;
uniform float weatherIntensity;
uniform float weatherDirection;
uniform float weatherScrollX;
uniform float weatherScrollY;

float hash(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }
float vnoise(float2 p) {
  float2 i = floor(p); float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + float2(1.0, 0.0)), u.x),
             mix(hash(i + float2(0.0, 1.0)), hash(i + float2(1.0, 1.0)), u.x), u.y);
}
float fbm(float2 p) { return vnoise(p) * 0.6 + vnoise(p * 2.3) * 0.4; }

half4 main(float2 coord) {
  // --- chromatic aberration ---
  float2 uv = coord / resolution;
  float2 chromaOffset = (uv - 0.5) * chromaAmount;
  half r = src.eval((uv - chromaOffset) * resolution).r;
  half g = src.eval(coord).g;
  half b = src.eval((uv + chromaOffset) * resolution).b;
  half3 c = half3(r, g, b);

  // --- CRT ---
  float2 crtCentered = uv - 0.5;
  float2 crtWarp = crtCentered * (1.0 + dot(crtCentered, crtCentered) * crtCurvature);
  float2 crtUv = crtWarp + 0.5;
  float crtMask = float(crtUv.x >= 0.0 && crtUv.x <= 1.0 && crtUv.y >= 0.0 && crtUv.y <= 1.0);
  {
    float2 chromaOffsetCrt = (crtUv - 0.5) * chromaAmount;
    half rCrt = src.eval((crtUv - chromaOffsetCrt) * resolution).r;
    half gCrt = src.eval(crtUv * resolution).g;
    half bCrt = src.eval((crtUv + chromaOffsetCrt) * resolution).b;
    half3 crtColor = half3(rCrt, gCrt, bCrt);
    float scan = 0.5 + 0.5 * sin(crtUv.y * resolution.y * 3.14159);
    float dim = mix(1.0, scan, crtScanlineIntensity);
    half3 crtResult = crtColor * half(dim);
    c = mix(c, mix(half3(0.0), crtResult, half(crtMask)), half(crtEnabled));
  }

  // --- bloom ---
  float luma = dot(c, half3(0.299, 0.587, 0.114));
  float bloomMask = smoothstep(bloomThreshold, 1.0, luma);
  c = c + c * half(bloomMask * bloomIntensity);

  // --- weather ---
  {
    float wk = weatherKind;
    if (wk >= 0.5 && wk < 1.5) {
      // rain
      float rad = weatherDirection * 3.14159 / 180.0;
      float sinA = sin(rad); float cosA = cos(rad);
      float u2 = cosA * coord.x - sinA * coord.y;
      float v2 = sinA * coord.x + cosA * coord.y + weatherScrollY;
      float streak = fract(u2 * 0.04);
      float drop = smoothstep(0.0, 0.08, streak) * (1.0 - smoothstep(0.08, 0.12, streak));
      float fade = smoothstep(0.0, 0.3, fract(v2 * 0.006));
      half rain = half(drop * fade * weatherIntensity * 0.6);
      c = c + half3(rain);
    } else if (wk >= 1.5 && wk < 2.5) {
      // sun-shaft
      float rad = weatherDirection * 3.14159 / 180.0;
      float2 srcPoint = float2(0.5 + sin(rad) * 0.3, -0.05);
      float2 toFrag = uv - srcPoint;
      float angle = atan(toFrag.x, toFrag.y);
      float shafts = 0.5 + 0.5 * sin(angle * 8.0);
      float dist = length(toFrag);
      float falloff = 1.0 - smoothstep(0.0, 1.2, dist);
      half shaft = half(shafts * falloff * weatherIntensity * 0.35);
      c = c + half3(shaft * 0.95, shaft * 0.9, shaft * 0.6);
    } else if (wk >= 2.5 && wk < 3.5) {
      // dark-vignette
      float2 uvShift = uv - 0.5;
      float d2 = length(uvShift);
      float vd = smoothstep(0.3, 0.85, d2);
      half dark = half(vd * weatherIntensity);
      c = c * (1.0 - dark);
    } else if (wk >= 3.5) {
      // clouds
      float2 cloudUv = float2(uv.x + weatherScrollX / resolution.x, uv.y * 0.5);
      float cloud = fbm(cloudUv * 3.0);
      float heightFade = smoothstep(0.6, 0.2, uv.y);
      float alpha = cloud * heightFade * weatherIntensity * 0.5;
      half3 cloudColor = half3(0.9, 0.9, 0.95);
      c = mix(c, cloudColor, half(alpha));
    }
  }

  // --- grayscale flash ---
  float lumaFlash = dot(c, half3(0.299, 0.587, 0.114));
  half3 gray = half3(lumaFlash);
  c = mix(c, gray, half(flashIntensity));

  // --- vignette ---
  float2 vigCentered = uv - 0.5;
  float vigD = length(vigCentered);
  float vigV = smoothstep(vignetteRadius, vignetteRadius * 0.5, vigD);
  c = mix(half3(vignetteColor), c, half(mix(1.0 - vignetteIntensity, 1.0, vigV)));

  return half4(c, 1.0);
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
