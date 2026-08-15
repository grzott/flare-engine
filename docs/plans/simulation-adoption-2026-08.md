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
3. ~~**No early publish.**~~ **SUPERSEDED 2026-08-14.** Owner decision, recorded in
   [consumer-enablement-2026-08.md](consumer-enablement-2026-08.md) §"Decisions taken" 1: a
   consumer-enablement release is cut **before** the freeze, and the launch is a later cut. No
   version number is reserved or stated — the fleet is lockstep, so the number is decided at
   version time.
4. ~~**The two engine rows are not pre-freeze musts.**~~ **SUPERSEDED 2026-08-14.** E2 became
   pre-freeze work and **has landed** (§5). E1 was cut as dead (§5). See §6.

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

For `nbody.test.ts` and `ripples.test.ts` this is one import line each; keep the bodies verbatim.

`field.test.ts` needs more: the import, the `createTrailField` → `createScalarField` factory name at
`:8,19,26,34,44,52`, and the `step()` arity at `:29,37,54`. **One test must be deleted:**
`:42-48` "top-band decay starves the headline rows faster than the body" calls
`step(0.3, 0.95, 0.2, 0.6, ∞)` with a live band and asserts `sample(60, 8) < sample(60, 90)`. Its
subject does not exist in `ScalarField`.

That deletion is the real cost of §2.2 and is called out rather than absorbed: it removes the only
automated proof the band works. The deleted test is also the ready-made spec for the region-multiply
row, should the band ever return — recover it from git history rather than rewriting it.

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

**E1 — `simulation`: `AgentField` settable `activeCount`. — ❌ CUT 2026-08-14, dead.**
The row existed only so the page could adopt `createStigmergy` (§4.1). The page has since settled on
keeping its own agent loop permanently — its own notes record the package helper as "a different
contract", and no `createStigmergy` call site remains in `demos/physarum/sim.ts`. With no consumer
waiting on it, the row unblocks nothing. File it again only if a real consumer appears.

**E2 — `render-web`: `createPostFxSurface` context lifecycle + loss recovery. — ✅ DONE 2026-08-14.**
Landed in the consumer-enablement release (Plan A Tasks 3–6). Scope grew once the package was read
against HEAD rather than against published 0.2.1: the `resize()` delta was **already fixed** at HEAD,
and three items the original spec did not list were added — a `Src` blend mode on the composite blit,
`clampDim` non-finite guarding, and loader stall/deadline/retry bounds.

Two things worth carrying forward:

- **It was a merge, not a port.** The engine was already *ahead* of the page on three axes — a
  zero-alloc `rectScratch` where the page allocates `kit.LTRBRect()` per pass, multi-child sampler
  support for LUT-class effects where the page binds only `[srcShader]`, and direct `pass.uniforms`
  where the page wraps in `Float32Array.from`. Copying the page's file wholesale would have
  regressed all three.
- **`onscreenCanvas()` and `sceneCanvas()` now return `Canvas | null`.** The page's adapter must
  guard both when it adopts the package.

**Cut under YAGNI:** a `ScalarField` rectangular-region multiply. It would be needed only to
re-enable the headline band, which the page has switched off (§2.2). File it if the band returns.

---

## 6. Sequencing and the freeze calendar

**Page-side (independent, do now):** §3 test gate → §2.1 spacetime → §2.2 physarum. Three commits,
no engine dependency, no publish. Net ~820 LOC deleted across three modules.

**Engine-side — RESOLVED 2026-08-14.** The calendar question this section posed is closed: the owner
resequenced the work pre-freeze, E2 has landed, and E1 was cut as dead. The recommendation this
section made — pre-freeze, on the grounds that the flip is the moment the site is most read and the
worst moment for `getting-started.mdx:127` to still say the hero runs a local copy — is what
happened, for exactly that reason.

**What remains is page-side and is now unblocked.** Once the consumer-enablement release is
published, the page executes row D3: `canvaskit-loader.ts` becomes a shim keeping the `?url` import,
`demos/postfx/surface.ts` becomes a thin adapter that builds the hero chain and delegates, and both
local files delete. The page must also guard `onscreenCanvas()` / `sceneCanvas()`, which are now
nullable, and drop its hand-rolled `smoothstep` in `logo/timeline.ts:59-64` — `@flare-engine/math`
has exported `smoothStep` all along (`packages/math/src/scalar.ts:62`).

**The page's own `render-web-upstream-spec.md` needs two corrections** when D3 is picked up: it says
the fix "belongs in 0.3.0 … already queued with 23 changesets" (the count was 44, and no version
should be named), and it lists six deltas when only five were live at engine HEAD — `resize()` was
already fixed there.

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
