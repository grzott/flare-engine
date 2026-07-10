// Headless engine entry — RN-free subset.
// Exports: math · events · core · ecs · render · input · physics · audio ·
//          assets · scene · animation · particles · tilemap · debug
// plus createGame / GameConfig / GameInstance and tier2-wiring.
// No @flare-engine/react, no @flare-engine/postfx.
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
export * from '@flare-engine/render';
export * from '@flare-engine/scene';
export * from '@flare-engine/tilemap';
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
