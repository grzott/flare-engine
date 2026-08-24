# Flare Engine — web target: PT + scaffolder (design, 2026-08-21)

Design SoT for making a Flare game run in a browser from the same source that builds the native
app — the claim `roadmap.md` already makes publicly, which today holds for the renderer and the
headless sim but not for an app.

Owner-approved 2026-08-21.

**The point of the work:** `@flare-engine/render-web` gives the engine a CanvasKit renderer, and
`apps/bench-web` proves it across three lanes. Neither carries the React layer, so no Flare *game*
has ever run in a browser. The public positioning line (`roadmap.md:11`, "runs the same code on
Web + React Native") is therefore unbacked at the app level going into an October flip. This arc
backs it, on Pan Tvardowski and on all three `create-flare-app` templates.

**Decisions taken (do not re-litigate):**

1. **Approach: platform resolution, no new engine surface.** `packages/react` keeps one
   `GameView`; native-only code gets `.web.tsx` siblings resolved by the bundler. `react-native-web`
   and `canvaskit-wasm` become optional peer deps. No new package, no new barrel, no new exported
   API. Rejected alternatives in §3.
2. **`@flare-engine/render-web` keeps its current role.** It is the headless CanvasKit renderer for
   benches and the page. It is explicitly *not* the base of a web host layer — that route
   (extraction-audit-2026-06 §"A2") was correct for a renderer with no React layer and is the wrong
   shape for shipping a game. Nothing in this arc changes render-web.
3. **0.3.0 publishes *with* the web changes.** Owner decision 2026-08-21. 0.3.x absorbs whatever
   PT-on-web discovery finds; 0.4.0 stays the launch cut. Consistent with the standing version
   decision in [consumer-enablement-2026-08.md](consumer-enablement-2026-08.md).
4. **The cut gates on execution, not on PT.** The publish requires the WEB-1 boot spike and the
   WEB-5 real-scaffold browser boot to be green — the web contract must have run in a browser at
   least once. It does not require PT. Rationale in §8.
5. **Hosting: own subdomain, own Worker.** `play.flareengine.dev` (name confirmed at WEB-H1) as a
   separate Cloudflare project, so CanvasKit's wasm payload never enters the docs site's
   Lighthouse-100 budget and the game gets an honest budget of its own.
6. **Input: auto-detect.** Desktop gets keyboard + gamepad; touch devices keep PT's existing
   on-screen joystick. A hosted URL gets opened on phones whether or not it is planned for.
7. **The news post ships with the playable URL, not with the publish.** 0.3.0 is `restricted`;
   announcing at publish time would describe something no reader can install. WEB-H4.

---

## 1. What exists today (verified 2026-08-21)

Read this table before planning any row. The arc is small *because* of it — the engine is
injection-based almost everywhere it would otherwise be native-bound.

| Layer | State | Evidence |
|---|---|---|
| RN-Skia web build | **Ships.** `LoadSkiaWeb` / `WithSkiaWeb` + `canvaskit-wasm@0.40.0`; `JsiSkSurfaceFactory.MakeOffscreen` implemented for web | `@shopify/react-native-skia@2.4.18/lib/module/web/`, `lib/module/skia/web/JsiSkSurfaceFactory.js` |
| The exact hook `GameView` renders through | **Already web-aware.** `usePictureAsTexture` branches on `Platform.OS === 'web'` and calls `makeImageSnapshot().makeNonTextureImage()` | `lib/module/external/reanimated/textures.js:53` |
| `packages/input` | **Web-ready by construction.** `KeyboardEventTargetLike` + `attachKeyboardListeners`, W3C Standard Gamepad indices, structural pointer state, no DOM type dep | `packages/input/src/{keyboard,pointer,gamepad}.ts` |
| `packages/assets` | **Platform-agnostic.** `AssetManager` takes an injected `AssetLoader`; `decodeImage(Skia, bytes)` works against any Skia | `packages/assets/src/{asset-manager,decode-image}.ts` |
| `packages/storage` | **Has a web adapter already.** `indexeddb-adapter.ts` alongside `mmkv-adapter.ts` | `packages/storage/src/` |
| `packages/audio` | Structural `AudioContextLike`; no hard binding | `packages/audio/src/`, PT `src/audio/init.ts` |
| PT native deps | **All four ship web builds.** `react-native-audio-api/lib/module/api.web.js` + `web-core/`; `react-native-mmkv/createMMKV.web.js`; gesture-handler `lib/module/web/`; worklets `SHOULD_BE_USE_WEB` in `platformChecker.js` (so `runOnUI` degrades to sync JS) | PT `node_modules/` |
| PT audio assets | **None to port.** Audio is fully synthesized — `createSfxBuffers` / `createMusicBuffers` | PT `src/audio/synth.ts` |
| `react-native-safe-area-context` | Ships `NativeSafeAreaProvider.web.js`, `SafeAreaView.web.js` | PT `node_modules/` |
| `packages/devtools` | Already carries a `Platform.OS === 'web'` branch | `packages/devtools/src/hud.tsx` |

## 2. What is actually missing

1. **`packages/react` declares no web peers and has no web path.** `game-view.tsx` imports
   `@shopify/react-native-skia` and `react-native` unconditionally; its own comments name a
   "future web fallback" that was never built. No `Platform` guard exists anywhere in the package.
2. **The scaffolder emits native-only apps.** All three templates ship `start` / `android` / `ios`
   and no `react-native-web`, `react-dom`, or `@expo/metro-runtime`.
3. **PT has no web entry** — same three installs missing, no `web` script, no web block in
   `app.json`.
4. **Nothing anywhere awaits `LoadSkiaWeb()`** before mounting a Skia tree, which web requires.
5. **No `canvaskit.wasm` is served** by any app but `bench-web`.

Note what is *not* on this list: a renderer, an asset path, an input tier, a storage backend.

## 3. Approach — and the two rejected

**Chosen — platform resolution.** One `GameView`, `.web.tsx` siblings where genuinely needed,
optional peer deps, app-level `LoadSkiaWeb()` gate. Zero API-surface growth five weeks before an
OSS freeze, nothing to deprecate, and the positioning claim becomes literally true: same import,
same component, both platforms.

Its one real cost: `.web.tsx` resolution is bundler magic that `tsc` cannot see, and non-Metro
consumers need documented aliases. Mitigated in §9 — and if WEB-1 shows no `.web.tsx` is needed at
all, the cost is zero and the mitigation is dropped under YAGNI.

**Rejected — `@flare-engine/react/web` subpath.** A second `WebGameView` behind an explicit import.
Typechecked and bundler-agnostic, but it doubles the component surface right before the freeze,
creates two implementations to keep in sync forever, and makes consumers branch their imports —
which is the precise opposite of the claim being backed.

**Rejected — CanvasKit-direct host layer on `render-web`.** No `react-native-web` dependency and
the leanest runtime, but it requires reimplementing `GameView`, `ui`, `ui-shop`, `devtools`, input,
layout and safe-area, plus a parallel UI layer inside PT. It is not "same code", and it is a
multiple of this arc's cost.

## 4. Engine rows (`packages/**` → engine-builder unless marked)

- **WEB-1 — boot spike [MT].** A throwaway in-repo app on `workspace:*` deps (the pattern
  `apps/bench-web` already uses), wired for web, booted in Chrome, running a Flare game loop with
  a sprite drawing. In-repo means no cross-repo linking, so discovery is same-day. **Output is a
  gap list, not kept code** — the spike app is deleted. WEB-2/WEB-3 are specced from what it hits,
  not from what this document predicts. Timebox: one session.
- **WEB-2 — `packages/react` web enablement.** `react-native-web` + `canvaskit-wasm` as optional
  peer deps (`peerDependenciesMeta.optional`); the web contract documented in
  `docs/design/api-specs.md`. One lockstep minor changeset. **Scope set by WEB-1 (§12): the row's
  substance is fixing `GameView`'s per-frame WebGL context leak on web** — it is a real engine
  defect, not a wiring gap, and the peer-dep/doc work is trivial next to it. Read §12 in full
  before planning; it names the mechanism, the measurement, and the two candidate fixes.
- **WEB-3 — postfx on web (specced by WEB-1, 2026-08-21; NOT empty).** WEB-1 predicted this row
  might close as a no-op. It does not: `GameView`'s postfx chain is fed by the very scene texture
  whose per-frame allocation is the WEB-2 blocker, so the postfx case needs its own decision and
  its own on-screen proof. Full statement in §12 "Fix direction". `input` / `assets` / `audio` /
  `storage` did come back clean, as §1 predicted.
- **WEB-4 — scaffolder templates.** All three of `blank` / `topdown` / `shmup`: a `web` script, the
  three installs, a `LoadSkiaWeb()`-gated web entry, a `canvaskit.wasm` copy step, and README
  coverage. Read §11.4 before planning.

  Template TS is covered by `tsconfig.templates.json` (see WEB-5) — plan against that, not against
  the "templates are unchecked" assumption.

  **`create-flare-app` is `private: true` today** (verified 2026-08-21), so it publishes in no
  release until that flips at launch, and `check-changeset` exempts private packages outright.
  Two consequences: WEB-4 needs **no changeset**, and the templates do not reach any user in
  0.3.0 — they reach users when `cfa` first publishes, at the flip. WEB-4/WEB-5 still land
  pre-cut because WEB-5 is how the *engine's* web contract gets executed end to end (§8), not
  because the templates ship in that release.
- **WEB-5 — real-scaffold browser boot [MT].** Scaffold via `create-flare-app` → `bun run web` →
  renders in Chrome, for one template. This row plus WEB-1 are what the publish gates on.

  **What the existing gate already covers (corrected 2026-08-21):** `create-flare-app`'s
  `typecheck` script runs `tsc --noEmit -p tsconfig.templates.json`, which **does** include
  `templates/*/src`, `templates/*/tests` and `templates/*/index.ts`. Templates are not a
  typecheck blind spot. What that check deliberately does *not* cover, per its own shim file, is
  the templates' **pinned** versions — it resolves against the monorepo's hoisted deps (the
  Expo-55-era stack), with an ambient shim standing in for `expo`. So WEB-5 is still required, and
  for a sharper reason than "the gate is blind": it is the only check that exercises the
  templates' pinned Expo-57 stack, the `canvaskit.wasm` serving, the `LoadSkiaWeb` gate and the
  Metro web config — none of which a `tsc` pass can see.

## 5. PT rows (PT repo, its own harness — record in PT's `SESSION_LOG.md` / `todo.md`)

Run against `^0.3.0` from the registry, after the publish. Findings feed 0.3.x.

- **WEB-P1 — deps + web entry.** The three installs, `canvaskit-wasm`, a `LoadSkiaWeb()`-gated
  entry, splash handling while the wasm downloads.
- **WEB-P2 — storage on web.** Either MMKV's own `createMMKV.web.js` (zero PT code) or the
  engine's `indexeddb-adapter` (durable, owned). Decide at build; record which and why.
- **WEB-P3 — input auto-detect.** Keyboard + gamepad on desktop through the existing engine tier;
  the on-screen joystick stays the touch path.
- **WEB-P4 — audio unlock.** The browser starts `AudioContext` suspended until a user gesture. PT
  has never needed this on device; without it the game runs silent and looks broken.
- **WEB-P5 — playable pass.** A full run in local Chrome: menu → zone 1 → boss → save persists
  across reload.

## 6. Hosting and the perf bar (post-publish)

- **WEB-H1 — deploy.** Cloudflare Worker/Pages project + DNS for the play subdomain. Separate from
  the page repo's project by decision 5.
- **WEB-H2 — cross-browser.** Chrome, Firefox, Safari.
- **WEB-H3 — perf bar.** A new lane on `bench-web`'s **existing** cold-start harness, which already
  measures cold/warm cache × throttle on/off against a 4G profile
  (`apps/bench-web/scripts/coldstart-driver.mjs`). Adds: a bundle-size budget, and a
  `check-perf-freshness` entry so the lane goes stale loudly.
- **WEB-H4 — the claim.** Page link, the owner's news post, `roadmap.md:11` positioning, and the
  `manual-test-protocol.md` M1 row (keyboard on web) — all in one row, so the public claim and the
  test that checks it cannot disagree.

## 7. Sequencing

```
WEB-1 (spike)  →  WEB-2 / WEB-3 / WEB-4  →  WEB-5
                                              ↓
                                     CE-W6 — publish 0.3.0
                                              ↓
       WEB-P1 → P2 → P3 → P4 → P5  ‖  CE-W7 / CE-W8   →  0.3.x if needed
                                ↓
                       WEB-H1 → H2 → H3 → H4  →  news post
```

The hosting rows start only after **WEB-P5** — there is nothing to deploy until PT plays through
in a local browser.

WEB-2, WEB-3 and WEB-4 are independent of each other once WEB-1 lands. PT (§5) and the already
queued CE-W7 / CE-W8 run in parallel after the publish — that parallelism is the reason the cut
does not gate on PT.

## 8. Why the cut gates on WEB-1/WEB-5 and not on PT

0.3.0 is a `restricted` publish. All 41 scoped packages carry `publishConfig.access: restricted`,
and `scripts/flip-access.mjs` documents that visibility flips **retroactively across every
published version** at launch — so nothing published here is externally visible before the October
flip. The consumers are PT, `flare-engine-page` and `grzott-portfolio`: three owner-controlled
repos. A 0.3.1 costs a lockstep republish, not a reputation.

What 0.3.x cannot cheaply undo is different: **CE-W7 and CE-W8 consume 0.3.0 immediately**, and W8
syncs export surfaces into the page's public docs. Publishing a web contract that has never
executed would let the page document a shape nobody ran. WEB-1 plus WEB-5 remove exactly that, at
a cost of roughly one session — which is why they gate, and why PT's much longer playable pass does
not.

Mechanical consequence of lockstep `fixed` versioning: every 0.3.x republishes all 41 packages and
re-runs `concretize-workspace-deps`. Batch PT's findings into one 0.3.x rather than publishing per
fix.

## 9. Gates and verification

- **Per row:** the standard `/close` gate — lint → typecheck → test → build — plus one lockstep
  **minor** changeset for every row touching `packages/*/src/**`. `check-changeset` counts `src/**`
  of **publishable** packages only: it skips `private` packages and anything confined to `tests/`,
  docs or tooling (`scripts/check-changeset.mjs:11`, `:60`). So WEB-2 and any WEB-3 spillover need
  a changeset; WEB-1, WEB-4 and WEB-5 legitimately need none.
- **`check-deps-tiers`:** WEB-2's new optional peers must be declared, not phantom.
- **Web resolution check — conditional.** Only if WEB-2 actually introduces a `.web.tsx` does the
  arc add a check that every such sibling's exports match its native counterpart; `tsc` cannot see
  the resolution. If WEB-1 shows no sibling is needed, this is dropped under YAGNI, not carried.
- **WEB-5 is a browser boot, not a typecheck** — see §4.
- **The publish gate:** WEB-1 green, WEB-5 green, then CE-W6 unchanged in mechanics.

## 10. Corrections to existing SoTs (edit in place, one source per fact)

1. **[consumer-enablement-2026-08.md](consumer-enablement-2026-08.md) §10 W6** — record that the
   0.3.0 cut now also carries the WEB-2/3/4 rows, and that its gate adds WEB-1 + WEB-5.
2. **`roadmap.md:11`** — the "same code on Web + React Native" positioning line becomes backed at
   WEB-H4, not before. Until then it describes the renderer and headless sim only.
3. **[manual-test-protocol.md](manual-test-protocol.md) M1** — currently presumes "a
   scaffolded/topdown web build (or a page demo)". WEB-4/WEB-5 make the scaffolded half real;
   update the row to name it.

## 11. Risks

1. **RN-Skia's web `<Canvas>` has never run in this repo.** Upstream support is complete and
   web-aware (§1), but "supported upstream" is not "runs here". Mitigated by ordering: WEB-1 is
   first and is a spike precisely so this is discovered in a throwaway app, cheaply.
2. **Metro/webpack bundling of 41 dual-format packages.** `check-exports` / `check-nodenext` /
   `attw` guard Node resolution, not a bundler's. WEB-1 exercises the real thing.
3. **CanvasKit's wasm payload** is large enough to dominate cold start. It is the reason for the
   separate hosting project (decision 5) and for WEB-H3's budget.
4. **The template *version* gap (corrected 2026-08-21 — this is not the "typecheck is blind to
   templates" risk it was first written as).** `tsconfig.templates.json` does typecheck all three
   templates, but against the monorepo's hoisted deps rather than their pinned Expo-57 versions.
   Version-specific breakage, and everything non-type (wasm serving, `LoadSkiaWeb`, Metro config),
   still escapes it. WEB-5 against a genuine scaffold is the only check that closes that gap.
5. **Autoplay policy** (WEB-P4) — silent-game failure mode, easy to ship by accident.
6. **`makeNonTextureImage()` per frame on web.** The web path in `usePictureAsTexture` copies the
   snapshot off the GPU. This is a perf characteristic, not a correctness one, but PT's postfx
   chain is the heaviest consumer of that path and may read slower on web than the bench lanes
   suggest. WEB-H3 measures it rather than assuming.

## 12. WEB-1 findings (spike run 2026-08-21)

Spike: `apps/web-spike`, Expo SDK 55 / RN 0.83.6 / RN-Skia 2.4.18 / react-native-web 0.21.2 /
`@expo/metro-runtime` 55.0.12, Metro web, Chrome, NVIDIA RTX 4070 Ti via ANGLE D3D11. App deleted
at row close; these findings are its only output.

### What works, proven in a browser

- **Expo web + Metro bundles the workspace engine packages.** Risk §11.2 does not materialize —
  no export-map or dual-format failure. `metro.config.js` needs the standard monorepo block
  (`watchFolders` + `nodeModulesPaths` + `disableHierarchicalLookup`); with it, `workspace:*`
  engine imports resolve.
- **`LoadSkiaWeb` + a `public/canvaskit.wasm` served at `/` works.** `LoadSkiaWeb` imports
  `canvaskit-wasm/bin/full/canvaskit`, so the served binary must be `bin/full/canvaskit.wasm`
  (8.0 MB), **not** `bin/canvaskit.wasm` (7.1 MB). Serving the wrong one is an ABI mismatch.
- **Bare RN-Skia renders correctly on web** — `<Canvas><Fill/></Canvas>` fills the viewport.
- **The engine's non-React tiers all run.** `GameLoop`, ECS `World`/`Position`/`Sprite`,
  `createProceduralAtlas`, and `input`'s `createKeyboard` + `attachKeyboardListeners` all worked;
  the loop ticked 1029 frames while rendering was dead. §1's prediction that `input` / `assets`
  need no change held.

### The blocker: `GameView` kills its own WebGL context on web

**Symptom.** `TypeError: Cannot read properties of null (reading 'rangeMin')` thrown from
`WebGLRenderer.onResize` → `MakeWebGLCanvasSurface` → `_MakeGrContext`. Nothing renders. The game
loop keeps running, so the app looks alive and paints nothing.

**Root cause, confirmed by direct experiment — a per-frame WebGL context leak:**

1. [`game-view.tsx:183`](../../packages/react/src/game-view.tsx#L183) calls `setPicture(pic)` inside
   `onPreRender` — a fresh `SkPicture` **every frame**.
2. That re-fires `usePictureAsTexture`'s effect (deps `[picture, size, texture]`) every frame,
   which calls `Skia.Surface.MakeOffscreen(...)`.
3. RN-Skia's **web** `MakeOffscreen` (`skia/web/JsiSkSurfaceFactory.js`) does
   `new OffscreenCanvas(w, h)` → `GetWebGLContext` → `MakeWebGLContext`: **a new WebGL context per
   call, released nowhere.** On native the equivalent is a JSI-managed private Gr context, which is
   why this is invisible on device.
4. Chrome caps live WebGL contexts per page at **16** and evicts the oldest. Measured directly:
   creating unreleased `OffscreenCanvas` contexts in a loop, the on-screen canvas went
   `isContextLost: false → true` at **iteration 15**; of 24 created, 16 alive / 8 lost.
5. The evicted context is the on-screen `<Canvas>`'s. `WebGLRenderer.onResize` then rebuilds
   against a dead context, where `getShaderPrecisionFormat()` returns `null` — the `rangeMin` read.

Causality was proven both directions: the failing `GameView` canvas was measured lost while a fresh
canvas built a surface fine, and a **healthy** bare-Skia canvas was then killed on demand by
replaying step 4 alone.

**Note the instrumentation trap for whoever works WEB-2:** patching
`HTMLCanvasElement.prototype.getContext` logs nothing here. `MakeOffscreen` goes through
`OffscreenCanvas.prototype.getContext`, a different prototype.

### Fix direction for WEB-2 — partly proven, one open question

Compositing the per-frame picture with RN-Skia's `<Picture picture={…}/>` instead of the texture
indirection **works and is stable**: 2474 frames with the context alive, against context death
within ~16 frames on the texture path. Per-frame `SkPicture`s are not themselves the problem.

**But that only covers an empty postfx chain, and the spike did not resolve the postfx case.**
`GameView` feeds the scene texture into `<Image>` with `<RuntimeShader>` children — the texture
*is* the postfx input, so a `<Picture>` fast path has nothing for the passes to sample. Two
candidate shapes, to be decided at WEB-2 with a real postfx pass on screen:

- **`<Picture>` when `passes.length === 0`, texture path otherwise** — smallest change, but leaves
  the leak live for any game that uses postfx. PT uses postfx, so this alone does not unblock §5.
- **A size-keyed offscreen surface reused across frames** (allocate on size change, not per frame),
  replacing the `usePictureAsTexture` call on web. Preserves postfx and fixes the leak at its
  source. More engine code; likely the real answer.

This is the one item §4's WEB-3 was reserved for, and it is not empty after all. **Answered at
WEB-3 — see §14: neither candidate survives, because RN-Skia cannot bind a runtime shader as an
image filter on web at all.**

### What WEB-2 then found (2026-08-21)

The surface-reuse fix exposed a **second** per-frame leak that only appears once the first is gone.
`makeNonTextureImage()` reads the whole viewport back into CanvasKit's wasm heap; leaving the GPU
snapshot and the previous CPU image unreleased exhausts that heap and CanvasKit throws
`Aborted()` — reproduced in-browser at **frame 566** of a 1280x720 run, matching the ~800-frame
death first seen in the app. Releasing the snapshot immediately and the previous frame image one
capture later survives 1500 frames at 2560x1215.

Two corrections to §3's stated mechanics, both proven at WEB-2:

1. **`.web.tsx` siblings are not available to these packages.** `packages/react` builds a single
   bundled entry (`tsdown`, `entry: ['src/index.ts']` → `dist/index.mjs`), so a `.web.tsx` source
   file is bundled away and a consumer's Metro never sees it. Shipping platform variants would
   need a second build entry plus a new exports condition, which `check-exports` / `attw` /
   `check-nodenext` all police. WEB-2 used a **runtime `Platform.OS` branch inside one bundle**
   instead, with both hooks always called (each inert via a null picture) so hook order is stable.
   §9's conditional `.web.tsx` parity check is therefore dropped — there are no siblings to check.
2. **A GL-context-currency theory was wrong.** It looked as though a reused offscreen surface would
   need its context made current (and `CanvasKit.setCurrentContext` is `undefined` in this build,
   which would have killed the approach). Measured: a surface reads back correctly after another
   context becomes current. Reuse is sound. Do not re-derive this.

### Lockfile consequence WEB-2 must expect

Adding `react-native-web` to the workspace is **not** lock-neutral, and it does not revert when the
dependency is removed. `react-native-purchases@10.0.1` — pulled in by `@flare-engine/iap-revenuecat`
— declares `react-native-web` as an **optional peer** (`optionalPeers: ["react-native-web"]`). The
moment `react-native-web` exists in the workspace, bun satisfies that optional peer and records it,
and a later `bun install` after removing the spike **kept** it: 26 residual lines
(`react-native-web` plus `fbjs`, `cross-fetch`, `inline-style-prefixer`, `css-in-js-utils`,
`hyphenate-style-name`, `setimmediate`, …). Restoring required `git checkout -- bun.lock`.

WEB-2 should expect its `bun.lock` diff to be larger than "one optional peer dep", and should check
that the new entries are intentional rather than incidental — the concretize/publish path
(`bun run version`) reads this lockfile.

## 13. Cut under YAGNI

- **A web host layer on `render-web`** — §3.
- **A `@flare-engine/react/web` barrel** — §3.
- **Server-side rendering, offline/PWA, install prompts.** Not asked for; a game canvas gains
  nothing from SSR.
- **Web builds for `Berek` or a second template beyond WEB-5's one.** WEB-4 wires all three
  templates; proving one in a browser is enough to prove the wiring.
- **The `.web.tsx` parity check when no `.web.tsx` exists** — §9.

## 14. WEB-3 findings (browser run 2026-08-21)

Spike: `apps/web-spike` rebuilt on the §12 stack (Expo 55.0.29 / RN 0.83.6 / RN-Skia 2.4.18 /
react-native-web 0.21.2 / canvaskit-wasm 0.40.0), Chrome, viewport 2560x1215, devicePixelRatio 1.
Deleted at row close. Three render paths were compared over one identical 64-sprite scene and a
real two-pass chain (`createVignette` + `createGrayscaleFlash`, the flash intensity animating so
the uniforms change every frame).

### The row's question, answered: `<Group layer>` does not replace the readback

Not for perf reasons — **RN-Skia 2.4.18 cannot express a runtime shader as an image filter on web
at all.** `<RuntimeShader>` is an image-filter node (`NodeType.RuntimeShaderImageFilter`), and both
call sites it needs throw `Not implemented on React Native Web` unconditionally:
`Skia.RuntimeShaderBuilder` (`skia/web/JsiSkia.js:38-40`) and
`ImageFilter.MakeRuntimeShaderWithChildren` (`skia/web/JsiSkImageFilterFactory.js:8-10`).

The layer mechanism itself is sound on web — proven by ladder, cheapest first:

| Layer paint | Result |
| --- | --- |
| none (`<Picture>` alone) | renders, 587 frames, 0 context losses |
| `<Paint opacity={0.5}>` | renders, composites correctly |
| `<Paint><Blur/></Paint>` | renders, correctly blurred — image filters DO work in a layer paint |
| `<Paint><RuntimeShader/></Paint>` | **paints nothing**, throws `Not implemented on React Native Web` |

So `<Group layer>` can carry a blur but never the postfx chain, and the readback is not optional on
web: every postfx SkSL binds the scene through `uniform shader src`, which needs an `SkImage`.

### The shipped web path renders nothing

**This is a defect in what WEB-2 landed, not a limitation.** `createSceneCapture`
(`packages/react/src/scene-texture.ts`) releases the previous frame image at the moment of the next
capture. RN-Skia's web `<Canvas>` paints on its own rAF, strictly later, so that image is still in
use: `BindingError: Cannot pass deleted object as a pointer of type Image const*` is thrown from
`JsiSkImage.width` **every frame**, and the canvas stays blank. Retention sweep:

| Frame images held before release | Result |
| --- | --- |
| 1 (what shipped) | blank, `BindingError` every frame |
| 2 | blank |
| 3 | renders correctly — 1378 frames, zero console errors, no abort |

WEB-2's "survives 1500 frames" measurement was a survival check, not a render check; nothing
asserted that a pixel appeared. That is precisely the gap this row's "own on-screen proof" existed
to close, and it is why a browser proof cannot be replaced by a frame counter.

### A working web postfx shape exists, and is still not shippable

`RuntimeEffect.makeShaderWithChildren` **is** implemented on web, so the chain can be applied as
nested paint *shaders* instead of image filters — `<Fill>` wrapping `<Shader source={passN}>` …
`<Shader source={pass1}>` with `<ImageShader image={scene}>` innermost. Each `<Shader>`'s first
child fills the effect's first `uniform shader` slot, which is exactly Convention A that
`packages/postfx/src/runtime.ts:74-85` already documents. Proven on screen: the vignette darkened
the corners, and a two-pass chain composed correctly.

It is blocked by an upstream leak. RN-Skia's web `<ImageShader>` leaks a Skia object per paint when
its image changes each frame, and the CanvasKit wasm heap hits `Aborted()` at frame **~330** — 336,
333 and 327 at retention depths 3, 6 and 12 respectively, and 333 with two passes. Independent of
our retention depth and of pass count, so it is not ours to fix. The contrast is the proof: the same
scene drawn through `<Image image={scene}>` with no shader node ran **1378 frames clean**.

### What WEB-3 therefore lands

1. The retention ring fix, so the web path actually renders (`scene-texture.ts`, depth 3).
2. A web gate on postfx in `GameView` — the chain is skipped with a one-time warning instead of
   throwing every frame. Native is untouched.
3. No adoption of `<Group layer>`, and no adoption of the `<Shader>` shape until the upstream leak
   is fixed.

**Consequence for §5 and the roadmap:** PT uses postfx, so PT's browser pass renders unfiltered on
web until RN-Skia fixes the `<ImageShader>` per-paint leak. The `roadmap.md:11` positioning claim
(§10 correction 2) stays unbacked for postfx-using games regardless of WEB-H4.

### Verified after the fix (same session, same spike)

`GameView` on web renders: **2353 frames, 0 context losses, no abort, 11.7 ms median** at
2560x1215, with a two-effect chain configured — drawn unfiltered, and with no
`Not implemented on React Native Web` throw, which is the gate working. Before the fix the same
build painted solid background and threw `BindingError` every frame.

**One defect left open, and it is WEB-2's architecture rather than this fix.** Every load logs React's
`Maximum update depth exceeded` exactly once, from `useWebSceneTexture`: it calls `setImage` inside a
`useEffect` whose `picture` dependency changes every frame, so each frame schedules a render that
schedules an effect that sets state again. It is a dev-mode error, it does not stop rendering
(944-2353 frame runs all completed clean), and it reproduced on every load tested. Not folded into
WEB-3 — the row's scope is postfx, and the render defect above is already fixed. Queued as **WEB-6**.

### Two traps for WEB-4 / WEB-5

- **`GameView` throws on web without a `<SafeAreaProvider>` ancestor.** `useSafeAreaInsets()` raises
  `No safe area value available`; the prop JSDoc at `packages/react/src/game-view.tsx:91-93` claims
  it "falls back to zero insets when no provider is mounted". That is false on
  `react-native-safe-area-context` 5.6.2. A scaffolded template that omits the provider is a blank
  page plus a stack trace — WEB-4's three templates must each wrap it.
- **A backgrounded Chrome tab pauses the whole render path.** `visibilityState: hidden` stops rAF,
  and RN-Skia's web `<Canvas>` paints from rAF, so the app looks exactly like "the engine renders
  nothing" while the game loop still ticks. Any WEB-5 browser boot must assert
  `document.visibilityState === 'visible'` before believing a blank canvas.

### Lockfile note, correcting §12

The spike needed **no `bun install`** — every pinned dep was already hoisted at the workspace root
from the WEB-1 run, and Metro resolves them through `nodeModulesPaths`. `bun.lock` was untouched by
this row, so §12's "Lockfile consequence" hazard did not apply. It still applies to any row that
adds a dependency.

## 15. WEB-6 findings (2026-08-24)

The §14 diagnosis held exactly: `useWebSceneTexture` called `setImage` from a `useEffect` keyed on
a `picture` that changes every frame, and `GameView`'s `onPreRender` fed that dep with
`setPicture(pic)`. React's `NESTED_PASSIVE_UPDATE_LIMIT` is 50, so the cascade trips at roughly the
50th frame and logs `Maximum update depth exceeded` once per load.

Two consequences beyond the warning, neither previously recorded: the web path paid **two React
renders per frame** rather than one, and the captured image reached the canvas **one hop later**
than it needed to.

### The fix

`useWebSceneTexture(Skia)` is now imperative — it returns `{ image, capture }` and `GameView`'s
`onPreRender` calls `captureWebScene(pic, w * pd, h * pd)` directly. `GameLoop` schedules through
`requestAnimationFrame` (`packages/core/src/game-loop.ts:142`), so a `setImage` from that callback
is an ordinary root update and never touches the passive-update counter. The retention ring, the
surface cache and `makeNonTextureImage()` are untouched — WEB-2 and WEB-3's fixes are unchanged.

Two smaller things fell out of it:

- **`picture` state is now dead on web.** Only the native branch calls `setPicture`, which is what
  `usePictureAsTexture(isWeb ? null : picture, sceneSize)` already assumed.
- **The size source moved.** The capture takes `w * pd` from `ctx.camera.viewportWidth` instead of
  the `sceneSize` memo. Both derive from the same `onLayout` event, so the value is identical, but
  the camera read has no React-state hop in front of it.

### Evidence, and its limit

Six tests in `packages/react/tests/game-view.test.ts`; four fail against the pre-fix source
(3-ticks-3-captures 0→3, `setPicture` on web 3→0, one-surface-per-run 0→1, physical-pixel
dimensions undefined→800×1200), one covers unmount disposal (0→1), and the native-path test is a
regression guard that passes on both.

**What the unit tests cannot show is the console.** The warning is React dev-mode output; only a
browser proves it gone, and `apps/web-spike` was deleted at the end of WEB-3. The structural claim
is deductive — no setState in a passive effect means nothing increments the passive-update counter —
but it is not the on-screen proof §14 asked for. **Folded into WEB-5**: that row already has to boot
a scaffold in Chrome, so it additionally asserts the console is clean of
`Maximum update depth exceeded`. Rebuilding a throwaway spike for one console line was judged not
worth a session (owner-approved 2026-08-24).

### Mock-pollution note for future react rows

`packages/react/tests/game-view.test.ts` and `tests/safe-area.test.ts` both call
`mock.module('@shopify/react-native-skia', …)`, and Bun's registry is global / last-writer-wins, so
which stub `GameView` actually sees is load-order dependent — safe-area's copy already omits
`usePictureAsTexture`. This row added `Skia.Surface.MakeOffscreen` to **both** rather than only the
file that needs it. Any future row that reaches a new `Skia.*` member from `GameView` has to do the
same.

## 16. WEB-4 findings (2026-08-24)

All three templates now carry: a `web` script, the four web installs, a `LoadSkiaWeb()`-gated
entry, a wasm copy step, and README coverage. Two things turned up that the row spec did not
predict.

### Every template was missing `<SafeAreaProvider>`

WEB-3 recorded this as a trap for WEB-4 (§14, "Two traps") and it was live in **all three**
templates, not one: none of `blank` / `topdown` / `shmup` wrapped its tree, so every scaffolded app
would have thrown `No safe area value available` on its first web render. `GameView` calls
`useSafeAreaInsets()` unconditionally. All three are now wrapped.

**Still open, and deliberately not fixed here:** `GameView`'s own JSDoc
(`packages/react/src/game-view.tsx:91-93`) claims the `safeArea` prop "falls back to zero insets
when no provider is mounted". That is false on `react-native-safe-area-context` 5.6.2 and it ships
in the published `.d.ts`. Fixing it is `packages/react` scope and wants its own lockstep changeset,
so it is not smuggled into a templates row.

### The web dependency pins are provisional

Added as `dependencies` (not dev — `LoadSkiaWeb` does a runtime
`import CanvasKitInit from "canvaskit-wasm/bin/full/canvaskit"`, which Metro bundles):

| Package | Pin | Basis |
| --- | --- | --- |
| `react-dom` | `19.2.3` | must match the template's `react` exactly |
| `react-native-web` | `~0.21.0` | the hoisted monorepo copy is 0.21.2 |
| `@expo/metro-runtime` | `~57.0.0` | SDK-major convention (spike ran 55.0.12 on SDK 55) |
| `canvaskit-wasm` | ~~`^0.40.0`~~ → `0.41.0` | **wrong; corrected at WEB-5** — RN-Skia 2.6.0 pins `0.41.0` exactly (§17) |

These are inferred, not verified: the templates pin the Expo-57 stack while the monorepo hoists the
Expo-55-era one, and `tsconfig.templates.json` resolves against the hoisted copy by design (§11.4).
So the typecheck passing says nothing about whether these four versions are the right ones for
Expo 57. **WEB-5 must run `npx expo install --check` against the real scaffold and correct them** —
added to that row.

### Verified here

- `tsc --noEmit -p tsconfig.templates.json` clean with the new `index.ts`, which imports
  `@shopify/react-native-skia/lib/module/web`. That subpath resolves because RN-Skia ships **no
  `exports` map**, and its `lib/module/web/index.d.ts` is present.
- `scripts/copy-canvaskit.mjs` run against a scratch cwd produces `public/canvaskit.wasm` — the
  `full` build §12 requires, not the smaller ABI-incompatible default. (The 8,001,100-byte
  figure first recorded here was canvaskit-wasm **0.40.0**; WEB-5 corrected the pin to 0.41.0,
  whose full build is **8,076,553** bytes. §17.)
- `canvaskit-wasm` exports `./bin/full/canvaskit.wasm` as a direct path, so the script resolves the
  binary through `require.resolve` rather than guessing at a `node_modules` layout.

### Note for anyone reading the template diff

`biome.json:51` excludes `packages/create-flare-app/templates` from linting outright. Template
sources use double quotes against the repo's single, and no formatter enforces anything inside that
tree — the lint gate will not catch style drift in templates. New template files match the existing
template style, not the engine style.

## 17. WEB-5 findings (real scaffold booted in Chrome, 2026-08-24)

**The row's assertion is met.** A `create-flare-app` scaffold of `blank`, installed from a registry,
run with `bun run web`, renders its cyan sprite in Chrome at 3440×1215 with the WebGL context alive
and a clean console over a 67-second run. This is the check WEB-1 and WEB-5 gate the 0.3.0 publish
on (§8), and it is now green — but only after the row found and fixed **two real bugs shipped by
WEB-4 the day before**.

### Bug 1 — the `canvaskit-wasm` pin split the dependency

WEB-4 pinned `^0.40.0`, taken from `@flare-engine/react`'s optional-peer *floor*. **RN-Skia 2.6.0
depends on `canvaskit-wasm@0.41.0` exactly.** The two ranges do not unify, so bun installed 0.40.0
at the top level and nested a second copy under `@shopify/react-native-skia/node_modules/` — which
extracted as an empty husk (`package.json` only, `bin/` and `types/` empty directories). Metro
compiled the bundle fine and then **died at serve time**:

```
Error: ENOENT ... @shopify/react-native-skia/node_modules/canvaskit-wasm/bin/full/canvaskit.js
```

Invisible to `tsc`, invisible to the bundle compile, fatal at runtime. Fixed by pinning all three
templates to `0.41.0`; the tree then holds one deduped copy. `canvaskit-wasm@0.41.0` installs
correctly on its own (25 files), so the husk was a bun nested-install artifact of the version split,
not a broken upstream package.

**Rule this establishes:** the template's `canvaskit-wasm` pin must track RN-Skia's exact
dependency, not the engine's peer floor. Re-check it on every RN-Skia bump.

### Bug 2 — the web entry imported Skia before CanvasKit existed

WEB-4's `index.ts` branched on `Platform.OS` but kept a **static** `import { App }`, deliberately,
"so native registration stays synchronous". That static import evaluates
`@shopify/react-native-skia` — whose web module builds its `Skia` object from `global.CanvasKit` at
**module-eval time** — before `LoadSkiaWeb()` has run. CanvasKit then loads fine and far too late;
`Skia` is already permanently hollow:

```
TypeError: Cannot read properties of undefined (reading 'Paint')
    at createFrameRenderer → createSkiaFrameRenderer → <GameView>
```

Nothing mounted: `rootChildren: 0`, no canvas, while `canvasKitLoaded` was `true`. A blank page with
a loaded CanvasKit is the signature of this bug.

**Fix, and why this shape:** the entry is split into `index.ts` (native, unchanged and still
synchronous) and `index.web.ts` (awaits `LoadSkiaWeb()`, *then* dynamically imports `App`), with
`package.json`'s `main` made **extensionless** (`"index"`) so Metro resolves per platform. Verified
directly: with `main: "index.ts"` Expo serves `/index.ts.bundle` and ignores `index.web.ts`
entirely; with `main: "index"` it serves `/index.web.ts.bundle`. Extensionless `main` is the load-
bearing part — an `index.web.ts` alongside `main: "index.ts"` is silently dead code.

The native path is byte-identical to what shipped before WEB-4, which is why this was preferred over
making both platforms bootstrap asynchronously.

### WEB-6's deferred proof, now discharged

§15 landed WEB-6 on unit evidence and deferred the console check here. **Confirmed:** across a clean
67-second run the console holds three lines — React DevTools info, `Running application "main"`, and
the WEB-3 postfx gate warning. **No `Maximum update depth exceeded`.** No `BindingError`, no
`Aborted`, no context loss.

### Two defects found in the shipped postfx gate (WEB-3) — fixed at WEB-7, same day

Both were `packages/react` scope and wanted their own lockstep changeset, so they were queued out of
this templates row rather than folded in:

1. **The gate warns when there is no postfx at all.** `game-view.tsx`'s `else if (!_webPostFxWarned)`
   fires on web unconditionally, not only when a chain exists. The `blank` template configures no
   postfx and still tells the user "postfx chain skipped" on every web load.
2. **The warning hardcodes "RN-Skia 2.4.18".** Templates ship 2.6.0, so the message names a version
   the user does not have. It should not state a version it cannot verify.

**Resolved by WEB-7.** `@flare-engine/render`'s `FrameRenderer` gained `hasPostFxBinding()` — a
pure null/flag check over the same guards `buildPostFxPasses` applies before calling
`runtime.buildPass`, so it answers "is a chain bound" without touching the call that throws on web.
`GameView` warns only when it returns true, the version literal is gone, and warn-once moved from a
module flag to a per-instance `useRef`.

### Method notes for whoever runs a scaffold check again

- **The tarball fixture cannot work off the public registry.** The local engine depends on
  `@flare-engine/dynamics`, which has never been published — `bun install` 404s on it, and *hangs
  indefinitely at "Resolving dependencies"* when the same manifest carries an `overrides` block
  rather than reporting the failure. Published `engine@0.2.1` has 15 deps and no dynamics, so
  nothing is wrong on the registry; the local set is simply ahead of it. Use a local registry.
- **verdaccio must be bound to `0.0.0.0`.** Started with `--listen 4874` it binds IPv6 `::1` only;
  bun then hangs on `localhost` and gets `ConnectionRefused` on `127.0.0.1`. `--listen 0.0.0.0:4874`
  plus an app-level `.npmrc` scoping only `@flare-engine` to it installs 530 packages in 35 s.
- **`bun publish --registry=<url>` does override `publishConfig.registry`** — confirmed by dry-run
  before publishing (`Registry: http://localhost:4874`). Worth re-confirming rather than assuming,
  given every package points `publishConfig` at npmjs.
- **`expo start` rewrites the scaffold's `tsconfig.json`** on first run (`extends` becomes
  `expo/tsconfig.base`). The template ships a tsconfig Expo immediately replaces.
- **`expo install --check` flags six pre-existing template pins** — Skia 2.6.2, RN 0.86.2,
  reanimated 4.5.1, safe-area-context ~5.7.0, worklets 0.10.1, typescript ~6.0.3. None are WEB-4's
  web additions, all four of which it accepts. The boot above ran on the pins as they ship; whether
  to move to Expo's expectations is a separate call.
