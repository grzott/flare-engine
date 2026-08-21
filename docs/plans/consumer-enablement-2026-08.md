# Flare Engine — consumer-enablement release (design, 2026-08-14)

Design SoT for the release that closes the gap between what `@flare-engine/*` ships and what its
two live consumers actually run — cut **before** the public flip rather than after it.

Owner-approved 2026-08-14.

**The point of the work:** at the current plan the first public release of Flare would ship with
**zero packages that have a real external consumer**. `grzott-portfolio` imports no engine code at
all; `flare-engine-page` hand-rolls the two packages it declares. Both say so in text the flip
makes maximally visible. This release makes both consumers real, then lets them bake for the
weeks before the flip.

**Decisions taken (do not re-litigate):**

1. **Pre-freeze, not post-flip.** Owner decision 2026-08-14. This **overrides**
   [dynamics-lift-2026-08.md](dynamics-lift-2026-08.md) §"Decisions taken" 2 ("Post-flip … as a
   lockstep 0.4.0") and [simulation-adoption-2026-08.md](simulation-adoption-2026-08.md)
   §"Decisions taken" 3 ("No early publish"). Both are corrected in place (§6) rather than left
   contradicting the code.
2. **Version-neutral.** This document names no version. **Release N** is this cut; **release N+1**
   is the launch cut. Lockstep `fixed` means N is one minor over 0.2.1 regardless of how many rows
   land. If more rows land later, N simply moves; nothing here has to be rewritten.
3. **Scope is consumer-unblock + web bench + hygiene.** Everything else the audits surfaced is cut
   under YAGNI and listed in §7 so nobody re-derives it.
4. **Publish stays `restricted` and owner-run.** `publishConfig.access` flips to `public` at
   OSS-I1, in release N+1, not here.

---

## 1. What the consumers are blocked on (verified 2026-08-14)

| Consumer | State | Blocked on |
|---|---|---|
| `grzott-portfolio` | Zero engine imports. `apps/web/src/lib/dynamics/` is a complete hand-rolled OBB rigid-body engine (556 LOC, 5 files). `@flare-engine` appears only in doc comments. | A `dynamics` package + two `math` helpers |
| `flare-engine-page` | Simulation swap **done** (`803ac9a`, `2af931a`). `@flare-engine/render-web` is declared and imported nowhere. | `render-web` hardening (its row D3) |

`@flare-engine/render-web@0.2.1` is an **older fork of the page's own `postfx/surface.ts`** — the
package docstring says "Lifted verbatim from `flare-engine-page/…/postfx/surface.ts`", snapshotted
before the page hardened it. The fix is to port *back*. The page has already written the engine's
spec: `flare-engine-page/docs/plans/render-web-upstream-spec.md`, six deltas with line citations.

**Three audit findings are already satisfied and are NOT rows:**

- `smoothStep` exists at `packages/math/src/scalar.ts:62` (exported `index.ts:85`). The page's
  local copy at `logo/timeline.ts:59-64` is redundant — a page-side deletion, not an engine gap.
- The RN-Skia native-tree drag is **already fixed at HEAD**. Published `assets@0.2.1` and
  `render@0.2.1` declare `"@shopify/react-native-skia": ">=1.0.0"` as a *required* peer (no
  `optionalPeers` entry, unlike `postfx`/`render-web`); at HEAD both manifests have no
  `peerDependencies` at all, which is correct since neither imports Skia. It ships fixed with N.
- **E1 (`AgentField` settable `activeCount`) is dead.** simulation-adoption §4.1 wanted it so the
  page could adopt `createStigmergy`. The page has since settled on keeping its own agent loop
  permanently — the helper is "a different contract" — so the row now unblocks nothing.

---

## 2. W1 — `math`: `Vec2.perp`, `Vec2.crossSV`

Both confirmed absent (`packages/math/src/vec2.ts`). Both land with optional `out` forms per house
style, not as local copies inside `dynamics`. Gates W3.

`math` has 6022 bytes of ceiling headroom — no byte-gate risk.

---

## 3. W2 — `render-web` hardening

The page's spec names six deltas. **Verified against HEAD 2026-08-14: five are real, one is already
fixed.** The page wrote its spec against published 0.2.1, not against engine HEAD.

1. No `webglcontextlost` / `webglcontextrestored` handling, and no lost-state concept.
   `onContextLost` must call `preventDefault()` or the context is never restorable.
2. `dispose()` leaks the `GrDirectContext` **and** the WebGL context handle. Load-bearing: the page
   swaps between five animations and each swap strands a live context; browsers cap them and
   force-lose the oldest.
3. ~~`resize()` skips the on-screen surface~~ — **already fixed at HEAD.**
   `postfx-surface.ts:216-219` rebuilds the on-screen surface (the OSS-C1 fix), matching what
   simulation-adoption §4.2 recorded. No work; it is re-verified by a test in Plan A.
4. The `fx` paint never sets `BlendMode.Src` → stale pong bleed between passes.
5. `loadCanvasKit` caches a **rejected** promise → one transient failure disables the hero for the
   page's lifetime.
6. No stall abort, no deadline on the load.

Plus one delta the page's spec does not list: the engine clamps dimensions with
`Math.max(1, canvas.width)`, which passes `NaN` straight through. The page's `clampDim` guards
non-finite input. Taken as part of delta 2's construction rewrite.

**This is a merge, not a copy.** The engine is *ahead* of the page on three axes: a zero-alloc
`rectScratch` where the page allocates via `kit.LTRBRect()` every pass; multi-child sampler support
for LUT-class effects where the page binds only `[srcShader]`; and passing `pass.uniforms` directly
where the page wraps in `Float32Array.from()`. Porting the page's file wholesale would regress all
three. Take the resilience, keep the engine's work.

**API impact:** `isLost()` additive; `onscreenCanvas(): Canvas` → `Canvas | null` breaking. Pre-1.0
minors are breaking here, so this rides N with no extra version event.

**Tests are the row, not an afterthought.** A happy-path browser check passes all six defects —
that is precisely how the fork drifted this far, and `render-web@0.2.1` is today tested only
against a CPU surface and a mock kit, with zero runtime consumers in either repo. Required:

- forced loss via `WEBGL_lose_context` → assert `isLost()`, safe no-op while lost, repaint after
  restore;
- create/dispose N surfaces in a loop → assert a fresh context is still obtainable;
- resize between composites → assert output matches the new dimensions;
- fail the first loader fetch, succeed the second → assert a real retry, not a replayed rejection.

**Known gate collision.** `render-web` measures 21995 bytes against a 24195 ceiling — 2200 bytes of
headroom, and six behaviors of new code plausibly exceed it. `check-perf.mjs --write` **never
raises a ceiling** (`scripts/check-perf.mjs:32-33`), by design, so this cannot be absorbed
silently. If breached, it is an owner-authorized reset recorded with its reason — added resilience
behavior, not an admitted regression. Do not raise the ceiling to make a red gate green without
that explicit call.

---

## 4. W3 — `@flare-engine/dynamics`

New tier-2 package, `@flare-engine/math` its only dependency. Lift the portfolio donor, apply the
zero-alloc pass, ship behavioral gates.

**This design does not restate the row.**
[dynamics-lift-2026-08-tasks.md](dynamics-lift-2026-08-tasks.md) already specifies it in full.
What the resequence changes there, and only this:

- the post-flip framing and its version pins (§6);
- **the cross-repo risk dissolves differently than written.** That doc assumed a pre-flip swap
  needs `file:`/git/vendored deps plus `transpilePackages` because the engine is not on public npm.
  It does not. `flare-engine-page` consumes the restricted registry today with a committed,
  secret-free `.npmrc` reading `${NPM_TOKEN}` from the environment. The portfolio needs the same
  four lines. No vendoring, no transpile config, no dev-link.

Non-skippable packaging gates: `LAYER_MAP` entry in `check-deps-tiers.mjs` (an unmapped scoped
package is a hard error), `@flare-engine/engine` umbrella re-export, exports map with **no
`"."`-level `types` key** (the attw masquerade fixed in OSS-C2), README, `api-specs.md` +
`architecture.md` entries, one lockstep minor changeset, and a fresh `bundleBytes` ceiling via
`check-perf --write --bytes` (creating a missing ceiling is the safe direction).

LICENSE/NOTICE need no registration — `scripts/propagate-license.ts` walks `packages/*`.

---

## 5. W4 — web benchmarks (PERF-6, full scope incl. device matrix)

Owner requirement: web perf numbers exist **before** the OSS publish. Spec:
[perf-measurement-2026-07.md](perf-measurement-2026-07.md) §11.6. Promoted from P4/cuttable to a
release-N row, at full scope including the real-browser matrix.

1. **Scenario SoT** into `@flare-engine/benchmarks` (already `private:true` + changeset-ignored),
   exported via package exports, consumed by `benchmarks/`, `bench-web`, and later `bench-native`.
   Add the `LAYER_MAP` entry **before** the first CI run. The dashboard's dead dep becomes live.
2. **`apps/bench-web`**: CanvasKit runner over the same scenarios; rAF-delta p50/p95/p99;
   Playwright headless for repeatability. **Double-lock in the first commit** — `private:true`
   *and* `.changeset` ignore. `bench-dashboard` is single-locked today; do not repeat that.
3. **The no-GPU numbers**: CanvasKit WASM bytes (default vs full, raw + gzip), cold start to first
   rendered frame, the same over a throttled 4G profile.
4. Results append to `history.ndjson` with the full provenance schema
   `{commit, host, runtime, appVersion, unit}`; the dashboard gains a Web section.
5. **Browser matrix** — gated on the owner action in §8. Sequenced last within W4 so the rest of
   the lane lands whether or not the account check clears in time.

---

## 6. W5 — hygiene

- `docs/design/api-specs.md:243` documents `findPath(grid, start, goal, opts?)` returning
  `{found, cells, cost}`. The shipped signature is
  `findPath(grid, startX, startY, endX, endY, options?)` returning
  `{path, cost, explored} | null` (`packages/pathfinding/src/astar.ts:9-16,128-135`; same shape for
  `findPathJPS`). OSS-D3 corrected the README and left the API contract doc wrong. It goes public
  in N+1; fix it in N. No gate checks `api-specs.md` against source, so this needs a human edit.
- `CODEOWNERS` — absent.
- `create-flare-app` `CHANGELOG.md` — the one package of 41 without one.

---

## 7. Corrections to existing SoTs (edit in place, one source per fact)

| Doc | Correction |
|---|---|
| `dynamics-lift-2026-08.md` | Decision 2 post-flip/0.4.0 → pre-freeze, release N. §3 lockstep note and §8 version pins de-versioned. §8 cross-repo risk rewritten around the `.npmrc` finding. |
| `simulation-adoption-2026-08.md` | Decision 3 "No early publish / 0.3.0 reserved" → superseded. §5 E1 marked dead with its reason. §5 E2 → W2 here. §6 calendar call resolved. |
| `flare-engine-page/docs/plans/render-web-upstream-spec.md` | "belongs in 0.3.0 … already queued with 23 changesets" → version-neutral; the count is 44. |
| `todo.md` | New rows seeded; Arc DYN moved out of post-flip. |

Existing docs that merely name a version without being made wrong by this change are left alone;
`road-to-oss-2026-09.md` is not swept.

---

## 8. Owner out-of-band actions

- **TestingBot plan tier — do this first.** W4 item 5 needs confirmation that the plan covers real
  *browser* devices. Surfaced at the start so it runs in parallel; the rest of W4 does not wait.
- **Rotate the npm publish credential.** Flagged "NOW" in the road-to-oss owner ledger and not yet
  confirmed done. It gates W6.
- **The publish itself.** Owner-run and owner-paired; agents never run it.

---

## 9. Cut under YAGNI

Named so they are not re-derived. Each was a real audit finding; none has a blocked consumer.

- **`perf-governor` package extraction** — the page's adaptive-quality FSM is platform-free and
  already tested, but it has exactly one consumer and that consumer's copy works today.
- **`procgen` package**, **2.5D lattice renderer**, **reactor kinetics** — single-consumer showcase
  code in the page's map/spacetime/reactor demos.
- **Object/multi-property tweens, Vec2 spring, `stagger()`, timeline/`seek`, React
  `useTween`/`useSpring`** — `animation` is scalar-only and has no React binding. Real gaps; no
  consumer is blocked. The portfolio uses Framer Motion, the page uses its own timelines.
- **The collapse timeline recorder** — genuinely generic (bake-once-scrub-often), but it is scope
  on an already-XL row and the portfolio's copy ships today. First candidate if W3 comes in light.
- **`Color` / `Rect` / `Transform2D` zero-alloc `Into` forms** — inconsistent with `Vec2`/`Mat3`,
  which are fully covered. Cheap, unblocking nothing.
- **`render-web` RAF/DPR/IntersectionObserver lifecycle helper** — nothing in `packages/`
  references `devicePixelRatio`, `IntersectionObserver`, or `ResizeObserver`, and both consumers
  hand-roll it. Deferred because the page's version is entangled with its perf governor; lifting
  half of it would regress the page, which decision 2 of simulation-adoption forbids.
- **`@flare-engine/react` web-safety** — the barrel statically re-exports `GameView`, which value-
  imports `react-native`, and the RN peers are non-optional. Neither consumer imports the package.
  A real pre-OSS question for the docs story, not a blocker for N.

---

## 10. Sequencing

W1 → W3. W2, W4, W5 independent of each other and of W1/W3. Then W6 (cut), then W7 (consumers).

**W6 — cut release N.** Consume the 44 pending changesets plus this release's into one lockstep
minor; `concretize-workspace-deps` (`workspace:*` → `^version`, the stale-`bun.lock` publish
landmine); then `check:publish-safety`, `check:exports`, `check:nodenext`, `check:perf`,
`check:perf-bytes`, `check:perf-freshness`, and the full lint → typecheck → test → build gate.

**Amended 2026-08-21 (owner):** release N also carries the Arc WEB engine rows (WEB-2, and WEB-3
if non-empty), and its gate additionally requires **WEB-1 and WEB-5 green** — the engine's web
contract must have executed in a browser at least once before W7/W8 consume it and W8 syncs
export surfaces into the page's public docs. It does **not** gate on Pan Tvardowski; PT runs
after the publish and its findings land in 0.3.x. Rationale and row specs:
[web-target-2026-08.md](web-target-2026-08.md) §8.

**W7 — consumers.**

- *Portfolio*: add `.npmrc` + deps, delete `apps/web/src/lib/dynamics/`, repoint the single import
  at `collapse-engine.ts:17`. Not a re-export shim — one consumer, one line.
- *Page*: bump deps, execute D3 — `canvaskit-loader.ts` becomes a shim keeping the `?url` import,
  `postfx/surface.ts` becomes the adapter building the hero chain and delegating; both local files
  then delete. Drop the local `smoothstep` for `math`'s.

---

## 11. Verification

**Engine:** per-row full gate (`lint → typecheck → test → build`) plus the W2 test battery and the
W3 behavioral gates from dynamics-lift §6 — boxes rest on a static floor, a stack does not sink,
energy does not grow, two-run determinism under a fixed seed, zero heap growth after warmup. Run
them against the donor first to establish reference numbers. `changeset status` per row.

**Portfolio:** the existing seeded bake-twice determinism test, **plus** the settle-frames
assertion — `expect(duration).toBeLessThan(2.5)` against the measured pre-swap baseline of
1.175 s / ~142 frames for the 12-box fixture. This is the item that catches a broken solver: one
that stops resolving contacts still free-falls *deterministically*, so every other gate passes
while the bake runs to the 480-frame cap. Then one owner eyeball of a real collapse.

**Page:** its own `lint → typecheck → test → build` gate, then load `/` and cycle all five
animations — spacetime and physarum must be visually unchanged; then force a context loss in
devtools and confirm the hero self-heals rather than blanking until reload.
