# External review — pre-flip findings (2026-08-31)

Third-party audit of the engine, written **from outside the repo** during a half-year work review
of all five `C:\_PROG` workspaces. Source review:
`grzott-portfolio/docs/REVIEW-2026-08-31-half-year-work-audit.md` (sections 2.2 and 5.III).

**This is an evidence ledger, not a queue.** Per
[road-to-oss-2026-09.md](road-to-oss-2026-09.md)'s stated hierarchy, rows that need doing get filed
*there*; if this doc and road-to-oss disagree, road-to-oss wins. Nothing here is a decision — each
row states what was measured, what it costs, and what the owner has to choose.

**Measured at** engine `516d313` (`0.3.1`, clean tree, `main`) on 2026-08-31, by running the
commands, not by reading status docs.

---

## 0. What this review already found tracked — do not re-file

Checked before writing, so the session does not duplicate existing rows:

| Item | Already tracked at |
| --- | --- |
| `Query._remove` is O(n) via `indexOf` | [pan-tvardowski-needs-2026-08.md:70](pan-tvardowski-needs-2026-08.md) — reported by the PT consumer |
| CLA/DCO before the first external PR | [road-to-oss-2026-09.md](road-to-oss-2026-09.md) §0.2 |
| `LICENSE` / `NOTICE` / `TRADEMARK.md` Apache-2.0 swap | done — all three present at root |
| npm visibility is retroactive and one-way | [flip-runbook.md](flip-runbook.md) header |
| `.claude/` + `SESSION_LOG.md` go public (the AI-transparency asset decision) | [flip-runbook.md:46](flip-runbook.md) pre-flight; ratification scheduled Oct 2–5 per road-to-oss §1 |
| Secret / absolute-path scrub across `.claude` + `SESSION_LOG.md` | road-to-oss F4 |

The OSS-hygiene surface is in better shape than most launches. Verified present at root:
`LICENSE`, `NOTICE`, `TRADEMARK.md`, `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
`SECURITY.md`, `.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/FUNDING.yml`,
and 42 of 42 per-package `CHANGELOG.md`.

---

## 1. E-R1 — `GameView` re-renders React every frame on native (NEW)

**Severity: P1 pre-flip.** Not tracked anywhere in `docs/plans/` — grep for `setState` in
road-to-oss returns only the `Button` focus row and `SeededRNG.setState`.

`packages/react/src/game-view.tsx:114` holds the scene picture in React state, and the per-frame
`onPreRender` callback pushes to it:

```ts
const [picture, setPicture] = useState<SkPicture | null>(null);
// ...
const pic = bridge.endFrame() as SkPicture | null;
if (pic !== null) {
  if (isWeb) captureWebScene(pic, w * pd, h * pd);
  else setPicture(pic);            // game-view.tsx:209 — every frame, 60 fps
}
```

So on **native**, every frame runs a full React render pass on the JS thread, in addition to the
simulation. The **web** path already solved this: `captureWebScene` is imperative, and the comment
at `game-view.tsx:129-137` records exactly why — the reactive version tripped React's
`NESTED_PASSIVE_UPDATE_LIMIT` (50), logged "Maximum update depth exceeded" on every load, cost two
React renders per frame, and added a frame of image latency.

**The native path never got the same treatment.** The reasoning that justified the web fix applies
unchanged to native; only the symptom (a console error) was web-only.

**What to decide:** whether native adopts the same imperative capture as web. This is a bounded fix
inside one file with an existing in-repo precedent to copy.

**Why it matters beyond perf:** this is the concrete artifact behind the threading critique in E-R3.
"Does an animation library re-render React 60 times a second?" is a question a reviewer can answer
by reading nine lines, and right now the answer is yes.

---

## 2. E-R2 — ECS churn is unmeasured, and the accepted ask does not fix the complexity (PARTLY NEW)

**Severity: P2.** The O(n) itself is **already reported** by PT
([pan-tvardowski-needs-2026-08.md:70](pan-tvardowski-needs-2026-08.md)). Two things are new.

**(a) The proposed remedy reduces the constant, not the complexity.** PT's ask is that
`createBoundsCullSystem` / `createLifetimeSystem` accept a caller-supplied `Query` so a consumer
stops holding duplicate masks. Granting it halves the number of O(n) scans per destroy. It does not
remove them — `Query._remove` still does `indexOf` + `splice`:

```ts
// packages/ecs/src/query.ts:47 (_check) and :60 (_remove)
const idx = this.entities.indexOf(entityId);
if (idx !== -1) this.entities.splice(idx, 1);
```

`World.destroy` (`world.ts:33-50`) walks every registered query, so a destroy costs
`O(queries × entities)` regardless of how many queries the consumer minted. Swap-remove plus a
`Map<entityId, index>` makes it `O(queries)`. Note `packages/physics` already uses swap-remove
semantics with a `Map` index (see [perf-measurement-2026-07.md](perf-measurement-2026-07.md) §
`SpatialIndex`), so the pattern is established in-repo.

**(b) There is no benchmark that would show the cost.** `benchmarks/src/scenarios/ecs.ts` defines
exactly one scenario shape:

```
ecs.step  {n} entities (Pos+Vel)
```

Steady-state iteration only. **No spawn/destroy churn scenario exists**, so every published ECS
number (`ecs-step-1k-entities-us` and siblings) describes the path that is fast, and the path PT
reports as dominating its frame is the one with no number attached. For a shmup engine, churn *is*
the hot path.

**What to decide:** whether a churn scenario lands before the flip. Argument for: the first
benchmark question from a reader will be "what does entity churn cost?", and PT has already
published an answer the engine cannot corroborate. Argument against: it is a new baseline row, and
`check:perf` is fail-closed both ways.

---

## 3. E-R3 — the renderer / threading decision has no ADR (NEW)

**Severity: P0 for the flip, P3 for the code.** Nothing in `docs/plans/` records it — grep for
`renderer ADR`, `no ADR`, and `worklet` (outside template dep pins and the PT web-deps table)
returns nothing. The portfolio's fact table already carries this as
`engine-render-decision-record` = *"none — no ADR exists"*.

**Measured, from source, today:**

| Fact | Evidence |
| --- | --- |
| Zero worklets anywhere | `grep -rl "react-native-reanimated\|'worklet'\|useSharedValue\|runOnUI" packages/*/src` → no matches across all 41 packages. **[2026-09-08] No longer true, by decision:** `packages/react/src/game-view.tsx` now carries one `'worklet'` and two Reanimated shared values. See ADR-0001 and ADR-0002. |
| The loop drives on `requestAnimationFrame` | `packages/core/src/game-loop.ts:142` |
| React re-renders per frame on native | `packages/react/src/game-view.tsx:209` (E-R1) |
| rn-skia peer floor | `packages/react/package.json:56` → `">=2.0.0"` |

So simulation **and** React reconciliation run on the JS thread on React Native. Meanwhile
`@shopify/react-native-skia`'s own documentation directs users to pass Reanimated shared values
precisely so that "the JavaScript thread never gets involved during the animation", and rn-skia
`2.10+` requires Reanimated 4 for that integration path.

**This is defensible and may well be correct** — for a game that owns the whole screen, the JS
thread is idle anyway, and avoiding a Reanimated peer is a real dependency-surface win. The problem
is not the choice. **The problem is that the choice is undocumented**, and it is the single decision
that most defines the product against the positioning in road-to-oss §0.8 ("animation, gamification,
interactive UI"). That positioning targets animation *inside a host app's UI* — which is exactly the
case where the JS thread is busy, and where a competitor's counter-pitch is one sentence.

"Why not Reanimated worklets?" is the first question any React Native engineer asks on flip day. If
the repo has no answer, the thread writes one.

### 3.1 Proposed ADR skeleton

There is no `docs/decisions/` or `docs/adr/` in this repo; the closest convention is
`docs/design/architecture.md`. Recommend a new `docs/design/adr-0001-renderer-and-threading.md`
(and the directory convention it establishes), covering:

1. **Context.** RN's two viable paths in 2026: JS-thread `requestAnimationFrame` versus
   Reanimated worklets on the UI thread. What each costs in peer surface, debuggability,
   determinism, and web/native code sharing.
2. **Decision.** JS-thread `rAF`, imperative Skia capture, no Reanimated peer. **[2026-09-08] The last clause was reversed** — the native capture moved to a UI-thread worklet and Reanimated + `react-native-worklets` are now required peers of `@flare-engine/react` (ADR-0001, then ADR-0002). The JS-thread `rAF` half stands. This document records the August position; do not quote its "no Reanimated peer" as current.
3. **Why.** The honest reasons, including the ones that are about the project rather than the
   technology — one code path for web and native, a testable pure-TS loop that runs under Bun with
   no RN runtime (this is why the engine has 2,887 tests and PT has 2,522), and determinism, which
   worklet scheduling makes harder.
4. **What it costs.** Frame work competes with host-app JS. Name the case it is *not* right for.
5. **What would reverse it.** A measured frame-drop threshold under host-app load, or a consumer
   requirement the JS thread cannot meet.
6. **Status.** Accepted; revisit post-flip if consumer reports say otherwise.

Point (3) is where the engine wins the argument: the testability story is genuinely strong and is
currently invisible to anyone outside the repo.

---

## 4. E-R4 — root `bun test` prints `16 fail`, and the recorded diagnosis is wrong (NEW to this repo)

**Severity: P1 pre-flip.** Not tracked in `docs/plans/`. The portfolio's fact table carries it as
`engine-tests` and calls the failures *"root-runner cross-package resolution artifacts"*. **That
characterization is incorrect**, and the correction matters because it changes the fix.

Reproduced today at `516d313`:

| Command | Result |
| --- | --- |
| `bun test` (repo root) | 2,903 ran / **2,887 pass / 16 fail** / 2 errors |
| `bun test packages` | 2,739 ran / 2,723 pass / **16 fail** — same signature |
| `bun test packages/tilemap/tests/tilemap-renderer.test.ts` | 11 pass / **0 fail** |
| `bun test packages/render-web/tests/conformance.test.ts` | 13 pass / **0 fail** |
| `bun test packages/create-flare-app/templates/shmup/tests/logic.test.ts` | 14 pass / **0 fail** |
| `bun test packages/tilemap packages/render-web packages/create-flare-app` | 182 pass / **0 fail** |
| `bun test packages/render packages/tilemap` | 353 pass / **0 fail** |

The three owners pass **alone and together**. They fail only when some *other* package is in the
same run. That is **cross-file state leakage inside one Bun process** — a module-scope mock or
singleton set by an earlier file and not reset — **not module resolution**. The failure messages
support this: the tilemap failures are behavioural (`draws tiles within camera bounds`,
`culls tiles outside camera bounds`), and the shmup failure is
`expect(kills).toBe(1)` receiving `0`. Resolution failures do not produce wrong physics results.

**Why it is P1 despite not being a real defect:** `bun test` at the repo root is a stranger's first
command after `git clone`. On flip day it prints `16 fail`. Whatever `turbo test` does per-package
in CI, that is the day-one impression, and "known artifact" is not a claim a first-time reader can
verify.

### 4.1 Root cause found — two mechanisms, both with a two-file repro

Bisected 2026-08-31. There is no third mechanism: 12 + 2 + the 2 reported errors = the 16.

**Mechanism A — `mock.module()` leaks process-wide (12 failures: tilemap 11, render-web 1).**
`packages/react/tests/game-view.test.ts` installs process-global module mocks at file scope:

```
game-view.test.ts:44   mock.module('react', …)
game-view.test.ts:137  mock.module('@shopify/react-native-skia', …)
game-view.test.ts:251  mock.module('@flare-engine/core', …)
game-view.test.ts:260  mock.module('@flare-engine/ecs', …)
game-view.test.ts:333  mock.module('@flare-engine/render', …)   ← the one that bites
```

Bun's `mock.module()` is **process-global and is never unwound at file end**. Once
`packages/react` has run, every later file in the same process resolves `@flare-engine/render` to
the stub — and `TilemapRenderer` and `render-web`'s `createWebSkiaModule` conformance both depend on
the real one.

```
bun test packages/react packages/tilemap/tests/tilemap-renderer.test.ts   → 11 fail
bun test packages/react packages/render-web/tests/conformance.test.ts     →  1 fail + 1 error
bun test packages/tilemap/tests/tilemap-renderer.test.ts                  →  0 fail (11 pass)
```

**Mechanism B — `_resetComponentIds()` in `beforeEach` (2 failures: shmup template).**
`packages/ecs/tests/*`, `packages/engine/tests/integration.test.ts` and
`packages/testing/tests/scene-snapshot.test.ts` all reset the module-global component-ID counter in
`beforeEach`. Any module that already allocated `ComponentDef`s at import time — the seven built-ins
in `components.ts`, or the shmup template's own components — then holds defs whose `id`/`bit`
**collide** with newly issued ones, so queries match the wrong entities:

```
bun test packages/engine/tests/integration.test.ts \
         packages/create-flare-app/templates/shmup/tests/logic.test.ts   → 2 fail
bun test packages/create-flare-app/templates/shmup/tests/logic.test.ts   → 0 fail (14 pass)
```

This is the same hazard the shmup test file already warns about in its own header comment
(`logic.test.ts:7`: *"World.query() registers permanent queries — do NOT call
`_resetComponentIds()`"*). The warning was written; the root cause was not removed. See **E-R8** —
mechanism B is a symptom of the module-global component-ID state, not an independent bug.

**Why the recorded diagnosis mattered.** "Cross-package resolution artifacts" implies a bundler or
`exports`-map problem and points the fix at packaging. The real causes are test-harness hygiene, and
they are fixable in the test files without touching a single shipped source file.

**What to decide:**

1. **Mechanism A** — move the `mock.module()` calls behind `beforeEach`/`afterEach` with explicit
   restore, or isolate `packages/react`'s tests in their own process. Bun has no automatic unwind,
   so isolation is the reliable option.
2. **Mechanism B** — folded into E-R8. A per-`World` or per-test registry removes the need for a
   reset hook at all.
3. **Belt and braces** — point the root `test` script at `turbo test` so the root command matches
   what CI gates on. Minutes, and it makes the repo green on day one regardless of the above.

---

## 5. E-R5 — small OSS-surface gaps (NEW, minor)

| Gap | Note |
| --- | --- |
| No root `CHANGELOG.md` | 42/42 per-package CHANGELOGs exist, but a visitor landing on the repo root has no single "what changed" view. Changesets can generate one, or a short pointer file suffices. |
| No `dependabot.yml` / renovate config | A public Apache-2.0 repo with no automated dependency updates is a visible maintenance signal. Cheap to add, and it makes the "best-effort maintenance" posture in E-R6 more credible, not less. |

---

## 6. E-R6 — declare a support posture in the README (NEW, non-code)

Not a defect; a launch risk. The owner's stated plan after the flip is a hard rest period followed
by selective freelance. An OSS repo with three-week-old unanswered issues reads **worse** than a
private one — it converts "impressive private project" into "abandoned public project", which is
the single most common way a strong solo launch loses credibility.

The fix is one paragraph in the README, written before anyone opens an issue: best-effort support,
no SLA, issues triaged on a stated cadence, PRs welcome but review may be slow. Stating it up front
costs nothing and is read as professionalism. Discovering it implicitly, from silence, is read as
abandonment.

Pairs with the `.claude/` + `SESSION_LOG.md` publicity decision already scheduled for Oct 2–5. A
recommendation on that, from outside: **publish both, and frame them in the README.** 11,319 lines
of append-only session record with a frictions ledger is the strongest available rebuttal to the
"AI slop" reflex — it is a documented process with gates, surfaced scope deviations, and recorded
frictions. But it only reads that way if the README claims it first. Found unexplained at the repo
root, it reads like a leak.

---

## 7. E-R7 — align the root README's ECS wording with the package README (NEW, messaging)

`packages/ecs/README.md:3` is exact and honest: *"Archetype-bitmask ECS … Max 32 component types
total — the component-id bitmask is module-global, shared across all `World` instances."* The
published blog post is equally careful, naming the Map-indirection cost and the 32-component ceiling
in its own excerpt.

The root `README.md` says **"Hybrid ECS"**, which is looser than both. The storage model is
`Map<componentId, Map<entityId, data>>` plus a bitmask for query matching
(`packages/ecs/src/world.ts:11-13`) — no typed arrays anywhere
(`grep -rn "Float32Array\|Int32Array\|Uint32Array\|ArrayBuffer" packages/ecs/src` → no matches).
Against bitECS's struct-of-arrays, "hybrid" invites a reading the code does not support.

Also worth surfacing at the root, not only in the package: **the 32-component cap is process-global,
not per-`World`**, so two worlds in one process split one budget. That is a fine constraint for a
game and a real one for a general-purpose engine. It is documented; it is not *discoverable*.
Measured, and scoped for a separate audit, in **E-R8**.

Recommend the root README use the package's own phrasing. The precision is already written — it
just is not where the first reader looks.

---

## 8. E-R8 — the 32-component ceiling: measured, and what an audit would have to settle

**Severity: P2 for the flip (documentation), P1 for the roadmap (design).** The owner wants to lift
this. It should not be attempted inside a flip-window session: it touches the hottest path in the
engine, the public `ComponentDef` shape, and the machine-gated zero-alloc contract. **This section
is the brief for a separate audit, not the change.**

### 8.1 What the constraint actually is

`packages/ecs/src/component.ts:20-39`:

```ts
let nextComponentId = 0;                       // module-global, mutable

export function defineComponent<T = undefined>(name, defaults?): ComponentDef<T> {
  const id = nextComponentId++;
  if (id >= 32) throw new Error(`Maximum 32 component types exceeded (defining "${name}")`);
  return { id, bit: 1 << id, name, create: defaults ?? (() => undefined as T) };
}

export function _resetComponentIds(): void { nextComponentId = 0; }   // @internal
```

Three separate properties fall out of those nineteen lines, and an audit has to treat them
separately because they have different fixes:

1. **The cap is 32** — `1 << id` on a JS number is a signed 32-bit operation.
2. **The counter is process-global, not per-`World`** — every `World` in a process draws from one
   budget, and `World` has no registry of its own.
3. **The counter is mutable from outside** — `_resetComponentIds` is exported from the public
   barrel (`src/index.ts:2`) and appears in `dist/index.d.ts`. It is `@internal` in JSDoc only;
   nothing enforces it.

### 8.2 Measured today

| Measurement | Value | Source |
| --- | --- | --- |
| Built-ins allocated eagerly on `import '@flare-engine/ecs'` | **7** | `components.ts` — `Position`, `Velocity`, `Rotation`, `Scale`, `Parent`, `Lifetime`, `Follower`, all top-level `defineComponent` calls |
| Components defined by Pan Tvardowski | **16** | `PT src/core/components.ts` |
| **Total consumed by the flagship consumer** | **23 of 32 (72%)** | 7 + 16 |
| Headroom left for PT | **9** | — |
| Built-ins PT never uses | **`Parent` (0 references)**; `Rotation` used once | grep over `PT/src` |
| Slot 31 works | yes — verified end-to-end | ad-hoc test, 2026-08-31 |
| `bit` at id 31 | **`-2147483648`** — negative | `1 << 31` is signed |
| 33rd `defineComponent` | throws, message names the component | verified |
| Tests covering any of the above | **zero** | no test in `packages/ecs/tests` references the limit |

Two things to take from that table. **The ceiling is closer than it looks** — a vertical shmup, at
the simpler end of the genre range, is at 72%, and 7 of the 23 were spent before the consumer wrote
a line. **And the failure is honest** — it throws on definition with a useful message, so nobody
ships silent corruption from overflow. That materially lowers the urgency: this is a design ceiling,
not a live bug.

The negative `bit` at slot 31 is not a defect — JS bitwise ops are int32 throughout, so `&`, `|` and
`~` all behave, and I verified a query over slot 31 matches, un-matches and removes correctly. It
*is* a trap for anything that treats a mask as a number rather than a bit set: a `mask > 0` guard, a
`>>>` shift, a devtools inspector printing an archetype, or any future serialization of an archetype
to JSON. None of those exist today. All of them are plausible next features.

### 8.3 What the audit has to settle, in order

**Q1 — what is the real requirement?** "More than 32" is not a target. Is it 64, 128, or unbounded?
Is the pressure component *types* or component *instances*? PT's 16 includes two pure tags
(`Shadow`, `HitboxDot`, both `defineComponent(name)` with no data) — folding tags into one bitfield
component is a consumer-side fix that costs the engine nothing. **An audit that starts by counting
what real consumers need may conclude the answer is a docs page, not a rewrite.**

**Q2 — does the hot path survive the change?** This is the gate. Query matching is currently one
integer AND:

```ts
// query.ts:32
(archetype & this.requiredMask) === this.requiredMask && (archetype & this.excludedMask) === 0
```

Every candidate below makes that more expensive, and `check:perf` has **11 fail-closed allocation
counters** plus the `ecs-step-*` baselines. **Run the perf gate first, on a spike branch, before
committing to an option** — it will settle the argument cheaply and it is exactly the tool for it.

**Q3 — what breaks in the public API?** `ComponentDef.bit` is `readonly bit: number` and is exported.
Anything that widens the mask changes that type or its meaning. Note this is a **lockstep-versioned
scope**: an `ecs` major would move all 41 packages.

### 8.4 The option space

Sketched so the audit starts from a map rather than a blank page. Not a recommendation — Q2 decides.

| Option | Ceiling | Hot path | API break | Notes |
| --- | --- | --- | --- | --- |
| **A. Multi-word mask** (`Uint32Array`, `ceil(N/32)` words) | any N | loop over words; archetype becomes an object, so `Map<number, number>` becomes `Map<number, Uint32Array>` | `bit: number` → word+offset | Costs an allocation per archetype unless pooled. Most conventional answer. |
| **B. `BigInt` mask** | unbounded | `&`/`\|`/`~` all work, so the diff is tiny — but **every BigInt op allocates** | `bit: number` → `bigint` | Smallest patch, worst fit: it collides head-on with the zero-alloc rule the repo machine-gates. Cheap to disprove — write the spike, run `check:perf`. |
| **C. Per-`World` registry** | still 32, but per world | unchanged | `defineComponent` no longer returns a portable def; needs `world.register(def)` | Does not raise the cap. Does fix property 2 **and** property 3, and makes `_resetComponentIds` unnecessary — which is what E-R4 mechanism B actually needs. |
| **D. Hybrid: int32 fast path + overflow tier** | any N | queries inside the first 32 stay **exactly as fast as today**; only queries touching overflow take the slow path | additive | Most complexity, best benchmark preservation. Worth costing if Q2 kills A and B. |
| **E. Don't lift it; make it survivable** | 32 | unchanged | none | Lazy built-ins (reclaim up to 6 of 7 for a consumer like PT that never touches `Parent`), a `componentCount()` introspection, a throw message that names the 32 already taken, and a docs page on tag budgeting. Hours, not weeks. |

**A note on sequencing.** C and E are independently valuable and do not block each other, and C is
the one that removes the `_resetComponentIds` export — closing E-R4 mechanism B, killing a public
`@internal` footgun, and fixing "two worlds split one budget", without touching the mask width at
all. If the audit lands anywhere, landing C first is defensible on its own merits.

### 8.5 One hazard the audit must check, not assume

The engine ships **dual CJS+ESM**. A module-global `let` is per module *instance*, not per package —
so a consumer whose graph loads both the CJS and the ESM build (mixed toolchains, Metro plus Jest, a
duplicated `node_modules` copy from a version skew) would get **two counters, both starting at 0**,
and component ids from one instance would silently collide with the other's. Queries would match
wrong entities with no error.

**This is a hypothesis, not a measured finding** — I did not reproduce it, and `exports`-map
conditions may well make it unreachable in practice. It is cheap to settle (import the ESM and CJS
builds in one process, define a component through each, compare ids) and it belongs in the audit,
because it is the difference between "32 is a ceiling" and "32 is a ceiling *and* the state can
fork". It also raises the stakes on option C: a per-`World` registry makes the whole class
impossible.

### 8.6 Minimum that should land before the flip regardless

Whatever the audit later decides, none of this waits on it:

1. **Tests for the boundary.** Zero exist. Cover: 32 definitions succeed, slot 31 round-trips
   through `add`/`has`/`query`/`remove`, and the 33rd throws. Cheap, and it pins the behaviour
   before anyone refactors it.
2. **Surface the cap where a reader will hit it.** `packages/ecs/README.md:3` states it exactly;
   the root `README.md` does not mention it (see E-R7). A consumer choosing an ECS wants to know
   before adopting, not on definition 33.
3. **Say it is process-global, not per-`World`.** That is the surprising half, and it is currently
   documented only in the package README's final clause.

---

## 9. Suggested disposition

Ordered by cost-to-fix against damage-if-skipped. Owner decides; nothing here is filed.

| Row | Pre-flip? | Rough cost |
| --- | --- | --- |
| E-R4 root `bun test` green | **yes** | both root causes are isolated with two-file repros (§4.1); isolate `packages/react`'s mocks, and point the root script at `turbo test` |
| E-R3 renderer/threading ADR | **yes** | hours — mostly writing down what is already known |
| E-R1 native imperative capture | **yes** | hours; web precedent exists in the same file |
| E-R6 README support posture | **yes** | one paragraph |
| E-R7 root README ECS wording | **yes** | minutes |
| E-R8 §8.6 only — boundary tests + document the cap | **yes** | hours |
| E-R5 root CHANGELOG + dependabot | probably | minutes each |
| E-R2 churn benchmark + swap-remove | post-flip acceptable | hours; new `check:perf` baseline row |
| E-R8 §8.1–8.5 — lift the 32-component ceiling | **no — separate audit** | own session; touches the hot path, the public `ComponentDef`, and a lockstep major |

The first six are all cheap, and together they close every item an outside reviewer flagged as a
day-one credibility risk. E-R2 is the only remaining item that is genuinely engineering work rather
than writing-down work.

**E-R8 is deliberately split.** Its §8.6 minimum (three boundary tests plus two documentation lines)
is flip-scope and should land. The redesign is not: it is the one item here that can move the
`ecs-step-*` baselines and force a lockstep major, and it needs its own audit with a perf spike as
its first step, not a flip-window session.

---

## 10. Context worth keeping (not a finding)

The same review measured the competitive landscape from the npm and GitHub APIs on 2026-08-31, and
it is more favourable than the engine's own docs assume:

- `react-native-game-engine` — last release **1.2.0, 2020-06-09**, last push 2024-12-31, and still
  **1,264 downloads/week**. Unserved demand, not absent demand.
- `rn-game-engine-next` — published 2026-04-08, four versions, **1 download/week**, abandoned.
- `react-native-game-engine-skia` — **14 stars**, last push 2022-08-24.
- `oznksc/Playroom` (Expo 2D editor/runtime, started 2026-05-31) — **2 stars**, active.
- `Casevh123/rn-game-engine-kernel` — **1 star**, started 2026-08-05.

Every 2026 entrant is one person, under ten stars, under a year old. **Flare is by a wide margin the
most complete thing in this category**, and the gap the engine claims exists does measurably exist.

The counterweight, and the reason E-R3 matters: the *animation-inside-an-app* slot the positioning
targets is not empty. `react-native-reanimated` 8,181,399/week, `@shopify/react-native-skia`
1,365,750, `lottie-react-native` 1,477,301, `@rive-app/react-native` 113,936.

The external review's recommendation for the flip, recorded here for the launch-copy decision: lead
with the **renderer-free leaf packages** (`dynamics`, `tilemap`, `pathfinding`, `ecs`, `math`,
`progression`, `testing`) and with the portfolio's page-collapse effect as the proof, because that
demo is untouched by the threading argument and shows the engine paying off somewhere nobody
expected. Keep "engine" as the umbrella rather than the headline — it invites a Phaser/Pixi
comparison the project loses on maturity and does not need to have.

---

## 11. In-repo audit response (2026-08-31)

Every claim above re-run against the working tree at `471ad14` — commands executed, not read. This
section is the SoT for the verdicts, the corrections, and the design decisions that came out of
them. The queue rows live in [todo.md](todo.md) **Arc XR** and are not restated here.

### 11.1 Verdicts

| Row | Verdict |
| --- | --- |
| E-R1 native re-render | Fact confirmed (`game-view.tsx:209`); three corrections in §11.2 |
| E-R2 ECS churn | Confirmed; the remedy it describes as a pending ask **already shipped** in 0.3.1 (`systems.ts:55`, CW7-3) |
| E-R3 no ADR | ADR absent, confirmed; **premise inverted** — see NEW-1 |
| E-R4 root `bun test` | **Fully confirmed.** 2,903 ran / 2,887 pass / 16 fail / 2 errors, exact. Both two-file repros reproduce exactly. The correction of the portfolio's "resolution artifact" diagnosis is right |
| E-R5 CHANGELOG / dependabot | Confirmed. No root `CHANGELOG.md`, no `.github/dependabot.yml`, no renovate config; 42/42 package CHANGELOGs present |
| E-R6 support posture | Confirmed. Zero support / maintenance / SLA wording in `README.md` |
| E-R7 root README wording | Confirmed. `README.md:8` and `:60` say "hybrid"; zero typed arrays in `packages/ecs/src`; `packages/ecs/README.md:3` is already exact |
| E-R8 §8.2 measurements | All confirmed: 7 built-ins, PT exactly 16 (`= defineComponent` x16), 23/32, slot-31 bit `-2147483648`, zero boundary tests (the only `32` in `packages/ecs/tests` is `0.032` at `fsm.test.ts:69`) |
| E-R8 §8.5 dual-build fork | **Upgraded from hypothesis to measured fact** — see NEW-3 |

### 11.2 Corrections to the review

1. **E-R1 "not tracked anywhere" is wrong.** [road-to-oss-2026-09.md:482](road-to-oss-2026-09.md)
   (OSS-B16) states it verbatim: *"`setPicture` per frame is the RN-Skia render model — keep."*
   [engine-deep-audit-2026-07.md:36](engine-deep-audit-2026-07.md) row 11 names it too. B16 shipped
   2026-07-08 (session #222) and kept `setPicture` deliberately. This is a re-litigation, not a
   discovery — which matters, because **B16 was closed on a false premise** (NEW-1).
2. **E-R1 "the web path already solved this" is wrong.** `scene-texture.ts:237` still calls
   `setImage(next)` every frame. Web went from *two* React renders per frame to *one*; it did not
   remove per-frame rendering. There is **no in-repo precedent to copy**, so the review's
   "bounded fix inside one file" sizing is optimistic.
3. **E-R4 disposition 3 is already done.** Root `package.json` is already `"test": "turbo test"`.
   The stranger's command is `bun test` — Bun's *builtin*, which bypasses package scripts entirely
   and cannot be redirected. Separately, the `mock.module` surface is ~40 call sites across 12
   packages, not just `packages/react`; isolating one package treats a symptom.

### 11.3 New findings

**NEW-1 (P0, launch blocker) — `@flare-engine/react` has an undeclared hard dependency on
`react-native-reanimated`.**

`game-view.tsx:16` imports `usePictureAsTexture` from `@shopify/react-native-skia`. That hook lives
at `lib/module/external/reanimated/textures.js:53` and its first statement is
`Rea.useSharedValue(null)`, where `Rea` is a lazy proxy that throws
`OptionalDependencyNotInstalledError('react-native-reanimated')` on first property access. Hook
rules mean it runs unconditionally — `usePictureAsTexture(isWeb ? null : picture, sceneSize)` — so
**web crashes too**, not only native.

rn-skia's real `dependencies` are `canvaskit-wasm` and `react-reconciler` only; reanimated is an
**optional peer** (`bun.lock:991` → `"optionalPeers": ["react-native", "react-native-reanimated"]`).
`packages/react/package.json:53-60` declares six peers and reanimated is not among them.

**Why it was never caught, and the masking mechanism:** *bun installs optional peers; npm, pnpm and
yarn skip them.* `react-native-reanimated@4.2.1` is present in this repo's `node_modules` while
appearing in **no** engine manifest — a grep over root plus all 42 package.json files returns
nothing outside the three `create-flare-app` templates. Every in-workspace consumer resolves it for
free (templates pin `~4.5.0`; PT pins `4.2.1` + `worklets 0.7.4`), and
`packages/react/tests/game-view.test.ts:137` stubs the whole of rn-skia with the comment
*"In tests there is no Reanimated"* — the suite is blind by construction. **An F2 verdaccio
rehearsal run under bun would not catch this either.**

Two documents assert the opposite: `packages/react/README.md:11` enumerates the peers using exactly
the right reasoning for safe-area-context (*"a value import … a project without it fails to resolve
at runtime"*) and omits this one; `engine-deep-audit-2026-07.md:114` states the policy *"the engine
has no reanimated peer anywhere; keep it that way."* The code has violated that policy since
`usePictureAsTexture` was adopted.

**This makes E-R3's ADR unwritable as drafted.** Its §3.1 decision ("no Reanimated peer") and its
rationale ("avoiding a Reanimated peer is a real dependency-surface win") are both false today.

**NEW-2 (P1) — native allocates a fresh offscreen GPU surface and snapshot every frame.**
rn-skia's `createTexture` worklet calls `Skia.Surface.MakeOffscreen(size.width, size.height)` per
invocation with no cache and no release, then `makeImageSnapshot()`. The effect re-fires on every
`picture` change — 60/s. This is the **same** leak the engine measured and fixed *for web only*
(`scene-texture.ts:63` `createSceneSurfaceCache`, written up in
[web-target-2026-08.md](web-target-2026-08.md) §12). Native has no bypass. It does not blank the
screen there (no Chrome 16-context cap), but it is a per-frame GPU allocation on the hottest seam in
a repo that machine-gates zero-alloc.

**NEW-3 (P1, correctness) — the §8.5 counter fork is real. Measured, not hypothesised.** Loading
both built formats in one Node process:

```
esm.Position.id = 0 | cjs.Position.id = 0
ESM new id = 7 bit 128 | CJS new id = 7 bit 128
RESULT: COLLISION — two counters, both from 0
```

It is not only a CJS/ESM problem: **any** duplicate copy of `@flare-engine/ecs` in one graph forks
the counter. The failure mode is silent wrong query results, not a throw. This promotes option C
(per-`World` registry) from "independently valuable" to "the fix for a live correctness class".

**NEW-4 (risk in E-R2's remedy) — swap-remove is not behaviour-preserving.** `query.ts:21`
documents `entities` as a *sorted* array; `packages/render/src/render-system.ts:94` iterates the
query directly into `SpriteBatch`, whose contract is *"preserving global insertion (z-sorted)
order"* (`sprite-batch.ts:67`). Swap-remove perturbs z-order and atlas-run clustering on every
destroy — changing rendered output, and plausibly moving the
`alloc.render … 8 atlas interleaved` / `… clustered` counters. Either preserve order (tombstone +
compaction) or accept and document it; the review presents it as a free win.

**NEW-5 (blast radius) — `_resetComponentIds` has non-test consumers.**
`benchmarks/src/ecs.bench.ts:1` and `benchmarks/src/integration.bench.ts:2` both import and call it.
Removing the export (option C) drags in the perf suite and forces a re-capture — on a machine
currently untrustworthy under load (WHEA corrected TLB machine-check, 2026-08-19).

### 11.4 XR-1 design — do it the way rn-skia recommends (owner-approved 2026-08-31)

Owner's call: adopt Reanimated properly rather than route around it. rn-skia's documented model is
that the texture lives in a shared value and never in React state; the engine currently does the
opposite and lets rn-skia's hook convert. Doing it the documented way collapses E-R1, NEW-1 and
NEW-2 into one row.

1. **Declare the peer.** `packages/react/package.json` gains
   `"react-native-reanimated": ">=3.19.1"` — matching rn-skia's own floor, deliberately **not**
   `>=4`, so Reanimated 3 stays viable and `packages/engine/README.md:42`'s old-architecture claim
   stays true. (Reanimated 4 additionally peers `react-native-worklets`; that is reanimated's own
   peer to resolve, not ours to declare — but it earns a documentation line, because Reanimated 4 is
   New-Architecture-only.)
2. **Own the shared value.** Replace `usePictureAsTexture` + `setPicture` with
   `useSharedValue<SkImage | null>(null)`, assigned directly from the `onPreRender` frame callback.
   The `image` prop at `game-view.tsx:317` changes from `sceneTexture` to `sceneImage`, and the
   `sceneTexture == null` guard at `:316` is dropped — a `SharedValue` object is never null, so
   the `viewportSize.w === 0` check alone is sufficient to suppress the `<Image>` before first capture.
3. **Reuse the engine's own capture.** `createSceneCapture` (`scene-texture.ts:143`) is already
   surface-cached, leak-fixed and covered. Feeding it on native kills the per-frame `MakeOffscreen`
   (NEW-2) and deletes the `isWeb` branch at `game-view.tsx:139-141` and `:208-209` — web and native
   converge on one path.
4. **Net effect:** zero React renders per frame on *both* platforms, one cached surface instead of
   60/s, and the threading story becomes true enough to write an ADR about.

**Why this is a spike and not a copy-paste.** Two web-tuned details do not transfer unexamined:

- `createSceneCapture` calls `makeNonTextureImage()` whenever it exists (`scene-texture.ts:159`). On
  web that is mandatory (cross-context sampling). On native it also exists, and calling it forces a
  full GPU→CPU readback every frame — a serious regression. It must be gated to web.
- `RETENTION_DEPTH = 3` (`scene-texture.ts:141`) was derived against RN-Skia web's `<Canvas>`
  painting on its own rAF *after* the capture. With a shared value on native the retention semantics
  differ and have to be re-derived, not assumed.

**Device verification (owner has a Pixel 7 connected, 2026-08-31).** This repo holds no game app, so
the native check runs against a scaffolded `create-flare-app` shmup template or the PT repo. Two
known local hazards: `bun run android` breaks on `react-native-audio-api` MAX_PATH (build with
`PT_SKIP_NATIVE_AUDIO=1`), and a Metro-resolved workspace build must not silently pick up a stale
`dist`. The check is: mount `<GameView>`, confirm frames render, and confirm React render count per
frame is zero (a `console.count` in the component body, read back over `adb logcat`).

**The negative test matters as much as the positive one.** A scaffold installed with **npm** (not
bun) and *without* reanimated must reproduce the `OptionalDependencyNotInstalledError` on today's
code, and must resolve cleanly once the peer is declared. That is the only check that actually
proves NEW-1, because bun masks it.

### 11.4b XR-1b vehicle build — result (2026-09-01, session #299)

**Vehicle A is built, installed and running on the Pixel 7 (Android 17). XR-1c is unblocked.**
Recipe, verbatim, because every step below cost something to find:

1. **Build from a short path.** The agent scratchpad is ~119 chars deep; rn-skia's CMake prefab
   step then generates `…/android/build/intermediates/cxx/Debug/<hash>/logs/arm64-v8a/prefab_command.bat`
   at **270 chars** and Gradle dies with `CreateProcess error=2` (MAX_PATH). Built from `C:\xr1b\`
   instead. Note `mv` cannot relocate a half-built project either — it cannot traverse the deep
   tree — so choose the short path *before* the first Gradle run, not after.
2. **`bun pm trust @shopify/react-native-skia` before the first Gradle run.** Bun blocks the
   package's `postinstall` (`node scripts/install-libs.js`) as untrusted, which is what unpacks the
   prebuilt Skia static libs. Without it the build fails at
   `:shopify_react-native-skia:configureCMakeDebug` with `Could not find libskia.a`. **This hits
   every scaffolded app on bun, not just this vehicle** — filed as **XR-10** below.
3. **Local registry.** verdaccio on `127.0.0.1:4873`, all 41 scoped packages published to it, app-level
   `.npmrc` pointing the **default** registry there (F2's rule — `create-flare-app` is unscoped).
   `localhost` resolved fine here; the `::1` hazard in web-target's notes did not reproduce.
4. **Verify the consumer actually got XR-1a**, do not assume: installed
   `@flare-engine/react@0.3.1` must show the `react-native-reanimated: >=3.19.1` peer **and**
   `useSharedValue` present / `usePictureAsTexture` absent in `dist/index.mjs`. Confirmed for A.
5. `bunx expo prebuild --platform android --no-install` → `./gradlew assembleDebug` (4m52s) →
   `adb install -r` → `adb reverse tcp:8081 tcp:8081` → `bunx expo start --dev-client`.

**Both hazards §11.4 flagged were handled correctly by XR-1a** — verified at the source, not assumed:
`game-view.tsx:187-190` passes `nonTextureImage: isWeb` (so no native GPU→CPU readback) and
`retentionDepth: isWeb ? 3 : 2`. Neither is the cause of what follows.

**THE RESULT THAT MATTERS — the Skia scene renders black on native.** Fully loaded, process alive,
`<GameView>` mounted: the React Native layer renders (the `Score: 0` HUD and the `VirtualJoystick`
are both on screen) and **the Skia canvas is empty**. The shmup template spawns a player sprite
inside `onReady`, so an empty canvas is a failure, not an idle state. Reproduced twice from a cold
launch; on the clean run there were **zero** `RNSkia updateAndRelease() failed` lines, so the
`LegacySurfaceTexture is not attached!` bursts seen earlier are a backgrounding artifact and a red
herring. Screenshots: `C:\xr1b\xr1b-a.png`, `xr1b-a3.png`.

**ATTRIBUTED AND ROOT-CAUSED — XR-1a is a confirmed native rendering regression. It must not ship
as it stands.** Three runs on the one APK, one device, one Metro, swapping only
`node_modules/@flare-engine/react` and re-bundling with `--clear`:

| `@flare-engine/react` build | `nonTextureImage` on native | Result |
| --- | --- | --- |
| published `0.3.1` (pre-XR-1a, `usePictureAsTexture`) | n/a | **renders** — enemies, bullets, `Score: 2` |
| XR-1a (workspace, shared value) | `false` (`isWeb`) — as shipped | **black canvas** |
| XR-1a + one-line patch | `true` | **renders** — bullets, enemy, `Score: 1` |

**Root cause: §11.4's premise "the snapshot is a true copy on native" is false.** On native
`surface.makeImageSnapshot()` returns a GPU-backed image owned by the offscreen surface's context,
and rn-skia's on-screen `<Image>` cannot sample it — the same cross-context problem web has, which
is why web needs `makeNonTextureImage()`. Native needs it too. The wrong premise is repeated in the
source docstring at `scene-texture.ts:117-118` ("the snapshot is a true copy on native") and must
be corrected there, not just here.

**The one-line fix is not the right fix.** Forcing `nonTextureImage: true` on native restores
rendering but reinstates exactly the per-frame GPU→CPU readback §11.4 called "a serious
regression" — trading a black screen for a frame-rate one. A correct fix keeps the image on the GPU
and makes the on-screen canvas sample the *same* context (or uses rn-skia's own texture handoff);
that is a design question for XR-1c, and the perf half must be measured, not assumed. Screenshots:
`xr1b-a3.png` (black), `xr1b-pre.png` (pre-XR-1a renders), `xr1b-patch.png` (patched renders).

**Correction to a claim made earlier in this session:** bun's cache is **not** registry-blind. It
keys entries by registry host — `@flare-engine/react@0.3.1@@localhost@@@1` and
`…@@registry.npmjs.org@@@1` coexist and hold different builds (2 vs 0 occurrences of
`useSharedValue`). The failed first A/B was the **lockfile** pinning the resolved registry, so
`bun add --force` re-resolved to the verdaccio entry. The remedy is to drop the lockfile entry or
install by explicit registry, not to purge the cache.

**Vehicle B (Reanimated 3 / old architecture) does not exist and cannot be built from the
scaffolder.** `expo prebuild` on Expo 57 / RN 0.86 wrote `newArchEnabled=true` into
`android/gradle.properties` and **silently ignored** the `expo.newArchEnabled = false` set in
`app.json`; Reanimated 3.19.5 then failed to link, `Target "worklets"/"reanimated" links to target
"hermes-engine::libhermes" but the target was not found`. **Consequence for XR-1a's own README
text:** `packages/engine/README.md` now claims "Reanimated 3.x works on both old and new
architecture, so old-architecture apps remain viable" and cites the RN 0.79–0.81 `newArchEnabled:
false` opt-out. That claim is **untestable through the supported first-run path**, because the
templates pin Expo 57 / RN 0.86, which force the New Architecture. Verifying it needs a hand-built
RN 0.79–0.81 vehicle the scaffolder does not emit. XR-2's ADR should state this rather than repeat
the claim unqualified.

### 11.4c XR-1c fix + device verification (2026-09-01, session #300)

**Fixed and verified on the Pixel 7.** The native capture now runs in a `runOnUI` worklet
(`game-view.tsx` `captureSceneOnUI`), so the offscreen surface is built on the UI thread in the same
GL context as the on-screen `<Canvas>`. Web is untouched and keeps the single-threaded path
WEB-1..WEB-7 verified. Screenshot: `xr1c-verified.png` — bullets, enemy, `Score: 2`, gameplay live.

**Why this shape and not the alternatives.** RN-Skia's own `usePictureAsTexture` does *exactly* what
XR-1a did — `MakeOffscreen` → `drawPicture` → `flush` → `makeImageSnapshot`, with
`makeNonTextureImage()` **web-only** — and differs in one respect: it wraps the work in
`Rea.runOnUI`. That single difference is the whole defect. Forcing the readback on native also
"fixes" the black frame but pays a GPU→CPU copy every frame; the threading fix pays nothing. Note
the fix is also strictly better than the code shipping today: pre-XR-1a dispatched via `runOnUI`
too, but reached it through `setPicture` → a React render per frame.

**Measured, not asserted** (30 s of gameplay each, identical procedure):

| | pre-XR-1a (ships today) | XR-1c fix |
| --- | --- | --- |
| renders | **black** on XR-1a; renders here | **renders** |
| `GameView` React renders / ~1800 frames | ~1 per frame (by construction) | **6 total** — mount + layout settles |
| RN-Skia `updateAndRelease` msgs / 30 s | 2 840 | 4 614 |
| process after repeated soaks | alive | alive |

**NEW-1 is closed on device:** 6 React renders across ~1800 frames is mount plus a few state
settles, not per-frame. Measured with a `console.log` injected into the shipped `GameView` body and
counted over `adb logcat`.

**One delta that is not clean, recorded rather than buried.** The benign RN-Skia pair
(`updateTexImage: LegacySurfaceTexture is not attached!` + `updateAndRelease() failed. The exception
above can safely be ignored`) is **pre-existing** — the shipping build emits 2 840 in the same
window — but the fix emits **~1.6× more**. It is RN-Skia's own TextureView path and RN-Skia labels
it ignorable, rendering is correct, and the process is stable; it is not a launch blocker. It is
also not understood, and two things about the new native path plausibly bear on it: there is **no
retention ring on native any more** (the worklet assigns `target.value` directly and never releases
the previous image — matching RN-Skia's own `createTexture`, which also does not), and `GameConfig`
already exposes `opaque` to move Android off TextureView onto SurfaceView. **Owed before the freeze:
a long soak (minutes, not 30 s) watching native memory, and a check of whether `opaque: true`
removes the messages.** `retentionDepth` no longer applies to native and is now web-only.

### 11.4d XR-1c residue closed: `opaque: true` removes the messages, nothing leaks (2026-09-05, session #316)

**Both questions §11.4c left open are answered on device, and the answer to the first changes the
reading of the second.** Pixel 7 (panther, Android 17), **release** build of the scaffolded vehicle,
both arms identical except `GameConfig.opaque`.

| | `opaque: false` (default) | `opaque: true` |
| --- | --- | --- |
| renders | yes, 0 JS errors | yes, 0 JS errors, RN overlay still on top |
| RN-Skia pair / 60 s | **22 028** | **0** (three consecutive windows) |
| share of all logcat output | **90%** (22 028 of 24 600 lines) | ~0% (1 125-3 925 lines total) |
| native heap, 6 min | 132 740 -> 135 089 KB (+2 349) | 129 433 -> 130 248 KB (+815) |
| plateau reached | t~150 s | t~120 s |

**No leak, on either path.** Both series rise during warm-up and then plateau with *bidirectional*
noise for the remaining 3.5 minutes (arm A wanders 135 281 -> 135 193 -> 135 089). §11.4c was right
that 30 s proves nothing; six minutes shows a flat steady state. `opaque: true` additionally sits
**~4.8 MB lower** in absolute native heap and settles sooner.

**So the 1.6x message delta recorded in §11.4c was log volume, not retention.** That is consistent
with the worklet path having no retention ring: there was never anything accumulating to retain.
The pair is RN-Skia's TextureView path, `opaque` moves Android onto SurfaceView, and the code that
emits them is simply no longer on the path. Recommended on Android, and now documented as such on
`GameConfig.opaque` — with the honest framing that this is log noise and TextureView overhead, not
a correctness fix, since rendering is correct either way.

**Two measurement traps worth keeping, both of which produced wrong numbers first.** (1) `adb logcat
-d` reads a **wrapping** ring buffer — `main` is 256 KiB and was sitting *full* at 255 KiB, so every
`-d | grep -c` count was a silent floor (they read 15 265-21 216 against a true 22 028). Stream to a
file for a fixed window instead. (2) A cumulative-count column sampled that way is not monotonic and
is meaningless; it measures buffer occupancy.

**Vehicle note.** The `dev.flare.demo` install that §11.4c's 2 840 / 4 614 figures were measured on
was a stale artifact of an earlier vehicle iteration; the tree's `app.json` declares
`com.grzott.newarch`, and the debug + Metro path no longer boots (`ReferenceError: Property
'MessageQueue' doesn't exist` under bridgeless). It was rebuilt as a **release** APK, which is both
a better soak target and why the absolute counts here are ~2.4x §11.4c's — a release build renders
more frames and the message rate tracks frames. **The figures above are internally comparable to
each other and NOT to §11.4c's.** Filed while documenting: **XR-13** — `runOnUI`, which *is* the
XR-1c fix, is deprecated in Reanimated 4 under an open-ended `>=3.19.1` peer.

### 11.5 Sequencing note

E-R3's ADR is deliberately sequenced *after* XR-1 rather than before it. Writing the ADR first would
record the threading decision as it was believed to be; writing it second records what the code
actually does. The ADR is cheap either way — the expensive part is being wrong in public about the
one decision a reviewer will check first.
