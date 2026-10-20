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
- **First-run + web consumption use the F2 verdaccio harness** (local registry at
  `http://localhost:4873`). Reuse the exact setup rehearsed in
  [flip-runbook.md](flip-runbook.md) (the F2 pre-flight box). Point the **default** registry at
  verdaccio — transitive non-Flare deps must come through its npmjs uplink too — but scope the
  override to the test tree, publish at a throwaway version, and start every attempt in a fresh
  tree with no lockfile (XR-11):

  ```bash
  # start verdaccio, then publish the freeze cut to it at a THROWAWAY version — never 0.4.0.
  # 0.4.99 is unmistakable in a lockfile and will never be cut for real; @flare-engine/create
  # stamps ^<its own version> into the templates, so a scaffold that falls through to npmjs
  # 404s loudly instead of silently resolving the real 0.4.0.
  mkdir freeze-window && cd freeze-window          # ONE fresh tree per attempt; never reuse
  echo 'registry=http://localhost:4873/' > .npmrc  # project-scoped, NOT `npm config set`
  # ...run the §1 / §4-web consumption tests inside this tree...
  ```

  **The `.npmrc` above does NOT protect the publish, and this is the one mistake in this document
  that publishes to the real registry.** Every one of the **42** `packages/*/package.json` carries
  its own `publishConfig.registry: "https://registry.npmjs.org/"` (since `be17caf`, 2026-04-17), and
  **npm and changesets honour a manifest's `publishConfig` over any `.npmrc`**. So `bun run release`
  on the throwaway branch, with the rotated token in `~/.npmrc`, publishes all 42 at `0.4.99` to the
  **real** registry — restricted until the flip, then public, and `0.4.99` sorts above every real
  `0.4.x`. The 2026-09-07 text of this paragraph named only the old unscoped scaffolder's pin; that
  was never the whole hazard (corrected 2026-10-09).

  On the throwaway branch, before `bun run release`, also:

  ```bash
  # rewrite every manifest pin — .npmrc cannot override it
  bun -e 'const fs=require("fs");for(const d of fs.readdirSync("packages")){const p="packages/"+d+"/package.json";const j=JSON.parse(fs.readFileSync(p,"utf8"));if(j.publishConfig){j.publishConfig.registry="http://localhost:4873/";fs.writeFileSync(p,JSON.stringify(j,null,2)+"\n")}}'
  git diff --stat   # must list 42 package.json files
  # then, after every rehearsal publish, prove nothing escaped:
  npm view @flare-engine/engine@0.4.99 --registry https://registry.npmjs.org/   # must 404
  npm view @flare-engine/create@0.4.99 --registry https://registry.npmjs.org/   # must 404
  ```

  Keep the real pins untouched in the flip commit. The July F2 rehearsal evidently redirected every
  pin — the real `0.3.0` publish in August succeeded, so nothing had reached npmjs — but the fact
  was recorded only in the F2 Done row and never reached this document or the runbook.

  Never `npm config set registry`: that is a **user-level** setting that redirects every npm
  command on the machine for the rest of the window — §2/§3's restricted-registry installs and
  F3's `npm view`/`npm pack` included. If a tree ever resolved from verdaccio, delete it rather
  than reinstall in it: the lockfile records the registry, so a re-install there returns the
  local build even after the override is gone, `--force` included. **Purging the npm/bun cache
  is not the remedy** — the caches are keyed by registry host, so a purge changes nothing and
  hides the lockfile as the cause.

- Reference devices: the owner's Android phone (locale **PL** — English-only matchers fail; see
  bilingual note in §2), plus a desktop browser matrix. iOS where a real device is available.
- Findings become **`FREEZE-FIX`-tagged** todo rows, fixed in priority order (§7). Non-blocking →
  post-flip backlog. Freeze rule: fixes only — no API changes, no new features, no docs restructuring.

---

## §1 — First-run funnel (LAUNCH-CRITICAL)

The path a stranger hits first. A break here is a launch blocker. Run against verdaccio (above) —
one fresh directory per attempt, and confirm you installed the throwaway `0.4.99` before ticking
anything. A `0.4.0` in the tree means you resolved from npmjs or from a stale lockfile, not from
the harness.

- [ ] **Windows** — cold shell (no repo checkout), for each template `blank` / `topdown` / `shmup`:
  - [ ] `npm create @flare-engine my-<tpl> -- --template <tpl>` → completes with **no `ERESOLVE`**
        and **no `--legacy-peer-deps`** (B32 fixed the `react@19.2.3` peer; confirm it holds).
  - [ ] `cd my-<tpl> && npm install` clean; `npx tsc --noEmit` (or the template's typecheck) passes.
  - [ ] **Prove what you installed, don't infer it:** `node_modules/@flare-engine/engine/package.json`
        reads `"version": "0.4.99"` and the lockfile's resolved URLs point at `localhost:4873`.
        A green install proves nothing until this holds — the typecheck and Metro boxes below are
        only as good as the artifact underneath them (XR-11).
  - [ ] `npm run start` — Metro bundles and resolves every `@flare-engine/*` import with no error.
        (Actually *running* the app needs a **dev build** — `@shopify/react-native-skia` is a native
        module, so plain `expo start` + Expo Go "press a/i" red-screens with a missing-native-module
        error. **This is already correct in the tree and is not an open question:** XR-10 landed, and
        every template README now leads with `bun run android   # or: bun run ios` and spells out the
        Expo Go red-screen. So the finding to watch for is a **regression** — a README that has gone
        back to telling a stranger to press `a`/`i` into Expo Go. Verified 2026-09-07 across the
        blank and shmup templates; re-read them rather than assuming either way.)
- [ ] **Linux container** (e.g. `node:22` docker, clean `$HOME`) — repeat all three templates end-to-end
      (catches Windows-only path luck; the F2 rehearsal only proved `--skip-install`).
- [ ] **Real Android device** — topdown template: `bunx expo run:android` → installs, launches, the
      tilemap renders and the virtual joystick moves the player over solid-grid collision (the TPL1 wire).
- [ ] **Root-README quickstart, verbatim** — every command block in [README.md](../../README.md) run
      exactly as written against the same registry override (`npm create @flare-engine my-game`, the
      install/build lines). Any command that errors or drifts from its documented output = a finding.

## §2 — Pan Tvardowski at `^0.4.0`

PT repo ([github.com/grzott/Pan-Tvardowski](https://github.com/grzott/Pan-Tvardowski)); bump it to
`@flare-engine/*@^0.4.0`, `bun install` from the restricted registry, build to the reference device.

- [ ] **Full campaign sweep** — zones 1→8 playable start to finish; no crash, no stuck scene.
- [ ] **Saves + settings round-trip** — quit mid-run, relaunch: progress/settings restored intact
      (no save-wipe — the migration landmine).
- [ ] **Shop** — open, purchase/equip a weapon/ship, changes persist across relaunch.
- [ ] **Locale PL↔EN** — toggle both ways; all strings swap, no missing keys, no layout overflow
      (device locale is PL — keep any smoke matchers bilingual `en|pl`).
- [ ] **Reduced-motion** — OS reduced-motion on: transitions/particles honor it.
- [ ] **Colorblind atlas** — each colorblind palette renders correctly.
- [ ] **B5 scene-restart** — die/restart and full scene reload: async preload completes, no leaked
      state, no double-run teardown.
- [ ] **B12 IAP-restore** — restore-purchases path re-grants entitlements; gated content unlocks.
- [x] **Audio, by ear** — reference device, **volume up, native audio NOT skipped** (do *not* set
      `PT_SKIP_NATIVE_AUDIO=1` for this build): SFX fire on gameplay events; music plays and crossfades
      cleanly on zone/scene change (no clipping/overlap); the settings volume/mute control actually
      attenuates the buses. (A muted/stubbed playthrough passes the "no crash" sweep while shipping
      broken audio — this is the least-exercised device path.)
      **Passed 2026-10-16** on PT's EAS APK `785c3ed4` (native audio loaded), owner by ear; the
      background-resume failure it found is §7 row 5, fixed PT-side and re-heard on `7b46ba95`.
- [ ] **Shader-backed backgrounds/effects (B24)** — in each zone using a water/fog/fire or
      env-background shader, confirm it **renders** (not blank/black), **animates over time** (not
      frozen at t=0), and that effect sprites layer in correct **global z-order** against normal sprites.

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

- [ ] **Desktop browser matrix** — hero demos render + animate on **Chrome**, **Firefox**, **Safari**.
- [ ] **Mobile browsers** — **Android Chrome** + **iOS Safari** (real devices): demos render, touch works.
- [ ] **WASM load on throttled 4G** — CanvasKit downloads + inits within an acceptable time; no hang.
- [ ] **Time-driven shader on web** — at least one hero demo using a time/resolution-driven shader
      (the render `dist` runs on the CanvasKit backend too): confirm it **renders and animates** on the
      web backend, not just native (B24 fixed the resolution-0 / frozen-time bugs — re-prove on web).
- [ ] **Lighthouse** — re-run; mobile + desktop still hit the owner's **100** bar.

## §5 — New surfaces (this arc's additions)

Each new-in-arc capability exercised at least once on its real target.

- [ ] **M1 — keyboard input** on desktop web: the scaffolded web build proven real by WEB-5 (a scaffold — then `create-flare-app`, now `@flare-engine/create` — under `bun run web`; see [web-target-2026-08.md](web-target-2026-08.md) §17) responds
      to `createKeyboard` input — arrows/WASD drive movement or UI focus; keydown/keyup + per-frame
      reset behave (no stuck keys).
- [ ] **M2 — headless barrel**: a plain `bun` script `import`s from `@flare-engine/engine/headless`,
      steps an ECS world, and runs to completion **with no React/Skia/react-native pulled in** (no
      native/DOM dependency error).
- [ ] **B8 / M4 — Tiled authoring**: author a fresh map in **Tiled 1.12**, export `.tmj`, run it through
      the `cli` → template pipeline (`parseTiled` / LDtk entities), and render it — flip bits + entities
      resolve correctly.
- [ ] **M6 — haptics** on device: a build using the real `expo-haptics` provider fires haptics on the
      wired events; the `NoopHapticsProvider` fallback is silent (no crash) where haptics is absent.

## §6 — Docs site

`flare-engine-page` docs (Astro Starlight + typedoc). On a **real phone**:

- [ ] **Every page + link** loads (no 404, no broken internal link); nav works.
- [ ] **Typedoc reference pages** render (the generated API pages, not just hand-written docs).
- [ ] **Getting-started, verbatim, as a stranger** — the owner follows it literally with no prior
      knowledge; any step that assumes context or drifts from reality = a finding.

## §7 — Findings → FREEZE-FIX

Log every failure here. Then create a `FREEZE-FIX`-tagged row in [todo.md](todo.md) per launch-critical
finding, fixed in priority order; non-blocking items → the post-flip backlog (road-to-oss §13).

Rows 1-2 are filed from PT's `docs/plans/engine-040-filings.md`, rows 3-5 from PT's
`docs/plans/engine-040-device-run.md`; a "step" number is that checklist's.

| # | §/step | Surface | Symptom | Severity (blocker / major / minor) | FREEZE-FIX row | Status |
|---|--------|---------|---------|------------------------------------|----------------|--------|
| 1 | §2 (PT, adoption audit) | `errors` `createSentryTransport` | After the first consented report, Sentry's default integrations keep capturing and sending outside the consumer's consent gate; opt-out cannot stop it | blocker (owner classified 2026-10-13 — consent is not in the launch-critical list) | FREEZE-FIX-1 | fixed in `0.4.1` (ADR-0008), published 2026-10-19; open until PT re-tests |
| 2 | §2 full campaign sweep (PT) | `render` `flash` / `tint` | Enemy, mini-boss and boss hit flash paints the whole sprite rectangle instead of the silhouette (frames with transparent padding) | major (owner elected to close in the window) | FREEZE-FIX-2 | fixed in `0.4.2` (ADR-0009); open until published and PT `H2` re-checks |
| 3 | §2 / launch (PT, release build without native audio) | PT `initAudio` | Crash on launch: audio module init throw is reported fatal by Metro | blocker | PT-side — fixed `89fe9b9` | closed |
| 4 | §2 / B5 die → retry (step 10) | PT game-over overlay | Blank screen after death with reduced motion off; overlay at opacity 0 but tappable | major | PT-side — fixed `7ec0a1b` | closed |
| 5 | §2 Audio, by ear (step 22) | PT app lifecycle | Music silent for the rest of a run after any trip to the background; SFX unaffected | major | PT-side — fixed `4eb72df` | closed |

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
- [ ] **Perf gate still green after the last FREEZE-FIX patch** — every hard item in the "Perf gate
      (single source)" block of road-to-oss §11 / OSS-H1. Not restated here on purpose. A fix that
      touches a measured package re-reds `check:perf-freshness`; that is a re-capture, not a waiver.
- [ ] **Registry override torn down:** verdaccio stopped, no `registry=` left in `$HOME/.npmrc` or
      in `npm config get registry`, and every verdaccio-resolved scaffold directory deleted. I2's
      flip-day cold scaffold cannot tell the two registries apart if any of this survives (XR-11).
- [ ] Owner sign-off recorded here: `signed-off: ____________  date: __________`
