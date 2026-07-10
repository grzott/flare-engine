// Engine convenience API — curated barrel.
// Headless tier (14 packages, RN-free):
export * from '@flare-engine/animation';
export * from '@flare-engine/assets';
export * from '@flare-engine/audio';
export * from '@flare-engine/core';
export * from '@flare-engine/debug';
export * from '@flare-engine/ecs';
export * from '@flare-engine/events';
export * from '@flare-engine/input';
export * from '@flare-engine/math';
export * from '@flare-engine/particles';
export * from '@flare-engine/physics';
// postfx — explicit to alias CompiledShader (clashes with render) and SkImageLike (clashes with assets):
export {
  BLOOM_SKSL,
  type BloomUniforms,
  CHROMATIC_ABERRATION_SKSL,
  type ChromaticAberrationUniforms,
  COLOR_GRADING_LUT_SKSL,
  COMPOSITE_SKSL,
  type ColorGradingLutUniforms,
  type CompiledPass,
  type CompiledShader as PostFxCompiledShader,
  type CompositeUniforms,
  CRT_SKSL,
  type CrtUniforms,
  createBloom,
  createChromaticAberration,
  createColorGradingLut,
  createCrt,
  createGodRays,
  createGrayscaleFlash,
  createNeutralLutBytes,
  createPostFxComposite,
  createPostFxController,
  createPostFxRuntime,
  createVignette,
  createWeatherClouds,
  createWeatherDarkVignette,
  createWeatherRain,
  createWeatherSunShaft,
  type Effect,
  EffectChain,
  type EffectKind,
  type EffectUniforms,
  GOD_RAYS_SKSL,
  type GodRaysUniforms,
  GRAYSCALE_FLASH_SKSL,
  type GrayscaleFlashUniforms,
  type PostFxController,
  type PostFxControllerOptions,
  type PostFxFlashConfig,
  type PostFxRuntime,
  type SkImageLike as PostFxSkImageLike,
  type SkiaPostFxModuleLike,
  type SkiaRuntimeEffectFactory,
  type SkiaRuntimeEffectLike,
  VIGNETTE_SKSL,
  type VignetteUniforms,
  WEATHER_CLOUDS_SKSL,
  WEATHER_DARK_VIGNETTE_SKSL,
  WEATHER_RAIN_SKSL,
  WEATHER_SUN_SHAFT_SKSL,
  type WeatherCloudsUniforms,
  type WeatherDarkVignetteUniforms,
  type WeatherRainUniforms,
  type WeatherSunShaftUniforms,
} from '@flare-engine/postfx';
// react — explicit curated re-exports; GameConfig aliased as GameViewConfig (clashes with engine.ts):
export {
  type CompiledPassLike,
  createSkiaFrameRenderer,
  type GameConfig as GameViewConfig,
  GameContext,
  type GameContextValue,
  GameView,
  type GameViewProps,
  LoadingScreen,
  type LoadingScreenProps,
  type PostFxChainLike,
  type PostFxPassDescriptor,
  type PostFxRenderHook,
  type PostFxRuntimeLike,
  type RenderHook,
  type RenderShapesOpts,
  renderShapesToImage,
  type SafeArea,
  SafeAreaContext,
  type ShapeRect,
  type SkiaFrameRenderer,
  type SkiaModuleLike,
  type SkOffscreenCanvasLike,
  skiaAtlasModule,
  useCountUp,
  useEntity,
  useGame,
  useGameLoop,
  useOverlayFade,
  useSafeArea,
  useSignalState,
  VirtualButton,
  type VirtualButtonProps,
  VirtualJoystick,
  type VirtualJoystickProps,
} from '@flare-engine/react';
export * from '@flare-engine/render';
export * from '@flare-engine/scene';
export * from '@flare-engine/tilemap';
// Engine-own exports:
export { createGame, type GameConfig, type GameInstance } from './engine.js';
export {
  type AchievementRule,
  type AnalyticsRule,
  createTier2Wiring,
  type LeaderboardRule,
  type Tier2AchievementsLike,
  type Tier2AnalyticsLike,
  type Tier2EventSource,
  type Tier2LeaderboardsLike,
  type Tier2Providers,
  type Tier2Rule,
  type Tier2WiringOptions,
} from './tier2-wiring.js';
