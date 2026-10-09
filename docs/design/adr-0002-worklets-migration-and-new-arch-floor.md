# ADR-0002: Dispatch the native scene capture through `react-native-worklets`, and require the New Architecture

- **Status**: Accepted (owner, 2026-09-05)
- **Date**: 2026-09-05
- **Consumer impact**: breaking
- **Release level**: minor (`0.x`, pre-publish — see "Why a minor and not a major")

## Context

`@flare-engine/react` dispatches the native scene capture with `runOnUI`, imported from
`react-native-reanimated` (`game-view.tsx:15`, called at `:257`). That call is the XR-1c fix: the
offscreen Skia surface must be built on the UI thread, in the same GL context as the on-screen
canvas, or the scene renders black on Android (§11.4b/c of the external review).

Three facts force a decision, all verified at HEAD against the installed dependency tree:

1. **`runOnUI` is deprecated.** Reanimated 4.2.1 declares it
   `export declare const runOnUI: typeof runOnUIFromWorklets` — a pure re-export of
   `react-native-worklets` — with `@deprecated Please use scheduleOnUI from react-native-worklets`.
   `tsc` reports TS6385 at both sites. **Nothing in the gate fails on it**: a deprecation is a
   suggestion, not an error, so this can rot silently.
2. **The peer range is open-ended.** `"react-native-reanimated": ">=3.19.1"` admits a future
   Reanimated 5, which may drop the re-export. A consumer would then satisfy the declared range and
   get a **silent runtime break on the native render path** — the worst failure shape available,
   and the same class as the original XR-1 defect.
3. **`runOnUI` allocates per frame.** It is curried — `runOnUI(fn)` returns a new wrapper, which is
   then invoked. The call site is inside `ctx.loop.onPreRender`, so on native this allocates one
   closure **every frame**. `AGENTS.md` states the rule it breaks: *"Zero-alloc in `update()` /
   `render()` — no `new` in game loops."* `scheduleOnUI(fn, ...args)` takes its arguments directly
   and allocates nothing.

## Decision

Import `scheduleOnUI` from `react-native-worklets` and call it directly, replacing
`runOnUI(captureSceneOnUI)(...)`. Declare `react-native-worklets` as a peer, and raise the
`react-native-reanimated` floor to `>=4.0.0`.

**This ends Reanimated 3 support, and therefore old-architecture support.** Reanimated 4 is
New-Architecture-only and peers `react-native-worklets >=0.7.0`; under Reanimated 3 the worklets
package is not guaranteed to exist at all.

## Consumer impact

- **Who breaks.** Any consumer pinning Reanimated 3.x, and any app running the old architecture.
- **What they see.** An unmet peer at install (loud), not a runtime surprise — which is the point.
- **Migration.** Upgrade to Reanimated 4 and enable the New Architecture. Expo 57 / RN 0.86 already
  force `newArchEnabled=true`, so any app scaffolded by the Flare scaffolder (`@flare-engine/create`
  since ADR-0007) is already there and
  needs no change.
- **Real-world blast radius: zero.** The scope is published `restricted`
  (`.changeset/config.json` → `"access": "restricted"`); there are no public consumers. The four
  actual consumers — Pan Tvardowski, Berek, `flare-engine-page` and the portfolio — are all
  owner-operated. **Compliance verified 2026-09-08 (owner session):** PT at
  `react-native-reanimated 4.2.1` / `react-native-worklets 0.7.4` / `newArchEnabled=true`
  (`android/gradle.properties:38`); Berek at `4.3.0` / `0.8.1` / `newArchEnabled: true`
  (`app.json:8`). Neither needs migration work. `flare-engine-page` and the portfolio are web
  targets and were not checked in that pass — the native capture path this ADR changes is not
  the path they run.
- **What we give up is a claim we could not test.** Old-architecture support was documented as
  *intended but not verified* (engine + react READMEs, 2026-09-05) precisely because no scaffolder
  template can produce such an app — all three pin Expo 57 / RN 0.86, and `expo prebuild`
  overrides an `app.json` opt-out. This trades an unverifiable claim for a verifiable one.

## Why a minor and not a major

Under `0.x` semver, a minor is the correct carrier for a breaking change, and `check:bump` treats
minor and major identically — both require this ADR. A major would publish `1.0.0` across all 42
lockstep packages and is reserved for the public launch. The engine is pre-publish and the owner
controls the announcement, so the version number is a communication decision, not a compatibility
one.

**Sequencing:** this lands as an *unreleased* minor changeset. It should ride into the existing
`0.4.0` freeze cut rather than triggering a separate release, because 64 references across 12
planning documents pin `0.4.0` as the freeze/launch version and renumbering it a second time buys
nothing. If a consumer needs the change earlier, cut then and sweep the references.

## Alternatives considered

- **Cap the peer at `>=3.19.1 <5`, keep `runOnUI`.** Non-breaking, keeps old-arch alive, and turns
  the silent Reanimated-5 break into a loud install warning. **Rejected** because it keeps the
  per-frame allocation and merely defers the migration — and rn-skia is expected to require
  Reanimated 4 at 2.10+ (ADR-0001 §5.2), so the deferral has a known expiry.
- **Do nothing, document the risk.** Rejected: leaves both the silent-break path and the per-frame
  allocation in place.
- **Conditional resolution — try `react-native-worklets`, fall back to Reanimated.** Rejected:
  puts a resolution branch on the hot init path to serve a configuration we cannot build a test
  vehicle for, and would have to be verified on a device that cannot be scaffolded.

## What would reverse this

1. **rn-skia keeping its `>=3.19.1` floor indefinitely** while a real consumer needs the old
   architecture. Today rn-skia 2.4.18 peers `>=3.19.1`, the same floor Flare declares — so this
   decision moves ahead of rn-skia rather than following it, which is the main argument against it.
2. **A measured regression on device.** The capture seam is device-only verifiable and has broken
   silently once already (XR-1a rendered black while every test stayed green). If `scheduleOnUI`
   changes render behaviour or the `GameView` re-render count on hardware, revert.
3. **Reanimated 4 proving unstable on the RN floor Flare supports**, in a way Reanimated 3 was not.
