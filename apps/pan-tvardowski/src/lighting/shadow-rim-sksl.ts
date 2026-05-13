/**
 * SkSL source for the shadow-rim fullscreen pass (PT lighting §2b).
 *
 * Augments the §1 rim-light shader with a 1D polar shadow map sampled via
 * a 256×1 child texture (child[1] = `shadowTex`).
 *
 * Uniforms (order matches packShadowRimUniforms — 12 floats, same layout as
 * the §1 rim-light shader so the same packing function can be reused):
 *   [0]  width          — viewport width  (px)
 *   [1]  height         — viewport height (px)
 *   [2]  lightX         — light position X (screen-space px)
 *   [3]  lightY         — light position Y (screen-space px)
 *   [4]  lightR         — light color red   (0..1)
 *   [5]  lightG         — light color green (0..1)
 *   [6]  lightB         — light color blue  (0..1)
 *   [7]  lightIntensity — light strength multiplier
 *   [8]  lightRadius    — falloff radius (px)
 *   [9]  bossX          — boss disc center X (screen-space px)
 *   [10] bossY          — boss disc center Y (screen-space px)
 *   [11] bossRadius     — boss disc radius (px)
 *
 * Child shaders:
 *   child[0]  src       — scene texture (same as §1)
 *   child[1]  shadowTex — 256×1 shadow-map texture (R channel = normalised distance)
 *
 * Shadow test:
 *   1. Compute angle from light to fragment: theta = atan(dy, dx).
 *   2. Normalise theta to UV [0, 1): u = (theta + PI) / (2*PI).
 *   3. Sample shadowTex at (u, 0.5) → R channel = encoded distance in [0, 1].
 *   4. Decode: shadowDist = R * FBO_SIZE (256 px).
 *   5. If distLight > shadowDist + SHADOW_BIAS, fragment is in shadow → mul rim by 0.
 */
export const SHADOW_RIM_SKSL = `
uniform shader src;
uniform shader shadowTex;
uniform float width;
uniform float height;
uniform float lightX;
uniform float lightY;
uniform float lightR;
uniform float lightG;
uniform float lightB;
uniform float lightIntensity;
uniform float lightRadius;
uniform float bossX;
uniform float bossY;
uniform float bossRadius;

const float AMBIENT = 0.0;
const float RIM_INNER = 0.80;
const float RIM_OUTER = 1.05;
const float PI = 3.14159265358979;
const float TWO_PI = 6.28318530717959;
const float FBO_SIZE = 256.0;
const float SHADOW_BIAS = 1.5;
const float SHADOW_TEX_HEIGHT = 0.5;

half4 main(float2 coord) {
  float2 uv = float2(coord.x, coord.y);

  float2 toBoss = uv - float2(bossX, bossY);
  float distBoss = length(toBoss);

  half4 base = src.eval(coord);

  if (distBoss > bossRadius * RIM_OUTER) {
    return base;
  }

  // --- Analytical normal (identical to §1) ---
  float2 normDir = (distBoss > 0.001) ? (toBoss / distBoss) : float2(0.0, 0.0);
  float t = clamp(distBoss / bossRadius, 0.0, 1.0);
  float nz = sqrt(max(0.0, 1.0 - t * t));
  float3 N = float3(normDir.x * t, normDir.y * t, nz);

  // --- Light direction ---
  float2 toLight = float2(lightX, lightY) - uv;
  float distLight = length(toLight);
  float3 L = (distLight > 0.001)
    ? float3(toLight.x / distLight, toLight.y / distLight, 0.0)
    : float3(0.0, 0.0, 1.0);

  // --- Attenuation ---
  float r2 = lightRadius * lightRadius;
  float atten = 1.0 / (1.0 + (distLight * distLight) / r2);

  // --- NdotL ---
  float NdotL = max(0.0, dot(N, L));

  // --- Rim-band mask ---
  float rimMask = smoothstep(RIM_INNER * bossRadius, bossRadius, distBoss);
  float edgeFade = smoothstep(RIM_OUTER * bossRadius, bossRadius, distBoss);
  float mask = rimMask * edgeFade;

  // --- Shadow test via 1D polar shadow map ---
  // Angle from light to this fragment (Skia Y axis points down, so negate dy
  // to match the CPU-side atan2 convention used in buildShadowMap).
  float2 fragToLight = uv - float2(lightX, lightY);
  float theta = atan(-fragToLight.y, fragToLight.x);
  // Normalise to texture U coordinate in [0, 1).
  float shadowU = (theta + PI) / TWO_PI;
  // Sample shadow map (256x1 texture, R channel = normalised distance).
  half4 shadowSample = shadowTex.eval(float2(shadowU * FBO_SIZE, SHADOW_TEX_HEIGHT));
  float shadowDist = float(shadowSample.r) * FBO_SIZE;

  // If the fragment is farther from the light than the nearest occluder in
  // this direction, it is in shadow — suppress the rim contribution.
  float shadowFactor = (distLight > shadowDist + SHADOW_BIAS) ? 0.0 : 1.0;

  // --- Combine ---
  float3 lightColor = float3(lightR, lightG, lightB);
  float3 rim = lightColor * (NdotL * atten * lightIntensity * mask * shadowFactor);

  return half4(
    base.rgb + half3(rim),
    base.a
  );
}
`;
