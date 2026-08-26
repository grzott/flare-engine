# What `grzott-portfolio` needs from the engine (2026-08-26)

Consumer-side requirements doc, written **by the portfolio repo, for the engine repo**. It states
what the page-collapse showcase still hand-rolls that is engine-shaped, so the engine can decide what
to absorb. It specifies no portfolio work.

**Status of the consumer:** `grzott-portfolio` is a real consumer as of 2026-08-25. Six packages ship
in `apps/web`, vendored as committed tarballs (see §5):

| Package | Where | Runtime? |
|---|---|---|
| `dynamics` | the collapse solver — `collapse-engine.ts:17` | yes |
| `errors` | `<ErrorBoundary>` + crash payloads around the collapse island | yes |
| `storage` | remembered transport playback speed | yes |
| `share` | blog-post share control with a clipboard fallback | yes |
| `math` | `Color` in the WCAG contrast gate | test only |
| `a11y` | `contrastRatio` / `wcagLevel` in the same gate | test only |

**This closes CE-W7 / DYN-2.** `consumer-enablement-2026-08.md` §1 lists the portfolio as blocked on
"a `dynamics` package + two `math` helpers". Both landed; the swap is done and merged.

---

## 1. Scope correction — `render-web` has no consumer here

A CanvasKit demo route was built at `/projects/flare-engine/demo` on 2026-08-25 and **removed on
2026-08-26** by owner decision. It worked (booted, simulated, settled, disposed cleanly, first
runtime consumer of `createPostFxSurface` anywhere), but it was out of scope: `grzott-portfolio` is a
portfolio, `/projects/*` describes work, and engine demos belong to `flare-engine-page` and Pan
Tvardowski. The portfolio's use of the engine is **the collapse effect over real DOM nodes** — not
rendering showcases.

Removed with it: `render-web`, `render`, `postfx`, `assets`, `ecs`, `core`, `input`, `debug`,
`particles`, `physics`, `canvaskit-wasm`, the `'wasm-unsafe-eval'` CSP allowance and `worker-src`.

**Consequence the engine should record honestly:** `render-web`, `render`, `postfx` and the whole
frame-loop tier are **back to zero external consumers**. The consumer-enablement release's own
framing — "the first public release would ship with zero packages that have a real external
consumer" — now holds for those packages again, and only for those. `dynamics`, `errors`, `storage`,
`share`, `math` and `a11y` do have one.

That is not a request to change anything. It is a fact the OSS-launch narrative should not overstate.

---

## 2. What the portfolio still hand-rolls

The collapse is 1,795 LOC across five files. Most of it is legitimately portfolio-specific — DOM
harvest, freeze/restore, scroll lock, `transform` writing, the transport UI — and the engine should
**not** absorb any of that (§4). Four pieces are different.

### 2.1 Record–replay timeline — the clear one

`apps/web/src/components/page-collapse/collapse-timeline.ts`, **79 LOC**, zero DOM, zero engine
imports, already unit-testable in isolation.

The collapse cannot re-integrate physics to scrub: semi-implicit Euler with friction and restitution
is not time-reversible. So the fall is **baked once** into a `Float32Array` and replayed by sampling.
That is a general pattern — bake-once, scrub-often — and nothing about it is portfolio-specific.

Current shape:

```ts
const STRIDE = 3; // dx, dy, angle per element per frame

createTimeline(elementCount: number, dt: number, maxFrames = 900): CollapseTimeline

interface CollapseTimeline {
  readonly elementCount: number;
  readonly frameCount: number;   // grows until settled or the buffer is full
  readonly duration: number;     // (frameCount - 1) * dt
  record(writer: (buf: Float32Array, frameBase: number) => void): void;
  sampleInto(progress: number, out: Float32Array): void; // lerps bracketing frames
}
```

Notes for whoever generalises it:

- **Angles are cumulative and never wrapped.** `Body.angle` accumulates `ω·dt`; a timeline that
  normalised to `[-π, π]` would unravel multi-turn spins into a visible backspin on the lerp. This is
  now documented on `Body` in `api-specs.md`, and any generic recorder must preserve it.
- `record` takes a **writer callback** rather than a body array, precisely so the recorder does not
  need to know what it is recording. Worth keeping — it is what makes it DOM-free.
- `sampleInto` writes into a caller-owned buffer; the collapse allocates one scratch buffer for the
  whole replay. Zero-alloc during playback is the point.
- `Float32Array` is deliberate here (playback precision, not simulation precision) even though
  `dynamics` uses `Float64Array` internally for its scratch. Do not "fix" this to f64 without
  measuring — it doubles the buffer for a visual replay.

**Already on the engine's radar and cut:** `consumer-enablement-2026-08.md` §9 lists "The collapse
timeline recorder — genuinely generic (bake-once-scrub-often), but it is scope on an already-XL row
and the portfolio's copy ships today. First candidate if W3 comes in light." W3 has now shipped.

**Ask:** absorb it, most naturally as a small addition to `@flare-engine/dynamics` (it records body
state) or a `@flare-engine/replay` tier-2 package if it should stay solver-agnostic.
**If declined:** the portfolio keeps its 79 lines. This is a nice-to-have, not a blocker.

### 2.2 Rest detection — a workaround for a known engine limitation

`collapse-engine.ts:573-585`:

```ts
const REST_LINEAR = 14;    // px/s
const REST_ANGULAR = 0.6;  // rad/s

function isSettled(): boolean {
  for (const p of sim) {
    if (Math.abs(p.body.velocity.x) > REST_LINEAR ||
        Math.abs(p.body.velocity.y) > REST_LINEAR ||
        Math.abs(p.body.angularVelocity) > REST_ANGULAR) return false;
  }
  return true;
}
```

These thresholds exist **only because `dynamics` v1 has no sleeping** — `world.ts:202-210` and the
package README document a bounded ~2.6 units/s oscillation at the penetration-slop equilibrium
(tracked as **DYN-3**). A resting pile never reaches zero velocity, so the consumer has to guess a
threshold that means "close enough".

They are hand-tuned and load-bearing: the bake stops when `isSettled()` returns true, and if it never
does the bake runs to the `MAX_FRAMES = 480` cap (3.99 s at `dt = 1/120`) instead of the measured
1.175 s / ~142 frames for the 12-piece baseline. A wrong threshold is a 3.4× longer clip.

**Ask (DYN-3, already open):** ship sleeping, or at minimum expose rest state so consumers stop
guessing. Either shape works:

```ts
// per-body, cheapest
interface Body { readonly sleeping: boolean }
// or world-level, which is what this consumer actually asks
function isAtRest(world: World): boolean
```

**If declined:** keep the current behaviour documented in the README, and do not change
`BAUMGARTE`/`PENETRATION_SLOP` without telling consumers — these thresholds were calibrated against
them, and the portfolio's determinism gate asserts a seed-calibrated `duration < 1.5 s`.

### 2.3 Cooperative time-sliced stepping — a real gap

`page-collapse.tsx:68` + `collapse-engine.ts:604-625`. The bake must not block input, so it runs in
~6 ms slices across rAF frames:

```ts
const BAKE_BUDGET_MS = 6;
bakeChunk(budgetMs: number): boolean   // steps until budget spent or settled; returns done
```

`@flare-engine/debug`'s `createFrameBudget` is **not** this. It is an FPS watchdog over a
`Float32Array` ring of frame deltas with an `onWatchdog` threshold (`debug/src/frame-budget.ts:20-45`)
— adaptive quality, not cooperative scheduling. The two got conflated during the portfolio audit;
recording it here so the engine does not inherit the same confusion.

**Ask:** a small deadline-bounded stepper, e.g.

```ts
function stepUntil(world: World, dt: number, opts: {
  budgetMs: number;
  maxSteps?: number;
  done?: () => boolean;
}): { steps: number; complete: boolean }
```

**If declined:** trivial for a consumer to write (it is ~15 lines around `performance.now()`), so
this is the lowest-value of the four. Its real value is that *every* consumer baking a simulation
will write it.

### 2.4 Deep-stack tunnelling — the only correctness item

`collapse-engine.ts:586-599`:

```ts
function clampFloor(): void {
  // Backstop against deep-stack penetration tunneling a piece through the floor
  // and free-falling off-screen forever (which also blocks settling → forces
  // the full-length MAX_FRAMES bake).
  for (const p of sim) {
    if (p.body.position.y > h) {
      p.body.position.y = h;
      if (p.body.velocity.y > 0) p.body.velocity.y = 0;
    }
  }
}
```

This runs **every step** and writes `Body.position.y` / `velocity.y` in place. It is a workaround: in
a deep stack the sequential-impulse solver can push a body through a static floor, after which it
free-falls forever, never settles, and forces the full 480-frame bake.

Conditions where it was observed: up to 60 dynamic bodies (`maxPieces ?? 60`), pixel-scale extents,
`gravity = 2200 px/s²`, `iterations: 10`, `dt = 1/120`, piled several deep against a static floor of
half-extent 100.

This is consistent with the documented v1 limits — no CCD, brute-force all-pairs broadphase — but
tunnelling *at rest in a stack* is different from tunnelling at high velocity, and worth a look.

**Ask:** confirm whether deep-stack penetration through a static body is expected at these
parameters. If yes, say so in the README next to the CCD note so consumers know a clamp is required.
If no, it is a solver bug and this is a reproduction.

**If declined:** the portfolio keeps `clampFloor`. It is cheap and it works. But note the contract it
depends on: **`Body.position` and `Body.velocity` must stay mutable plain objects.** A future
refactor to getters or immutable bodies breaks this silently — the pile would simply stop being
clamped and the bake would run long. `api-specs.md` now states the mutability guarantee; please keep
it.

---

## 3. Priority, from this consumer's perspective

| # | Item | Value here | Value to other consumers | Effort |
|---|---|---|---|---|
| 1 | **DYN-3 sleeping / rest state** (§2.2) | high — removes two magic numbers | high — every stacking sim needs it | M |
| 2 | **Timeline recorder** (§2.1) | medium — 79 lines we would delete | high — generic replay | M |
| 3 | **Deep-stack tunnelling answer** (§2.4) | medium — correctness clarity | high if it is a bug | S to answer |
| 4 | **`stepUntil` budget stepper** (§2.3) | low — 15 lines | medium | S |

None of these blocks the portfolio. The collapse ships today, on `main`, running the engine solver.

---

## 4. Explicit non-goals — do not build these

Named so no one generalises portfolio code that should not be generalised:

- **DOM anything.** Element harvest, `getBoundingClientRect` batching, freeze/restore of inline
  styles, `position: fixed` pinning, scroll lock, `inert`, `transform` writing. The collapse's whole
  SEO/a11y guarantee is that real DOM nodes are never destroyed or rasterised; that is a portfolio
  property, not an engine one.
- **The transport UI** — play/pause/scrub/speed, the vertical slider, reverse-close easing.
- **A DOM renderer for `dynamics`.** The collapse writes `el.style.transform` directly. It does not
  want a renderer and must not get one.
- **Rendering of any kind.** See §1 — this consumer draws nothing through the engine.

---

## 5. How this consumer installs, and what that constrains

`grzott-portfolio` does **not** install from npm. The `@flare-engine` scope is unpublished
(`dynamics` has never reached registry.npmjs.org at any version; `0.3.0` was version-bumped in git
without a publish), so the portfolio vendors committed `npm pack` tarballs in `vendor/flare-engine/`
redirected by a root `pnpm.overrides` block, with a manifest recording the engine commit SHA.

Currently pinned: **engine `8701b58`**, 7 packages (`a11y`, `dynamics`, `errors`, `events`, `math`,
`share`, `storage`).

Two consequences for the engine:

1. **`.npmrc` + `${NPM_TOKEN}` does not work for this consumer**, contrary to
   `dynamics-lift-2026-08.md:316-324` ("verified 2026-08-14"). That verification held for
   `flare-engine-page`, which resolves packages that were actually published. It does not hold for
   `dynamics`. Worth correcting in that doc.
2. **The portfolio re-packs on demand**, so engine changes reach it without a publish. Breaking
   changes are cheap to absorb *if* they are in a changeset. Keep the changeset discipline.

The portfolio's migration path off vendoring is written and ready
(`docs/flare-engine-registry-migration.md` in that repo); it needs a paid npm org and a real publish.

---

## 6. Verification the portfolio already provides

If any of §2 lands, these gates are what will catch a regression — they run on every commit and on
tagged releases:

- **Determinism:** `collapse-engine.test.ts` bakes twice under seed `0xc0ffee` and asserts the
  painted `el.style.transform` strings are equal across 21 `seek()` samples, plus `pieceCount === 12`
  (a guard against a vacuous pass) and a seed-calibrated `duration < 1.5 s`.
- **Contract:** `dynamics-contract.test.ts` — 10 tests over `dt <= 0` inertness, exact gravity
  integration, statics never moving, resting on a floor, stacks not sinking, no energy gain,
  run-to-run determinism, unwrapped cumulative angle, mutable `position`/`velocity`, and the full
  nine-name export surface.

The donor-vs-engine swap measured **6.8e-13** maximum divergence over 480 frames — eight orders of
magnitude below the consumer's `toFixed(2)` paint rounding — which is why the determinism gate passed
unchanged. That is the bar any future solver change should clear, or announce loudly.
