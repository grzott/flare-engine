# Manual-test protocol — the two-week freeze window (Oct 12–25)

**Owner-executed** after OSS-H1 (freeze + `0.4.0` restricted publish, Oct 12), before OSS-I1 (flip,
Oct 26–28). Dates moved from Oct 5–18 / Oct 20 on 2026-10-09 (owner) when the Oct 5 freeze did not
happen. Authored by OSS-H2. Spec: [road-to-oss-2026-09.md §11](road-to-oss-2026-09.md).

## How to use this doc

- Walk every box in order. Check `[x]` on pass; on fail, log a row in **§7 Findings** and keep going
  (don't stop the sweep — collect everything, then triage).
- **Everything runs against `^0.4.0` RESTRICTED**, not the public registry. The public
  `@flare-engine/*@0.4.0` versions — the scaffolder `@flare-engine/create` included — do **not**
  exist anonymously on npmjs until flip day; the tokenless *public*-registry cold scaffold is
  deliberately **I2's** job (flip day), not this window's.
- **First-run + web consumption install the real freeze build from npmjs, authenticated**
  (owner decision 2026-10-23). Verdaccio was only needed while the scaffolder was not on npmjs;
  `@flare-engine/create` has been published restricted alongside the other 41 since `0.4.0`
  (ADR-0007), so an authenticated install now tests the exact bytes the flip makes public. That
  drops the throwaway-version publish, the 42-manifest `publishConfig.registry` rewrite with its
  publish-to-the-real-registry hazard, and the registry teardown. If verdaccio is ever used again,
  the full procedure and its hazards live in [flip-runbook.md](flip-runbook.md)'s F2 pre-flight box.
  Rules that still hold (XR-11): one fresh directory per attempt, no lockfile carried between
  attempts, never `npm config set registry`. Authentication: Windows uses the token already in
  `~/.npmrc`; a Linux container gets the read-only token through `NPM_TOKEN` and a container-local
  `~/.npmrc` line `//registry.npmjs.org/:_authToken=${NPM_TOKEN}`.

- Reference devices: the owner's Android phone (locale **PL** — English-only matchers fail; see
  bilingual note in §2), plus a desktop browser matrix. iOS where a real device is available.
- Findings become **`FREEZE-FIX`-tagged** todo rows, fixed in priority order (§7). Non-blocking →
  post-flip backlog. Freeze rule: fixes only — no API changes, no new features, no docs restructuring.

---

## §1 — First-run funnel (LAUNCH-CRITICAL)

The path a stranger hits first. A break here is a launch blocker. Run against npmjs, authenticated
(above) — one fresh directory per attempt, and confirm you installed the current freeze patch
(`0.4.4` since 2026-10-26, FREEZE-FIX-4) before ticking anything.

**Runner (2026-10-23):** `docs/plans/_local/window-2026-10-23/check/window-check.sh` (gitignored;
run it with `--dry-run` first) covers §1, §5 and the Android half of §4/§6. Every scaffold, npm
cache and build goes into one temp folder that it deletes on exit; `summary.txt` and the logs stay
in its `results/`. Two boxes are checked differently from their wording. "Metro bundles" runs
`expo export --platform android`, which bundles every import with no device attached. The Android
build is the release variant (`expo run:android --variant release`), so the JS is inside the APK
and no Metro window is left running.

**Results 2026-10-25 on `0.4.3`** (runner, `results/20261025-175034`): Windows, the Linux container
and the README quickstart passed every check below, all three templates on both OSes. Android at
`results/20261023-224318`: see that box.

- [x] **Windows** — cold shell (no repo checkout), for each template `blank` / `topdown` / `shmup`:
  - [x] `npm create @flare-engine my-<tpl> -- --template <tpl>` → completes with **no `ERESOLVE`**
        and **no `--legacy-peer-deps`** (B32 fixed the `react@19.2.3` peer; confirm it holds).
  - [x] `cd my-<tpl> && npm install` clean; `npx tsc --noEmit` (or the template's typecheck) passes.
  - [x] **Prove what you installed, don't infer it:** `node_modules/@flare-engine/engine/package.json`
        reads the current freeze patch (`0.4.3`) and the lockfile's resolved URLs point at
        `registry.npmjs.org`.
        A green install proves nothing until this holds — the typecheck and Metro boxes below are
        only as good as the artifact underneath them (XR-11).
  - [x] `npm run start` — Metro bundles and resolves every `@flare-engine/*` import with no error.
        (Actually *running* the app needs a **dev build** — `@shopify/react-native-skia` is a native
        module, so plain `expo start` + Expo Go "press a/i" red-screens with a missing-native-module
        error. **This is already correct in the tree and is not an open question:** XR-10 landed, and
        every template README now leads with `bun run android   # or: bun run ios` and spells out the
        Expo Go red-screen. So the finding to watch for is a **regression** — a README that has gone
        back to telling a stranger to press `a`/`i` into Expo Go. Verified 2026-09-07 across the
        blank and shmup templates; re-read them rather than assuming either way.)
- [x] **Linux container** (e.g. `node:22` docker, clean `$HOME`) — repeat all three templates end-to-end
      (catches Windows-only path luck; the F2 rehearsal only proved `--skip-install`).
- [ ] **Real Android device** — topdown template: `bunx expo run:android` → installs, launches, the
      tilemap renders and the virtual joystick moves the player over solid-grid collision (the TPL1 wire).
      **2026-10-23 on `0.4.3`, without `--drop-audio-api`:** the release build installed and
      launched; the tilemap, collision and the door passed. The joystick moved the player but
      erratically: §7 row 15, FREEZE-FIX-4. Open until the stage passes on the release that carries it
      (`0.4.4`). The Windows, Linux and README boxes above passed on `0.4.3`, which differs from
      `0.4.4` only in `react`'s joystick touch handling.
- [x] **Root-README quickstart, verbatim** — every command block in [README.md](../../README.md) run
      exactly as written, authenticated against npmjs as above (`npm create @flare-engine my-game`, the
      install/build lines). Any command that errors or drifts from its documented output = a finding.

## §2 — Pan Tvardowski at `^0.4.0`

PT repo ([github.com/grzott/Pan-Tvardowski](https://github.com/grzott/Pan-Tvardowski)); bump it to
`@flare-engine/*@^0.4.0`, `bun install` from the restricted registry, build to the reference device.

The boxes ticked below passed in the owner's manual run on the Pixel 7 at `^0.4.0`, 2026-10-13
(PT `docs/plans/engine-040-device-run.md` steps 14-20 and 23, recorded "all good"); ticked here
2026-10-23. PT has since adopted `0.4.2` (`64d5a61`).

- [x] **Full campaign sweep** — zones 1→8 playable start to finish; no crash, no stuck scene.
- [x] **Saves + settings round-trip** — quit mid-run, relaunch: progress/settings restored intact
      (no save-wipe — the migration landmine).
- [x] **Shop** — open, purchase/equip a weapon/ship, changes persist across relaunch.
- [x] **Locale PL↔EN** — toggle both ways; all strings swap, no missing keys, no layout overflow
      (device locale is PL — keep any smoke matchers bilingual `en|pl`).
- [x] **Reduced-motion** — OS reduced-motion on: transitions/particles honor it.
- [x] **Colorblind atlas** — each colorblind palette renders correctly.
- [x] **B5 scene-restart** — die/restart and full scene reload: async preload completes, no leaked
      state, no double-run teardown.
- [ ] **B12 IAP-restore** — restore-purchases path re-grants entitlements; gated content unlocks.
      **Owner to confirm:** PT step 21 counts only if the 2026-10-13 build had
      `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID` and the phone is a Play-licensed tester; without the
      key PT falls back to `NoopIAPProvider` and the step is *not exercised* — then log it in §7 as
      `minor`, post-flip.
      **Not exercised (checked 2026-10-23):** PT's `.env` holds no RevenueCat key, so no PT build
      has run the real provider. Logged as §7 row 12.
- [x] **Audio, by ear** — reference device, **volume up, native audio NOT skipped** (do *not* set
      `PT_SKIP_NATIVE_AUDIO=1` for this build): SFX fire on gameplay events; music plays and crossfades
      cleanly on zone/scene change (no clipping/overlap); the settings volume/mute control actually
      attenuates the buses. (A muted/stubbed playthrough passes the "no crash" sweep while shipping
      broken audio — this is the least-exercised device path.)
      **Passed 2026-10-16** on PT's EAS APK `785c3ed4` (native audio loaded), owner by ear; the
      background-resume failure it found is §7 row 5, fixed PT-side and re-heard on `7b46ba95`.
- [x] **Shader-backed backgrounds/effects (B24)** — in each zone using a water/fog/fire or
      env-background shader, confirm it **renders** (not blank/black), **animates over time** (not
      frozen at t=0), and that effect sprites layer in correct **global z-order** against normal sprites.
      PT step 23. PT uses no per-sprite SkSL (only `tint`/`outline`), so per-sprite shaders are not
      exercised by PT.
- [x] **Hit flash on device at `0.4.2`** (closes §7 row 2) — PT step 24 on a build containing
      `64d5a61`: enemy, mini-boss and boss flash in their own silhouette, no box; the four `tint`
      users (phantom summons, boss and revenge telegraphs, dash ghosts) likewise.
      **Passed 2026-10-23 on the device (owner):** the flash covers only the sprite's shape, and
      the effect after a dodge looks better too.

## §3 — `tilemap` + solid-grid coverage, vehicle Berek, at `0.4.0` — DEFERRED post-flip

**Deferred until after the flip (owner decision 2026-10-19)**, with road-to-oss §10 `BK1`. Not run
in this window and not an exit criterion; what it covered now rests on §1's real-Android topdown box
(see Exit criteria). It remains engine verification, not Berek development — Berek's own build was
already deferred (owner decision 2026-09-08). The checklist below is kept for the post-flip run.

Second-genre proof (top-down). Bump to `^0.4.0`, install from restricted registry, run. Berek
already clears the ADR-0002 floor (`react-native-reanimated 4.3.0`, `react-native-worklets 0.8.1`,
`newArchEnabled: true` at `app.json:8` — verified 2026-09-08), so this is a dep bump, not a
migration.

- [ ] Tilemap renders; **solid-grid** movement/collision behaves (the XP5 physics + tilemap lift path
      — the exact code B33 just de-referenced).
- [ ] A representative level walk: no crash, no regression vs the last known-good engine version.

## §4 — Web (page hero demos) at `^0.4.0`

`flare-engine-page` repo (CanvasKit-WASM backend, `render-web`). Bump to `^0.4.0`, deploy the preview.

Automated pass 2026-10-23 on the live site at `^0.4.2`: the hero plus 8 showcases (3 games,
5 animations) in Chrome 155 (real GPU), Playwright Firefox 153 and WebKit 26.5, plus Pixel 7 and
iPhone 14 emulation. All 45 loads: HTTP 200, 0 page errors, a non-blank canvas within 1.3-3.6 s.
WebKit and the emulations are proxies, not Safari or real phones.

- [ ] **Desktop browser matrix** — hero demos render + animate on **Chrome**, **Firefox**, **Safari**.
      Chrome and Firefox: all 9 pages animate, and a 25 s soak holds without fallback. Safari is not
      run (Windows). WebKit animates everything, but 4 animations go blank after the perf governor
      rebuilds them at a lower tier — §7 row 9, traced to the Windows WebKit build itself (a plain
      WebGL canvas blanks on resize there too). A real Safari check is still needed.
      **No Mac available (owner, 2026-10-23):** real Safari waits until the owner has one, so
      Safari is unverified at the flip.
- [ ] **Mobile browsers** — **Android Chrome** + **iOS Safari** (real devices): demos render, touch works.
      Emulation renders and animates all 9. The three game pages overflowed the phone width — §7
      row 10, fixed on the page's flip branch.
      No iPhone either (same owner decision): iOS Safari is unverified at the flip. Android Chrome
      is the runner's `phone` stage, a build of `feat/oss-flip` served from the PC over USB.
- [ ] **WASM load on throttled 4G** — CanvasKit downloads + inits within an acceptable time; no hang.
      No hang (slow 4G, CPU 4x, cache off): first frame at 2.2 s on `/` (no CanvasKit) and about
      36 s on CanvasKit pages, because the 3.26 MB wasm downloads twice — §7 row 11. With the HTTP
      cache on, the second copy is a cache hit and the first frame lands at about 20 s.
- [x] **Time-driven shader on web** — at least one hero demo using a time/resolution-driven shader
      (the render `dist` runs on the CanvasKit backend too): confirm it **renders and animates** on the
      web backend, not just native (B24 fixed the resolution-0 / frozen-time bugs — re-prove on web).
      **Passed 2026-10-23:** the logo's specular sheen (time-driven uniforms present in the compiled
      GLSL) changes 1.2-7.1% of pixels during its shine phase on Chrome, Firefox and both
      emulations. The post-FX SkSL passes link on all configs with 0 failures.
- [ ] **Lighthouse** — re-run; mobile + desktop still hit the owner's **100** bar.
      Not met on the live site — §7 rows 6-8. All three are fixed on the page's flip branch. A
      local build scores accessibility and best-practices 100 on `/`, `/getting-started/`,
      `/showcases/` and `/showcases/overrun/`, and getting-started desktop performance 100 with CLS 0.
      Re-run on the live site after the flip deploys. Live mobile performance sat at 94-98 (LCP
      about 2.5 s on simulated slow 4G), which these fixes do not touch.

## §5 — New surfaces (this arc's additions)

Each new-in-arc capability exercised at least once on its real target.

- [x] **M1 — keyboard input** on desktop web: the scaffolded web build proven real by WEB-5 (a scaffold — then `create-flare-app`, now `@flare-engine/create` — under `bun run web`; see [web-target-2026-08.md](web-target-2026-08.md) §17) responds
      to `createKeyboard` input — arrows/WASD drive movement or UI focus; keydown/keyup + per-frame
      reset behave (no stuck keys).
      **Passed 2026-10-23 on the page's two keyboard games**, which use the published
      `createKeyboard` (`^0.4.2`) in desktop Chrome. Over 1 s, holding D moved the Causeway ship
      +46/+63 px and the Overrun player +125/+140 px, holding A moved them −78 and −232/−255 px,
      and with no input they drifted 2-3 px. The scaffold's `npm run web` in §1 re-checks the same
      path from a template.
- [x] **M2 — headless barrel**: a plain `bun` script `import`s from `@flare-engine/engine/headless`,
      steps an ECS world, and runs to completion **with no React/Skia/react-native pulled in** (no
      native/DOM dependency error).
      **Passed 2026-10-23** against the published `@flare-engine/engine@0.4.2` from npmjs, installed
      with `bun install --omit=peer` into an empty directory (no `react`, `react-native` or Skia in
      `node_modules`): `World` + `createMovementSystem`, 60 steps, correct position, exit 0 under both
      bun 1.3.11 and node.
- [ ] **B8 / M4 — Tiled authoring**: author a fresh map in **Tiled 1.12**, export `.tmj`, run it through
      the `cli` → template pipeline (`parseTiled` / LDtk entities), and render it — flip bits + entities
      resolve correctly.
      Runner: `tiled-kit` writes a 5-tile tileset and the drawing steps. `s5` converts the saved map
      with the published `flare tiled-to-flare`, checks it with the published `parseTiled` (saved by
      1.12, H/V/D flips resolve and collide, objects keep name, class and position), then renders it
      in the topdown template in the browser and on the phone. Flipped tiles draw unflipped by
      design: render-flip is post-flip M10 (`tilemap-renderer.ts:64-66`).
      **2026-10-25, first `s5` run:** stopped at the conversion. The map had been saved as TMX
      (XML) under the `.tmj` name; Tiled takes the format from the Save-as-type list, not from the
      file name. The CLI reads JSON only, as its README says. The map also had no door, no flipped
      tiles and no object named `spawn`. Not an engine defect; the error text is §7 row 16. Redraw
      and re-run. The runner now names the XML case and the kit's steps say how to avoid it.
      **2026-10-26, second run** (`results/20261026-083600`, with `--local-react`): the JSON map
      converted, parsed (16x12, 2 layers, solid local ids 1-3), kept both objects with name, class and
      position, rendered with spawn and collision in the browser and rendered on the phone. Flips
      failed: the saved map holds no flipped tile (H 0, V 0, D 0), so nothing was painted flipped.
      The runner now rejects such a map before it scaffolds, and the kit's flip steps say how to see
      a flip while painting.
- [ ] **M6 — haptics** on device: a build using the real `expo-haptics` provider fires haptics on the
      wired events; the `NoopHapticsProvider` fallback is silent (no crash) where haptics is absent.
      **No consumer wires the Expo provider (checked 2026-10-23):** PT does not depend on
      `@flare-engine/haptics` and no template uses it; only the page imports it, with the web
      vibration provider. Exercising this needs a scaffold with `expo-haptics` wired by hand and a
      device build. Otherwise log it in §7 as *not exercised* (`minor`, post-flip).
      Runner: `s5` wires the published `@flare-engine/haptics` to real `expo-haptics` in that same
      scaffold: an impact on every wall bump and a notification when the door opens. The web build
      gets `NoopHapticsProvider`, which covers the silent-fallback half.
      **2026-10-26** (same run, Pixel 7, Android 17): no red errors on web. On the phone the owner
      felt no vibration, but the phone's own log (`dumpsys vibrator_manager`) shows the app's cues
      reached the motor: 10 wall-bump impacts played to the end, each 50 ms at 12% strength, with
      every vibration setting at High. The door's notification started and was cancelled 2 ms in,
      superseded by a wall-bump impact from the same frame (the jamb). Android plays one vibration at
      a time, and the check app fired both, so this was the check app, not the engine. The
      strength is `expo-haptics`' own Android waveform, passed through unchanged: §7 row 17. The
      check app now opens every door tile and holds the bump cue back while the door's plays, and
      the runner reads the phone's vibration log instead of asking whether a buzz was felt.

## §6 — Docs site

`flare-engine-page` docs (Astro Starlight + typedoc). On a **real phone**:

- [x] **Every page + link** loads (no 404, no broken internal link); nav works.
      **Passed 2026-10-23, automated crawl of the live site:** all 1,081 sitemap pages 200; 2,205
      internal URLs, 0 non-200; 7,946 fragment anchors, 0 broken; 11 one-hop 307s to trailing-slash
      URLs. The 237 links into this repo 404 until runbook Step 1 by design; the page's own L10 row
      re-checks them after the flip. 229 of them are typedoc "Defined in" links pinned to `7328b53`,
      so they depend on public history keeping that commit.
- [x] **Typedoc reference pages** render (the generated API pages, not just hand-written docs).
      **Passed 2026-10-23:** all 1,051 `/api/` pages have an h1, a signature and body text; 4 API pages
      plus `/`, `/getting-started/` and `/showcases/` rendered at 390x844 with no horizontal
      overflow. Emulated, not on a physical phone.
- [ ] **Getting-started, verbatim, as a stranger** — the owner follows it literally with no prior
      knowledge; any step that assumes context or drifts from reality = a finding.
      The runner's `phone` stage opens it on the phone last.

## §7 — Findings → FREEZE-FIX

Log every failure here. Then create a `FREEZE-FIX`-tagged row in [todo.md](todo.md) per launch-critical
finding, fixed in priority order; non-blocking items → the post-flip backlog (road-to-oss §13).

Rows 1-2 are filed from PT's `docs/plans/engine-040-filings.md`, rows 3-5 from PT's
`docs/plans/engine-040-device-run.md`; a "step" number is that checklist's. Rows 6-11 come from
the 2026-10-23 automated pass over the live site (Lighthouse, link crawl, browser matrix); the raw
reports are in `docs/plans/_local/window-2026-10-23/` (gitignored). Rows 12-13 come from the same
day's review of §1 and §2, row 14 from the runner's first Android run, rows 15-17 from its later
stages.

| # | §/step | Surface | Symptom | Severity (blocker / major / minor) | FREEZE-FIX row | Status |
|---|--------|---------|---------|------------------------------------|----------------|--------|
| 1 | §2 (PT, adoption audit) | `errors` `createSentryTransport` | After the first consented report, Sentry's default integrations keep capturing and sending outside the consumer's consent gate; opt-out cannot stop it | blocker (owner classified 2026-10-13 — consent is not in the launch-critical list) | FREEZE-FIX-1 | closed — fixed in `0.4.1` (ADR-0008); PT adopted it in `64d5a61`, which pins the init options in `tests/platform/sentry-consent.test.ts`; PT does not install the Sentry SDK, so there is no device path to re-test |
| 2 | §2 full campaign sweep (PT) | `render` `flash` / `tint` | Enemy, mini-boss and boss hit flash paints the whole sprite rectangle instead of the silhouette (frames with transparent padding) | major (owner elected to close in the window) | FREEZE-FIX-2 | closed — fixed in `0.4.2` (ADR-0009); PT adopted it in `64d5a61`; the §2 device re-check passed 2026-10-23 (owner) |
| 3 | §2 / launch (PT, release build without native audio) | PT `initAudio` | Crash on launch: audio module init throw is reported fatal by Metro | blocker | PT-side — fixed `89fe9b9` | closed |
| 4 | §2 / B5 die → retry (step 10) | PT game-over overlay | Blank screen after death with reduced motion off; overlay at opacity 0 but tappable | major | PT-side — fixed `7ec0a1b` | closed |
| 5 | §2 Audio, by ear (step 22) | PT app lifecycle | Music silent for the rest of a run after any trip to the background; SFX unaffected | major | PT-side — fixed `4eb72df` | closed |
| 6 | §4 Lighthouse (2026-10-23, live site, Lighthouse 12.8.2) | page CSP | Best-practices 93 on every URL tested: the page's CSP blocks 3-4 Starlight inline scripts (hashes missing) and one Cloudflare-injected script. Functional cost: Starlight's tab-restore element is never defined and the Ctrl+K hint stays hidden; search still opens. **Fixed on the page's `feat/oss-flip`:** the post-build CSP step now hashes every inline script in the built HTML (0 of 1,082 pages left with an unhashed one). The Cloudflare script is the zone's per-request bot JavaScript detection and cannot be hashed. **2026-10-23:** the owner turned Bot Fight Mode off, but the live pages still carried the snippet afterwards, and Cloudflare documents JavaScript detections as always on for Free-plan zones. Options: accept it (live best-practices stays below 100 on that one console error; no visitor-facing function is lost), move to a plan where the toggle exists, or serve the CSP as a header with a per-request nonce, which Cloudflare's injector honours (a Worker change, post-flip) | minor (owner's 100 bar) | page-side + Cloudflare | fixed in page; Cloudflare part waits on the owner's choice |
| 7 | §4 Lighthouse | page contrast | Accessibility 93 on `/`: code-sample comments `#6a737d` on `#24292e` (3.04:1); footer links "Apache-2.0" / "v0.4.2" 1.43:1 against body text with no underline (the same footer gives 96 on `/showcases/` and `/showcases/overrun/`). **Fixed on `feat/oss-flip`:** comments repainted to the muted token (6.0:1), footer blurb links underlined; local accessibility 100 on all four pages | minor (owner's 100 bar) | page-side | fixed, live re-check after flip |
| 8 | §4 Lighthouse | page `/getting-started/` | Desktop CLS 0.146 in 3/3 runs from the requirements table `div.reqs` → performance 94; mobile performance 94-98 elsewhere. Cause: the brand web fonts swap in after first paint and re-wrap the text (CLS 0 with fonts blocked). **Fixed on `feat/oss-flip`:** docs pages preload the two latin faces; throttled A/B CLS 0.034 → 0, local desktop performance 100 | minor (owner's 100 bar) | page-side | fixed, live re-check after flip |
| 9 | §4 desktop matrix (Playwright WebKit 26.5, proxy) | page perf governor + CanvasKit surface rebuild | When the governor steps an animation down a tier, it rebuilds it on the same canvas. After that, WebKit shows a blank canvas while the HUD still reports 59-96 fps. Reproduced on logo, nuclear-reaction, physarum-network and spacetime-lattice by forcing the step-down; Chrome and Firefox keep rendering. Not yet seen on real Safari. **Isolated 2026-10-23: a Playwright WebKit (Windows) defect, not page or engine code.** A plain WebGL1/WebGL2 canvas with no CanvasKit and no engine blanks after any `width`/`height` change in that build, while `readPixels` still returns the drawn colour; a 2D canvas, Chromium and Firefox are fine. With render-web 0.4.2 + canvaskit 0.41.1, dispose and re-create at the same size renders, and a fresh `<canvas>` renders. The rebuild blanks only because it resizes the canvas, and a plain window resize on the live site blanks it as well. The "iPhone 14" run used the same Windows binary, so it is not iOS evidence | major only if real Safari shows it (judged unlikely) | — (owner resizes a running animation in real Safari) | open until the Safari check |
| 10 | §4 mobile (emulated) | page game showcases | On causeway, overrun and reroute, the "N engine packages, in the order the demo earned them" table is wider than a phone and has no scroll container: iPhone 14 scrolls sideways (page 420-516 px vs 390), Pixel 7 renders zoomed out. **Fixed on `feat/oss-flip`:** the table scrolls inside its own focusable region; page width equals the viewport on all three pages at 390 and 412 px | minor | page-side | fixed |
| 11 | §4 WASM on 4G | `render-web` `loadCanvasKit` with canvaskit-wasm 0.41.x | `loader.ts:74-76` downloads the wasm with progress and passes `wasmBinary`. The 0.41.x glue does not read `wasmBinary` (0.40.0, the version the engine's own tests and bench resolve, does), so it streams the same 3.26 MB again from `locateFile`. Every consumer on 0.41.x is affected: the templates pin `0.41.0` and the peer range is `>=0.40.0`. Cache off: about 36 s to the first frame on slow 4G. Cache on: the second fetch is a cache hit, about 20 s. A fix needs the downloaded bytes handed back as a Blob URL via `locateFile` (0.41 has no `instantiateWasm` hook either), which re-stales the render-web perf lanes | minor (perf; owner may raise) | post-flip `0.4.x` patch unless the owner pulls it in | open |
| 12 | §2 B12 IAP-restore (PT step 21) | `iap-revenuecat` restore | Not exercised: PT's `.env` holds no RevenueCat key, so every PT build fell back to `NoopIAPProvider`. A real run needs Play Console products, a Play test track, a license tester and RevenueCat service credentials. RevenueCat's Test Store is no shortcut here: it needs `react-native-purchases` 9.5.4 or later, and restore on it is unconfirmed | minor (coverage gap) | — (post-flip) | open |
| 13 | §1 first-run (code read 2026-10-23, the runner's `readme` stage prints the live hint) | `create` next-step hint | `manifest.ts` sets `postInstall: 'bun run start'` for all three templates and `cli.ts` prints it whatever package manager ran the install. An `npm create` user without bun gets `bun: command not found`; with bun, `start` is the Expo Go path every template README warns against (press `a`, red screen). The READMEs lead with `bun run android`, and the templates' `test` script is `bun test` | minor (owner may raise: it sits on the launch-critical funnel) | CREATE-HINT-1, post-flip `0.4.x` patch unless the owner pulls it in | open |
| 14 | §1 real Android device (the runner's `android` stage, 2026-10-23, Windows) | `audio` + `engine` peer metadata | The topdown release build fails in `react-native-audio-api`'s arm64 native build: ninja cannot create its object directory, after CMake warns the directory alone is 186 of 250 characters. No template uses audio, but `audio` and `engine` declare the package as a required peer (`>=0.3.0`), so npm and bun install it into every scaffold (bun picked `0.13.6`) and Expo compiles it. Its CMake mirrors the absolute source path inside the object directory, so the project path counts twice, and no Windows project path is short enough with the stock toolchain. Engine source never imports it. With the package deleted before prebuild, the same template built a release APK at a longer path (42 characters), Skia, Reanimated and Worklets included | blocker (every template's `bun run android` on Windows) | FREEZE-FIX-3 (ADR-0010, `0.4.3`) | closed — `0.4.3` published 2026-10-23; the same evening the runner's `android` stage built, installed and launched the topdown template on the phone without `--drop-audio-api` (`results/20261023-224318`) |
| 15 | §1 real Android device (the runner's `android` stage on `0.4.3`, 2026-10-23; reported 2026-10-25) | `react` `<VirtualJoystick>` | The joystick moves the player erratically, and with the finger held to the right the knob leaves the ring. The component fed `nativeEvent.locationX/Y` to `updateJoystick` as if measured against the stick. Android measures them against the view under the finger on every move (`JSTouchDispatcher.kt:156-158`, `TouchesHelper.kt:51-65` in RN 0.83.6): the default knob, which was a touch target, while the finger is over it, and the full-screen game view past the ring. Fabric also puts the first changed touch on the event, and the responder gets every finger's moves, so in shmup the fire-button finger can drive the stick. Web was right throughout: react-native-web measures against the responder | blocker (the only control of the first-run template, on every Android device) | FREEZE-FIX-4 (ADR-0011, accepted 2026-10-26, `0.4.4`) | open: `0.4.4` cut 2026-10-26; owner device check with `--local-react` before the publish, then the `android` stage on the published `0.4.4` |
| 16 | §5 B8/M4 (the runner's `s5` stage, 2026-10-25) | `cli` `flare tiled-to-flare` | A map saved as TMX (XML) fails with the raw JSON parser message `Unexpected token '<', "<?xml vers"... is not valid JSON`. The CLI is documented as `.tmj` only, but Tiled writes XML under any name when Save as type is left on TMX, so a stranger gets no hint | minor (DX) | CLI-TMX-1, post-flip | open |
| 17 | §5 M6 (the runner's `s5` stage, 2026-10-26, Pixel 7) | `haptics` `createExpoHapticsProvider` | The cues reach the motor, but the owner could not feel them. The adapter forwards `impact`/`notification` to `expo-haptics`' `impactAsync`/`notificationAsync` unchanged, and on Android those play fixed waveforms through `Vibrator`: `light` is 50 ms at 12% strength, `success` two 40 ms steps at 20% and 24% (`expo-haptics` 57.0.3, `HapticsImpactType.kt`, `HapticsNotificationType.kt`). The same module's `performAndroidHapticsAsync` uses the system haptic effects instead. A consumer calling `expo-haptics` directly gets the same strength | minor (feel, Android only) | HAPTICS-ANDROID-1, post-flip | open |

### Exit criteria (all must hold before OSS-I1 / flip)

- [ ] §1 first-run funnel is **green on both OSes, all three templates** (zero blockers).
- [ ] PT runs on `0.4.0` with no blocker/major regression. Berek (§3) is deferred post-flip (owner
      decision 2026-10-19), so §1's **Real Android device** topdown box is now the only pre-flip
      manual coverage of `tilemap` and the physics solid-grid path.
- [ ] Web matrix + Lighthouse 100 hold; docs getting-started is followable cold.
- [ ] **§5 new surfaces** (M1 keyboard, M2 headless, B8/M4 Tiled, M6 haptics) each executed on its real
      target and green — or every failure logged in §7 and triaged (blockers closed).
- [ ] Every `FREEZE-FIX` blocker is closed (each fix shipped as a lockstep `0.4.x` restricted patch and
      re-tested); majors closed or explicitly accepted; minors triaged to the post-flip backlog.
- [x] **Perf gate still green after the last FREEZE-FIX patch** — every hard item in the "Perf gate
      (single source)" block of road-to-oss §11 / OSS-H1. Not restated here on purpose. A fix that
      touches a measured package re-reds `check:perf-freshness`; that is a re-capture, not a waiver.
      Green 2026-10-23 at `7328b53`, no override: `check:perf` (11 scenarios), `check:perf-bytes`
      (42 packages), `check:perf-freshness` (5 suites captured at `785a3b2`).
- [ ] **No registry override left:** `npm config get registry` prints `https://registry.npmjs.org/`,
      no `registry=` line in `$HOME/.npmrc` pointing anywhere but npmjs, nothing listening on
      4873/4874, and every §1 scaffold directory deleted (the runner's `exit` stage checks all four). With the window on npmjs (2026-10-23) this is a check, not a teardown — but
      I2's flip-day tokenless scaffold must start from a clean machine either way (XR-11).
- [ ] Owner sign-off recorded here: `signed-off: ____________  date: __________`
