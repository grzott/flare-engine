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
  peer deps (`peerDependenciesMeta.optional`); `.web.tsx` siblings only where WEB-1 proved need;
  the web contract documented in `docs/design/api-specs.md`. One lockstep minor changeset.
- **WEB-3 — spillover row, spec written after WEB-1.** Exists so a gap in `input` / `storage` /
  `assets` / `audio` / `ui` has a home. §1 predicts this row is empty; if WEB-1 confirms that, it
  closes as a no-op and says so in the SESSION_LOG rather than being silently dropped.
- **WEB-4 — scaffolder templates.** All three of `blank` / `topdown` / `shmup`: a `web` script, the
  three installs, a `LoadSkiaWeb()`-gated web entry, a `canvaskit.wasm` copy step, and README
  coverage. Read §11.4 before planning.

  **`create-flare-app` is `private: true` today** (verified 2026-08-21), so it publishes in no
  release until that flips at launch, and `check-changeset` exempts private packages outright.
  Two consequences: WEB-4 needs **no changeset**, and the templates do not reach any user in
  0.3.0 — they reach users when `cfa` first publishes, at the flip. WEB-4/WEB-5 still land
  pre-cut because WEB-5 is how the *engine's* web contract gets executed end to end (§8), not
  because the templates ship in that release.
- **WEB-5 — real-scaffold browser boot [MT].** Scaffold via `create-flare-app` → `bun run web` →
  renders in Chrome, for one template. Manual/scripted, **not** a typecheck: `create-flare-app`'s
  tsconfig excludes `templates/`, so the gate is structurally blind to template errors. This row
  plus WEB-1 are what the publish gates on.

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
4. **The template blindspot.** `create-flare-app`'s tsconfig excludes `templates/`; the gate cannot
   see errors there. WEB-5 is the only real check, and it must run against a genuine scaffold.
5. **Autoplay policy** (WEB-P4) — silent-game failure mode, easy to ship by accident.
6. **`makeNonTextureImage()` per frame on web.** The web path in `usePictureAsTexture` copies the
   snapshot off the GPU. This is a perf characteristic, not a correctness one, but PT's postfx
   chain is the heaviest consumer of that path and may read slower on web than the bench lanes
   suggest. WEB-H3 measures it rather than assuming.

## 12. Cut under YAGNI

- **A web host layer on `render-web`** — §3.
- **A `@flare-engine/react/web` barrel** — §3.
- **Server-side rendering, offline/PWA, install prompts.** Not asked for; a game canvas gains
  nothing from SSR.
- **Web builds for `Berek` or a second template beyond WEB-5's one.** WEB-4 wires all three
  templates; proving one in a browser is enough to prove the wiring.
- **The `.web.tsx` parity check when no `.web.tsx` exists** — §9.
