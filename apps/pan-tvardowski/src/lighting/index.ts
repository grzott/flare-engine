export { RIM_LIGHT_SKSL } from './rim-light-sksl';
export type { PointLight, RimLightState } from './types';
export {
  RIM_LIGHT_CHAIN,
  RIM_LIGHT_UNIFORM_COUNT,
  analyticalNormal,
  attenuation,
  createRimLightRuntime,
  packRimLightUniforms,
} from './rim-light-runtime';
export type { RimLightChain, RimLightRuntime } from './rim-light-runtime';
export { SHADOW_RIM_SKSL } from './shadow-rim-sksl';
export {
  SHADOW_ANGLES,
  FBO_SIZE,
  buildShadowMap,
  encodeShadowMap,
  rayRectIntersect,
  sampleShadowMap,
} from './shadow-map';
export type { OccluderRect } from './shadow-map';
export {
  SHADOW_RIM_CHAIN,
  createShadowRimRuntime,
} from './shadow-rim-runtime';
export type { ShadowRimChain, ShadowRimRuntime } from './shadow-rim-runtime';
