---
"@flare-engine/engine": patch
---

XR-12: declare the `react-native-reanimated` peer on the barrel. `@flare-engine/engine` re-exports `GameView`, which requires Reanimated since the UI-thread scene capture landed, but the peer was only declared on `@flare-engine/react` — so an npm/pnpm/yarn consumer of the barrel resolved without it and crashed on first render.
