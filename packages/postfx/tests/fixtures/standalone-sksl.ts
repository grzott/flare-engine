// Byte-exact copies of the standalone shader strings as shipped in 0.4.11.
// The exported strings are the contract: change one only on purpose, and update its copy here.

export const BLOOM_SKSL_SNAPSHOT = `
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

export const CHROMATIC_ABERRATION_SKSL_SNAPSHOT = `
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

export const COLOR_GRADING_LUT_SKSL_SNAPSHOT = `
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

export const CRT_SKSL_SNAPSHOT = `
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

export const GOD_RAYS_SKSL_SNAPSHOT = `
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

export const GRAYSCALE_FLASH_SKSL_SNAPSHOT = `
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

export const VIGNETTE_SKSL_SNAPSHOT = `
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

export const WEATHER_CLOUDS_SKSL_SNAPSHOT = `
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

export const WEATHER_DARK_VIGNETTE_SKSL_SNAPSHOT = `
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

export const WEATHER_RAIN_SKSL_SNAPSHOT = `
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

export const WEATHER_SUN_SHAFT_SKSL_SNAPSHOT = `
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
