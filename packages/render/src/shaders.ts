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
  half3 tinted = mix(c.rgb, half3(color.r, color.g, color.b), 0.35h);
  half3 final = mix(tinted, half3(foamColor.r, foamColor.g, foamColor.b), half(foam));
  return half4(final, c.a);
}
`;
