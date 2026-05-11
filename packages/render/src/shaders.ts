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
