# ADR-0005: Flare supports a desktop delivery target — the web export in a bundled-Chromium shell, with Steam integration as adapter packages

- **Status**: Accepted <!-- owner, 2026-09-08 -->
- **Date**: 2026-09-08
- **Consumer impact**: additive
- **Release level**: minor

## Context

Verified at HEAD `2ae80cc` on 2026-09-08. Full design and evidence:
[desktop-steam-2026-09.md](../plans/desktop-steam-2026-09.md); queue pointers in
[todo.md](../plans/todo.md) Arc DESK.

Arc WEB proved a scaffolded Flare app renders in a browser (WEB-5, 2026-08-24). That build is
produced by Expo + Metro (`packages/create-flare-app/templates/blank/{package.json,metro.config.js}`),
with `react-native-web` supplying `react-native` and `LoadSkiaWeb` supplying Skia through CanvasKit
(`templates/blank/index.web.ts`). `canvaskit-wasm` and `react-native-web` are already optional peer
deps of `packages/react` (`package.json:53-70`). Nothing about that path is browser-specific once
the bundle is loaded.

Three facts make desktop a decision rather than an obvious extension:

1. **The engine has no desktop input, display or lifecycle surface**, because nothing it shipped on
   needed one. A mouse that moves without being pressed never updates `pointer.position`
   (`packages/input/src/input-manager.ts:77-82`, `:67-68`); `KeyboardEventLike` carries no modifier
   state (`keyboard.ts:10-15`); there is no gamepad rumble or connect/disconnect event
   (`gamepad-source.ts:39-62`). `ScreenManager` (`packages/core/src/screen.ts`) and `AppLifecycle`
   (`packages/core/src/app-lifecycle.ts`) are fully implemented and **never instantiated** — `GameView`
   calls `camera.setViewport()` directly instead (`packages/react/src/game-view.tsx:302-309`).
2. **Steam integration has an exact precedent and no existing implementation.**
   `packages/iap-revenuecat` establishes the concrete-adapter pattern at tier 3.5
   (`provider.ts:91-183`), and `api-specs.md:829,850` already names Steam as a post-launch platform
   adapter for leaderboards and achievements. Nothing has been built.
3. **The alternative native route is closed.** `@shopify/react-native-skia` does not support
   Microsoft's `react-native-windows` or `react-native-macos`; its docs list iOS, Android, Web, tvOS
   and Apple macOS via react-native-tvos, and Shopify/react-native-skia#2058 is closed without
   implementation. Without Skia there is no renderer.

This ADR does not decide which shell. That is gated on a spike (Arc DESK row DESK-1), because
`electron/electron#45732` — gamepads undetected under Steam Input on Proton, closed "not planned" in
February 2025 — could disqualify Electron for the Steam Deck target, and NW.js (v0.115.0,
2026-08-18, Chromium 152) is a live alternative rather than a legacy one.

## Decision

Flare supports desktop as a first-class delivery target for Windows and Linux including Steam Deck,
by running the existing Expo web export inside a bundled-Chromium shell. The engine gains the
desktop input, display and lifecycle surface it lacks, and gains Steam support as adapter packages
against the Tier-2 interfaces that already exist — `@flare-engine/achievements-steam` and
`@flare-engine/leaderboards-steam` at tier 3.5 following `iap-revenuecat`, and a Steam Cloud
`StorageAdapter` at tier 2.5 following `createMmkvAdapter`. **No `@flare-engine/*` package depends on
a shell**; the shell ships as a `create-flare-app` template, and the Steamworks SDK is never
committed to this repository.

## Consumer impact

Additive. Nothing existing is removed or renamed.

- **Who breaks.** Nobody, with one row to watch: DESK-5 routes `GameView`'s viewport through
  `ScreenManager` instead of calling `camera.setViewport()` directly. Every consumer today receives
  raw viewport pixels, so `ScreenManager` must default to `stretch` at the real viewport size, which
  reproduces current behaviour exactly. Any other default silently changes what every existing game
  draws — the case this ADR's release gate exists for. The default belongs in DESK-5's changeset,
  stated explicitly.
- **What they see.** New optional exports: mouse buttons, wheel, cursor lock, keyboard modifiers,
  gamepad connect/disconnect and rumble, a screen/display surface, and three new packages that must
  be installed deliberately. Existing calls compile and behave as before.
- **Migration.** None required. A consumer who wants desktop scaffolds the new template; a consumer
  who does not is unaffected.
- **Why now.** It ships after the October 20 flip, not before — the pre-freeze queue does not fit
  as it is (`docs/plans/roadmap.md`). Recorded now because the design is finished and because two
  rows collide with Arc HYG (HYG5's `pollGamepads` seam, HYG2's `AppLifecycle` docstring), which the
  arc that runs second needs to know.

## Alternatives considered

- **A DOM + CanvasKit host with no `react-native-web`.** Built on `@flare-engine/render-web`,
  whose `PostFxSurface` has a working postfx path and a real `resize()` — genuinely better on the
  one axis where the chosen route is broken (postfx renders nothing on web,
  `docs/plans/web-target-2026-08.md`:435-437). Rejected: a second `GameView` to keep in sync
  forever, and it abandons "same code everywhere" for anything built on RN components. Named in
  "What would reverse this".
- **react-native-windows / react-native-macos.** Rejected on the Skia fact in Context §3. It would
  also give nothing on Linux or Steam Deck.
- **An OS-webview shell (Tauri v2, Wails, Neutralino).** Far smaller binaries. Rejected because all
  of them use WebKitGTK on Linux, whose WebGL path Tauri's own troubleshooting documentation records
  as unreliable and which masks `WEBGL_debug_renderer_info` so an app cannot detect being dropped to
  software rasterization. Linux is the Steam Deck; that is disqualifying for a CanvasKit/WebGL
  pipeline. Ultralight was also considered and is disqualified separately: it supports no WebGL at
  all.
- **Shipping Steam support inside the existing interface packages** rather than as adapters.
  Rejected: it would put a Node-native binding in the dependency graph of packages that must run in
  React Native and in a browser. The lazy-`import()` adapter boundary `iap-revenuecat` already
  establishes is the reason that problem has a known answer.

## What would reverse this

- **Upstream never fixes RN-Skia's `<ImageShader>` per-paint leak.** If postfx-on-web stays broken
  long enough that shader-driven games cannot ship on desktop, the rejected DOM+CanvasKit host
  becomes the better route, because `render-web`'s postfx path works.
- **No bundled-Chromium shell delivers gamepad input on a Steam Deck under Steam Input.** If DESK-1
  finds the `electron/electron#45732` class of failure in both Electron and NW.js with no acceptable
  mitigation, the Deck claim in the platform matrix is unsupportable and the design is rewritten
  rather than executed.
- **CanvasKit gains a production WebGPU backend.** Removed in Chromium M118 with Dawn now backing
  only Graphite, and Skia's team has said the work needs significant iteration. If that reverses,
  the renderer assumptions in the design doc's §10 R2 are worth re-deriving.
- **Valve changes the SDK Access Agreement's redistribution terms.** The "never commit the SDK"
  constraint is downstream of it.
