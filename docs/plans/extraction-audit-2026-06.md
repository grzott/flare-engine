# Flare Engine — Extraction Audit (2026-06-30)

Deep multi-repo audit (Pan-Tvardowski, flare-engine-page, Berek) for proven-in-game logic that
should be lifted into the engine. Method: 9 parallel surface surveys + 2 web-render/physics
deep-dives → an adversarial verifier per candidate that grepped the real engine source and
defaulted to reject if already-covered or genre-coupled. 37 candidates verified.

Companion to the roadmap's
[Engine extraction history](roadmap.md#engine-extraction-history) (history of what already
landed) and its Rejected list (which still holds). This doc is the forward queue.

Verdict tally: 12 lift-with-strip · 21 extend-existing · 1 needs-new-package · 3 reject.

---

## Headlines

1. **The web render backend is proven and ready — `@flare-engine/render-web` (medium).** This is
   the single biggest gap closed. flare-engine-page already runs `@flare-engine/core` + `math` +
   `particles` + `postfx` (real SkSL) **unmodified** on a CanvasKit-WASM WebGL surface that already
   satisfies the engine's abstract `CanvasLike`. The surface + loader + postfx adapter exist and
   ship; they have zero PT coupling.
2. **There is a coherent new package hiding in the page demos — `@flare-engine/simulation` (large,
   but the cores are bun-tested and lift near-verbatim).** This is the "physics expansion" the
   audit was looking for: the existing `physics` package is collision-only, and these are
   continuous-time dynamics (n-body symplectic integrator, scalar fields, agent stigmergy, wave
   pool). Several files carry headers explicitly nominating themselves to upstream.
3. **A second new package consolidates the economy/progression slivers — `@flare-engine/progression`
   (small–medium).** Individually each economy candidate is too thin for its own package; the
   per-candidate verifiers wanted to scatter them into math/achievements. Bundled, they form a real
   meta-progression surface and justify the package.
4. **~13 high-confidence extend-existing lifts** into `math`/`ecs`/`storage`/`a11y`/`animation`/
   `render`/`tilemap`/`physics` — mostly trivial/small, immediate wins. The `ecs` ones close a real
   hole (engine ships `Position`+`Velocity` but nothing that moves them).
5. **Berek (the second genre) earned its keep** — a topdown scaffold surfaced 4 concrete engine
   gaps (tile-grid move-and-slide, tilemap draw-into-host-batch, ascii map builder), exactly the
   reusability proof a second game is supposed to provide.

---

## 1. `@flare-engine/render-web` — the web backend  ★ headline

**Proof (flare-engine-page):** `demos/postfx/surface.ts` calls `kit.MakeWebGLCanvasSurface(canvas)`
and draws to a live `SkCanvas` — the same shape `render`'s `Renderer` targets via `CanvasLike`
(`save/restore/translate/scale/rotate/clear` are all native on `SkCanvas`). `demos/reactor/
canvaskit-loader.ts` is a streaming WASM loader (fetch + byte-progress → `wasmBinary`, `locateFile`
fallback, single cached promise, lazy multi-MB load). `surface.ts`'s own header calls itself "the
upstreamable web Skia backend (a future `@flare-engine/web` Skia module)". The postfx RuntimeEffect
path compiles **real SkSL on web** via a 12-line `SkiaPostFxModuleLike` shim — one postfx codebase,
two Skia backends.

**Package shape:** standalone `@flare-engine/render-web` (keeps `render` backend-neutral; avoids
forcing the multi-MB `canvaskit-wasm` dep on native consumers). Exports `loadCanvasKit`,
`createWebSurface(kit, canvas): CanvasLike`, re-exports `createPostFxSurface`. `canvaskit-wasm` as
optional/peer dep.

**What's needed:**
- Lift `postfx/surface.ts` (game-agnostic; imports only `@flare-engine/postfx` + `canvaskit-wasm`).
- Lift `canvaskit-loader.ts`; **make the wasm URL injectable** — the `?url` Vite import is
  bundler-specific; expose a `locateFile`/url option so non-Vite consumers point at their own asset.
- `createWebSurface(kit, canvas)` returning the on-screen `SkCanvas` typed as `CanvasLike`.
- **Conformance test** (headless via `node-canvaskit`): run `Renderer.begin/applyCamera/end` + a
  `SpriteBatch` draw against a CanvasKit surface to prove the abstraction is satisfied end-to-end.
- Document the web target in `docs/design/api-specs.md`; add a `create-flare-app` web note.

**Risk to resolve first:** `CanvasLike` today declares only `save/restore/translate/scale/rotate/
clear`. Real sprite drawing needs `drawImageRect`/`drawCircle`/`Paint` lifecycle — **confirm
`SpriteBatch`'s draw surface (not just `Renderer`) is fully expressible on `SkCanvas`** before
claiming full parity. Also: WebGL context-loss handling, and `MakeImage`-per-frame cost in the
demo renderers (offer a persistent-texture path for the hot path).

### XP1 resolution (2026-06-30) — functional **GO**; `CanvasLike` delta: **none**

Read-only spike: type-def + source analysis, no browser (perf is out of scope — see last bullet).
Verified against `canvaskit-wasm@0.41.1` defs, RN-Skia `Canvas` types, and the engine's
`render`/`react` source. Resolves the "risk to resolve first" above.

- **`CanvasLike` needs zero change.** It is *only* the `Renderer`'s transform/clear contract
  (`save/restore/translate/scale/rotate/clear`, [renderer.ts:2](../../packages/render/src/renderer.ts#L2)).
  All six map 1:1 onto CanvasKit `Canvas` with identical signatures, so
  `createWebSurface(kit, canvas): CanvasLike` = `kit.MakeWebGLCanvasSurface(canvas).getCanvas()`
  returned as-is, narrowed to `CanvasLike`. No new methods. *(Pre-existing, non-web caveat:
  `CanvasLike.rotate`'s "radians" JSDoc is wrong — **both** RN-Skia and CanvasKit `Canvas.rotate`
  take **degrees** (`rotate(deg, rx, ry)`); it's dormant because camera rotation is rarely nonzero
  and sprite rotation is baked into the RSXform, never `canvas.rotate`. Fix as a separate doc/typo
  cleanup, out of XP2 scope.)*
- **`SpriteBatch` is not the parity risk — and `CanvasLike` is not its draw surface.**
  `SpriteBatch` calls no canvas methods; it hands grouped commands to a `drawAtlas(image, commands)`
  callback ([sprite-batch.ts:174](../../packages/render/src/sprite-batch.ts#L174)). That callback is
  owned by the **bridge** (`createSkiaFrameRenderer`,
  [skia-bridge.ts:822](../../packages/react/src/skia-bridge.ts#L822)), which uses a richer surface
  than `CanvasLike`: `Canvas.drawAtlas/drawImageRect/drawRect` + `Paint` + a `SkiaModuleLike`
  factory set. **Consequence for XP2:** the conformance test cannot drive a SpriteBatch draw through
  a bare `CanvasLike` — render-web must ship a **web frame-renderer** (the CanvasKit analog of
  `createSkiaFrameRenderer`), not just `createWebSurface`.
- **Every method that path needs exists on CanvasKit** — `Canvas.drawAtlas/drawImageRect/drawRect/
  drawCircle`; module `XYWHRect`, `RSXform`, `Paint` (ctor), `PictureRecorder` (ctor),
  `ColorFilter.MakeBlend/MakeMatrix`, `RuntimeEffect.Make`, `ImageFilter.MakeDropShadow`,
  `MakeWebGLCanvasSurface`. The **postfx** half is already **live-proven** on CanvasKit by
  flare-engine-page's `createPostFxSurface`; the **sprite** half is **type-confirmed** here (live
  run is XP2's conformance test — the page's reactor is immediate-mode circles, never `drawAtlas`).
- **The one concrete XP2 adapter gap: object-form vs flat-form rects/xforms.** RN-Skia's
  `SkiaModuleLike` returns object wrappers (`SkHostRect.setXYWH`, `SkRSXform.set`) and passes
  **arrays of objects** to `canvas.drawAtlas(img, SkRect[], SkRSXform[], paint)`; the bridge
  pools + mutates them in place for its zero-alloc invariant. CanvasKit's
  `drawAtlas(atlas, srcRects: InputFlattenedRectangleArray, dstXforms: InputFlattenedRSXFormArray, …)`
  wants **flat `Float32Array`s** (4·n floats; RSXform = `scos,ssin,tx,ty`), and its `XYWHRect`/
  `RSXform` return bare `Float32Array`s with **no** `.setXYWH`/`.set` mutators. So the bridge does
  not run unmodified against raw CanvasKit. Two routes, both yielding an upstreamable backend
  (decide at XP2 build):
  - **A1 — via RN-Skia web bridge:** feed RN-Skia's web `Skia` (it wraps CanvasKit and already does
    the object→flat conversion — parity row 1) into the existing `createSkiaFrameRenderer`
    unchanged. Least engine churn; but pulls `@shopify/react-native-skia` + `react-native-web` into
    render-web (heavy dep; Astro/Vite aliasing risk, per the page's canvaskit-spike).
  - **A2 — CanvasKit-direct shim (recommended):** render-web ships a thin `SkiaModuleLike` over
    CanvasKit whose `XYWHRect`/`RSXform` return tiny wrappers writing into a reusable backing
    `Float32Array`, and whose canvas `drawAtlas`/`drawImageRect`/`drawRect` flatten the object array
    into a grow-only scratch `Float32Array` before the CanvasKit call — preserving the bridge's
    zero-alloc invariant. No `react-native` dep; extends the `SkiaPostFxModuleLike` shim the page
    already proved. This ~1 small adapter file is the bulk of XP2.
- **Perf is out of XP1 scope.** Live WebGL `drawAtlas` throughput (the parity doc's still-empty
  "Spike Results" table + its Medium-severity perf risk) needs a real browser. **Functional GO ≠
  perf GO**; XP2's conformance test is headless (node-canvaskit, functional only), and the perf
  benchmark stays a later live spike.

---

## 2. `@flare-engine/simulation` — continuous-time dynamics  ★ new package

The empty slot: `physics` is discrete collision/queries; `particles` is one-shot ballistic
emitters (no inter-particle forces, no field coupling); `animation/spring.ts` is single-DOF. None
of them integrate forces or own a field grid. The page demos fill exactly that slot, **already
zero-alloc (SoA `Float32Array`) and already bun-tested.**

Proposed module surface (deps: `math` + `core` only; **no DOM/Skia imports**):

| Module | Lift from | State |
|---|---|---|
| `integrate/nbody.ts` — `NBodySystem`: velocity-Verlet, Plummer-softened gravity, COM, inelastic `absorb`, `closestPair`, `totalEnergy` invariant; optional post-Newtonian GR precession | `spacetime/nbody.ts` | **verbatim** — header already nominates `@flare-engine/physics`; has energy-conservation test |
| `integrate/verlet.ts` — bare `verletStep`/`leapfrogInto` advancing SoA pos/vel under an arbitrary per-body acceleration callback | generalize `nbody.ts` step | small |
| `field/scalar-field.ts` — `ScalarField`: separable box-blur diffuse (ping-pong), multiplicative decay, bilinear sample, additive deposit, radial erode, gradient, RGBA pack | `physarum/field.ts` | near-verbatim; parameterize edge mode (toroidal\|clamp) + palette |
| `agent/stigmergy.ts` — SoA agents that sense a `ScalarField` at 3 offset sensors, `decideTurn` (Jones), move, deposit; typed `onSense`/`onMove` callbacks. The engine's first emergent-AI primitive. | `physarum/sim.ts` | medium — **the real work** is extracting a generic `AgentField` without dragging in the demo's nutrient-source choreography / beam repulsion / branch coroutine |
| `wave/wave-packet-pool.ts` — fixed-pool analytic expanding wavefronts (`heightAt(x,y,now)`); cheap stable shockwave/ripple/sonar layer | `spacetime/ripples.ts` | verbatim; already tested |

Port the existing `*.test.ts` (`nbody`, `field`, `ripples`, `lattice`, `starfield`) as the
acceptance suite — they assert real behavior (energy bounded, blur conserves mass, lens ring),
which clears the "tests must be real" bar.

**Split caveat (do this before coding):** the 2.5D **lattice** (`spacetime/lattice.ts`) is two
things. The *potential-summation half* (`addWells` — sum point sources into a scalar height/force
field) belongs in `simulation` as a `ScalarField` producer. The *perspective project/unproject
half* is presentation and **overlaps the recorded 2.5D-lighting strategy** — route it to a
render-side 2.5D helper, not here, or it lands in the wrong package. Same for the starfield's
lens-deflection map (presentation-leaning).

**Risks:** n-body is O(n²) pairwise — fine for a handful of bodies, needs a Barnes-Hut/grid note
before being marketed as general. Symplectic integrator bounds *energy* but not individual
apoapses (spatial confinement is the caller's job — document it or users report "bodies fly away"
as a bug). `AgentField` has no existing home → expect bikeshedding (simulation vs a future
`@flare-engine/ai`); the field-coupling argues for `simulation`. **`reactor` is a false candidate**
— its model is ECS-coupled and its only pure file is U-235 constants; do not package it.

---

## 3. `@flare-engine/progression` — consolidate the economy slivers  ★ new package

Orchestrator call the per-candidate verifiers couldn't make: five economy/progression candidates
are each individually too thin for a package, and scattering them into `math`/`achievements`
fragments the meta-progression surface. **Bundle them.** Clean split with `math`: pure stateless
helpers stay in `math`; stateful meta-state primitives go here.

| Into `@flare-engine/progression` | From PT | Verifier note |
|---|---|---|
| `createUpgradeTrack` (geometric price + cap + immutable buy) + `resolveStats` fold | `economy/shop.ts`, `config/ship-upgrades.ts` (dup'd 3×) | **needs-new-package, conf 0.82** — the anchor; subtle off-by-one in the hand-rolled price formula is exactly why it should be canonical |
| `rollDrop`/`rollDropInto` — pity-aware weighted drop (the *stateful* half) | `economy/drops.ts` | pairs with `math.weightedPickInto` (the pure pick) |
| unlock DAG — prerequisite graph + frontier over a cleared `Set` | `cell/difficulty/ship-unlock.ts` | thin alone (verifier said defer); fine as a member of this bundle |
| `resolveTier`/`resolveTierIndex` — "highest threshold crossed by a running tally" | `visual-spec/achievements.ts` | verifier put it in `achievements`; keep with the rest |
| collectible-unlock registry — immutable unlock-set + partition + capstone-on-complete | `codex/entries.ts`, `codex/shards.ts` | proven over two entry kinds; thin alone, coherent here |

Pure helpers that go to **`math`** instead (not progression): `weightedPickInto<T>` (`random.ts` —
`math.choose` is uniform-only), the timed-window/capped-curve scoring math from `risk-reward-faucet`
(`reward.ts`), and `hashU32`/`seededIndex` stateless one-shot hash from `seeded-variant-picker`.

---

## 4. Tier-1 extend-existing — do-now wins

Sorted by confidence. All verified against engine source; targets corrected by the adversarial pass.

| Candidate | Target | Eff | Conf | One-line |
|---|---|---|---|---|
| velocity-integrator-system | `ecs` (`createMovementSystem`) | triv | .88 | **closes a real hole** — ecs ships `Position`+`Velocity` but nothing moves them; dup'd 4× in engine's own templates/tests |
| contrast-a11y-audit | `a11y` (`audit.ts`) | triv | .90 | WCAG ratio + ΔE distinguishability over `math.Color`; 100% genre-agnostic; adds `math` dep (safe leaf) |
| angle helpers (merge `shortest-angle-diff` + `homing-steering`) | `math` (`scalar`+`vec2`) | triv | .90/.72 | **two agents found the same primitive** — `angleDelta`/`rotateTowards` + zero-alloc `Vec2.turnVelocityToward`; turret/facing/homing all re-derive it. Keep branch form byte-identical (ULP test) |
| lifetime-and-bounds-cull-systems | `ecs` (`Lifetime` + 2 system factories) | small | .86 | every game spawns transient bullets/FX needing timer/area cull; keep destroy via callback (ecs must not dep physics) |
| follower-pin-system | `ecs` (`Follower` + system) | small | .72 | ecs has a half-built `Parent` with no consumer; PT re-pins 2× + orphan-culls a 3rd place. Split orphan-cull into its own system so games owning destruction opt out |
| tile-grid-move-and-slide | `physics` | small | .85 | **Berek** — the missing link between `extractColliders()` and movement. ⚠ build `SolidGrid` from structural `{row,col}[]`, **not** `TileCollider` — physics must not import tilemap (layer inversion) |
| tilemap-draw-into-host-batch | `tilemap` (`drawInto`) | triv | .88 | **Berek** — zero-alloc `drawInto(camera, batch)` so the frame owner flushes once and tiles z-order under sprites; aligns with the documented single-flush convention |
| single-document-versioned-store | `storage` (`createDocumentStore`) | small | .72 | inverse of `createStorage`'s N-slot model: one in-memory doc, total `parse`, first-run hook |
| sanitize-schema-toolkit | `storage` (`sanitize.ts`) | med | .78 | lenient field-drop validation for migrating real saves (strict-throw nukes the whole doc); ~80-100 LOC of pure combinators |
| round-robin-timeline-stepper | `animation` (`step-sequence.ts`) | triv | .78 | the missing 3rd member of the cyclic family (periodic = scalar, sprite-animator = frames, step-sequence = per-step-duration callback cursor) |
| timed-modifier-stack | `animation` (`TimedModifier`) | triv | .70 | tick + apply-with-combine + read; slots beside tween/spring/periodic |
| bench-session-harness | `testing` | small | .82 | deterministic-RNG swap/restore + flag registry + done-sentinel — the backbone the bench scenarios AND the planned agent-QA epic both need |
| agent-qa-game-snapshot | `testing` (`defineSnapshot`) | small | .72 | structured headless snapshot projector; **not** a new `agent-qa` package — the critic/LLM panel isn't on disk yet |
| use-overlay-fade · use-count-up · use-signal-state | `react` (hooks) | triv | .82 | React-overlay fade (the Animated analog of scene's canvas `fadeTransition`), count-up on `math.easeOutCubic`, `Signal`-backed store. ⚠ react test-mock pollution caveat applies |

---

## 5. Lower-value / judgment-call (defer unless a second consumer appears)

- **scroll-wrap-parallax-layer** → `render` (.72) — verifier **downgraded to LOW**: post-strip core
  is ~25 lines of arithmetic and PT's single-`-=2*vh` wrap is buggy for large dt. Recipe, not a lift.
- **telegraph-indicator** → `render` sprite-effects (.66) — ~25 lines of orchestration; the win is
  the capture-restore-exact + reduced-motion lifecycle, not the math.
- **clock-driven-pulse-flipbook** → `animation` (.66) — `periodicTween` already covers it; reduced-
  motion clamp already in `a11y.dampenedMotion`. Near-duplicate risk.
- **theme-focus-scaffold** → `ui` as neutral `UIRoot` (.86 but low value) — 2 providers; some would
  inline. Single focused export if lifted.
- **is-dev-mode-guard** → `devtools` `isDevMode()` (.85) — makes the fragile bare `__DEV__` guards
  (which throw under bun/test) test-safe. Watch tree-shaking vs Metro constant-fold.
- **timed-window-ability** → `core` (.72), **ascii-to-tiled-map-builder** → `tilemap` (.70, Berek,
  test-tooling), **slot-preview-derivation** → split `storage`+`localization` (.66; the real win is
  `formatTimestamp` into `localization` — no Intl helper exists in any package),
  **first-run-os-preference-seed** → split (.60; ⚠ would introduce `require('react-native')` into
  `localization`/`a11y`, which are deliberately RN-dep-free — gate as separate entry points or skip),
  **effect-budget-degrader** → `particles` spawn-governor, not a new `fx-budget` package (thin).

---

## 6. Rejected (genre-coupled; verifier-confirmed)

- **behavior-registry-dispatch** (`enemy-ai.ts`) — dispatch loop is itself PT-coupled (aim-at-player,
  shield mirror, difficulty scale); generic residue is ~10 lines re-wrapping shipped primitives.
- **bench-scenario-framework** (`perf/scenarios/types.ts`) — the recorder half is already in
  `debug.createPerfRecorder`; what survives the strip is a 3-method lifecycle interface. (If ever
  revisited: a `defineScenario`/`runScenario` lifecycle paired with `createPerfRecorder` is the only
  thing worth designing — but engine-side from scratch, not a lift.)
- **portrait-manifest-resolver** — dialogue intentionally forwards `speakerPortraitKey` verbatim to a
  host seam; lifting it couples the portrait-agnostic runtime to a concrete manifest format.

Prior roadmap rejects (Boss FSM, miniboss form-cycle, deterministic wave spawner, PT shape
catalogue) **still hold** — the boss/spawner survey found no genre-agnostic primitive underneath
worth more than the already-recommended `step-sequence` cursor (row 4) and `Follower` system.

---

## Recommended sequencing

1. **`render-web`** — headline; unblocks "Flare games run on web". Resolve the `SpriteBatch`-on-
   `SkCanvas` parity question first, then it's a near-strip lift.
2. **Tier-1 `ecs` + `math` cluster** (movement, lifetime/bounds cull, follower, angle helpers) —
   cheapest, highest-leverage, and `render-web`'s conformance test will exercise them on web.
3. **Berek's `physics`/`tilemap` gaps** (tile move-and-slide, draw-into-batch) — small, and they're
   the second-genre reusability proof; fold back into Berek to validate.
4. **`simulation`** — the strategic expansion; cores are tested, but budget the `AgentField` strip
   and settle the 2.5D-projection split vs the lighting strategy before scaffolding.
5. **`progression`** — consolidate the economy bundle; lower urgency (PT is its only consumer today,
   a second game would harden the API).

Per the engine-first rule, anything PT still uses gets the engine package first, then PT swaps its
local copy for the import.
