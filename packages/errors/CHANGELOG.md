# @flare-engine/errors

## 0.4.12

## 0.4.11

### Patch Changes

- 451ccba: Internal refactor: `createClientTransport` and `createSentryTransport` now rebuild a crash payload into an `Error` through one shared internal helper instead of two hand-written copies, and `createClientTransport` with `ErrorClientLike` moved to its own module beside the Sentry transport. Both transports hand their client the same `Error` as before (the payload's name and message, and its stack when it has one). No behaviour or API change.

## 0.4.10

### Patch Changes

- 0974e19: `SentryTransportOptions` gains an `integrations` hook, `(kept, defaults) => SentryIntegrationLike[]`,
  that receives the ADR-0008 allowlist and the SDK's own default list and returns what `init` uses;
  without it `init` receives the allowlist exactly as before, and a hook that throws is logged and
  falls back to it. `CrashTransport` gains an optional `close()`: `createSentryTransport` awaits the
  SDK's `close()` once (only if the module was loaded) and every later `report()` sends nothing, and
  `composeTransports` forwards `close()` to each child that has one. `createNoopTransport` and
  `createConsoleTransport` leave `close` undefined.
- 938c86d: Fix `installGlobalErrorCapture` leaving its React Native `ErrorUtils` handler live after
  `uninstall()` when no previous global handler existed. `uninstall()` only restored a handler when
  `getGlobalHandler()` had returned one, so with none the installed closure stayed as the global
  handler and kept reporting to the transport, or filling the buffer, for a capture the consumer
  believed detached. `uninstall()` now always calls `setGlobalHandler`, with the previous handler when
  there was one and a no-op otherwise, and the installed closure itself turns into a pure pass-through
  once uninstalled. Restoring an existing previous handler is unchanged.

## 0.4.9

## 0.4.8

### Patch Changes

- 584a1fb: `installGlobalErrorCapture` (both the live path and the `setTransport` drain) and `ErrorBoundary`
  now handle a transport whose `report` returns a rejected promise: the rejection is caught and logged
  with the `[@flare-engine/errors]` prefix, as a synchronous throw already was. Before, a
  consumer-written `async report` that rejected (for example awaiting `fetch` while offline) was left
  as an unhandled rejection; on web the capture's own `unhandledrejection` listener then reported it
  through the same transport, which rejected again, and so on until the transport recovered. The
  bundled transports swallow their own failures and were not affected. `ErrorBoundary` also now logs a
  transport that throws synchronously instead of letting the throw escape `componentDidCatch`.

## 0.4.7

## 0.4.6

## 0.4.5

### Patch Changes

- 8814ec2: Public release: every `@flare-engine/*` package is public on npm from this version, published from
  CI with npm provenance. No code changes; npm visibility is retroactive, so earlier versions are
  public too.

## 0.4.4

## 0.4.3

## 0.4.2

## 0.4.1

### Patch Changes

- FREEZE-FIX-1: `createSentryTransport` starts Sentry with the SDK's own capture switched off, so
  Sentry sends only what the transport is given.

  Before, the first `report()` initialised `@sentry/react-native` with its default integrations,
  automatic session tracking and native crash handling, so once a consumer's consent check had let one
  payload through, Sentry kept capturing on its own — global JS errors and unhandled rejections,
  release-health sessions, native crashes — for the rest of the process, outside that check. The
  transport now passes an `integrations` allowlist that keeps only event processors (`RewriteFrames`,
  `Release`, `DebugMeta`, `SdkInfo`, `Dedupe`, `InboundFilters`, `NativeLinkedErrors`, `EventOrigin`)
  and drops every other default by name, including names it has never seen, and sets
  `enableAutoSessionTracking`, `enableNativeCrashHandling`, `enableAppHangTracking`,
  `enableWatchdogTerminationTracking` and `sendClientReports` to `false`. `dsn`, `environment`,
  `release` and `sampleRate` are passed as before. No exported name, signature or type changes.

  What consumers observe: Sentry no longer receives uncaught JS errors, unhandled rejections,
  sessions, native crashes or iOS app hangs on its own, nor client reports — route process-wide JS errors
  through `installGlobalErrorCapture` with this transport. Events still sent via `report()` keep their
  stack frames, release and debug-meta but lose the device/OS context, React Native runtime info,
  module list and breadcrumbs the dropped integrations attached. One residual the transport cannot
  close: on Android 11+ the native SDK reports past ANRs on its own, gated by a native option the React
  Native JS options do not expose — set the `io.sentry.anr.enable` manifest meta-data to `false` if
  consent must cover ANRs. Rationale, the per-SDK-major verification and the post-flip follow-up (an
  opt-in passthrough plus `close()`, CW7-Q11) are in ADR-0008.

  <!-- symbols-ok: RewriteFrames, Release, DebugMeta, SdkInfo, Dedupe, InboundFilters,
       NativeLinkedErrors, EventOrigin -->
  <!-- reason: the eight names are @sentry/react-native default-integration names kept by the
       transport's allowlist, not Flare exports. The five `init` keys resolve against the private
       shim in `sentry-types.d.ts`. -->

## 0.4.0

### Patch Changes

- 15424ba: OSS-M7: capture the crashes `ErrorBoundary` cannot see.

  `installGlobalErrorCapture(target, options?)` routes uncaught errors and unhandled rejections into the existing transport chain — the update-loop, async and asset-load crashes that never reach a React render phase. The target is structural (`addEventListener` for web, `ErrorUtils` for React Native), so one call handles both platforms and tests use a fake global. Returns a handle with `uninstall()`, `setTransport()` and `buffered`.

  A transport may attach after installing; errors raised in between are held in a bounded ring buffer (default 20, oldest dropped) and drained on attach, so crashes during boot are not lost while the reporter initialises. On React Native the previous `ErrorUtils` handler is chained rather than replaced, and restored on uninstall.

  `createClientTransport(client)` is the web counterpart to the native-only `createSentryTransport`: it takes an already-initialised, structurally-typed browser client, so this package depends on no reporter of its own.

## 0.3.1

## 0.3.0

### Minor Changes

- ff62507: Peer-dependency floor bump + Skia decoupling across the React-facing packages, plus a new web frame-renderer export. Floors move to `react >=19` and `react-native >=0.79` (Skia 2.x requires RN 0.79, not 0.78) wherever those peers are declared. `@shopify/react-native-skia` moves to `>=2.0.0` where it is still required (`react`, `engine`), is dropped entirely as a peer from `render` and `assets` (both already inject a structural `*Like` Skia module and never import Skia), and becomes an **optional, type-only** peer of `shapes` (used only for the `import type` in `draw.ts`) and an **optional, injected** peer of `postfx` (Skia is passed in at runtime; the floor moves from `>=1.0.0` to `>=2.0.0`). `react-native-gesture-handler` is dropped as a peer from `input`, `react`, and `engine` (no runtime usage). `engine` gains `react-native-safe-area-context >=4.0.0` as a required peer, matching `<GameView>`'s inset resolution.

  `@flare-engine/render-web` additionally ships `createWebFrameRenderer(kit: CanvasKit): FrameRenderer` — the web/CanvasKit analog of `@flare-engine/react`'s `createSkiaFrameRenderer`, a thin composition `createFrameRenderer(createWebSkiaModule(kit))`; presentation (replaying `endFrame()` onto a surface and flushing) stays the consumer's responsibility. Also fixes the `render-web` on-screen post-FX surface so `resize()` correctly rebuilds the WebGL onscreen surface (`postfx-surface.ts`), preventing a stale-size onscreen target after a canvas resize.

- 7c4f7cf: Packaging polish across all shipping manifests. Every package now declares `engines: { "node": ">=20" }`. Each package's `exports["."]` carries per-condition type declarations — ESM consumers (`import`) resolve `./dist/index.d.mts` and CommonJS consumers (`require`) resolve `./dist/index.d.ts`, so the declaration file always matches the resolved module format instead of an ESM import falling back to the CJS-flavored `.d.ts` (the `"."`-level `types` that previously shadowed the ESM condition is removed; the root `types` field is retained for legacy/`node10` resolution). The `@types/react` dev floor moves from `^18` to `^19` across the React-facing packages, matching the installed React 19 runtime. No runtime or public API surface changes.
- 376969a: Build toolchain modernized across all packages, with no runtime or public API changes. Every package is now bundled with `tsdown` (Rolldown-based, replacing the unmaintained `tsup`); dist output (`.js`/`.mjs`/`.d.ts`/`.d.mts` + sourcemaps) is byte-compatible, so `exports` maps and installed shape are unchanged. Lint runs on Biome 2, the TypeScript floor moves to 5.9 (with `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, and `moduleDetection: "force"` added as guards), and Bun ambient types are removed from the shipped-source typecheck. The `@flare-engine/engine` README now documents that the engine is architecture-agnostic and imposes no React Native New Architecture requirement of its own.
- 68d22b2: README truth pass (features + platform tiers): every `ts`/`tsx` example now typechecks against the workspace (enforced by `bun run check:readme`) and api-specs links are absolute (resolve on npmjs.com).

  - Snippets corrected to the real API where they had drifted: `animation` imports easings from `@flare-engine/math` (not `@flare-engine/animation`); `particles` uses `Color` objects, `speed`/`speedMax`, `direction`, config `gravityY`, and single-arg `update(dt)` (opacity fades via `start`/`endAlpha`, not `Color.a`); `pathfinding` `findPathJPS(grid, sx, sy, ex, ey)` returning `PathResult | null` with `path`/`cost`/`explored`; `dialogue` `createDialogueGraph`/`createDialogueRunner`/`createTextReveal` signatures + `ActionHandler(key)`; `debug` `StatsTracker` + `FpsWidget.update(stats)` + `TimeControl(clock)`; `errors` zero-arg `createConsoleTransport()`; `localization` real manager options; `scene` `Scene` requires `name`/`world`/`camera`.
  - Placeholders declared with real types; `haptics` marks its `expo-haptics` example `no-check` (uninstalled peer); `deep-links`/`share` import `Linking`/`Share` from `react-native`.

## 0.2.1

## 0.2.0

### Minor Changes

- Version bumped as part of the 0.2.0 lockstep release.

## 0.1.0

### Minor Changes

- Initial release.
