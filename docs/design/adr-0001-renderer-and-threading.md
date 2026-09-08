# ADR-0001 — Renderer and threading model

- **Status:** Accepted
- **Date:** 2026-09-01
- **Deciders:** engine owner
- **Supersedes:** nothing (first ADR in this repo)

> **On this file's existence.** This is the first ADR here, and it establishes the
> `docs/design/adr-NNNN-*.md` convention. It was written *after*
> [`external-review-2026-08.md`](../plans/external-review-2026-08.md) §11.4 landed, deliberately: an
> earlier draft would have recorded the threading model as it was *believed* to be. As of
> 2026-08-31 that belief was wrong in both directions — the repo had no Reanimated peer and no
> worklets, then acquired both, and the first attempt at acquiring them shipped a black screen on
> device. Everything below is measured at HEAD, with file:line, not recalled.

---

## 1. Context

React Native offers two viable ways to drive a 2D renderer in 2026:

1. **JS-thread `requestAnimationFrame`.** Simulation and draw-call recording run on the JavaScript
   thread. Simple, debuggable, portable to web unchanged, and testable without a device.
2. **Reanimated worklets on the UI thread.** Work runs off the JS thread entirely.
   `@shopify/react-native-skia`'s own documentation steers users here — passing shared values so
   that "the JavaScript thread never gets involved during the animation."

The choice is not free in either direction. Worklets cost a peer dependency, a Babel plugin, a
second execution context that ordinary breakpoints and `console.log` reach awkwardly, and a
scheduling model that makes deterministic replay harder. The JS thread costs frame budget shared
with whatever else the host app is doing.

This decision is load-bearing for the project's public positioning — "animation, gamification,
interactive UI, and games" — because that positioning explicitly includes animation *inside a host
app's UI*, which is the case where the JS thread is **not** idle.

## 2. Decision

**A hybrid, split by what each thread is actually needed for.**

| Concern | Thread | Mechanism |
| --- | --- | --- |
| Simulation, ECS, draw-call recording | **JS** | `requestAnimationFrame` — `packages/core/src/game-loop.ts:142` |
| React reconciliation | **JS** | ordinary React; ~zero renders per frame (§4) |
| Scene texture handoff to the canvas | **UI** | one Reanimated worklet — `packages/react/src/game-view.tsx:49`, dispatched at `:246` |
| Animation (tween/spring/timing) | **JS** | engine's own; **no** Reanimated animation API anywhere |

> **Superseded in its mechanism by [ADR-0002](adr-0002-worklets-migration-and-new-arch-floor.md),
> re-verified 2026-09-08 at HEAD `7f32ad4`.** The *decision* below stands — the scene-texture handoff
> runs on the UI thread and nothing else does. Three details under it have moved:
>
> - The dispatch is **`scheduleOnUI` from `react-native-worklets`**, not Reanimated's `runOnUI`.
>   `runOnUI` is curried, so it allocated a wrapper closure every frame inside `onPreRender`.
> - The peers are now **`react-native-reanimated >=4.0.0`** (was `>=3.19.1`) plus a new
>   **`react-native-worklets >=0.7.0`**, which is what sets the New Architecture floor.
> - The file:line refs drifted: the `'worklet'` body is at `packages/react/src/game-view.tsx:50`
>   and the dispatch at `:263`.
>
> Everything below is left as written — it is the record of what was measured on 2026-08-31.

Concretely, at HEAD:

- `react-native-reanimated` is a **required** peer of `@flare-engine/react` at `>=3.19.1`
  (`packages/react/package.json:57`) — matching rn-skia's own floor, not a number we invented.
  It is required rather than optional because `<GameView>` always uses it.
- Reanimated appears in **exactly one package** and, as executable code, **one file**:
  `packages/react/src/game-view.tsx` uses `useSharedValue` and a single `runOnUI` worklet.
  (`scene-texture.ts` mentions it only in a docstring.) The other 40 scoped packages have no
  knowledge of it.
- The Reanimated **animation** surface is not used at all: zero occurrences of `withTiming`,
  `withSpring`, `useAnimatedStyle` or `useDerivedValue` across `packages/*/src`.

So: **the UI thread is used for exactly one job, and only because that job cannot be done anywhere
else.** Everything else stays on the JS thread on purpose.

## 3. Why

**3.1 — The worklet is not a preference; it is a hardware constraint.** The scene is captured into
an offscreen Skia surface and handed to the on-screen `<Canvas>` as an image. A surface created on
the JS thread belongs to a *different GL context* than the canvas that samples it, so the canvas
draws nothing — a black frame while the game loop runs normally, with every unit test still green.
This was not theory: it shipped, and was caught only on a physical Pixel 7. The fix is to build the
surface inside a `runOnUI` worklet, which is precisely what rn-skia's own `usePictureAsTexture`
does. Evidence and the three-way device A/B:
[`external-review-2026-08.md`](../plans/external-review-2026-08.md) §11.4b–§11.4c.

**3.2 — Everything else on the JS thread buys testability that is otherwise unobtainable.** The
loop's frame source is an injection seam — `const request = this.tick ?? requestAnimationFrame`
(`game-loop.ts:142`) — so the entire simulation runs under Bun with no React Native runtime, no
device, and no emulator. That is why this repo can hold **2,965 passing tests** and Pan Tvardowski
another **2,522** (both counted 2026-09-01, both green), and why a contributor can run them in
seconds. Move simulation into worklets and most of that becomes device-dependent integration
testing. This is the strongest argument for the design and it is currently invisible to anyone
outside the repo.

**3.3 — One code path for web and native.** The same loop and the same renderer drive CanvasKit
WASM in a browser. A worklet-based simulation would need a second path for web, doubling the
surface that has to be kept honest.

**3.4 — Determinism.** A fixed-timestep loop on one thread replays. Worklet scheduling makes
reproducing a frame sequence materially harder, which matters for a deterministic wave spawner and
for the golden tests that depend on it.

**3.5 — Dependency surface.** Keeping Reanimated confined to one integration package means the 40
headless packages stay pure TypeScript with no native peer at all. A consumer using
`@flare-engine/ecs` or `@flare-engine/math` pulls in nothing.

## 4. What it costs

**Frame work competes with host-app JavaScript.** For a game that owns the screen this is free — the
JS thread is otherwise idle. For a Flare animation embedded in a busy React Native screen, the host
app's own JS (list virtualization, network callbacks, navigation transitions) shares the thread and
can cause dropped frames that a worklet-based renderer would not. **We have not measured this case**,
and it is the honest weak point of the design against the "interactive UI" half of the positioning.

**React renders are near-zero, but that is a property of the current implementation, not a
guarantee.** Measured on device over ~1800 frames of gameplay: **6** `GameView` renders total, i.e.
mount plus a few layout settles. Achieved by writing captured frames into a shared value instead of
React state. A future contributor adding a per-frame `setState` would silently give this back; the
tests in `packages/react/tests/game-view.test.ts` assert the dispatch shape to make that loud.

**The worklet path is noisier than the path it replaced.** It emits ~1.6× the RN-Skia TextureView
messages (`updateAndRelease() failed` / `LegacySurfaceTexture is not attached!`) of the pre-worklet
implementation — 4,614 vs 2,840 per 30 s. RN-Skia labels these ignorable and rendering is correct,
but the delta is **not understood**. Tracked as row **XR-1c** in
[`todo.md`](../plans/todo.md), together with the fact that the native path no longer keeps a
retention ring — the worklet assigns the shared value and never releases the prior image, matching
rn-skia's own `createTexture`, which also does not.

**Old-architecture support is claimed but unverified.** The `>=3.19.1` floor exists to keep
Reanimated 3 — and therefore old-architecture apps — viable. No scaffolder template can produce such
an app: all three pin Expo 57 / RN 0.86, which force `newArchEnabled=true`, and `expo prebuild`
silently overrides an `app.json` opt-out. Verifying the claim needs a hand-built RN 0.79–0.81
vehicle. See §11.4b of the external review.

## 5. What would reverse this

Any one of these should reopen the decision:

1. **A measured frame-drop threshold under host-app load.** If Flare running inside a busy RN screen
   drops frames the worklet path would not, the "interactive UI" positioning is not backed. This is
   the §4 gap and the most likely reverser.
2. **rn-skia's integration path moving out from under us.** rn-skia `2.10+` requires Reanimated 4 for
   its shared-value integration, and Reanimated 4 is New-Architecture-only and additionally peers
   `react-native-worklets`. Raising the Flare floor to Reanimated 4 would end old-architecture
   support outright — a breaking change for consumers the current floor promises to serve.
3. **A consumer requirement the JS thread cannot meet** — e.g. an animation that must keep running
   while the host app blocks its JS thread.
4. ~~**The XR-1c investigation finding the message delta is a real leak**, not log noise.~~
   **Resolved 2026-09-05 — it is log noise, and this reverser is retired.** Measured on a Pixel 7
   release build over two 6-minute soaks: native heap plateaus with bidirectional noise on both
   paths, and `opaque: true` (SurfaceView instead of TextureView) drops the pair from 22 028
   messages per 60 s to **zero** while rendering identically. Nothing was accumulating, which is
   consistent with the worklet path having no retention ring. Evidence:
   [external review §11.4d](../plans/external-review-2026-08.md).

## 6. Status

**Accepted.** Revisit post-flip if consumer reports contradict §4, or immediately if any §5 trigger
fires. The hybrid is deliberate: the UI thread is used where the GPU context requires it and nowhere
else, and that boundary is the thing to defend in review.

---

## References

- Threading defect, root cause, and device A/B — [`external-review-2026-08.md`](../plans/external-review-2026-08.md) §11.4b, §11.4c
- Loop and frame source — `packages/core/src/game-loop.ts:142`
- The worklet — `packages/react/src/game-view.tsx:49`, dispatched `:246`
- Peer floors — `packages/react/package.json:56-57`
- Layering and package map — [`architecture.md`](architecture.md)

<!-- symbols-ok: usePictureAsTexture, updateAndRelease -->
<!-- reason: both are @shopify/react-native-skia APIs, not Flare exports. This ADR is about how
     Flare sits on top of that library, so its names appear here by necessity. Note XR-13 later
     dropped Flare's use of usePictureAsTexture in favour of scheduleOnUI — see ADR-0002. -->
