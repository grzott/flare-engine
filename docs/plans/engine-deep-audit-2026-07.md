# Engine Deep Audit — 2026-07-02 (fresh pass)

> **Superseded 2026-07-03 as a queue** by [road-to-oss-2026-09.md](road-to-oss-2026-09.md); this is
> an evidence ledger only. Two decisions post-date it: the flip is **October 2026** (not September)
> and the engine relicenses **MIT → Apache-2.0**. Any "September flip" heading and the
> "October→September date sweep" directive here are historical — do NOT execute them; the road-to-oss
> doc wins. A 2026-07-03 final audit (road-to-oss §16) added launch-blocker rows on top of this pass;
> full ledger in `_local/final-audit-2026-07-03.md`.

Research/audit session. One 34-agent workflow: 8 package-group deep readers + 8 adversarial verifiers (every quoted claim re-verified against code at file:line), 3 consumer-repo auditors (Pan-Tvardowski, flare-engine-page, grzott-portfolio), 5 OSS-readiness dimensions, 5 web-research topics + 5 fact-checkers (every version/date re-verified against registries on 2026-07-02). No code changed.

Companion, not derivative: the launch/consumption + monetization framing is folded into the living OSS plan, [road-to-oss-2026-09.md](road-to-oss-2026-09.md) (the standalone launch/monetization notes are kept out of the repo). This pass is code-level and ecosystem-fresh. Per-package detail: [package-findings-2026-07.md](package-findings-2026-07.md).

## Verdict

The engine core is genuinely production-grade — foundation/render/postfx/storage/localization are proven, test realness is uniformly high, and zero `any`/`@ts-ignore` across all 41 src trees. But this pass found **~20 confirmed code bugs the green gate cannot see** (fake-based tests, untested default branches, doc-vs-code drift), a **first-run funnel broken at every link**, and **one time-critical item nobody had: the publish credential needed rotation before the flip window (owner action, tracked privately)**. The work is a bug shortlist + flip mechanics + a systemic README truth pass, not features.

On the owner's four ideas: **planck.js yes (post-flip, opt-in, `planck` not `planck-js`)**; **C++ modules no (the data gate is nowhere near tripped — fix algorithms in JS first)**; **devtools yes and first (it unblocks PT's deferred balance pass)**; **live editor never (playground + inspector give 90% of the value)**.

## 1. Confirmed-bug ledger (new in this pass)

All verified with file:line evidence by an independent second agent; full list per package in [package-findings-2026-07.md](package-findings-2026-07.md). Ranked by user impact:

| # | Bug | Where | Impact |
|---|-----|-------|--------|
| 1 | `FORMAT_CODES { png: 3, jpeg: 2 }` vs real RN-Skia `ImageFormat { JPEG=3, PNG=4 }` | share `capture.ts:41` | Screenshot capture broken: png yields JPEG bytes, jpeg passes kICO → null. Fakes-based tests can't catch it |
| 2 | Camera rotation radians/degrees four-way contract break: `CanvasLike.rotate` labeled radians, both bridges forward verbatim to degree-taking Skia, api-specs claims web converts, shapes DOES convert | render `frame-renderer.ts:120`, render-web `web-surface.ts:39`, api-specs.md:295 | Any nonzero `Camera2D.rotation` renders wrong on both backends |
| 3 | Scaffolds stamp `@flare-engine/*: "^0.0.0"` (CLI never passes flareVersion) | create-flare-app `cli.ts:31-36`, `scaffold.ts:149` | `npm create flare-app` broken even after publish — launch blocker |
| 4 | `spawn('npx.cmd'/'bun.cmd', {shell:false})` → EINVAL on Node ≥20.12 Windows, in both `flare new` and the scaffolder's install step | cli `cli.ts:93-98`, create-flare-app `scaffold.ts:96-104` | Windows scaffolding broken end-to-end |
| 5 | Pathfinding heap capped at 4096, never grows; overflow pushes corrupt the open set (NaN bubbles up) | pathfinding `astar.ts:163`, `jps.ts:117` | Silent wrong paths on ~64×64+ open maps; zero consumers so never seen |
| 6 | RevenueCat restore maps `entitlements.all` (includes expired) → re-grants lapsed subs; customer-info listener unsubscribe NEVER works (nulled before async add); purchase tx id is a date string | iap-revenuecat `provider.ts:41,155-180` | Real money-path bugs in the one concrete tier-2 adapter |
| 7 | Restart-current-scene reuses the just-destroyed instance (stale World); transition path never awaits async `onPreload` | scene `scene-manager.ts:57,215` | Two silent lifecycle traps on the most common patterns |
| 8 | Tiled flip/rotation GID bits never masked → wrong tileset + lost colliders; LDtk multi-tileset broken; LDtk IntGrid never reaches `extractColliders` (always `[]`) | tilemap | The authoring pipeline works only on the narrow Berek path |
| 9 | Throwing handler wedges Signal/EventEmitter deferred removal (no try/finally); nested emit resets the flag early | events `signal.ts:39-50`, `emitter.ts:54-71` | Engine-wide: GameLoop, Query, ScreenManager all broadcast via Signal |
| 10 | Focus ring never re-renders (context value stable, `Button` reads focus unsubscribed); no input driver exists at all | ui `focus-provider.tsx:16-25`, `button.tsx:46` | README's "keyboard/gamepad navigation" claim is neither wired nor visually functional |
| 11 | Per-frame React churn: `setPicture`+`setPasses` every frame, fresh arrays defeat bailout, `RuntimeShader` elements re-created, 4 inline handlers + style array per render | react `game-view.tsx:177-237` | Floor-device perf; violates the repo's own zero-alloc rule at the hottest seam |
| 12 | `importJSON` clears storage before validating entries (wipe on bad payload); `runMigrations` silently skips gaps despite doc claiming it throws | storage `storage.ts:132`, `migrations.ts:28-42` | Save-data integrity traps |
| 13 | Dangling dialogue `next` id silently ends conversation; branch/action cycles recurse to stack overflow | dialogue `runner.ts:93-96,164-180` | Worst possible failure mode for content authors |
| 14 | `myapp://zone/4` → first path segment eaten as host; `/zone/:id` never matches (the standard RN deep-link shape) | deep-links `parse.ts:23-34` | Undocumented; README example itself hits it |
| 15 | ParticlePool cap is prewarm-only (core Pool falls through to factory) → unbounded per-frame allocation past prewarm; LCG seed hardwired to 1 | particles + core `pool.ts:23-27` | Contradicts the pool's whole purpose |
| 16 | GameLoop never exposes the fixed-timestep interpolation alpha | core `game-loop.ts:96-120` | The classic missing piece; prerequisite for any physics integration |
| 17 | `CollisionWorld.add` on an existing entity leaves a stale duplicate broadphase record; `Pointer.delta` overwrites (not accumulates) same-frame motion | physics `collision-world.ts:77-79`, input `pointer.ts:63-68` | Small correctness traps in hot systems |
| 18 | `serializeScene` registers N+1 permanent World queries per call (query removal API still missing); devtools enumerates entities via a `nextId` cast promising an iterator that never landed | testing `scene-snapshot.ts:25-31`, devtools `hooks.ts:26` | The missing ecs `query.dispose()`/entity-iterator is the root cause of three separate hacks |
| 19 | Engine barrel is RN-only (`export * from react` pulls react-native at module scope); explicit `GameConfig` export silently shadows react's different `GameConfig` | engine `index.ts:2,32` | Blocks headless/web; has bitten PT scripts twice |
| 20 | Audio `rate` option declared but never applied (interface lacks playbackRate); "auto-suspends on background" claimed in README + api-specs, implemented nowhere | audio `sfx-pool.ts:8` | Dead API + false claim shipping in a public package |

Systemic (not a single bug): **README code examples fail to compile in ~24 of 41 packages** — verified group-by-group. Every package README also ends with a relative `../../docs/design/api-specs.md` link that 404s on npmjs.com, and every `bun add @flare-engine/...` install line fails until the access flip. A one-day compile-every-README-snippet pass is the highest-ROI single task before the flip.

## 2. September flip — consolidated order (fresh findings merged with rev. 2)

Time-critical and irreversible items first:

1. **Rotate the publish credential.** The npm publish credential needed rotation before the flip window (owner action, tracked privately). Trusted publishing (per-package manual config ×40) is a post-flip arc, not launch-blocking.
2. **History/exposure audit before any visibility flip** (irreversible). Secret scan PASSED (full 847-file history, no live secrets, no .npmrc/.env ever committed). Remaining hygiene: add `.npmrc`/`.env*` to .gitignore (README instructs creating a root .npmrc that would be trackable today); scrub local `C:\` paths from `.claude/skills/retro/SKILL.md:21-23` + todo.md; decide fate of the two untracked private strategy notes (kept out of the repo), SESSION_LOG.md (7,385 lines) and `.claude/` (recommendation: keep public as the AI-transparency asset); git author email is grzott@gmail.com on every commit (owner's call). GitHub flip gotchas (verified): stars/watchers erased, push rulesets disabled, entire Actions history becomes public, private forks detach.
3. **Tarball audit of published 0.2.x** before `npm access set status=public` — visibility is retroactive for all published versions and effectively one-way.
4. **Order matters: repo public → re-add provenance → npm flip.** Provenance hard-fails on private repo/package (the S4b landmine, reversed). Then scripted `npm access set status=public @flare-engine/<pkg>` ×40 + flip release with `.changeset/config.json` access:public + 40× publishConfig in one commit. Rehearse on verdaccio like S5. `ci.yml` runs on pull_request only — add a push-to-main backstop for the flip commit. Note `.changeset/config.json` ignores `@flare-engine/benchmarks`, a package that doesn't exist.
5. **create-flare-app:** fix the `^0.0.0` stamp (derive flareVersion from package.json), real version, drop `private:true`, fix both Windows spawn EINVALs, fix `.version('0.0.0')` in both CLIs, rename template `.gitignore` → `gitignore` (npm packlist strips dotfile), add the missing `react-native-safe-area-context` to template deps, publish, cold-machine verify. Also: shmup/blank templates render a black screen vs their "enemy spawner, HUD score" manifest claims — enrich or soften; shmup starter leaks bullets (never despawned) and allocates in `onUpdate`.
6. **Peer-range bump, ship as 0.3.0.** Current floors are false advertising vs July 2026 reality: react >=18 (12 pkgs) vs RN-Skia 2.x hard-requiring react >=19; react-native >=0.73 vs Skia's >=0.78 floor (0.73–0.77 are legacy-arch era, unsupportable); skia >=1.0.0 vs tested 2.6.x; canvaskit-wasm >=0.40 vs RN-Skia's exact 0.41.0 pin. Same pass: mark the skia peer **optional** in render/shapes/assets (zero runtime imports — this is also what pulled the full RN tree into the web-only page repo), drop the dead `react-native-gesture-handler` peer (input, react, engine — never imported), add the missing `react-native-safe-area-context` peer to engine. Validate once against the stack new users scaffold: Expo SDK 57 / RN 0.86 / React 19.2 / Hermes V1 / Skia 2.6.9.
7. **Fix the flip-blocking bug shortlist** (ledger #1–4 + #7 minimum: share format codes, camera rotate, scaffolder, spawns, scene restart). The rest can land as 0.4.x post-flip.
8. **README/docs truth pass** (one day, systemic): compile every README snippet; replace relative api-specs links; rewrite the restricted-npm install sections; tier-2 "adapters land at 0.2.0" promises (we're at 0.2.1 with none); `.claude/skills` + private-PT deep links in 5 package READMEs; haptics-expo promise (api-specs.md:797).
9. **Docs honesty in design docs:** architecture.md presents planck.js integration + rbush SpatialIndex + flow-fields as shipping — none exist; SemVer story contradicts itself (docs say independent, `.changeset` is fixed lockstep — README:14 even says "lockstep cut" while README:159 says independent); 0.2.0→0.2.1; October→September sweep (README, AGENTS.md:47 incl. stale "feature-complete at 0.1.x", CONTRIBUTING.md:5, docs/README.md:25, roadmap.md:48); easings count is 32/42/35 in three places (actual 35); shapes package absent from architecture.md and api-specs entirely.
10. **Governance afternoon:** SECURITY.md, Contributor Covenant (CONTRIBUTING.md:114 promises it "at 0.1.0-rc" — visibly broken promise on day one), issue/PR templates, FUNDING.yml (tip-jar), Discussions on, and the one-line flarerpg.org disambiguation (exists nowhere today).
11. **Docs site (flare-engine-page):** not deployed yet; October appears in 7+ strings incl. the footer; typedoc API reference is gated off (`GENERATE_API=1` never dry-run); guides link the private GitHub repo (dead until flip); PT showcase uses placeholder assets; Berek absent. Lighthouse is already launch-grade (98–100). Engine-side prerequisite for its D3 dogfood row: the render/assets optional-peer fix (item 6).

## 3. Module roadmap — the owner's four ideas, adjudicated with fresh data

### Physics / planck.js — yes, post-flip, opt-in

- **Pick `planck` v1.5.0** (npm `planck`; the legacy `planck-js` name is frozen at 1.3.0 — naming trap). Verified 2026-07-02: released 2026-04-07, pure TS, zero runtime deps, MIT, 5.3k stars, active (piqnt). It is the only candidate satisfying every constraint at once: runs on Hermes today (no WASM), maintained upstream ("too much typing to manage myself" is moot — it's a dependency, not a codebase to own), Box2D semantics with sleeping/joints.
- **Do not build the RN path on WASM.** Hermes WASM is an explicit "not ready for production" early preview (Feb 2026, tmikov); react-native-rapier and Polygen are both stalled experiments. rapier2d (healthy, 0.19.3) stays a possible web-only backend later — keep planck types out of the public API (thin facade) so that swap stays open.
- **Architecture:** `@flare-engine/physics-rigid` adapter over ECS — package owns the `planck.World`, components store opaque handles, sync-in before / read-back after `step()` into preallocated snapshots; fixed-timestep accumulator with render interpolation (**prerequisite: expose GameLoop alpha — ledger #16, tiny change, do it in the flip window**); reuse plain `{x,y}` scratch (planck v1 accepts Vec2Value everywhere); `world.queueUpdate()` for mid-step mutations; document determinism honestly (same-device replay yes, cross-platform bit-determinism no).
- **In the window instead:** fix the existing detection-only `physics` package's real gaps — MTV/overlap-depth helper, `CollisionWorld.raycast` with mask, duplicate-add guard, and the grid broadphase its own comment prescribes.
- **`@flare-engine/dynamics` (portfolio lift)** is a separate, real option: the donor is 556 lines, DOM-free, deliberately written house-style for lifting (SAT + sequential impulse + friction/restitution/Baumgarte — things planck also does, minus maturity). As of today the owner's v3 work made the collapse bake seedable, so the byte-identical-bake migration gate is implementable. Sequence per the portfolio's own doc: reword the "built with my 2D engine" claim first (minutes, fixes the one actually-false public claim), rebase vec.ts on `@flare-engine/math` second, lift the solver as a post-flip milestone if wanted — note it needs a zero-alloc pass (donor allocates per vec op) and would overlap planck; pick ONE as the rigid-body story (recommendation: planck for games, dynamics lift only if the portfolio-credibility milestone matters more than avoiding duplicate scope).

### C++ / native optimization — no; the gate is not tripped

- **The owner's own data says no bottleneck exists:** device baselines (2026-05-26, Pixel 6/Pixel 10/Galaxy A55) show worst-case p95 frame 3.7 ms against the 16.7 ms budget; the protocol gates Tier D (native C++) on sustained <60 fps on Pixel 6a **after** tiers A–C. Nothing is close. _(The engine-side copy of that data was a dead fork of Pan Tvardowski's and was deleted 2026-07-28; the living harness, protocol, and ndjson history are in the [PT repo](https://github.com/grzott/Pan-Tvardowski) under `docs/perf/`. Engine device measurement is rebuilt in Arc PERF — see [perf-measurement-2026-07.md](perf-measurement-2026-07.md) §11.7.)_
- **The measured headroom is algorithmic and rendering-side, in JS:** (1) grid spatial hash replacing the brute-force broadphase (its own comment says "<~1000 entities, upgrade to grid/rbush" — 10–100× at 1k+); (2) Float32Array SoA for particles (currently object pool — and fix ledger #15 first); (3) single typed-array write + one JSI call per Atlas per frame — the exact diagnosis in Shopify/react-native-skia #2521 (10k sprites on iPhone 12 mini vs ~300 on budget Android, still open upstream); (4) SkSL screen-space effects on the proven postfx path.
- **If the gate ever trips:** Nitro Modules v0.36.1 (verified: ~73 ns/call vs ~1.16 µs TurboModule; mainstream — mmkv v4, unistyles) with a single `step(ArrayBuffer)` per frame over one shared SoA buffer — never per-entity calls (Nitro's own docs: marshaling eats small-call gains). Budget the hidden cost: a C++ core forks the hottest subsystem (web needs a WASM twin) — roughly doubles its maintenance for a solo dev. Precedent says nobody at this scale needed it (Expo's own guidance: pure-JS physics + Skia at 60fps).

### Dev tools — yes, and first among the four; it feeds PT directly

Sequence (verified tool choices):

1. **ecs prerequisites** (small, engine-repo): public World entity iterator + `query.dispose()` — kills the `nextId` cast, the serializeScene leak, and the permanent-query landmine in one arc.
2. **`@flare-engine/devtools` real inspector:** param-registry "tweak handles" (writes into existing refs, panel polls at UI rate — hot paths stay zero-alloc) + component values for the selected entity + the existing snapshot ring buffer. Web overlay on **Tweakpane 4** (framework-agnostic ESM, maintained; avoid leva — React-bound, sporadic). Split the RN entry so pure web installs work (today the react-native peer + module-scope imports block it).
3. **Expo devtools-plugin transport** for the same registry (`create-dev-plugin` + `useDevToolsPluginClient`; API stable since SDK 50, docs current 2026-06). This is on-device PT tuning — **it directly unblocks the deferred holistic balance/density pass**, the highest-value self-use payoff available.
4. **Docs playground (launch-window, small):** 3–5 curated editable examples on flareengine.dev as a fully static client-only playground (CodeMirror/Monaco + esbuild-wasm or import maps + prebundled engine ESM + canvaskit). The KAPLAY pattern — its playground was the decisive adoption asset. **Skip WebContainers** (commercial license required for production for-profit use) **and Sandpack** (no stable release since 2025-02).

### Live editor — never build it

Evidence: GDevelop's editor IS the product with a company behind it; ct.js (editor-first, solo) sits at ~320 stars; kaplay/littlejs/excalibur all thrive editor-less; Theatre.js died holding timeline-editor scope even with funding; Excalibur's browser-extension inspector has 8 stars (wrong form factor). The playground + inspector + Tiled import cover the real need. Tilemap authoring story = **Tiled 1.12.x** (active: three 2026 releases) as primary, LDtk secondary (no stable release in 2.5 years, repo alive) — which means fixing the tilemap parser holes (ledger #8) is the actual editor work.

### New-module shortlist (ranked, evidence-based)

| Rank | Module/feature | Why | Size |
|---|---|---|---|
| 1 | Keyboard input in `input` | Only missing modality; unlocks desktop web for the mission audience | days |
| 2 | RN-free headless entry for `engine` (drop react from barrel or `./headless` subpath) | Bit PT twice; blocks every web/headless consumer incl. owner's sites | ~1 wk |
| 3 | Default asset loaders (web fetch + RN file) behind the existing `AssetLoader` type | Today "manifest-driven loading" is 100% caller-supplied plumbing — first-run wall | days |
| 4 | Particles v2: emitter shapes + injectable pool/seed + an ECS/SpriteBatch render adapter | PT rolled its own FX stack; page uses the pool — two consumers proving two different missing shapes | ~1 wk |
| 5 | Tier-2 local providers: memory leaderboards, console+memory analytics, save-backed achievements | ~40–100 LOC each; converts three interface-only packages into usable ones; kills the stale 0.2.0 promises | days |
| 6 | Haptics expo-haptics adapter (~50 LOC, structural injection) + navigator.vibrate web | PT's design docs call it "the one true engine gap"; README already promises it | days |
| 7 | `errors.installGlobalErrorCapture` (unhandledrejection/onerror/ErrorUtils) + injected Sentry-like client for web | Game-loop/async crashes — the majority — currently never reach any transport | days |
| 8 | math curves (bezier/catmull-rom `*Into`) + segment intersection + `SeededRNG` get/setState | Standard expectations; RNG state unlocks deterministic saves | days |
| 9 | render table-stakes: flipX/flipY, per-batch additive blend, 9-slice, opt-in camera culling | No supported sprite-mirror path at all today; additive is a shmup/particle staple | ~1 wk |
| 10 | PT-driven API generality fixes: imperative movement-integrate form, domain-shaped drop pity, multi-track resolveStats, collectible capstone fallback, test-safe `__DEV__`, vignette-tint postfx | Each converts a documented PT keep-local into a dedup — second-consumer evidence already exists | small each |
| — | `physics-rigid` (planck) | Demand-gated as above | ~2 wk |
| — | `dynamics` (portfolio lift) | Portfolio milestone; overlaps planck — pick one story | XL |

## 4. Ecosystem watch (all verified 2026-07-02)

- **RN 0.86** (strict 2-month cadence); New Architecture is the only architecture since 0.82; **Hermes V1 default since 0.84** — it is NOT Static Hermes (no native compile, no type-driven opt, no JIT; New Expensify gains were single-digit %).
- **Expo SDK 57** (RN 0.86, React 19.2, quarterly cadence). Known regression worth a template note: importing reanimated under RN 0.85+ Hermes raises Android memory 25–30% — the engine has **no reanimated peer anywhere; keep it that way**.
- **RN-Skia 2.6.9** (weekly-ish): peers react >=19 required, RN >=0.78 optional; ships Skia m150 prebuilt binary packages; pins canvaskit-wasm exactly 0.41.0. **Graphite/WebGPU lives in `@next` and is explicitly not production** — wrong risk pre-launch, revisit after. Atlas floor-device issue #2521 open since 2024.
- **canvaskit-wasm 0.41.1**, ~1.7M dl/wk, ~annual cadence, no deprecation signal (Flutter keeps CanvasKit as default web renderer). Low risk; re-check annually.
- **react-native-mmkv v4** is a Nitro rewrite — any future MMKV storage adapter inherits the `react-native-nitro-modules` peer.
- **npm mechanics:** trusted publishing = per-package manual config, GitHub-hosted runners only, npm ≥11.5.1; provenance requires public repo + public package and in practice an explicit `--provenance`/publishConfig flag. The publish credential itself needed rotation before the window (owner action, tracked privately).
- **Launch-pattern evidence:** KAPLAY won on a day-one playground + examples; LittleJS on itch.io jams (571 signups) + tiny builds; Excalibur on cadence + a services company. Show HN bar: immediately runnable, author present. GameFromScratch's annual JS/TS engine roundup will find the repo once public + active.

## 5. Delta vs the 2026-07-02 rev. 2 audit

**Confirms:** September-flip-achievable verdict; flip runbook + create-flare-app as top must-lands; keyboard/headless/Tiled/dynamics/haptics as the launch-window module list; planck demand-gated; C++ data-gated; editor never.

**Adds (new information):** the confirmed-bug ledger (§1) with file:line evidence; the publish-credential rotation need (owner action, tracked privately); the `^0.0.0` scaffold stamp (worse than "unpublished"); two Windows spawn EINVALs; the peer-floor bump as 0.3.0; ~24-package README compile failures + npm-404 doc links as a systemic class; the render/assets required-peer bug that drags RN into web installs; devtools tool choices verified (Tweakpane yes / leva no / Theatre.js dormant / WebContainers licensed / Sandpack stalled); Tiled-over-LDtk with 2026 release evidence; npm token/trusted-publishing/provenance mechanics verified in detail; GitHub visibility-flip side effects verified.

**Corrects/updates rev. 2:** PT's "uncommitted gate-green work" note is stale — PT is clean and pushed at e0f35f5 (2026-07-01, shop swap + save redesign landed); PT also declares two dead deps (particles, tilemap — imported nowhere) alongside the two known phantom deps (debug, input); grzegorzotto.dev remains zero-engine-code, but the portfolio now has a ratified migration contract (its docs/reference doc, updated 2026-07-02) and a seedable bake, so the dynamics-lift gate is implementable, not aspirational.
