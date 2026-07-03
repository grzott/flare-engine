# OSS Launch Audit — 2026-07-02 (rev. 2)

Research/audit session, two workflows: 16-agent launch/market audit + 5-agent package-consumption verification across all four consumer programs. Companion: [monetization-strategy-2026-07.md](monetization-strategy-2026-07.md). No code changed.

## Premise (owner constraints, 2026-07-02)

- Small project by design: primary user is the owner; purpose is self-use + making the RN ecosystem more accessible to game devs. Adoption is welcome, not the business.
- The owner lives off building apps/websites **on** the engine — the engine is infrastructure, not product.
- Name is settled: owner holds flare-engine.com (→ flareengine.dev), flareengine.dev, the `flare-engine` npm org, and will acquire flareengine.com when its renewal lapses.
- **September 2026 release is fixed.** Release = public flip (npm public + repo public + docs live). Marketing (HN/Reddit) is decoupled — no day-one announcement required.
- Engine is in testing phase (restricted npm, 0.2.x) until the flip.

## Verdict

The September flip is achievable with room to spare **if release is defined as "public and installable" rather than "marketed."** The engineering is done; what remains is the flip mechanics, the docs-site funnel, and an honesty sweep. The marketing-facing gaps (README visuals, showcase assets, playground, benchmarks) move to announce-when-ready — after September, on the owner's schedule.

## Claim check: "virtually every package has a real implementation proven by PT / grzegorzotto.dev / flareengine.dev"

Verified package-by-package across Pan-Tvardowski, Berek, flare-engine-page, grzott-portfolio, and in-repo consumers (templates/benchmarks). Result: **substantially true — with four precise holes and one misattribution.**

### Coverage by evidence tier (40 packages)

**Tier A — imported and exercised by a production program (33):**

| Consumer | Packages (import counts) |
|---|---|
| PT (alpha, npm ^0.2.1) | ecs(103), engine(72), physics(70 — CollisionWorld), assets(66), math(54), render(43), testing(40), storage(26 — MMKV prod save path), ui(25), shapes(25), iap(22 — real content gates), localization(21), postfx(12), animation(11), ui-shop(8), share(7), errors(6), debug(6), events(4), dialogue(4), a11y(4), react(3), deep-links(3), progression(2), iap-revenuecat(2 — env-gated real RevenueCat construction), devtools(1 — HUD in AppRoot), cli(devDep, pack-kenney script) |
| Berek (scaffold proof) | tilemap(6 — the XP5 proof), physics(solid-grid), react, assets, render, input(type), ecs |
| flareengine.dev (production browsers) | core, math, **particles**, postfx, animation, ecs — runtime imports at ^0.2.1 in the three hero demos |
| Via engine barrel at PT runtime | core (every frame via GameView), audio, scene (fadeTransition), input (VirtualJoystick via react) — exercised, no direct import line |

**Tier B — engine-lineage code in production, dependency installed but not yet import-wired (2):** `simulation` (page nbody/ripples are code-byte-identical twins — materially honest; scalar-field deliberately drifted) and `render-web` (page postfx-surface is drifted same-lineage). Page dogfood rows D2–D5 close this.

**Tier C — Noop-sink consumption (3):** `leaderboards`/`analytics`/`achievements` — PT's wiring pushes real events (4 analytics events, per-zone score submits, 2 achievement unlocks) into hard-wired NoopProviders. The plumbing is production-proven; no real backend adapter exists (by design at 0.2.x). ~60 LOC interface+Noop+context each.

**Tier D — own tests only (2):** `haptics` (72 LOC stub, zero callers anywhere — `/haptic/i` greps empty across PT) and `pathfinding` (1,009 LOC, real A*/JPS/navmesh implementation, zero consumers anywhere).

### The misattribution

**grzegorzotto.dev does not run engine code today** — zero deps in any package.json/pnpm-lock, no vendored/CDN/iframe path (conclusively re-verified). Its collapse-demo physics (`apps/web/src/lib/dynamics/`) is *original* rigid-body code written to be lifted INTO a future `@flare-engine/dynamics`; the site's "built with my 2D engine" trigger text is what the portfolio's own audit calls literally-true-but-misleading. Two honest fixes, either works: lift `dynamics` into the engine and rebase the demo (preferred — code exists, 1–2 wks, makes the claim true), or reword the trigger text (minutes).

### Corrections to rev. 1 of this audit

- "particles has zero consumers" was PT-only truth: **flareengine.dev runtime-imports particles in all three hero demos** — production-proven on web. PT still routes around it (hand-rolled ECS FX). Verdict softens from redesign-or-cut to: keep, add an ECS/SpriteBatch-integrated emitter shape alongside.
- PT has two **phantom deps**: `@flare-engine/debug` (6 real imports) and `@flare-engine/input` (test-only) are used but undeclared in package.json — resolve transitively today, break on strict install. Fix in PT before the flip.
- Berek README references a deleted `src/movement.ts` (folded into physics at 0.2.1) — minor drift.

## September plan (fixed date, quiet launch)

### Must land for the flip

1. **Public-flip runbook + rehearsal** — the only genuinely risky item. 40× `publishConfig.access` restricted→public + `.changeset` access flip + provenance re-add (removed in S4b) + npm access change on published packages + README/CONTRIBUTING restricted-section rewrite + repo-visibility flip, sequenced. Rehearse like S5 did.
2. **`create-flare-app` publish** — currently `"private": true` at 0.0.0; README already tells users to run it. Publish + cold-machine `npm create flare-app@latest` verify. Without this there is no quickstart.
3. **Docs site live** — deploy to Cloudflare, bind flareengine.dev, verify WASM MIME on the real host; rewrite getting-started (drop the NPM_TOKEN block); `GENERATE_API=1` typedoc dry-run **now**, not launch week.
4. **Honesty sweep (docs-vs-code)** — architecture.md planck.js + flow-fields claims (neither exists), E1 `createWebFrameRenderer` export drift, lockstep-vs-independent SemVer contradiction, stale counts (36 vs 40+1 packages, 32 vs 42 easings, 0.2.0 vs 0.2.1), October→September date sweep, PT phantom deps.
5. **Repo-public hygiene decision** — SESSION_LOG.md (7,385 lines) + `.claude/` harness + docs/plans/ go public with the repo. Deliberate choice (the AI-transparency story may be an asset for the blog); at minimum un-link package READMEs from `.claude/skills/`.
6. **Community minimum** — LICENSE is done; add SECURITY.md, CoC (CONTRIBUTING already promises one), basic issue template, FUNDING.yml. An afternoon.

### Strongly recommended in the window (serves the mission, not the marketing)

- **Keyboard input** for `input` — the only missing input modality; unlocks desktop-web games for the audience the mission targets. Days.
- **RN-free core barrel / headless entry** — the barrel's react-native entanglement bit PT tooling twice and blocks the headless consumption path the owner's own sites use. ~1 wk.
- **Tiled/LDtk official authoring story** — parsers exist; a docs page + LDtk-entity→ECS spawn convention + the topdown template is what "accessible to game devs" concretely means. 1–2 wks.
- **`dynamics` lift** from the portfolio (or reword the site claim).
- **Postfx array-uniform truncation fix** — small bug, unblocks documented workaround.
- Commit the dangling gate-green work in PT/Berek repos.

### Post-flip, announce-when-ready (owner's schedule — no HN pressure)

README GIF + 20-line snippet · PT showcase assets on the docs site · page dogfood D2–D5 (closes Tier B) · real web benchmark numbers (NUMBERS.md spike table is empty; a parity post already shipped) · in-browser playground · real-device docs-site pass · OG images · CI-on-main + badge · Trusted Publishing OIDC · Tier-0 live-tweak inspector (2–4 wks; also the owner's own best productivity tool) · blog-schedule reconcile (the 07-29 "Open beta" and 08-31 "v1.0" slots are the owner's to retitle — advisory, since packages stay restricted until September).

## Name (downgraded from P0 to a note)

Owner holds the domains and the npm org; for a small project a rename is unwarranted. Do add a one-line disambiguation to README + docs-site FAQ — "not affiliated with flareteam/flare-engine, the C++ action-RPG engine (flarerpg.org)" — because search collisions are real and the note costs nothing. EUIPO trademark: optional at this scale; revisit only if third-party adoption materializes.

## Module roadmap (re-ranked for self-use + ecosystem accessibility)

**Launch window:** keyboard input · Tiled/LDtk story · headless/RN-free core path · dynamics lift · postfx array-uniform fix · haptics decision (either wire PT hit/bomb haptics — the cheapest way to give the stub a real consumer — or mark it experimental in the README table) · particles: add ECS-integrated emitter shape (page proves the current shape for creative-coding; PT proves ECS games need a different one).

**Post-flip:** Tier-0 live-tweak inspector (Expo devtools-plugin bridge + tweakpane over ECS; 70% exists in `devtools`; needs a World entity iterator) · pathfinding consumer (Berek enemy-chase or a topdown-template example — turns the only unconsumed real package into a taught feature) · Tier-2 API generality fixes (DropPity shape, multi-track resolveStats, collectible capstone, `san` dynamic keys — each converts a documented PT keep-local into a dedup) · a11y MotionPolicy, quality governor, object pool, procedural SFX (PT-evidenced generics, one small arc).

**Demand-gated (unchanged from rev. 1):** planck.js opt-in `physics-rigid` when a consumer needs joints/stacking (planck v1.5.0 verified healthy; pure JS is the only portable RN option — Hermes WASM still experimental) · arcade physics extensions when a platformer consumer appears · C++/Nitro acceleration stays data-gated behind the Phase-10 bench gate (~4ms/frame collision+particles on floor-spec Android after spatial-hash broadphase + SkSL GPU offload; JS stays the web path if ever tripped) · in-browser scene editor (engine prerequisites per the portfolio feasibility doc: JSON scene format + data-driven loader) · Tier-2 real adapters · networking: out of scope, position deliberately.

## Fact corrections from the verify passes (keep for future posts)

Phaser Editor is **$12/month** (not $29); Rive exports are **no longer free** (runtimes stay MIT); LDtk's last release was **Jan 2024** (~2.5 yrs — still the best free auto-tiling editor, don't call it "actively developed"); the JS-vs-WASM canvas-particle study had **WASM ahead ~1.29x**; react-native-mmkv's Nitro rewrite is **v4**. Market context that still holds at any project size: the RN-first niche is empty (react-native-game-engine dormant 6 yrs, still ~1.6k dl/wk; RN-Skia ~1.23M dl/wk is the funnel), and for code-first TS devs the adoption gates are runnable examples + docs, never an editor.
