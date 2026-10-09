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
apps are no longer supported. Every `@flare-engine/create` template already ships both packages at
these versions, so scaffolded apps need no change.

Dropping old-architecture support costs nothing testable: no `@flare-engine/create` template could ever
produce such an app, because all three pin Expo 57 / RN 0.86 and `expo prebuild` silently overrides
an `app.json` opt-out. The earlier `>=3.19.1` floor was chosen to keep those apps viable, but Flare
was never run on one — so the engine was shipping a promise it could not verify. Both shipped
READMEs now state the New-Architecture requirement outright.
