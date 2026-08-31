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
| Zero worklets anywhere | `grep -rl "react-native-reanimated\|'worklet'\|useSharedValue\|runOnUI" packages/*/src` → no matches across all 41 packages |
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
2. **Decision.** JS-thread `rAF`, imperative Skia capture, no Reanimated peer.
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
