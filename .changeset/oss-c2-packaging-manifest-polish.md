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

Packaging polish across all shipping manifests. Every package now declares `engines: { "node": ">=20" }`. Each package's `exports["."]` carries per-condition type declarations — ESM consumers (`import`) resolve `./dist/index.d.mts` and CommonJS consumers (`require`) resolve `./dist/index.d.ts`, so the declaration file always matches the resolved module format instead of an ESM import falling back to the CJS-flavored `.d.ts` (the `"."`-level `types` that previously shadowed the ESM condition is removed; the root `types` field is retained for legacy/`node10` resolution). The `@types/react` dev floor moves from `^18` to `^19` across the React-facing packages, matching the installed React 19 runtime. No runtime or public API surface changes.
