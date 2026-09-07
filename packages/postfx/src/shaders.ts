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
uniform float3 color;
uniform float density;
uniform float streakLen;

// scrollOffsetY is a normalized fall phase in [0,1). Increase it each tick
// by (speed * dt / screenHeight) and wrap with fract() on the game side.

float hash(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }

half4 main(float2 coord) {
  half4 scene = src.eval(coord);
  float2 uv = coord / resolution;
  float aspect = resolution.x / resolution.y;
  float rad = direction * 3.14159 / 180.0;
  float sinA = sin(rad);
  float cosA = cos(rad);
  // aspect-corrected rotated axes: fallAxis along drop travel, perpAxis across
  float perpAxis = (cosA * uv.x - sinA * uv.y) * aspect;
  float fallAxis = sinA * uv.x + cosA * uv.y;

  float coverage = 0.0;

  // near layer — COLS=45, tiling=6, brightness=1.0
  {
    float COLS = 45.0;
    float tiling = 6.0;
    float brightness = 1.0;
    float cid = floor(perpAxis * COLS);
    float colHash = hash(float2(cid, 0.0));
    if (colHash < density) {
      float phase = hash(float2(cid, 1.0));
      float colBright = brightness * (0.6 + hash(float2(cid, 2.0)) * 0.4);
      float center = 0.5 + (hash(float2(cid, 3.0)) - 0.5) * 0.4;
      float seg = fract(fallAxis * tiling - scrollOffsetY + phase);
      float coverageY = smoothstep(streakLen, 0.0, seg);
      float width = 0.04;
      float xMask = smoothstep(width, 0.0, abs(fract(perpAxis * COLS) - center));
      coverage = max(coverage, coverageY * xMask * colBright);
    }
  }

  // far layer — COLS=85, tiling=11, brightness=0.5
  {
    float COLS = 85.0;
    float tiling = 11.0;
    float brightness = 0.5;
    float cid = floor(perpAxis * COLS);
    float colHash = hash(float2(cid, 10.0));
    if (colHash < density) {
      float phase = hash(float2(cid, 11.0));
      float colBright = brightness * (0.6 + hash(float2(cid, 12.0)) * 0.4);
      float center = 0.5 + (hash(float2(cid, 13.0)) - 0.5) * 0.4;
      float seg = fract(fallAxis * tiling - scrollOffsetY + phase);
      float coverageY = smoothstep(streakLen, 0.0, seg);
      float width = 0.03;
      float xMask = smoothstep(width, 0.0, abs(fract(perpAxis * COLS) - center));
      coverage = max(coverage, coverageY * xMask * colBright);
    }
  }

  half3 mixed = mix(scene.rgb, half3(color), half(coverage * intensity));
  return half4(mixed, scene.a);
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
uniform float direction;

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
  // direction=0 → pure horizontal scroll (cos=1, sin=0), matching the pre-direction default.
  float rad = direction * 3.14159 / 180.0;
  float2 scrollDir = float2(cos(rad), sin(rad));
  float2 cloudUv = float2(
    uv.x + scrollOffsetX * scrollDir.x / resolution.x,
    uv.y * 0.5 + scrollOffsetX * scrollDir.y / resolution.y
  );
  float cloud = fbm(cloudUv * 3.0);
  float heightFade = smoothstep(0.6, 0.2, uv.y);
  float alpha = cloud * heightFade * intensity * 0.5;
  half3 cloudColor = half3(0.9, 0.9, 0.95);
  return half4(mix(scene.rgb, cloudColor, half(alpha)), scene.a);
}
`;

// Composite single-pass shader combining all always-runnable effects.
//
// Uniform layout (packed in this exact order by packUniforms — 24 floats total):
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
//   [18] weatherScrollY   (rain fall phase, normalized [0,1) — increment by speed*dt/screenHeight each tick)
//   [19] weatherColor.r
//   [20] weatherColor.g
//   [21] weatherColor.b
//   [22] weatherDensity   (fraction of columns that carry a drop, 0–1; default 0.5)
//   [23] weatherStreakLen  (lit fraction of each repeat period, 0–1; default 0.15)

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
uniform float3 weatherColor;
uniform float weatherDensity;
uniform float weatherStreakLen;

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
      // rain — falling sawtooth streaks, 2 parallax layers, alpha-over blend
      // weatherScrollY is normalized [0,1) fall phase (increment speed*dt/screenH each tick)
      float rad = weatherDirection * 3.14159 / 180.0;
      float sinA = sin(rad);
      float cosA = cos(rad);
      float aspect = resolution.x / resolution.y;
      float perpAxis = (cosA * uv.x - sinA * uv.y) * aspect;
      float fallAxis = sinA * uv.x + cosA * uv.y;

      float coverage = 0.0;

      // near layer — COLS=45, tiling=6, brightness=1.0
      {
        float COLS = 45.0;
        float tiling = 6.0;
        float brightness = 1.0;
        float cid = floor(perpAxis * COLS);
        float colHash = hash(float2(cid, 0.0));
        if (colHash < weatherDensity) {
          float phase = hash(float2(cid, 1.0));
          float colBright = brightness * (0.6 + hash(float2(cid, 2.0)) * 0.4);
          float center = 0.5 + (hash(float2(cid, 3.0)) - 0.5) * 0.4;
          float seg = fract(fallAxis * tiling - weatherScrollY + phase);
          float coverageY = smoothstep(weatherStreakLen, 0.0, seg);
          float width = 0.04;
          float xMask = smoothstep(width, 0.0, abs(fract(perpAxis * COLS) - center));
          coverage = max(coverage, coverageY * xMask * colBright);
        }
      }

      // far layer — COLS=85, tiling=11, brightness=0.5
      {
        float COLS = 85.0;
        float tiling = 11.0;
        float brightness = 0.5;
        float cid = floor(perpAxis * COLS);
        float colHash = hash(float2(cid, 10.0));
        if (colHash < weatherDensity) {
          float phase = hash(float2(cid, 11.0));
          float colBright = brightness * (0.6 + hash(float2(cid, 12.0)) * 0.4);
          float center = 0.5 + (hash(float2(cid, 13.0)) - 0.5) * 0.4;
          float seg = fract(fallAxis * tiling - weatherScrollY + phase);
          float coverageY = smoothstep(weatherStreakLen, 0.0, seg);
          float width = 0.03;
          float xMask = smoothstep(width, 0.0, abs(fract(perpAxis * COLS) - center));
          coverage = max(coverage, coverageY * xMask * colBright);
        }
      }

      c = mix(c, half3(weatherColor), half(coverage * weatherIntensity));
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
      // clouds — rotated scroll, mirrored from WEATHER_CLOUDS_SKSL (direction=0 → horizontal)
      float rad = weatherDirection * 3.14159 / 180.0;
      float2 scrollDir = float2(cos(rad), sin(rad));
      float2 cloudUv = float2(
        uv.x + weatherScrollX * scrollDir.x / resolution.x,
        uv.y * 0.5 + weatherScrollX * scrollDir.y / resolution.y
      );
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
