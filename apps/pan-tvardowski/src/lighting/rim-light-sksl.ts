/**
 * SkSL source for the rim-light fullscreen pass (PT lighting §1).
 *
 * Uniforms (order matches packRimLightUniforms):
 *   [0]  width          — viewport width  (px)
 *   [1]  height         — viewport height (px)
 *   [2]  lightX         — light position X (screen-space px)
 *   [3]  lightY         — light position Y (screen-space px)
 *   [4]  lightR         — light color red   (0..1)
 *   [5]  lightG         — light color green (0..1)
 *   [6]  lightB         — light color blue  (0..1)
 *   [7]  lightIntensity — light strength multiplier
 *   [8]  lightRadius    — falloff radius (px); attenuation = 1/(1+d²/r²)
 *   [9]  bossX          — boss disc center X (screen-space px)
 *   [10] bossY          — boss disc center Y (screen-space px)
 *   [11] bossRadius     — boss disc radius for analytical normal (px)
 *
 * §1 only: no shadows, no occlusion. Analytical normals from disc geometry.
 */
export const RIM_LIGHT_SKSL = `
uniform shader src;
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

half4 main(float2 coord) {
  // Flip Y: Skia's coord origin is top-left; shader y increases downward.
  float2 uv = float2(coord.x, coord.y);

  // Distance from this fragment to the boss disc centre.
  float2 toBoss = uv - float2(bossX, bossY);
  float distBoss = length(toBoss);

  // Sample the unmodified scene pixel.
  half4 base = src.eval(coord);

  // Only light fragments inside (or in the rim band just outside) the disc.
  if (distBoss > bossRadius * RIM_OUTER) {
    return base;
  }

  // --- Analytical normal ---
  // Treat the boss as a hemisphere viewed from directly above.
  // At the centre the normal points straight at the camera: (0,0,1).
  // At the edge it's purely radial in XY.
  float2 normDir = (distBoss > 0.001) ? (toBoss / distBoss) : float2(0.0, 0.0);
  float t = clamp(distBoss / bossRadius, 0.0, 1.0);
  // hemisphere: nz = sqrt(1 - t²), nx/ny = normDir * t
  float nz = sqrt(max(0.0, 1.0 - t * t));
  float3 N = float3(normDir.x * t, normDir.y * t, nz);

  // --- Light direction ---
  float2 toLight = float2(lightX, lightY) - uv;
  float distLight = length(toLight);
  float3 L = (distLight > 0.001)
    ? float3(toLight.x / distLight, toLight.y / distLight, 0.0)
    : float3(0.0, 0.0, 1.0);

  // --- Attenuation: physical inverse-square ---
  float r2 = lightRadius * lightRadius;
  float atten = 1.0 / (1.0 + (distLight * distLight) / r2);

  // --- NdotL ---
  float NdotL = max(0.0, dot(N, L));

  // --- Rim-band mask: fade from 0 at RIM_INNER inward radius, peak at edge ---
  float rimMask = smoothstep(RIM_INNER * bossRadius, bossRadius, distBoss);
  // Also fade out beyond the disc edge.
  float edgeFade = smoothstep(RIM_OUTER * bossRadius, bossRadius, distBoss);
  float mask = rimMask * edgeFade;

  // --- Combine ---
  float3 lightColor = float3(lightR, lightG, lightB);
  float3 rim = lightColor * (NdotL * atten * lightIntensity * mask);

  // Additive rim on top of the scene pixel.
  return half4(
    base.rgb + half3(rim),
    base.a
  );
}
`;
