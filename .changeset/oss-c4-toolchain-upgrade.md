---
"@flare-engine/a11y": minor
"@flare-engine/achievements": minor
"@flare-engine/analytics": minor
"@flare-engine/animation": minor
"@flare-engine/assets": minor
"@flare-engine/audio": minor
"@flare-engine/cli": minor
"@flare-engine/core": minor
"@flare-engine/debug": minor
"@flare-engine/deep-links": minor
"@flare-engine/devtools": minor
"@flare-engine/dialogue": minor
"@flare-engine/ecs": minor
"@flare-engine/engine": minor
"@flare-engine/errors": minor
"@flare-engine/events": minor
"@flare-engine/haptics": minor
"@flare-engine/iap": minor
"@flare-engine/iap-revenuecat": minor
"@flare-engine/input": minor
"@flare-engine/leaderboards": minor
"@flare-engine/localization": minor
"@flare-engine/math": minor
"@flare-engine/particles": minor
"@flare-engine/pathfinding": minor
"@flare-engine/physics": minor
"@flare-engine/postfx": minor
"@flare-engine/progression": minor
"@flare-engine/react": minor
"@flare-engine/render": minor
"@flare-engine/render-web": minor
"@flare-engine/scene": minor
"@flare-engine/shapes": minor
"@flare-engine/share": minor
"@flare-engine/simulation": minor
"@flare-engine/storage": minor
"@flare-engine/testing": minor
"@flare-engine/tilemap": minor
"@flare-engine/ui": minor
"@flare-engine/ui-shop": minor
---

Build toolchain modernized across all packages, with no runtime or public API changes. Every package is now bundled with `tsdown` (Rolldown-based, replacing the unmaintained `tsup`); dist output (`.js`/`.mjs`/`.d.ts`/`.d.mts` + sourcemaps) is byte-compatible, so `exports` maps and installed shape are unchanged. Lint runs on Biome 2, the TypeScript floor moves to 5.9 (with `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, and `moduleDetection: "force"` added as guards), and Bun ambient types are removed from the shipped-source typecheck. The `@flare-engine/engine` README now documents that the engine is architecture-agnostic and imposes no React Native New Architecture requirement of its own.
