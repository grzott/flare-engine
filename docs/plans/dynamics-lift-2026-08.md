# Flare Engine — `@flare-engine/dynamics` lift (design, 2026-08-13)

Design SoT for lifting the `grzott-portfolio` page-collapse rigid-body core into a new engine
package, and flipping the portfolio's collapse showcase onto it. Owner-approved 2026-08-13.

**The point of the work:** the portfolio's collapse trigger reads *"built with my 2D engine"* and
links to `/projects/flare-engine`, but the demo runs zero engine code. This makes the claim
literally true by shipping the solver as an engine package and having `apps/web` consume it.

**Decisions taken (do not re-litigate):**

1. **Opt C** from the portfolio's own migration contract — upstream the solver, flip the consumer.
   Opt A is dead (recorded below), Opt B is cut (§7), Opt E is an unrelated track.
2. ~~**Post-flip.**~~ **SUPERSEDED 2026-08-14 — this lands PRE-freeze.** Owner decision, recorded in
   [consumer-enablement-2026-08.md](consumer-enablement-2026-08.md) §"Decisions taken" 1. The lift
   rides the consumer-enablement release, not a post-flip one, so both consumers actually run engine
   code for the weeks before the public flip instead of the flip shipping packages with no external
   consumer. No version number is stated anywhere: the fleet is lockstep, so the number is decided
   at version time.
3. **`dynamics` is the engine's rigid-body story.** The parked planck.js adapter
   ([engine-deep-audit-2026-07.md](engine-deep-audit-2026-07.md) §3) is demoted to a documented
   "if a game ever needs joints / sleeping / CCD" option, not a parallel track.

Consumer-side contract SoT (other repo, do not duplicate here):
`grzott-portfolio/docs/reference-collapse-flare-engine-integration.md`. §4 of this doc **corrects**
that file's determinism framing; everything else in it stands.

---

## 1. What exists today (verified 2026-08-13)

**Donor** — `grzott-portfolio/apps/web/src/lib/dynamics/`, 556 LOC across 5 files, DOM-free,
framework-free, plain objects + free functions, written in engine house style with the lift
declared in its own header (`index.ts:1-7`):

| File | LOC | Contents |
|---|---|---|
| `vec.ts` | 64 | `Vec2` + 11 free helpers |
| `body.ts` | 129 | OBB body, mass/inertia from extents, `boxVertices` / `boxNormals` / `aabbOf` |
| `collision.ts` | 157 | SAT + reference/incident face clipping → 1–2 point manifold |
| `world.ts` | 190 | gravity integration, brute-force AABB broadphase, sequential-impulse solver |
| `index.ts` | 16 | the barrel — the single consumer import |

**Sole consumer:** `apps/web/src/components/page-collapse/collapse-engine.ts:17`, one import off the
barrel, no deep imports.

**Why the engine cannot already do this.** `@flare-engine/physics` v0.2.1 is collision *detection*:
`CollisionWorld.step()` takes no `dt`, applies no gravity, mutates no positions; `Collider` carries
only `shape/isTrigger/layer/mask`; shapes are AABB + Circle (no oriented boxes); `shapeOverlap`
returns a bare boolean (no manifold, so no stacking). `@flare-engine/simulation` is contact-less
point-mass / Verlet. This is Opt A's death certificate — recorded so nobody re-opens it on seeing
the package name.

**Why engine rendering is permanently out.** The showcase's entire value is that collapsing
elements stay real DOM receiving only CSS transforms (indexable, accessible). `@flare-engine/
render-web` rasterizes to a CanvasKit-WASM canvas and destroys that property. Engine physics here
runs **headless** — compute `{x, y, angle}` per tick, DOM transforms stay portfolio-side — and
that is the ceiling of what "runs on the engine" can mean for this demo.

---

## 2. Package design

**`packages/dynamics` → `@flare-engine/dynamics`, tier 2**, dependency on `@flare-engine/math` only.

**In scope (v1, frozen):** OBB boxes; gravity integration; SAT + Sutherland-Hodgman clipping
manifold; sequential-impulse solver with Coulomb friction, restitution and Baumgarte
de-penetration; brute-force AABB broadphase.

**Out of scope:** joints, sleeping, CCD, circle/polygon shapes, ECS coupling, and any broadphase
beyond the brute-force pass. `SpatialIndex` from `physics` is a legal equal-tier dependency — the
tier gate rejects only *strictly upward* edges ([check-deps-tiers.mjs:214](../../scripts/check-deps-tiers.mjs))
— but stays unwired at v1; the collapse runs tens of bodies.

**Position next to `physics`, documented in both READMEs:** `physics` answers *did these overlap*,
`dynamics` answers *where do they end up*. No dependency in either direction.

**Public surface — the portfolio's ratified contract, verbatim:**

- Values: `createWorld`, `addBody`, `createBody`, `step`.
- Types: `World`, `Body`.
- `createBody` input: `position.{x,y}`, `half.{x,y}`, `velocity.{x,y}`, `angularVelocity`,
  `static`, `friction`, `restitution`, `density`.
- `Body` fields read back per tick: `position.{x,y}`, `angle`, `velocity.{x,y}`, `angularVelocity`.
- `Body` fields **written in place** by the consumer: `position.y`, `velocity.y`. These must stay
  mutable plain-object fields — read-only getters or an SoA `Float32Array` body layout **break the
  contract**. This caps the zero-alloc pass (§5) to transient per-step structures.

**Two gaps this lift opens in `math`:** `Vec2.perp` and `Vec2.crossSV` do not exist upstream
(`packages/math/src/vec2.ts` has `rotate` but neither). They land in `math` with `out` forms, not as
local copies in `dynamics`. `Vec2.rotate` is already bit-identical to the donor's and is adopted
as-is.

**Repo gates this package must satisfy** (none optional): `LAYER_MAP` entry in
[check-deps-tiers.mjs](../../scripts/check-deps-tiers.mjs) — an unmapped scoped package is a hard
error, so this is not skippable; `@flare-engine/engine` umbrella re-export; exports map with **no
`"."`-level `types` key** (the attw masquerade fixed in OSS-C2); README; `api-specs.md` and
`architecture.md` entries; one lockstep **minor** changeset.

LICENSE + NOTICE need no registration — `scripts/propagate-license.ts` walks `packages/*` and picks
up new packages automatically, as does the root `workspaces` glob.

---

## 3. Lockstep consequence

Adding a package does not ship `dynamics` at its own starting version beside the rest of the fleet.
Changesets is `fixed` lockstep across all `@flare-engine/*`, so this is one minor bumping **every**
package to the same number. The portfolio pins that number once it is cut.

**Do not write the number into this document.** It moves whenever another row lands first, and a
stale version in a design doc is the drift this plan corpus exists to avoid.

---

## 4. Determinism — correcting the consumer doc

The consumer contract calls for a **byte-identical-bake gate** and warns that *any* solver-touching
edit, "even a math-helper swap", perturbs the bake. That framing implies a stored golden timeline
that a migration must reproduce bit-for-bit. It does not exist.

`collapse-engine.ts:602` bakes at **runtime**, per trigger, into a 480-frame `Float32Array`
(`MAX_FRAMES = 480`, `collapse-engine.ts:93`), seeded by `Math.random` in production. The consumer
doc says so itself: "each collapse still varies". So:

**The gate is a determinism assertion — same seed, bake twice in one process, identical bytes — not
a cross-version fidelity contract.** There is nothing historical to match.

This matters because a `math` rebase is *not* bit-neutral:

| Donor helper | Upstream `Vec2.*` | Bit-identical? |
|---|---|---|
| `add`, `sub`, `scale`, `dot`, `cross` | same expression order | yes |
| `rotate` | same expression order | yes |
| `normalize` | donor `Math.hypot(x,y)` then `x / l`; math `Math.sqrt(x*x+y*y)` then `x * (1/len)` | **no** — two independent divergence sources |
| `perp`, `crossSV` | absent upstream | n/a (§2) |
| `len` | — | dead: exported, never called |

`normalize` is on the hot path (`collision.ts:133`, inside `collide`, every step). Were bit-identity
a real requirement, the engine would carry `Math.hypot` plus a divide in its solver forever, for one
consumer's replay fidelity, in the one place where `hypot` is the slower call. It is not a
requirement, so `dynamics` adopts math's sqrt form as a deliberate, documented, one-time
perturbation — verified behaviorally (§6), not by hash.

**Applied 2026-08-13.** This section declared the consumer doc's framing corrected but chartered
nobody to correct it, so the false text would have outlived the gate by two months. Phase 0 closed
that: `collapse-engine.ts`'s `rng` doc comment and **three** statements in
`grzott-portfolio/docs/reference-collapse-flare-engine-integration.md` no longer mandate a
byte-identical-bake gate. One of the three was not merely stale but *actively false* about the
shipped artifact — it claimed the gate "hashes the pre-playback bake buffer" and is "upstream of
playback", whereas the gate samples `el.style.transform` across a `seek` sweep and is therefore
downstream of playback. A reader following it would have built a second, contradictory gate
requiring `CollapseHandle`'s public API to be widened — precisely what the sampling design avoids.

**Empirically confirmed 2026-08-13:** two same-seed bakes replay identically. The solver carries no
hidden entropy — no `Math.random`, no `Date.now()`, no `Set`/`Map` iteration in the step path — so
the injected `rng` is the sole non-determinism source, as this section assumes.

---

## 5. Zero-alloc pass

A straight lift violates the engine's own hot-path rule (AGENTS.md: no `new` in game loops). The
donor allocates per vector op; at 10 solver iterations a modest pile costs thousands of objects per
step. Sites, in `step` order:

1. **Broadphase** — `aabbOf(b)` is recomputed inside the inner loop, so it runs O(n²) times and each
   call allocates 8 vertex objects via `boxVertices`. Precompute AABBs once per body per step into a
   preallocated array. This is an algorithmic fix, not only an allocation one.
2. **`collide`** — `boxVertices` ×2 (8 objects), `boxNormals` ×2 (2 arrays + 8 objects),
   `{x:-n.x,y:-n.y}` and `sub(s,v)` per normal inside `leastPenetration`, a fresh result object per
   call, `clip`'s arrays and interpolated points, and a fresh `ManifoldPoint[]`.
3. **`prepare`** — `Constraint[]`, `SolvePoint[]`, `perp(normal)`, two `sub` per point.
4. **`solve`, ×10 iterations** — `relativeVelocity` allocates 3 objects per call and is called twice
   per point per iteration; plus `scale` ×2 and two negation literals.

**Two collapses worth calling out, because they remove allocation *and* work:**

- `relativeVelocity` never escapes — its result is only ever `dot`ed against `normal` or `tangent`.
  It reduces to two scalar expressions with no vector at all.
- `pn` / `pt` exist only to reach `applyImpulse`. Re-signature it to scalars
  (`applyImpulse(body, ix, iy, rx, ry)`) and both literals disappear.

Everything else is pooling: per-world scratch vectors and free-lists for `Manifold`,
`ManifoldPoint`, `Constraint`, `SolvePoint`, reused across steps and grown on demand.

**The transformation is mechanical.** Writing into an `out` parameter instead of returning an object
literal cannot change float bits, because the arithmetic is untouched. What *would* change bits is
algebraic "improvement" — reassociating, fusing, or swapping a divide for a reciprocal multiply.
Outside the single sanctioned `normalize` change (§4), the pass must not do that.

Body storage stays object-per-body (§2 contract). "Zero-alloc" here means the transient per-step
structures, not an SoA rewrite.

---

## 6. Gates

**Engine-side package tests** — behavioral, not coverage:

- boxes come to rest on a static floor and stay at rest;
- a stack does not sink through under the tuned Baumgarte / slop;
- total energy does not grow over a long run;
- two-run determinism under a fixed seed;
- zero heap growth across N steps after warmup.

**Portfolio-side, at the swap:**

- the determinism test — seeded RNG, bake twice, identical replay. Note that `CollapseHandle`
  exposes `bakeChunk` / `seek` / `duration` / `destroy` / `pieceCount` and **not** the recorded
  `Float32Array`, so the gate samples the observable output (transforms read back across a sweep of
  `seek` values) rather than hashing the buffer. That needs no source change and covers the playback
  path too;
- settle stays well inside `MAX_FRAMES = 480` — roughly 200 frames today, so the margin is the
  signal that solver behavior did not shift. **This is the item that catches a broken solver, and
  the task plan originally dropped it.** A solver that stops resolving contacts still free-falls
  *deterministically*, so every other gate item above passes while the bake runs to the cap. It is
  now an assertion, not an eyeball: `expect(a.duration).toBeLessThan(2.5)` against a measured
  pre-swap baseline of **1.175 s / ~142 frames** for the 12-box test fixture (cap = 3.9917 s). Note
  the "roughly 200 frames" figure above describes a **real page collapse in the browser**, not that
  fixture — the two numbers measure different scenes and should not be reconciled;
- one owner eyeball of a real collapse.

Plus the standard per-row full gate in each repo.

---

## 7. Sequencing

**Now, pre-freeze, portfolio-side only, zero engine cost — ✅ BOTH DONE 2026-08-13:**

1. **Messaging fix. ✅ Done.** Rewording the "built with my 2D engine" trigger and its
   `/projects/flare-engine` link to match reality. Owner editorial — tracked in the portfolio repo
   as its Opt D, and as **PF1** in [road-to-oss-2026-09.md](road-to-oss-2026-09.md) §10.
   **Correction:** the claim lived at **three** sites, not one — the collapse `<button>`'s
   `aria-label` *and* `title`, plus the badge `<Link>`'s text. Locating it by the line range
   `585-588` found only the third; the other two were recovered by the "check for the same claim
   elsewhere" grep. Owner chose a *prototype-for* framing over *related-work*.
2. **A test lane, then the determinism test. ✅ Done.** Vitest + happy-dom in `apps/web`
   (owner-approved 2026-08-13 over a one-off script), then the determinism gate in it. No engine
   dependency; it is the safety net the migration lands on, and it is now wired into CI so it
   actually runs.
   **Correction:** "the portfolio has no test infrastructure today — no runner, no test files" was
   **false**. `apps/cms` already had `node --test` with two schema-drift suites, one of them failing
   at the time (a `PostRow` type that never caught up with the 2026-04-30 syndication migration;
   fixed 2026-08-13). What was true is that **`apps/web`** had no runner and no tests.

**Cut: Opt B (`vec.ts` → `@flare-engine/math` rebase).** The consumer doc sequenced D → B → C when C
was uncertain and B was the cheap partial win. With C chosen and timed post-flip, B needs pre-npm
`file:`/vendored dep plumbing *and* is discarded when C replaces the barrel wholesale. It buys
nothing the swap does not.

**Pre-freeze, in order** (resequenced 2026-08-14 — see decision 2):

1. ~~**`math`** — `Vec2.perp` + `Vec2.crossSV` with `out` forms.~~ **✅ DONE 2026-08-14.** Landed in
   the consumer-enablement release as Plan A Task 1, both with optional `out` forms, 10 tests
   including aliasing cases (`perp(v, v)`). Note the doc comment records the rotation as **90°
   clockwise** — `(-y, x)` is the standard counter-clockwise formula in a y-up math frame, but this
   engine is y-down (Skia), matching `render/src/sprite-batch.ts:27`. A solver that trusts "CCW"
   here will build a mirrored tangent basis.
2. **`dynamics`** — the XL row: lift, zero-alloc pass, tests, packaging, docs, `LAYER_MAP`, umbrella
   re-export, changeset. **Unblocked; this is now the next row.**
3. **Portfolio swap** — delete `apps/web/src/lib/dynamics/`, repoint the single import at
   `collapse-engine.ts:17` to `@flare-engine/dynamics`. Not a re-export shim: one consumer, one
   line, and the portfolio's KISS rule bans one-thing wrappers. Then reword the trigger copy a
   second time — this time to something true.

Tracked as **Arc DYN** in [todo.md](todo.md), with this document as its SoT. Originally seeded
below Arc HYG as post-flip work; resequenced pre-freeze 2026-08-14 by the owner, so it no longer
sits behind Arc OSS and Arc PERF in `/start` order.

**The capacity risk is real and is not waved away.** `todo.md`'s own note reads "lands by Oct 5 with
slack, not without", and this is an XL row now competing with Arc OSS and Arc PERF for pre-freeze
capacity. The owner took that trade knowingly, to buy a real dogfooding cycle before the public
flip. If the calendar tightens, this row — not an Arc OSS row — is the one to slip.

---

## 8. Risks

- **The cross-repo risk dissolves, but not for the reason first written.** The consumer doc's "not
  on npm → needs `file:`/git/vendored dep + `transpilePackages`" assumed that a pre-flip migration
  had no way to resolve the package. It does. `flare-engine-page` already consumes the restricted
  registry through a committed, secret-free `.npmrc` that reads `${NPM_TOKEN}` from the environment:

  ```
  @flare-engine:registry=https://registry.npmjs.org/
  //registry.npmjs.org/:_authToken=${NPM_TOKEN}
  ```

  `grzott-portfolio` needs the same four lines and nothing else — it has no `.npmrc` today. So the
  swap works pre-flip: no vendoring, no `transpilePackages`, no dev-link. Verified 2026-08-14.
- **Engine version churn** likewise dissolves: pin the cut version's caret range rather than a
  commit.
- **The zero-alloc pass is where correctness gets lost.** It touches every line of the solver while
  the visible output is "a pile of boxes falls", which hides subtle regressions. The behavioral
  gates in §6 exist for this; run them against the donor first to establish the reference numbers.
- **One consumer, no bake-in.** `dynamics` ships with a single real user. Keep the v1 surface at
  exactly §2 — every speculative addition is API surface frozen against no evidence.
- **Duplicate scope with planck** is accepted, not avoided, by decision 3. Revisit only if a game
  needs joints, sleeping, or CCD.
