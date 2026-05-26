export const FIRE_SKSL = /* sksl */ `
uniform shader src;
uniform float2 resolution;
uniform float3 color;
uniform float3 tipColor;
uniform float speed;
uniform float intensity;
uniform float time;

float hash(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }

float vnoise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + float2(1.0, 0.0));
  float c = hash(i + float2(0.0, 1.0));
  float d = hash(i + float2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(float2 p) {
  return 0.5 * vnoise(p) + 0.25 * vnoise(p * 2.0);
}

half4 main(float2 coord) {
  half4 srcColor = src.eval(coord);
  float2 uv = coord / max(resolution, float2(1.0));
  float2 np = float2(uv.x * 4.0, uv.y * 6.0 - time * speed * 2.0);
  float n = fbm(np);
  float flameMask = smoothstep(0.0, intensity, n * (1.0 - uv.y));
  float3 fireRgb = mix(color, tipColor, uv.y);
  half4 fireColor = half4(fireRgb.r, fireRgb.g, fireRgb.b, flameMask);
  return half4(fireColor.rgb, fireColor.a * srcColor.a);
}
`;

export const FOG_SKSL = /* sksl */ `
uniform shader src;
uniform float2 resolution;
uniform float3 color;
uniform float density;
uniform float speed;
uniform float scale;
uniform float time;

float hash(float2 p) {
  return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453);
}

float valueNoise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + float2(1.0, 0.0));
  float c = hash(i + float2(0.0, 1.0));
  float d = hash(i + float2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(float2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * valueNoise(p);
    p *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

half4 main(float2 coord) {
  float2 uv = coord / max(resolution, float2(1.0));
  float2 drift = float2(time * speed, 0.3 * time * speed);
  float n = clamp(fbm(uv * scale + drift), 0.0, 1.0);
  half4 srcColor = src.eval(coord);
  half3 blended = mix(srcColor.rgb, half3(color.r, color.g, color.b), half(density * n));
  return half4(blended, srcColor.a);
}
`;

export const WATER_SKSL = /* sksl */ `
uniform shader src;
uniform float2 resolution;
uniform float3 color;
uniform float3 foamColor;
uniform float waveSpeed;
uniform float waveAmplitude;
uniform float time;

half4 main(float2 coord) {
  float2 uv = coord / resolution;
  float wave1 = sin(uv.x * 6.2832 * 3.0 + time * waveSpeed * 2.0) * waveAmplitude;
  float wave2 = sin(uv.x * 6.2832 * 5.0 - time * waveSpeed * 1.3 + 1.5) * waveAmplitude * 0.5;
  float totalWave = wave1 + wave2;
  float2 displaced = float2(uv.x, uv.y + totalWave);
  displaced = clamp(displaced, float2(0.0), float2(1.0));
  half4 c = src.eval(displaced * resolution);
  float waveDeriv = cos(uv.x * 6.2832 * 3.0 + time * waveSpeed * 2.0) * waveAmplitude * 2.0
                  + cos(uv.x * 6.2832 * 5.0 - time * waveSpeed * 1.3 + 1.5) * waveAmplitude;
  float foam = smoothstep(waveAmplitude * 0.6, waveAmplitude * 1.5, waveDeriv);
  half3 tinted = mix(c.rgb, half3(color.r, color.g, color.b), half(0.35));
  half3 final = mix(tinted, half3(foamColor.r, foamColor.g, foamColor.b), half(foam));
  return half4(final, c.a);
}
`;

// ---------------------------------------------------------------------------
// Zone background shaders — procedural-silhouette SkSL
// Each shader generates a recognizable background silhouette via SDFs / noise.
// All accept a scrollOffsetY uniform driven by Skia-bridge time so the
// background parallax-scrolls without CPU-side UV manipulation.
// ---------------------------------------------------------------------------

export const ROOFS_CITY_SKSL = /* sksl */ `
uniform float2 resolution;
uniform float3 skyColor;
uniform float3 roofColor;
uniform float scrollOffsetY;
uniform float density;

float hash(float x) { return fract(sin(x * 127.1) * 43758.5453); }

float buildingTop(float2 uv, float density) {
  float col = floor(uv.x * density);
  float h = 0.35 + 0.35 * hash(col);
  float w = 0.6 + 0.3 * hash(col + 7.3);
  float edge = step(abs(fract(uv.x * density) - 0.5), w * 0.5);
  return edge * step(uv.y, h);
}

half4 main(float2 coord) {
  float2 uv = coord / max(resolution, float2(1.0));
  uv.y = uv.y + scrollOffsetY / max(resolution.y, 1.0);
  uv.y = fract(uv.y);
  float buildings = buildingTop(uv, density);
  half3 col = mix(half3(skyColor.r, skyColor.g, skyColor.b),
                  half3(roofColor.r, roofColor.g, roofColor.b),
                  half(buildings));
  return half4(col, 1.0);
}
`;

export const FOREST_CANOPY_SKSL = /* sksl */ `
uniform float2 resolution;
uniform float3 skyColor;
uniform float3 leafColor;
uniform float scrollOffsetY;
uniform float density;

float hash(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }

float valueNoise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + float2(1.0, 0.0)), u.x),
             mix(hash(i + float2(0.0, 1.0)), hash(i + float2(1.0, 1.0)), u.x), u.y);
}

half4 main(float2 coord) {
  float2 uv = coord / max(resolution, float2(1.0));
  uv.y = uv.y + scrollOffsetY / max(resolution.y, 1.0);
  float n = valueNoise(float2(uv.x * density, uv.y * 3.0));
  float treeLine = 0.55 + 0.25 * valueNoise(float2(uv.x * density * 0.5, 0.0));
  float canopy = step(uv.y, treeLine) * smoothstep(0.3, 0.7, n);
  half3 col = mix(half3(skyColor.r, skyColor.g, skyColor.b),
                  half3(leafColor.r, leafColor.g, leafColor.b),
                  half(canopy));
  return half4(col, 1.0);
}
`;

export const RIVER_WAVE_SKSL = /* sksl */ `
uniform float2 resolution;
uniform float3 waterColor;
uniform float3 foamColor;
uniform float scrollOffsetY;
uniform float waveScale;

half4 main(float2 coord) {
  float2 uv = coord / max(resolution, float2(1.0));
  float scroll = scrollOffsetY / max(resolution.y, 1.0);
  float2 p = float2(uv.x, uv.y + scroll);
  float w1 = sin(p.x * 6.2832 * waveScale + p.y * 4.0) * 0.04;
  float w2 = sin(p.x * 6.2832 * waveScale * 1.7 - p.y * 2.5 + 1.2) * 0.02;
  float surface = 0.5 + w1 + w2;
  float inWater = step(uv.y, surface);
  float crest = smoothstep(surface - 0.015, surface, uv.y) * (1.0 - inWater) +
                smoothstep(surface + 0.015, surface, uv.y) * inWater;
  half3 base = mix(half3(foamColor.r, foamColor.g, foamColor.b),
                   half3(waterColor.r, waterColor.g, waterColor.b),
                   half(inWater));
  half3 col = mix(base, half3(foamColor.r, foamColor.g, foamColor.b), half(crest * 0.6));
  return half4(col, 1.0);
}
`;

export const MOON_CRATER_SKSL = /* sksl */ `
uniform float2 resolution;
uniform float3 moonColor;
uniform float3 craterColor;
uniform float scrollOffsetY;
uniform float craterCount;

float hash(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }

float crater(float2 uv, float2 center, float r) {
  float d = length(uv - center);
  float rim = smoothstep(r, r * 0.85, d) - smoothstep(r * 0.85, r * 0.65, d);
  float floor_ = smoothstep(r * 0.65, r * 0.4, d);
  return rim * 0.6 + floor_ * 0.25;
}

half4 main(float2 coord) {
  float2 uv = coord / max(resolution, float2(1.0));
  uv.y = uv.y + scrollOffsetY / max(resolution.y, 1.0);
  float c = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float2 center = float2(hash(float2(fi, 0.0)), hash(float2(fi, 1.0)));
    float r = 0.04 + 0.07 * hash(float2(fi, 2.0));
    c += crater(fract(uv), center, r) * step(fi, craterCount - 1.0);
  }
  c = clamp(c, 0.0, 1.0);
  half3 col = mix(half3(moonColor.r, moonColor.g, moonColor.b),
                  half3(craterColor.r, craterColor.g, craterColor.b),
                  half(c));
  return half4(col, 1.0);
}
`;

export const CAVE_INTERIOR_SKSL = /* sksl */ `
uniform float2 resolution;
uniform float3 caveColor;
uniform float3 glowColor;
uniform float scrollOffsetY;
uniform float stalactiteCount;

float hash(float x) { return fract(sin(x * 127.1) * 43758.5453); }

float stalactite(float2 uv, float count) {
  float col = floor(uv.x * count);
  float tip = 0.1 + 0.2 * hash(col);
  float w = 0.3 + 0.3 * hash(col + 5.0);
  float dx = abs(fract(uv.x * count) - 0.5) / (w * 0.5);
  float shape = step(dx, 1.0) * step(uv.y, tip * (1.0 - clamp(dx, 0.0, 1.0)));
  return shape;
}

half4 main(float2 coord) {
  float2 uv = coord / max(resolution, float2(1.0));
  uv.y = 1.0 - uv.y;
  uv.y = uv.y + scrollOffsetY / max(resolution.y, 1.0);
  float stalac = stalactite(uv, stalactiteCount);
  float glow = smoothstep(0.8, 1.0, uv.y) * (1.0 - stalac);
  half3 col = mix(half3(caveColor.r, caveColor.g, caveColor.b),
                  half3(glowColor.r, glowColor.g, glowColor.b),
                  half(glow));
  col = mix(col, half3(caveColor.r, caveColor.g, caveColor.b) * half(0.3), half(stalac));
  return half4(col, 1.0);
}
`;

export const MOUNTAIN_HILLS_SKSL = /* sksl */ `
uniform float2 resolution;
uniform float3 skyColor;
uniform float3 hillColor;
uniform float scrollOffsetY;
uniform float ridgeScale;

float hash(float x) { return fract(sin(x * 127.1) * 43758.5453); }

float heightField(float x, float scale) {
  float h = 0.0;
  float amp = 0.5;
  float freq = scale;
  for (int i = 0; i < 4; i++) {
    float ix = floor(x * freq);
    float fx = fract(x * freq);
    fx = fx * fx * (3.0 - 2.0 * fx);
    h += amp * mix(hash(ix), hash(ix + 1.0), fx);
    freq *= 2.0;
    amp *= 0.5;
  }
  return h;
}

half4 main(float2 coord) {
  float2 uv = coord / max(resolution, float2(1.0));
  float scroll = scrollOffsetY / max(resolution.y, 1.0);
  float horizon = 0.4 + 0.3 * heightField(uv.x + scroll * 0.3, ridgeScale);
  float mountains = step(uv.y, horizon);
  half3 col = mix(half3(skyColor.r, skyColor.g, skyColor.b),
                  half3(hillColor.r, hillColor.g, hillColor.b),
                  half(mountains));
  return half4(col, 1.0);
}
`;
