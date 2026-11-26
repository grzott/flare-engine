---
'@flare-engine/math': patch
'@flare-engine/debug': patch
'@flare-engine/ui': patch
'@flare-engine/shapes': patch
'@flare-engine/particles': patch
'@flare-engine/audio': patch
'@flare-engine/react': patch
'@flare-engine/engine': patch
---

Announces the 0.5.0 changes that had not been announced yet ([ADR-0012](https://github.com/grzott/flare-engine/blob/main/docs/design/adr-0012-0-5-0-breaking-set.md), rows 5-11). Nothing changes behaviour in this release. The one addition is `createStatsTracker()`.

- **math:** `springIn`, `springOut` and `springInOut` are `@deprecated` and are removed in 0.5.0. Use `easeInBack`, `easeOutBack` and `easeInOutBack`, which return the same values. (`springInOut` and `easeInOutBack` round differently only where the result is subnormal.)
- **debug:** new `createStatsTracker()`, which returns a `StatsTrackerHandle`. It has the same members as the `StatsTracker` class (`stats`, `updateFromClock`, `setEntityCount`, `setDrawCalls`, `reset`) and allocates nothing after creation. The `StatsTracker` class is `@deprecated` and is removed in 0.5.0. To migrate, replace `new StatsTracker()` with `createStatsTracker()`, and change any `StatsTracker` type annotation to `StatsTrackerHandle`.
- **ui:** in 0.5.0, `FocusManagerOptions.refocusOnUnregister` defaults to `false`: when the focused node unregisters, focus clears to `null`. Pass `refocusOnUnregister: true` to keep re-homing to the first node in tab order.
- **shapes:** the `glow: 'friendly'` and `glow: 'hazard'` strings are deprecated and are removed in 0.5.0. Pass a `GlowSpec` instead.
  - `'friendly'` becomes `{ color: friendlyGlowArgb(), width: 3 }`, which paints the same pixels.
  - `'hazard'` becomes `{ color: hazardGlowArgb(), width: 1 }`. It keeps the colour and the 1 px of stroke, but it is one ring instead of two, and its inner edge sits 2.5 px outside the shape's radius instead of 0.75 px.
  - `applyHazardGlow` stays exported, for drawing the two-ring look yourself.
  - The strings are deprecated in the `glow` JSDoc and the README, not with a `@deprecated` tag: TypeScript cannot attach one to a single member of a string union.
- **particles:** in 0.5.0, the `color` option of `drawParticles` defaults to `true`. Pass `color: false` to keep drawing without colour.
- **audio:** in 0.5.0, `AudioContextLike.createBufferSource` returns `AudioBufferSourceNodeLike | PromiseLike<AudioBufferSourceNodeLike>`, so the asynchronous `react-native-audio-api` web context type-checks. A context that returns a node at once still satisfies the new type. Code that calls `createBufferSource()` itself has to await the result, or narrow it.
- **react, engine:** in 0.5.0, the `react-native-reanimated` peer floor rises from `>=4.0.0` to `>=4.1.0`. Reanimated 4.0.x supports only worklets 0.4.x, but both packages already require worklets `>=0.7.0`, and 4.1.x is the first Reanimated line that supports it. Expo SDK 58 pins Reanimated 4.7.1.

`SceneManager.pop()` keeps destroying the popped scene by default; ADR-0012 declines that flip (#179).
