# Flare on the desktop — a Steam delivery target (design, 2026-09-08)

Design SoT for making a Flare game shippable on Steam for Windows and Linux, including Steam Deck,
from the same source that builds the native app and the browser build. Row pointers live in
[todo.md](todo.md) **Arc DESK**; full row specs live here.

**The point of the work:** Arc WEB proved a scaffolded Flare app boots and renders in a browser
(WEB-5, 2026-08-24). A browser build that runs is one packaging step away from a desktop build that
runs, and desktop is the only distribution channel where a 2D indie engine meets an audience that
pays. The gap between the two is not the renderer — it is that the engine has no mouse, no window,
no lifecycle and no store integration, because nothing it has ever shipped on needed them.

**Status:** APPROVED 2026-09-08 (shape + platform matrix + timing). Not yet executed. Runs after the
October flip.

**Decisions taken (do not re-litigate):**

1. **This is an engine capability, not a ship path for one game.** Owner decision 2026-09-08. Any
   Flare consumer gets the desktop target; the arc is judged on whether a freshly scaffolded app
   reaches a Steam-uploadable build, not on whether a particular title ships.
2. **First cut is Windows + Linux, with Steam Deck an explicit target. macOS is deferred.** Owner
   decision 2026-09-08. macOS costs an Apple Developer account, notarization and a third signing
   pipeline for a small share of Steam; it is a later row, not a v1 gap. Deck being in scope is what
   forces §3's shell constraint and pulls controller work into §5.
3. **Post-flip. Nothing in this arc runs before Oct 23.** Owner decision 2026-09-08. Consistent with
   Arc HYG's placement and with `roadmap.md`'s capacity arithmetic, which already does not fit the
   pre-freeze queue into the remaining sessions. Desktop is not launch-critical to the October scope.
4. **The desktop runtime is the existing Expo/Metro web export inside a bundled-Chromium shell.**
   There is no second host implementation and no `react-native-web`-free DOM host. Rejected
   alternatives and why in §3.
5. **The shell is not an engine package.** No `@flare-engine/*` package ever depends on Electron,
   NW.js or any shell. The shell ships as a `create-flare-app` template, which is the same boundary
   `iap-revenuecat` draws for a native SDK: the engine owns the contract, the app owns the runtime.
6. **Steam integration ships as adapter packages against the existing Tier-2 interfaces.** No new
   interface packages, no new provider abstraction. `achievements-steam` and `leaderboards-steam` at
   tier 3.5 following `iap-revenuecat` exactly (§6), and a Steam Cloud `StorageAdapter` at tier 2.5
   following `createMmkvAdapter` exactly.
7. **Electron vs NW.js is decided by DESK-1 on measured evidence, not here.** §4 states the criteria
   and the one known disqualifier. A design doc that picks a shell before anyone has run a gamepad
   on a Deck under Steam Input is guessing, and the specific risk in §4 is exactly the kind that
   invalidates a shape rather than costing a row.
8. **postfx stays broken on web and therefore on desktop.** It is an upstream RN-Skia defect
   (§10 R1). This arc documents the limitation in the consumer-facing docs and does not build a
   workaround for it.

---

## 1. What exists today (verified 2026-09-08 at HEAD `2ae80cc`)

Read this table before planning any row. Most of the desktop story is already paid for; the arc is
sized by §2, not by this section.

| Layer | State | Evidence |
|---|---|---|
| A Flare app in a browser | **Ships.** A `create-flare-app` scaffold of `blank`, installed from a registry, renders in Chrome over a 67-second run with a live WebGL context and a clean console | [web-target-2026-08.md](web-target-2026-08.md) §17; `SESSION_LOG.md` session 278 |
| How that web build is produced | Expo + Metro. `expo start --web`, `registerRootComponent`, `getDefaultConfig` from `expo/metro-config` | `packages/create-flare-app/templates/blank/{package.json,metro.config.js,index.web.ts}` |
| What supplies `react-native` in that build | `react-native-web` (`~0.21.0`), a plain dependency of each template | `packages/create-flare-app/templates/*/package.json` |
| The host component | `GameView` — wires GameLoop, InputManager, AudioManager, AssetManager, SceneManager, Renderer and Camera2D end to end, with one runtime web branch | `packages/react/src/game-view.tsx:165` |
| Web/native split mechanism | A runtime `Platform.OS` branch inside one bundle. **`.web.tsx` siblings do not work for engine packages** — `packages/react` builds a single tsdown entry, so a `.web.tsx` source file is bundled away | [web-target-2026-08.md](web-target-2026-08.md):330-336 |
| Optional web peers | `react-native-web` and `canvaskit-wasm` are **optional** peer deps, exactly as Arc WEB specified | `packages/react/package.json:53-70` |
| Game loop pacing | Host-controllable already. `tick`/`cancelTick` are public fields defaulting to `requestAnimationFrame`; fixed-timestep accumulator + `alpha` interpolation both present | `packages/core/src/game-loop.ts:41-43`, `:114-139` |
| Audio | Structurally neutral. `AudioContextLike` is a narrowed standard Web Audio surface; `AudioManager.init(factory)` takes an injected context, so a Chromium `AudioContext` satisfies it unchanged | `packages/audio/src/audio-manager.ts:44-53`, `:82-85` |
| Storage | Drop-in. `StorageAdapter` is five async string methods; `createIndexedDbAdapter()` works in a Chromium renderer with no change | `packages/storage/src/adapter.ts:8-19`, `indexeddb-adapter.ts:74` |
| Keyboard | Real. Per-`KeyboardEvent.code` state, buffered edges, OS auto-repeat de-duplicated, `blur` force-releases held keys | `packages/input/src/keyboard.ts:49-100`, `:114-137` |
| Gamepad | W3C Standard Gamepad, 17 buttons + 4 axes, analog trigger values, per-axis remap table with persistence | `packages/input/src/gamepad.ts:22-60`, `remap.ts:12-21` |
| Adapter-package precedent | `@flare-engine/iap-revenuecat` — tier 3.5, `create*Provider(config)` factory, lazy `await import()` of the native SDK, memoized configure promise, no-throw contract, hand-rolled structural SDK types, no registration mechanism | `packages/iap-revenuecat/src/provider.ts:91-183` |
| RN-free import surface | `@flare-engine/engine/headless` exists and is the correct entry for a non-RN build | `packages/engine/src/headless.ts:1-5`, `package.json:31-40` |

**A correction this table makes to the record.** The gap analysis that produced this doc initially
reported that `@flare-engine/ui`, `ui-shop` and `devtools` "have no web equivalent" because their
components import `react-native`. That is wrong: `react-native-web` *is* their web implementation,
and it is already a template dependency. The true statement is weaker and different — **no template
exercises `ui` or `ui-shop`, so neither is proven on web**, and `devtools`' HUD deliberately returns
`null` there (`packages/devtools/src/hud.tsx:10`). DESK-1 confirms or refutes this.

---

## 2. What is actually missing

Four groups. Only the third is large.

**(a) Mouse is not a first-class input.** `Pointer` is documented as "primary touch (or the mouse)"
and the merge loses everything a desktop game needs. `InputManager.onPointerDown/Move/Up(id, x, y)`
takes no button parameter (`packages/input/src/input-manager.ts:66-91`), so there is no
left/middle/right discrimination; there is no wheel; there is no cursor lock or hide. And there is a
live functional bug, not merely a missing feature: `onPointerMove` forwards to `pointer` only when
`id === this._primaryTouchId` (`input-manager.ts:77-82`), and `_primaryTouchId` is assigned only
inside `onPointerDown` (`:67-68`) — **so a mouse that moves without being pressed never updates
`pointer.position`.** Every hover, reticle and cursor-driven menu is broken on desktop today.

**(b) Keyboard and gamepad have desktop-shaped holes.** `KeyboardEventLike` carries only `code` and
`type` (`keyboard.ts:10-15`) — no modifier state at all, so chords must be hand-rolled from key
codes. Gamepad hot-plug is poll-only: `createWebGamepadSource` reads `navigator.getGamepads()` and
never listens for `gamepadconnected`/`gamepaddisconnected` (`gamepad-source.ts:39-62`), and a
disconnect surfaces only as a `null` snapshot on the next poll (`gamepad.ts:126-143`). There is no
rumble anywhere: `packages/input` never touches `vibrationActuator`, and `packages/haptics` drives
device vibration, which cannot reach a gamepad motor.

**(c) Display and lifecycle are implemented but dead.** This is the largest item and the least
obvious. `ScreenManager` is a complete resolution-independence primitive — `designWidth`/
`designHeight`, `fit`/`fill`/`stretch`, `pixelRatio`, safe-area insets, `designToScreen`,
`onResize` (`packages/core/src/screen.ts`) — and **nothing instantiates it.** `GameView` reads RN's
`onLayout` and calls `ctx.camera.setViewport(width, height)` directly
(`packages/react/src/game-view.tsx:302-309`), and `Camera2D.setViewport` is a raw pixel setter with
no letterbox logic (`packages/render/src/camera2d.ts:135-138`). `AppLifecycle` is the same story: it
has `onBackground`/`onForeground`/`onMemoryWarning` and pauses the loop
(`packages/core/src/app-lifecycle.ts`), its docstring claims it "bridges React Native AppState", and
**nothing subscribes to anything** — `GameView` never constructs it. Beyond those two, there is no
fullscreen concept anywhere in `packages/**` (repo-wide grep: zero hits), and
`createWebSurface` binds one surface to one `<canvas>` at creation with no resize path
(`packages/render-web/src/web-surface.ts:39-65`), though `PostFxSurface.resize()` does exist
(`postfx-surface.ts:50`).

A resizable desktop window and a Deck's fixed 1280×800 both need exactly what `ScreenManager`
already implements. The arc's job is wiring, not design.

**(d) There is no Steam anything.** No adapter, no docs, no mention of Steam as a delivery target
anywhere in `docs/` — the only two hits are `api-specs.md:829,850` naming Steam as a *future*
platform adapter for the leaderboards and achievements interfaces, post-launch.

---

## 3. Approach — and the two rejected

**Chosen: the Expo web export, loaded by a bundled-Chromium shell.** The shell is a thin native
wrapper whose renderer process loads the static bundle `expo export --platform web` already
produces. Nothing about the engine's rendering, React or asset path changes; the browser build and
the desktop build are the same artifact with a different loader. Steam integration runs in the
shell's Node side and reaches the game through the existing provider interfaces.

This is chosen because it reuses the one path that has been proven to run (§1) and because every
engine fix in §5 improves the browser target at the same time — the mouse bug, the dead
`ScreenManager` and the missing lifecycle wiring are web defects that desktop merely makes
unavoidable.

**Rejected: a DOM + CanvasKit host that drops `react-native-web`.** A second host built directly on
`@flare-engine/render-web`, with no RN in the module graph. Genuinely attractive on one point —
`render-web`'s `PostFxSurface` has a working postfx path and a real `resize()`, so shaders would
work on desktop where the RN-Skia web path is broken (§10 R1). Rejected because it is a second
`GameView` to keep in sync forever, it abandons the "same code everywhere" claim for anything built
on RN components, and it trades a documented upstream bug for a permanent maintenance burden. If
upstream never fixes postfx-on-web, this becomes worth reopening — that is the trigger, not a
general preference.

**Rejected: react-native-windows / react-native-macos.** A native RN desktop target rather than a
web one. Dead on a single fact: **`@shopify/react-native-skia` does not support Microsoft's
`react-native-windows` or `react-native-macos`.** Its installation docs list iOS, Android, Web, tvOS
and Apple macOS via react-native-tvos, and the standing feature request for Windows/macOS support
(Shopify/react-native-skia#2058, opened 2023-12-14) is closed without implementation. Note the docs'
"macOS" entry means Apple's macOS through react-native-tvos, which is a different project from
Microsoft's `react-native-macos`; do not conflate them in consumer-facing prose. Without Skia there
is no renderer, so this route cannot host Flare at all, and it would give nothing on Linux or Deck
regardless.

---

## 4. The shell question is not decided here

Two candidates survive the Deck constraint, and DESK-1 picks between them.

**Only a bundled-Chromium shell qualifies.** Every OS-webview shell — Tauri v2, Wails, Neutralino,
Electrobun in its default mode — uses WebKitGTK on Linux, whose WebGL path is documented by Tauri's
own troubleshooting guide as unreliable, and which masks `WEBGL_debug_renderer_info` so an app
cannot even detect that it has been dropped to software rasterization. That is disqualifying for a
CanvasKit/WebGL pipeline whose Linux target is the Steam Deck. Ultralight is separately disqualified:
it is purpose-built for games and much lighter than Chromium, but it **does not support WebGL at
all**.

**Electron** is current (v44.x on Chromium 152, three supported majors, MIT, commercial
redistribution fine) and is the larger ecosystem. **NW.js** is not the legacy option it is often
assumed to be — v0.115.0 shipped 2026-08-18 on Chromium 152, the same Chromium, on a roughly monthly
cadence — and it has more real Steam shipping precedent for this exact scenario than Electron does.

**The one known disqualifier, and DESK-1's primary question.** `electron/electron#45732`: from
around Electron v27, gamepads — including a Steam Deck's built-in controls — stop being detected
when Steam Input is enabled and the app is launched through Proton. The issue was **closed "not
planned"** in February 2025; reporters name v26.6.10 as the last known-good. If this reproduces and
has no acceptable mitigation, Electron cannot serve decision 2's platform matrix and NW.js takes the
slot. If NW.js reproduces it too, the arc's Deck claim needs rewriting before any other row runs.

**Decision criteria for DESK-1**, in order: (i) gamepad reaches the game on a Deck with Steam Input
enabled; (ii) the CanvasKit WebGL context is hardware-backed, verified by reading the renderer
string rather than by assuming; (iii) frame pacing is controllable and the loop is not throttled;
(iv) packaged size and cold start are within sight of each other. Ecosystem size breaks a tie;
nothing else does.

**A packaging wrinkle either shell must solve.** `index.web.ts` hardcodes
`locateFile: (file) => '/' + file` for `canvaskit.wasm`
(`packages/create-flare-app/templates/blank/index.web.ts`), which resolves against an origin. Under
a `file://` load there is no origin and the WASM fetch fails. The fix is either a loopback HTTP
server inside the shell or a shell-aware `locateFile`; DESK-1 reports which, and DESK-11 implements
it.

---

## 5. Engine rows — input, display, lifecycle

All rows are `packages/**` → engine-builder. Each is consumer-observable and therefore needs a
changeset; the arc as a whole is covered by ADR-0005
([adr-0005-desktop-delivery-target.md](../design/adr-0005-desktop-delivery-target.md)).

- **DESK-2 — mouse as a first-class input.** Fix the hover bug at `input-manager.ts:77-82` first: a
  pointer move with no prior press must update `pointer.position`. Then add button discrimination
  (left/middle/right) to the `onPointer*` signatures, a wheel/scroll channel, and cursor lock/hide
  as a host-driven capability rather than a DOM call inside `packages/input`. The touch contract
  must not regress — `Pointer`'s existing shape stays, and the new surface is additive, in keeping
  with the repo's `…Into`-twin convention for anything hot.
- **DESK-3 — keyboard modifiers.** Extend `KeyboardEventLike` with modifier state and expose a
  modifier query alongside the existing `isActionDown` family, so a chord is expressible without
  binding `ControlLeft` as an ordinary code. Structural, no DOM types.
- **DESK-4 — gamepad connect/disconnect + rumble.** Make `createWebGamepadSource` listen for
  `gamepadconnected`/`gamepaddisconnected` instead of inferring from poll results, expose a
  connect/disconnect `Signal`, and add rumble through `GamepadHapticActuator`. Rumble belongs in
  `packages/input` next to the pad it drives, not in `packages/haptics`, which is a device-vibration
  package and cannot reach a controller motor. **Sequencing note:** this row touches
  `pollGamepads` and `GamepadSource.poll()`, whose fresh-object contract was settled by Arc HYG's
  HYG5 precondition on 2026-09-07 — read that before planning.
- **DESK-5 — wire `ScreenManager` into the real render path.** Replace `GameView`'s direct
  `camera.setViewport(w, h)` (`game-view.tsx:302-309`) with a `ScreenManager` that owns design
  resolution, scale mode, pixel ratio and safe area, and drives the camera from it. This is the row
  that makes a resizable window and a 1280×800 Deck screen both work, and it retires the largest
  piece of dead code in the engine. **Behaviour risk:** every existing consumer currently gets raw
  viewport pixels; a default of `stretch` at the real viewport size preserves that exactly, and any
  other default is a silent break. State the default in the changeset.
- **DESK-6 — wire `AppLifecycle`; pause and resume on window blur.** Construct it in `GameView`,
  subscribe it to the platform's real signals, and route audio suspend/resume through it —
  `AudioManager.suspend()`/`resume()` are documented as manual-only today
  (`packages/audio/src/audio-manager.ts:87-99`). Generalize the keyboard's `blur` stuck-key clear so
  it fires from the same place. **Note:** Arc HYG's HYG2 plans to correct `AppLifecycle`'s
  docstring to say "manual adapter". If DESK-6 lands first it makes that row moot; if HYG2 lands
  first, DESK-6 makes its docstring wrong again. Whichever runs second owns the reconciliation.
- **DESK-7 — window and display host surface.** Fullscreen toggle, resize-driven surface
  recreation, and DPI-change handling, expressed as a contract the host implements rather than as
  engine code that calls a browser API. `createWebSurface` needs a resize path
  (`packages/render-web/src/web-surface.ts:39-65`); `PostFxSurface.resize()` already exists and
  should be driven from the same place. Decide placement during planning: the strong prior is a
  bounded addition to `packages/core` next to `ScreenManager`, **not** a new package.

---

## 6. Steam integration rows

The shapes are fixed by precedent, not invented here. Read `packages/iap-revenuecat` before planning
any of these; §1's last row lists what the pattern is.

- **DESK-8 — `@flare-engine/achievements-steam`.** Tier 3.5 in `LAYER_MAP`, depends on
  `@flare-engine/achievements`, peer-depends on the chosen Steamworks binding only. One
  `createSteamAchievementsProvider(config): AchievementsProvider` factory; the binding reached by
  `await import()` inside methods so no module-graph edge exists for RN or browser consumers;
  a memoized init promise rather than a boolean, per `provider.ts:91-131`; every method try/catches
  and honours the no-throw contract; SDK types hand-rolled structurally in `src/types.ts`, never
  imported from the binding's own `.d.ts`. No `isAvailable()` — the documented fallback is the
  consumer selecting `NoopAchievementsProvider` behind its own env flag.
- **DESK-9 — `@flare-engine/leaderboards-steam`.** Identical shape against
  `LeaderboardsProvider`'s `submitScore`/`getTopN`/`getPlayerRank`
  (`packages/leaderboards/src/provider.ts:19-23`).
- **DESK-10 — Steam Cloud `StorageAdapter`.** This one follows a *different* precedent: `storage` is
  a pure factory-adapter package with no React binding and no Noop, so the row is
  `createSteamCloudAdapter(handle: SteamRemoteStorageLike): StorageAdapter` with the handle injected
  and its type declared locally, exactly as `createMmkvAdapter` avoids a peer dep on
  `react-native-mmkv` (`packages/storage/src/mmkv-adapter.ts:4-14`). Tier 2.5. Do not give it a
  context or a hook.

**Which Steamworks binding.** Three exist; DESK-1 picks one and this doc records it. `steamworks.js`
(MIT, Rust/N-API, built for Electron and NW.js) is the incumbent but its npm publish is ~2 years
stale against a repo that kept moving. `greenworks` is maintained best-effort and its maintainer
says active development is not a priority. `steamworks-ffi-node` (MIT, Koffi FFI, no native
compilation) claims by far the widest surface including Steam Input, but is young and
single-maintainer; treat its feature list as claimed until exercised.

**The licensing constraint, and it is firm.** Valve's SDK Access Agreement permits redistributing
only the `redistributable_bin` contents, only bundled inside finished software. The Steamworks SDK
itself is therefore **never committed to this repo** — a consumer downloads it under their own
partner account. Wrapper code stays Apache-2.0 like the rest of the engine. All three bindings above
already work this way, and Valve separately lists Apache-2.0 as fine for a Steam-distributed app.
DESK-8's README must state this; a contributor who vendors the SDK to make CI green has created a
licensing problem, not a convenience.

---

## 7. Scaffolder, docs and proof rows

- **DESK-11 — `desktop` template in `create-flare-app`.** A fourth template carrying the shell, its
  build config, the `locateFile` fix from §4, and Steam Deck's hard requirements met by
  construction: a default controller configuration that reaches all content, on-screen glyphs that
  never show keyboard prompts under gamepad control, legible text at 1280×800, and — if the shell
  needs any pre-game window at all — one that is fully gamepad-navigable, which is the rule that
  most often fails a web-shell game.
- **DESK-12 — desktop documentation and its limitations page.** `api-specs.md` rows for every new
  export, a desktop guide, and an explicit limitations section: postfx does not render (§10 R1),
  CanvasKit is WebGL and there is no WebGPU path (§10 R2), macOS is not supported in this cut, and
  whatever DESK-1 finds about Deck controllers. The repo's standing rule applies with force here —
  **whoever implements a row drafts its consumer-facing prose**; this section is not to be written
  from this design doc's text by someone who did not touch the code.
- **DESK-13 — proof: a scaffolded desktop app reaches a Steam-uploadable build.** The arc's exit
  gate. A `create-flare-app --template desktop` scaffold, built for Windows and Linux, launched from
  a Steam depot, gamepad working, achievements firing against a real appid. Not a published store
  page — an uploadable build. Steam Direct is $100 per title and recoupable at $1,000 revenue; the
  standard split is 70/30 to $10M. The web upload UI caps at 2GB, above which SteamPipe's CLI with
  delta patching is the path — relevant because a bundled Chromium starts around 150MB before any
  game content.

---

## 8. Sequencing and gates

**DESK-1 gates everything.** It is a spike: its output is a findings section appended to this
document (§12 onward, following [web-target-2026-08.md](web-target-2026-08.md)'s pattern), and
whatever code it produces is throwaway and labelled as such. It answers, in order: does the Expo web
export load in each shell at all; does §4's `locateFile` problem bite and which fix works; is the
WebGL context hardware-backed on both OSes; does the Deck gamepad regression reproduce; do `ui` and
`ui-shop` actually render through `react-native-web` (§1's open question); which Steamworks binding
builds cleanly on Windows and Linux.

**If DESK-1 finds no shell that passes its first criterion, the arc stops and this document is
rewritten.** That is the point of gating on it.

After DESK-1: §5's rows (2–7) are independent of the shell and can run in any order, and each is
independently valuable to the browser target — if the arc were abandoned after them, nothing is
wasted. §6's rows depend only on the binding choice. DESK-11 depends on the shell choice and on §5.
DESK-12 and DESK-13 close.

Gates are the repo's standard sequence in `.claude/hooks/verify.sh`, plus the two that a new package
specifically trips: `check:deps` fails any package missing from `LAYER_MAP` in
`scripts/check-deps-tiers.mjs`, and `check:bump` refuses the arc's minor unless ADR-0005 is
`Accepted`. Adding packages also moves the count that
`docs/design/architecture.md:11` owns as its single source — update it there, and note the repo's own
outstanding finding that it is mirrored in roughly eighteen prose sites
(`pre-flip-audit-2026-09-findings.md:1642`).

---

## 9. Corrections to existing SoTs (edit in place, one source per fact)

Found while auditing for this design, and applied in the same commit that adds it.

1. **[web-target-2026-08.md](web-target-2026-08.md) §14 and §16 are stale on the safe-area claim.**
   Both record that `GameView`'s `safeArea` JSDoc is false and that fixing it was deliberately out
   of scope. It was fixed on 2026-09-07 by Arc PFA's PF-7:
   `packages/react/src/game-view.tsx:159-160` now reads
   `useContext(SafeAreaInsetsContext)` and falls back to `ZERO_INSETS`, which never throws. Both
   passages are corrected in place.
2. **[roadmap.md](roadmap.md)'s positioning line was never given the caveat Arc WEB required.**
   `web-target-2026-08.md` §10 correction 2 said the "same code on Web + React Native" claim becomes
   backed at WEB-H4 and until then describes the renderer and headless sim only. WEB-H4 has not run;
   the line still carries no caveat. Corrected.
3. **[manual-test-protocol.md](manual-test-protocol.md) M1 was never updated.** §10 correction 3
   said M1 should name the now-real scaffolded web build; it still reads "a scaffolded/topdown web
   build (or a page demo)", hedged as if the build were hypothetical. Corrected.

Items 2 and 3 are Arc WEB's own mandated corrections, unexecuted since 2026-08-21. They are applied
here because this arc's first row depends on knowing exactly how far the web claim actually reaches.

---

## 10. Risks

- **R1 — postfx renders nothing on web, and therefore nothing on desktop.** An upstream RN-Skia
  `<ImageShader>` per-paint leak; `web-target-2026-08.md`:435-437 records that a postfx-using game
  renders unfiltered in a browser. Any game whose look depends on shaders gets a materially
  different desktop build. Mitigation is documentation (DESK-12), not code — decision 8. If upstream
  fixes it, nothing here changes; if upstream never does, §3's rejected DOM host becomes worth
  reopening, since `render-web`'s postfx path works.
- **R2 — CanvasKit is WebGL-only for the foreseeable future.** WebGPU support was scaffolded into
  CanvasKit around v0.35.0, but the Dawn-on-Ganesh backend was removed in Chromium M118 and Dawn now
  backs only Skia's newer Graphite; Skia's team has said the work "will likely take significant
  iteration". Chromium still gates WebGPU behind a flag. Plan on WebGL; do not write a roadmap line
  that implies otherwise.
- **R3 — the Deck gamepad regression may have no clean mitigation.** §4. This is the risk that can
  invalidate the arc's shape rather than cost it a row, which is why DESK-1 exists.
- **R4 — a bundled Chromium is ~150MB before any content.** Irrelevant to Steam users, relevant to
  depot mechanics (§7 DESK-13) and to anyone assuming the engine's tiny package sizes carry over.
- **R5 — two rows collide with Arc HYG.** DESK-4 touches the `pollGamepads` seam HYG5 plans to make
  zero-alloc; DESK-6 makes HYG2's planned docstring correction wrong. Both are noted on the rows.
  Whichever arc runs second owns the reconciliation; neither is a blocker.
- **R6 — `create-flare-app` gains a template with a pinned shell version.** The engine does not
  depend on Electron or NW.js (decision 5), but the template does, and a template's pins are a
  maintenance surface — Arc WEB already learned this when a `^0.40.0` / `0.41.0` CanvasKit split
  broke a scaffold (`web-target-2026-08.md` §17). Pin exactly and treat shell bumps as a real row.

---

## 11. Out of scope for this arc

Named so a later reader does not read absence as oversight: macOS (decision 2); Steam Input action
sets and full glyph theming beyond what Deck Verified requires; Steam Workshop; P2P networking and
matchmaking; Steam's overlay-dependent features beyond what the chosen binding exposes for free;
any storefront other than Steam; and the Steam Machine and Steam Frame, whose Verified programs
Valve announced for summer 2026 and which a Deck-Verified title reportedly inherits for the Machine
— worth revisiting once the Deck path actually works, not before.
