# Flare Engine — `flare-engine-page` engine-adoption (design, 2026-08-13)

Design SoT for closing the gap between what `@flare-engine/*` ships and what the public site
actually runs. Covers the page-side adoption of `@flare-engine/simulation` and the two engine gaps
that adoption surfaced.

**The point of the work:** `flare-engine-page` declares `@flare-engine/simulation` and
`@flare-engine/render-web` as dependencies and imports neither. It hand-rolls both instead — and
its own published docs say so (`getting-started.mdx:127` "This site's hero currently runs a local…",
`guides/foundations.mdx:38` "The demos on this site still run their own local…"). The engine's
marketing site not using the engine is the same class of claim-vs-reality gap that
[dynamics-lift-2026-08.md](dynamics-lift-2026-08.md) exists to close for the portfolio.

**Decisions taken (do not re-litigate):**

1. **Sim only; postfx deferred.** `demos/postfx/surface.ts` stays page-local until the engine's
   `createPostFxSurface` is at parity (§4.2). Swapping to it today is a net regression.
2. **Never regress the page to adopt a package.** Where page-local code is ahead of the engine,
   the page keeps its copy and the engine gets a row. Applied twice below.
3. **No early publish.** 0.3.0 stays reserved for the October flip. Anything gated on unpublished
   engine code is gated, not worked around with a publish.
4. **The two engine rows are not pre-freeze musts.** They unblock deletion of duplicated code, not
   a defect. See §6 for the calendar call.

---

## 1. What exists today (verified 2026-08-13)

`flare-engine-page/package.json:23-30` declares 8 engine packages at `^0.2.1`. Six are imported.
`@flare-engine/simulation` and `@flare-engine/render-web` are not imported anywhere in `src/`.

Equivalence was verified by comment-stripped diff (`sed 's://.*::'` + block-comment/blank strip)
between the page module and the engine module:

| Page module | Engine module | Code-only diff |
|---|---|---|
| `demos/spacetime/nbody.ts` (277 LOC) | `simulation/src/integrate/nbody.ts` (273) | **empty — identical** |
| `demos/spacetime/ripples.ts` | `simulation/src/wave/wave-packet-pool.ts` | **empty — identical** |
| `demos/physarum/field.ts` (270 LOC) | `simulation/src/field/scalar-field.ts` (289) | superset; one stripped param, dead at the call site (§2.2) |
| `demos/physarum/sim.ts` agent loop | `simulation/src/agent/stigmergy.ts` | generalization + one gap (§4.1) |
| `demos/postfx/surface.ts` (292 LOC) | `render-web/src/postfx-surface.ts` (241) | page ahead on two edges (§4.2) |

The engine modules are lifts **of this page's code** — `stigmergy.ts:10` records it in-file
("lifted verbatim from field.ts"), and the nbody/wave headers are the page's headers with the
showcase-specific prose stripped.

**The published 0.2.1 is behaviorally current.** Four commits have touched `packages/simulation`
since the `@flare-engine/simulation@0.2.1` tag (`c7c03c6` license, `8696136` README, `7c4f7cf`
packaging, `376969a` toolchain), and `git diff --stat` confirms they reach only `LICENSE`, `NOTICE`,
`README.md`, `package.json`, `tsdown.config.ts`, and the `src/index.ts` barrel. **No module source
changed.** So everything in §2 is available from the npm dependency already installed — no publish,
no dev-link, no engine change.

---

## 2. Tier 1 — the simulation swap (page repo)

### 2.1 Spacetime — pure import swap

Both modules are byte-identical to the engine's.

| File | Change |
|---|---|
| `demos/spacetime/sim.ts:29` | `import { type ClosestPair, createNBodySystem } from "./nbody"` → `from "@flare-engine/simulation"` |
| `demos/spacetime/sim.ts:31` | `import { createRipplePool } from "./ripples"` → `from "@flare-engine/simulation"` |
| `demos/spacetime/lattice.ts:17` | `import type { RipplePool } from "./ripples"` → `from "@flare-engine/simulation"` |
| `demos/spacetime/nbody.ts` | delete |
| `demos/spacetime/ripples.ts` | delete |
| `demos/spacetime/nbody.test.ts:7`, `ripples.test.ts:6` | retarget import at the package (§2.3) |

Call sites needing no change: `sim.ts:333` `createNBodySystem(MAX_BODIES)`, `sim.ts:335`
`createRipplePool(28)`, `sim.ts:763` `nb.step(dt, cfg.G, cfg.softening, cfg.gr, cfg.softening)` —
identical signatures.

### 2.2 Physarum — field + sense helpers (agent loop stays local)

`ScalarField` is a superset of `TrailField`. Every method the page calls — `sample`, `deposit`,
`localMean` (`sim.ts:342`), `meanValue`/`maxValue` (`sim.ts:439-440`), `resize` (`sim.ts:472`),
`toRGBA` (identical 6-arg signature) — is present with an identical signature. The one difference is
`step()`, which drops `topBandFrac`/`topBandDecay`.

**That strip costs nothing, because the band is already disabled.** `sim.ts:28` sets
`HEADLINE_BAND_FRAC = 0` ("0 = network fills the WHOLE canvas (like the reactor); >0 starves the
top") and `sim.ts:29` annotates the decay as "unused while FRAC = 0". With `topBandFrac = 0`,
`field.ts:127` computes `topRows = 0` and no row receives the extra decay. Dropping both arguments
is behavior-preserving at the current configuration.

| File | Change |
|---|---|
| `demos/physarum/sim.ts:23` | `import { createTrailField, decideTurn, senseAt, type TrailField } from "./field"` → `import { createScalarField, decideTurn, senseAt, type ScalarField } from "@flare-engine/simulation"` |
| `demos/physarum/sim.ts:207` | `createTrailField(w, h, cfg.fieldScale)` → `createScalarField(w, h, cfg.fieldScale)` — `'toroidal'` is the default, matching `TrailField` |
| `demos/physarum/sim.ts:419` | `field.step(cfg.diffuseRate, cfg.decayRate, HEADLINE_BAND_FRAC, HEADLINE_BAND_DECAY, FIELD_MAX)` → `field.step(cfg.diffuseRate, cfg.decayRate, FIELD_MAX)` |
| `demos/physarum/sim.ts:28-29` | delete both now-unreferenced constants |
| `demos/physarum/field.ts` | delete |
| `demos/physarum/field.test.ts` | retarget import at the package (§2.3) |

The agent loop at `sim.ts:358-410` **stays page-local** — see §4.1. `senseAt`/`decideTurn` are the
engine's now, and typecheck because the field is a real `ScalarField`.

If the headline band is ever re-enabled, that is the moment to file a `ScalarField` region-multiply
row — not before. `erode()` is radial and cannot express a full-width row band.

### 2.3 The tests are retargeted, not deleted

The engine has `packages/simulation/tests/nbody.test.ts`, `wave-packet-pool.test.ts`, and
`scalar-field.test.ts`, so the page's copies are redundant *as engine tests*. They are not redundant
as **consumer-contract tests**: retargeted at `@flare-engine/simulation`, they assert that the
resolved, published, bundled surface behaves — covering the packaging and exports-map failure modes
an in-repo test cannot reach.

Retargeting is one line per file. Keep the test bodies verbatim.

---

## 3. The test gate (page repo, do this first)

`flare-engine-page` has 9 `*.test.ts` files and **no `test` script**. `.claude/hooks/verify.sh` runs
`lint → typecheck → build`. The tests that guard this exact swap have never executed in the gate.

1. `package.json` scripts: add `"test": "bun test"`.
2. `.claude/hooks/verify.sh`: insert a `==> test` step between typecheck and build, matching the
   engine's `lint → typecheck → test → build` order.
3. Run it once **before** the §2 edits to establish a green baseline. A pre-existing failure
   discovered mid-swap is indistinguishable from a swap-induced one.

This lands as its own commit, before §2.

---

## 4. What stays page-local, and why

### 4.1 The physarum agent loop — the perf governor

The page's loop iterates `activeCount` (`sim.ts:366`), which `sim.ts:554` drives from the perf
governor: `activeCount = clamp(Math.round(count * s), Math.min(AGENT_FLOOR, count), count)`. Arrays
are allocated at the `count` ceiling and only the first `activeCount` are stepped, so cost tracks the
budget while the pheromone field is preserved — "a smooth thin/thicken, no re-seed"
(`sim.ts:202-204`).

The engine's `AgentField.count` is `readonly` and `update()` loops all of it (`stigmergy.ts:120`).
Adopting `createStigmergy` today silently drops agent-count scaling on slow devices.

Everything else about `createStigmergy` **is** a clean fit: same Jones sense→rotate, same chaos
jitter, same toroidal wrap, same deposit, and the page's chemotaxis block maps onto the
`onSense(i, x, y, heading) => number` hook. It also upgrades the loop from `Math.random()`
(`sim.ts:375`) to a seeded, deterministic `SeededRNG`. Unblocked by E1 (§5).

### 4.2 The postfx surface — context lifecycle and loss recovery

`demos/postfx/surface.ts` carries three hardening behaviors, declared in its own header
(`surface.ts:11-20`). Status against `render-web/src/postfx-surface.ts`:

| Behavior | Engine 0.2.1 | Engine HEAD |
|---|---|---|
| Explicit WebGL context lifecycle, freeing `GrDirectContext` + handle on `dispose()` | absent | absent |
| `webglcontextlost` / `webglcontextrestored` self-heal (`sceneCanvas()` → `null` while lost) | absent | absent |
| `resize()` rebuilds the on-screen surface | absent | **present** (OSS-C1, `postfx-surface.ts:208-224`) |

The page and the engine fixed the resize bug independently. The first two are still page-only, and
they are not cosmetic: browsers cap live WebGL contexts, so leaking one per hero-animation switch
eventually force-loses the oldest. Adopting the engine's surface at 0.2.1 regresses all three; at
0.3.0 it regresses two. Unblocked by E2 (§5).

---

## 5. The two engine rows

Both exist only because the page ran ahead of the engine. Both are game-agnostic — neither encodes
anything about this site — and both have a working reference implementation in a named page file to
test against.

**E1 — `simulation`: `AgentField` settable `activeCount`.**
Make the stepped-agent count mutable (allocate at the `count` ceiling; step, deposit, and iterate
only the first `activeCount`), exactly the shape the page already runs at `sim.ts:202-205`. A quality
throttle is table stakes for any agent sim shipping to mixed hardware. `forEachAgent` and `resize`
honor it. Unblocks §4.1. One lockstep minor changeset.

**E2 — `render-web`: `createPostFxSurface` context lifecycle + loss recovery.**
Take explicit ownership of `GetWebGLContext` → `MakeWebGLContext` → `MakeOnScreenGLSurface`, free
the `GrDirectContext` and the context handle in `dispose()`, and handle
`webglcontextlost`/`webglcontextrestored` by no-op'ing draws while lost and rebuilding GPU objects on
restore. Every web consumer hits the browser context cap; today the package leaks a context per
surface. Unblocks §4.2. One lockstep minor changeset.

**Cut under YAGNI:** a `ScalarField` rectangular-region multiply. It would be needed only to
re-enable the headline band, which the page has switched off (§2.2). File it if the band returns.

---

## 6. Sequencing and the freeze calendar

**Page-side (independent, do now):** §3 test gate → §2.1 spacetime → §2.2 physarum. Three commits,
no engine dependency, no publish. Net ~820 LOC deleted across three modules.

**Engine-side (E1/E2):** these unblock deletion of duplicated code. Nothing is broken today, no
consumer is blocked, and no launch claim depends on them. They must **not** jump the pre-freeze
queue ahead of Arc OSS and Arc PERF, whose capacity note in [todo.md](todo.md) already reads "lands
by Oct 5 with slack, not without."

Two honest options, owner's call at planning time:

- **Below the P2 cut-line, pre-freeze.** If the calendar stays green they ride the 0.3.0 cut and the
  page finishes its adoption the week the flip lands. If it tightens they slip untouched.
- **Post-flip, with 0.4.0.** They land alongside [dynamics-lift-2026-08.md](dynamics-lift-2026-08.md),
  which is already a 0.4.0 post-flip lift from a sibling consumer — same shape, same arc.

Recommendation: **below the P2 cut-line.** Both rows are small and each has a reference
implementation, so they are unusually low-risk for pre-freeze work; and the flip is the moment the
site is most read, which is the worst moment for `getting-started.mdx:127` to still say the hero
runs a local copy.

---

## 7. Out of scope

- **`@flare-engine/engine/headless` (OSS-M2).** The page importing individual packages is correct
  for tree-shaking on a static site. The headless barrel is a docs story, not a page change.
- **`createWebFrameRenderer` (OSS-C1).** The demos own bespoke CanvasKit renderers; there is no
  sprite/atlas path to route through a `FrameRenderer`. Revisit only if a demo grows one.
- **`@flare-engine/dynamics`.** 0.4.0 post-flip, portfolio-first. A rigid-body hero animation is a
  plausible seventh demo, but it is not this design.
- **The 0.3.0 page bump.** One known edit — `demos/postfx/surface.ts:207` drop `Array.from`, pass
  `pass.uniforms` directly (OSS-B19 narrowed `makeShaderWithChildren` to `Float32Array`). Type-only,
  fails `astro check`. Tracked in the consumer-compat audit, not here.
- **The reactor and map demos.** `demos/reactor/` and `demos/map/` have no engine counterpart to
  adopt; `map/grid.ts` and `reactor/sim.ts` are showcase-specific.

---

## 8. Verification

**Page (§2/§3):** `bun run lint`, `bun run typecheck` (`astro check`), `bun test` (9 files, incl. the
3 retargeted), `bun run build` — via `.claude/hooks/verify.sh` with the new test step.

Then load `/` and select each affected animation:

- **Spacetime** — orbits, inspiral, merger flash, radiating ripples must be **visually unchanged**;
  the swapped code is byte-identical.
- **Physarum** — the network must be **visually unchanged**. The agent loop, its `Math.random()`
  seeding, and the perf governor are all untouched, and the dropped `step()` arguments were inert at
  `HEADLINE_BAND_FRAC = 0`. Confirm the governor still thins the network under load (the backtick
  dev panel exposes the agent budget).

**Engine (§5):** per-row full gate green plus a test proving the page's exact usage — an
`activeCount` change that alters the stepped set without reallocating (E1), and a
context-loss/restore cycle that leaves no leaked `GrDirectContext` (E2). One lockstep minor changeset
per row; verify with `changeset status`.
