# ADR-0008: `createSentryTransport` starts Sentry with its own capture off, by integration allowlist

- **Status**: Accepted <!-- owner, 2026-10-19 -->
- **Date**: 2026-10-19
- **Consumer impact**: behaviour-change
- **Release level**: patch

## Context

Verified at HEAD `804f3d1` on 2026-10-19, against the working tree before this row's diff.

`createSentryTransport` (`packages/errors/src/transports/sentry.ts`) lazily imports
`@sentry/react-native` on the **first** payload `report()` is handed and called
`mod.init({ dsn, environment, release, sampleRate })` — four keys and nothing else (`sentry.ts:27-35`
pre-diff; the private shim `transports/sentry-types.d.ts:6-11` admitted exactly those four). Unchanged
since `0.3.1`; shipped as-is in the `0.4.0` dist.

With nothing else set, the SDK applies its defaults, and three of them capture **on their own**,
outside `report()`:

1. **`ReactNativeErrorHandlers`**, a default integration on every major the `>=5.0.0` peer admits,
   installs the SDK's global JS error and unhandled-rejection handlers on `ErrorUtils`.
2. **`enableAutoSessionTracking`** defaults to `true` and is forwarded to the native SDK, which
   starts and ends release-health sessions by itself.
3. **`enableNativeCrashHandling`** defaults to `true`: the Android and iOS SDKs install their own
   crash handlers and send on the next launch.

The consequence for the consumer pattern this transport invites — a consent check that drops
payloads *before* they reach the transport — is that the check holds only until the first consented
report. From that moment, a user who opts out keeps being reported for the rest of the process by
paths the check never sees, and nothing can tear the SDK down: `CrashTransport` is `report()`-only
(`packages/errors/src/transport.ts:7-9`) and the SDK handle is closure-private. One further effect,
inferred rather than observed in this repo: with `installGlobalErrorCapture` also chained on
`ErrorUtils`, a fatal JS error reaches both handlers and is reported twice.

Found by PT's `0.4.0` adoption audit (2026-10-12), filed as FREEZE-FIX-1 (P0 privacy). The freeze
rule (fixes only, no API change) and the lockstep gate (`minor` would cut `0.5.0`) bound the fix.

### What each switch reaches, per SDK major

Research pass 2026-10-19 (Sentry docs plus source at tags 5.0.0, 5.36.0, 6.22.0, 7.0.0, 7.4.0,
7.5.0, 7.13.0, 8.31.0). Majors admitted by the `>=5.0.0` peer: 5 (5.0.0 → 5.36.0), 6 (6.0.0 →
6.22.0), 7 (7.0.0 → 7.13.0), 8 (8.0.0 → 8.31.0, latest at 2026-10-15). The SDK is installed in
neither this repo nor PT, so nothing below was executed here.

| JS `init` key | Default | What it reaches, 5.0.0 → 8.31.0 |
| --- | --- | --- |
| `integrations` (function form) | all defaults | Core Options key honoured by the RN `init` on every major. 5.0.0 `sdk.tsx` pushes the default set only when `defaultIntegrations` is undefined; 5.36+/6/7/8 resolve `defaultIntegrations === undefined ? getDefaultIntegrations(options) : …` and hand the result to `getIntegrationsToSetup`, which applies an `integrations` **function** to that default list. The global JS error + unhandled-rejection capture is the `ReactNativeErrorHandlers` default integration. `captureException` delivers independently of integrations — the transport (`makeNativeTransportFactory` / fetch) is not an integration. Kept-name strings verified in 8.31.0 source; 5.x–7.x name strings were not individually verified, which the fail-safe property below absorbs. Docs: [options](https://docs.sentry.io/platforms/react-native/configuration/options/), [default integrations](https://docs.sentry.io/platforms/react-native/integrations/default/). |
| `enableAutoSessionTracking` | `true` | Forwarded to native on every major — Android `options.setEnableAutoSessionTracking(…)`, iOS via the options dictionary sentry-cocoa parses. Sessions are a native feature, so dropping JS integrations does **not** stop them; this key is required. |
| `enableNativeCrashHandling` | `true` | Android: removes `UncaughtExceptionHandlerIntegration`, `AnrIntegration` and `NdkIntegration` by `instanceof` (verified in 8.31.0 `RNSentryStart.java`; the same block in 5.0.0–7.13.0 `RNSentryModuleImpl.java`). iOS 5.0.0–7.4.0: removes `SentryCrashIntegration`. iOS 7.5.0+: sets `enableCrashHandler = NO`, which per the [Apple options docs](https://docs.sentry.io/platforms/apple/configuration/options/) also disables [watchdog-termination tracking](https://docs.sentry.io/platforms/apple/guides/ios/configuration/watchdog-terminations/). 7.5.0 is the only semantic drift across the range for any key used here. |
| `enableAppHangTracking` (iOS) | `true` | Not affected by the crash switch on any major → must be `false`. [Docs](https://docs.sentry.io/platforms/react-native/configuration/app-hangs/). |
| `enableWatchdogTerminationTracking` (iOS) | `true` | Survives the crash switch on 5.0–7.4 → must be `false`; redundant but harmless on 7.5+. |
| `sendClientReports` | `true` | Outcome counters (counts of dropped events). The JS client attaches them to envelopes it is already sending; forwarded to Android `setSendClientReports`, where the native behaviour was not checked. `false` for strictness, not because a standalone send was observed. |
| tracing, replay, profiling, logs, MetricKit, failed-request capture | off | All opt-in via sample rates or flags the transport never sets. Nothing to do. |

Option names are unchanged 5.0.0 → 8.31.0 for every key used. `Sentry.close()` exists in 5.36.0,
6.22.0, 7.13.0 and 8.31.0 — relevant to the CW7-Q11 follow-up, not to this fix.

## Decision

`createSentryTransport` keeps `defaultIntegrations` unset so the SDK computes its own defaults for
the installed major, and passes `integrations` as a module-level filter (`keepEventProcessors` over
the `KEPT_INTEGRATIONS` set) that keeps only the event processors `RewriteFrames`, `Release`,
`DebugMeta`, `SdkInfo`, `Dedupe`, `InboundFilters`, `NativeLinkedErrors` and `EventOrigin`, by
name, and drops everything else — `ReactNativeErrorHandlers`, `Breadcrumbs`, `DeviceContext`,
`HttpContext`, `ModulesLoader`, `ReactNativeInfo`, every tracing/replay/app-start/frames
integration, and any name it has never seen. It additionally sets `enableAutoSessionTracking`,
`enableNativeCrashHandling`, `enableAppHangTracking`, `enableWatchdogTerminationTracking` and
`sendClientReports` to `false`. `dsn`, `environment`, `release` and `sampleRate` are passed as
before; the native SDK stays enabled. The private shim gains the same keys and a minimal
`Integration` type; it still does not leak into the built `dist/*.d.ts` (verified: zero `declare
module` after `bun run build`). No exported name, signature or type changes.

**Fail-safe property.** The allowlist is the direction that degrades safely: a kept name that does
not match on some SDK major only loses that enrichment (frames, release, debug-meta, dedupe), while
an unknown or renamed capture-side integration is dropped by default. No future default integration
can add a capture path through this transport without the engine opting it in.

## Consumer impact

- **Who.** Every consumer of `createSentryTransport` on `@flare-engine/errors` `0.4.1` and later,
  on any `@sentry/react-native` major the peer admits. Consumers of `createClientTransport`,
  `createConsoleTransport` and `installGlobalErrorCapture` are untouched.
- **What they see.** Silently different behaviour, in the safe direction. Sentry stops receiving
  anything the transport was not handed: uncaught JS errors and unhandled rejections that are not
  routed through the transport, release-health sessions, native crashes, iOS app hangs and watchdog
  terminations, client reports. Events that *are* sent via `report()` keep their stack frames,
  release, debug-meta, dedupe and inbound filtering, but lose the enrichment the dropped
  integrations attached — device/OS/app context, React Native runtime info, module list, console and
  network breadcrumbs. Dashboards that relied on Sentry's own capture or on those contexts will show
  the gap after `bun update`.
- **Migration.** For process-wide JS errors, route `ErrorUtils` / `unhandledrejection` through the
  same transport with `installGlobalErrorCapture` (ships since `0.4.0`), which also removes the
  inferred double report. There is **no** engine path to opt Sentry's own capture back in, and no way
  to shut a live client down on opt-out: both are the API half, CW7-Q11, post-flip (an opt-in
  `integrations` passthrough on `SentryTransportOptions` and a `close()` on the returned transport
  calling the SDK's `close`). Calling the SDK's own `init` before the first `report()` is not a
  workaround — the transport's `init` binds a new client over it.
- **Residual — Android 11+ ANR.** sentry-java's `AnrIntegrationFactory` returns `AnrV2Integration`
  for API ≥ 30 (Android 11); it implements the integration interface directly rather than
  subclassing `AnrIntegration`, so the RN SDK's `instanceof AnrIntegration` removal under
  `enableNativeCrashHandling: false` misses it. At SDK initialisation it reports past ANRs from
  `ApplicationExitInfo`, gated only on the native option behind `isAnrEnabled`, which the RN JS
  options do not expose (no `anrEnabled` key in 8.31.0 `RNSentryStart.java`). The engine cannot
  switch it off. Because the transport inits lazily on the first consented `report()`, this can only
  fire after consent was given in that process. Consumer mitigation: the `io.sentry.anr.enable`
  manifest meta-data set to `false`
  ([Sentry Android docs](https://docs.sentry.io/platforms/android/configuration/app-not-respond/));
  whether manifest meta-data applies under the RN SDK's programmatic native init is **unverified**.
- **Native early-init paths.** A consumer initialising the native SDK before JS — `sentry.options.json`
  (8.0.0+) or `autoInitializeNativeSdk: false` with a hand-written native init — has configured it
  outside the transport, and the transport's JS options are then not (or not fully) forwarded
  natively. Set the same native flags there: session tracking, crash handling, app-hang and watchdog
  tracking, client reports, ANR.
- **Why now.** A P0 privacy defect in a `0.4.0` dist that consumers are adopting during the freeze
  window, and the only pre-flip release where the fix can ship alone: `0.4.1`, as a `patch`, with
  nothing else in the cut. The gate cannot see a patch-level behaviour change, which is why this ADR
  exists.

## Alternatives considered

- **`defaultIntegrations: false`.** The simplest switch and the first fix proposed. Rejected: it also
  removes `RewriteFrames`, `Release` and `DebugMeta`, so uploaded source maps stop matching frames
  and the auto-filled `dist` is lost. `SentryTransportOptions` has no `dist` field, and adding one is
  an API change the freeze forbids.
- **`enableNative: false`.** Turns the native SDK off entirely, which would also close the ANR
  residual. Rejected by the owner: it loses the native transport and its offline cache, and the
  release/dist auto-fill from the native app metadata.
- **Add the opt-in passthrough and `close()` now.** The complete fix. Rejected for this cut: both are
  additive API on a frozen surface (`SentryTransportOptions`, `CrashTransport`'s return type); they
  are filed as CW7-Q11, post-flip, patch + ADR.

## What would reverse this

- **A Sentry major where one of the eight kept names starts capturing on its own**, observed in
  that major's source. Remove it from `KEPT_INTEGRATIONS`; the allowlist shape stays.
- **A Sentry major renames one of the kept integrations.** Enrichment degrades (frames stop
  rewriting, release stops auto-filling); not a reversal, but the set must be extended with the new
  name in a patch.
- **The RN SDK exposes the Android ANR switch as a JS `init` option.** Add it, set `false`, and
  strike the residual above.
- **CW7-Q11 lands.** The default stays as decided here; the passthrough makes the opt-in explicit
  rather than ambient, which is the point of this ADR.
- **`SentryTransportOptions` gains a `dist` field** (an API change, post-flip). Then
  `defaultIntegrations: false` becomes viable and strictly simpler than the allowlist; re-evaluate.

<!-- symbols-ok: Integration, ReactNativeErrorHandlers, Breadcrumbs, DeviceContext, HttpContext,
     ModulesLoader, ReactNativeInfo, RewriteFrames, Release, DebugMeta, SdkInfo, Dedupe,
     InboundFilters, NativeLinkedErrors, EventOrigin, defaultIntegrations, enableNative,
     getDefaultIntegrations, getIntegrationsToSetup, makeNativeTransportFactory,
     UncaughtExceptionHandlerIntegration, AnrIntegration, NdkIntegration, AnrV2Integration,
     AnrIntegrationFactory, SentryCrashIntegration, enableCrashHandler, ApplicationExitInfo,
     isAnrEnabled, anrEnabled, autoInitializeNativeSdk, setSendClientReports, RNSentryStart.java,
     RNSentryModuleImpl.java, Sentry.close -->
<!-- reason: every name above is a @sentry/react-native, @sentry/core, sentry-java or sentry-cocoa
     identifier (integration names, SDK init keys, native classes and source files) named because
     this ADR is about what those SDK paths capture on their own. `Integration` is the private
     shim's type in `sentry-types.d.ts`, which is deliberately not a Flare export. None of them is,
     or should resolve as, a Flare symbol. -->
