---
'@flare-engine/engine': patch
---

The README and the package description no longer call `./headless` safe for web-only and Node projects (#505). Docs only: no behaviour change.

**Why the old wording was wrong.** At runtime `./headless` imports no React Native, but installing `@flare-engine/engine` still installs React Native, Skia, Reanimated and Worklets. They are the package's required peers, and its `@flare-engine/react` dependency requires them too.

**What the README adds**, in a new section, "Web and Node without React Native":
- install only the leaf packages (`core`, `ecs`, `render`, …), which declare no required React Native peer;
- build the few subsystems `createGame` would construct;
- in Node, set `loop.tick` and `loop.cancelTick` before `start()`, since Node has no `requestAnimationFrame`.
