---
'@flare-engine/react': minor
'@flare-engine/engine': minor
---

Dispatch the native scene capture through `scheduleOnUI` from `react-native-worklets` instead of
Reanimated's deprecated, curried `runOnUI`. Per ADR-0002.

Two things this fixes. `runOnUI` is deprecated in Reanimated 4 and the peer range was open-ended
(`>=3.19.1`), so a consumer on a future Reanimated 5 would have satisfied the declared range and
got a silent runtime break on the native render path. And `runOnUI(fn)` is curried, so it allocated
a wrapper closure on every frame inside `onPreRender` — the one place `AGENTS.md` forbids
allocation.

**Breaking:** `@flare-engine/react` now peers `react-native-reanimated >=4.0.0` and
`react-native-worklets >=0.7.0`, and Reanimated 4 is New-Architecture-only, so old-architecture
apps are no longer supported. Every `create-flare-app` template already ships both packages at
these versions, so scaffolded apps need no change.
