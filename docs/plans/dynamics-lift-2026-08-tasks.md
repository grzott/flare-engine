# `@flare-engine/dynamics` Lift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the portfolio's page-collapse rigid-body solver as `@flare-engine/dynamics`, and flip
`grzott-portfolio`'s collapse showcase onto it, so "built with my 2D engine" becomes literally true.

**Architecture:** Lift 556 LOC of DOM-free OBB rigid-body code (SAT + clipping manifold + sequential
impulse) from `grzott-portfolio/apps/web/src/lib/dynamics/` into a new tier-2 engine package
depending only on `@flare-engine/math`. Bodies stay object-per-body (a consumer contract); every
transient per-step structure moves to per-world pools so `step()` allocates nothing after warmup.
The consumer then deletes its local module and repoints one import.

**Tech Stack:** engine — TypeScript 5.9, Bun (runtime + test), tsdown (dual CJS/ESM), Biome,
Changesets (fixed lockstep), Turborepo. Portfolio — Next.js, pnpm, Biome, Turborepo, Vitest +
happy-dom (introduced by Task 1).

**Spec:** [dynamics-lift-2026-08.md](dynamics-lift-2026-08.md) — read it before Task 1. It carries
the decisions, the determinism correction (§4), and the allocation-site inventory (§5).

## Global Constraints

- **Timing: Phase 1 and 2 must not start before the OSS flip completes (Oct 19–23, 2026).** Phase 0
  is portfolio-repo-only and runs any time.
- **Two repos, two harnesses.** `flare-engine` is Bun + Turborepo; `grzott-portfolio` is
  **pnpm** + Turborepo, workspace name `@grzott/web`. Never run one repo's gate in the other —
  `/close` in particular resolves by cwd and will load the wrong one.
- Tier 2. `@flare-engine/dynamics` depends on `@flare-engine/math` and nothing else.
- No `any`, no `as any`, no `@ts-ignore`.
- **`noUncheckedIndexedAccess` is on in both repos, and it applies to typed arrays** — `verts[i]` is
  `number | undefined`, verified against the real config. For loop-bounded reads use a non-null
  assertion into a local: `const ax = verts[o]!;`. That is the existing house idiom
  (`packages/render/src/sprite-batch.ts:252` uses `pop()!`), it costs nothing at runtime, and
  hoisting reads out of expressions helps the hot path anyway. Do not reach for `as any` or a
  `?? 0` fallback that silently masks an indexing bug.
- Named exports only; `import type` for type-only imports (Biome `noDefaultExport` / `useImportType`).
- Plain objects + module-level functions. No classes.
- Zero-alloc in `step()`; provide `…Into` / out-param forms for anything consumed per-frame.
- **`Float64Array` for all solver scratch — never `Float32Array`.** AGENTS.md's "Float32Array for
  bulk numeric data" rule does not apply here: the donor's arithmetic is f64 throughout, and
  narrowing to f32 silently degrades contact-solver stability.
- `Body.position` and `Body.velocity` stay mutable plain-object fields. Not getters, not SoA — the
  consumer writes `position.y` and `velocity.y` in place.
- All direction-vector normalization uses the sqrt form (`Math.sqrt(x*x + y*y)`, then multiply by
  the reciprocal), matching `@flare-engine/math`. `Math.hypot` survives only at the once-per-step
  gravity-magnitude site, where it is not a hot path.
- Only comment non-obvious logic. No `TODO` / `FIXME`.
- Conventional Commits, ≤72 chars, no body, no emoji, **no `Co-Authored-By` trailer**.
- Changesets is `fixed` lockstep: one **minor** changeset for the whole engine-side change. Never
  major (it would force 1.0.0), never a per-package bump.
- Engine gate per row: `bun run lint`, `bun run typecheck`, `bun run test`, `bun run build`, plus
  `bun run check:deps` and `bun run check:changeset`.

---

## File Structure

**`grzott-portfolio` (Phase 0 and 2):**

| File | Responsibility |
|---|---|
| `apps/web/vitest.config.ts` | Create: happy-dom environment, `@/` alias |
| `apps/web/package.json` | Modify: `test` script, Vitest devDeps; Phase 2 adds the engine dep |
| `turbo.json` | Modify: a `test` task |
| `apps/web/src/components/page-collapse/collapse-engine.test.ts` | Create: the determinism gate |
| `apps/web/src/components/page-collapse/page-collapse.tsx` | Modify: trigger copy — the collapse `<button>`'s `aria-label` **and** `title`, plus the badge `<Link>`'s text and `aria-label`. Three claim sites; find them by element, not line number |
| `apps/web/src/lib/dynamics/**` | Delete in Phase 2 |
| `apps/web/src/components/page-collapse/collapse-engine.ts:17` | Modify in Phase 2: the import |
| `docs/reference-collapse-flare-engine-integration.md` | Modify: stale line ref, then mark executed |

**`flare-engine` (Phase 1):**

| File | Responsibility |
|---|---|
| `packages/math/src/vec2.ts` | Modify: add `perp` + `crossSV` to the `Vec2` namespace |
| `packages/math/tests/vec2.test.ts` | Modify: cover both |
| `packages/dynamics/package.json` | Create: manifest, tier-2 deps, exports map |
| `packages/dynamics/tsconfig.json` | Create |
| `packages/dynamics/tsdown.config.ts` | Create |
| `packages/dynamics/src/body.ts` | Create: `Body`, `createBody`, `isStatic`, geometry writers |
| `packages/dynamics/src/pool.ts` | Create: per-world scratch, grown on demand |
| `packages/dynamics/src/manifold.ts` | Create: SAT + face clipping into a pooled `Manifold` |
| `packages/dynamics/src/world.ts` | Create: `World`, `createWorld`, `addBody`, `step` |
| `packages/dynamics/src/index.ts` | Create: the public barrel |
| `packages/dynamics/tests/*.test.ts` | Create: behavioral gates |
| `packages/dynamics/README.md` | Create |
| `packages/engine/src/index.ts`, `packages/engine/package.json` | Modify: umbrella re-export + dep |
| `scripts/check-deps-tiers.mjs:37-78` | Modify: `LAYER_MAP` entry |
| `docs/design/api-specs.md`, `docs/design/architecture.md` | Modify: package entries |
| `docs/plans/todo.md` | Modify: seed Arc DYN |

**Internal vs public:** only `src/index.ts` is the public surface. `pool.ts`, `manifold.ts`, and the
geometry writers in `body.ts` stay unexported from the barrel; tests import them directly by path,
the way `packages/physics/tests/*` already does.

---

## Phase 0 — now, `grzott-portfolio` only

> **EXECUTED 2026-08-13**, on `grzott-portfolio` `main` (commits `b2313aa`..`dc57acd`).
>
> **The load-bearing result: the bake is deterministic under a fixed seed.** Task 2 Step 2's STOP
> condition did not fire, so the migration contract's central claim holds and Phases 1-2 are not
> invalidated. The solver was independently confirmed to carry no hidden entropy — no `Math.random`,
> no `Date.now()`, no `Set`/`Map` iteration in the step path — so the injected `rng` really is the
> sole non-determinism source.
>
> Corrections found during execution are marked **Corrected 2026-08-13** inline below. Read them:
> three of them change what a task should do, and one changes what Task 10 can verify.

### Task 1: Stand up Vitest in the portfolio

**Corrected 2026-08-13.** The original text claimed the portfolio had "no test infrastructure today
— no runner, no test files". That was **false**, and the error is load-bearing: `apps/cms` already
ships `"test": "node --test tests/*.test.mjs"` with two schema-drift suites — one of which was
*failing* at the branch point (`cross_posts` written by the ingest route but absent from the
`PostRow` TS type). Adding the root `test` script below therefore turned root `pnpm test` red on
first use. It has since been fixed in the portfolio (the three 2026-04-30 syndication columns were
missing from `PostRow`), so root `pnpm test` is green again — but do not re-derive the premise.

What is true: **`apps/web` had no test runner and no test files.** This task creates that lane;
Task 2 puts the first test in it.

**Files:**
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/lib/__smoke.test.ts` (deleted at the end of Task 2)
- Modify: `apps/web/package.json`, `turbo.json`

**Interfaces:**
- Produces: a working `pnpm test` in `@grzott/web`. Task 2 depends on it. (**Corrected
  2026-08-13:** originally claimed a working `pnpm test` "at the repo root" too — unachievable as
  written, because the root script fans out to `apps/cms`, whose suite was red. Scope the claim to
  `@grzott/web`; the green scoped command is `pnpm test --filter @grzott/web`.)

- [ ] **Step 1: Install the runner**

```bash
pnpm add -D vitest happy-dom --filter @grzott/web
```

`happy-dom` rather than `jsdom`: the collapse engine needs elements, inline styles, and
`getBoundingClientRect` (which the tests stub anyway), not a full browser emulation, and happy-dom
starts substantially faster. No React testing library is needed — `collapse-engine.ts` is a plain
DOM module with no React in it.

- [ ] **Step 2: Write the config**

`apps/web/vitest.config.ts`:

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
  },
});
```

The alias must mirror `apps/web/tsconfig.json:7` (`"@/*": ["./src/*"]`) or every `@/`-prefixed
import inside the module under test fails to resolve.

- [ ] **Step 3: Wire the scripts**

Add to `apps/web/package.json` scripts:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

Add to `turbo.json` tasks, mirroring the existing `typecheck` entry:

```json
    "test": {
      "dependsOn": ["^build"],
      "outputs": []
    }
```

Add `"test": "turbo run test"` to the root `package.json` scripts.

- [ ] **Step 4: Prove the lane works with a throwaway smoke test**

`apps/web/src/lib/__smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('vitest wiring', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });

  it('has a DOM', () => {
    const el = document.createElement('div');
    el.textContent = 'ok';
    document.body.appendChild(el);
    expect(document.body.textContent).toBe('ok');
  });

  it('resolves the @ alias', async () => {
    const mod = await import('@/lib/dynamics');
    expect(typeof mod.createWorld).toBe('function');
  });
});
```

The third case is the one that actually matters — it fails loudly if Step 2's alias is wrong, which
is the most likely setup mistake and would otherwise surface as a confusing import error in Task 2.

- [ ] **Step 5: Run it**

```bash
pnpm test --filter @grzott/web
```

Expected: 3 passing.

- [ ] **Step 6: Check Biome is happy with test files**

```bash
pnpm lint
```

Biome lints the whole tree. If test-file idioms trip a rule, fix the config deliberately rather than
sprinkling suppressions.

- [ ] **Step 7: Emit the commit block — do not run it**

**Corrected 2026-08-13:** this step used to run `git add` / `git commit`, contradicting this
document's own closing note ("Do not run `git add` / `commit` / `push` from a builder agent") and
`grzott-portfolio`'s `CLAUDE.md` ("Propose only — never run `git add`/`git commit`/`git push`. The
human pastes."). Emit the block for the owner to paste. Note the scope: `collapse` is **not** in the
portfolio's commitlint scope enum (`web | cms | schemas | db | ui | config | repo | deps | docs |
ci`), and subjects are sentence-case.

```
git add apps/web/vitest.config.ts apps/web/package.json turbo.json package.json pnpm-lock.yaml apps/web/src/lib/__smoke.test.ts
git commit -m "build(web): Add a vitest lane with happy-dom"
```

---

### Task 2: The bake-determinism gate

**Files:**
- Create: `apps/web/src/components/page-collapse/collapse-engine.test.ts`
- Delete: `apps/web/src/lib/__smoke.test.ts`

**Interfaces:**
- Consumes: `createCollapse(root, opts): CollapseHandle` from `./collapse-engine`; the Vitest lane
  from Task 1.
- Produces: the safety net Task 10 lands on.

**Read this before writing the test.** `CollapseHandle` exposes `bakeChunk(budgetMs)`, `seek(p)`,
`duration`, `destroy(opts?)`, and `pieceCount` — it does **not** expose the recorded `Float32Array`.
So the gate cannot hash the buffer directly without widening the public API. Instead it samples the
**observable** output: bake, then `seek` across the range and read back each piece's inline
`transform`. Two identically-seeded runs must produce identical sample sequences. This covers the
solver *and* the playback path, and needs no source change.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { createCollapse } from './collapse-engine';

/** Deterministic stand-in for Math.random: a 32-bit LCG, same sequence every run. */
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A fixed page fixture: happy-dom reports zero-size rects, so stub them. */
function buildFixture(): { root: HTMLElement; pieces: HTMLElement[] } {
  const root = document.createElement('div');
  const pieces: HTMLElement[] = [];
  for (let i = 0; i < 12; i++) {
    const el = document.createElement('div');
    const rect = { x: (i % 3) * 120, y: Math.floor(i / 3) * 90, width: 110, height: 80 };
    el.getBoundingClientRect = () =>
      ({
        ...rect,
        top: rect.y,
        left: rect.x,
        right: rect.x + rect.width,
        bottom: rect.y + rect.height,
        toJSON: () => rect,
      }) as DOMRect;
    root.appendChild(el);
    pieces.push(el);
  }
  document.body.appendChild(root);
  return { root, pieces };
}

/** Bake with a fixed seed, then sample the painted transforms across playback. */
function sampleRun(seed: number): { duration: number; frames: string[] } {
  const { root, pieces } = buildFixture();
  const handle = createCollapse(root, { rng: seededRng(seed), fixedDt: 1 / 120 });

  let guard = 0;
  while (!handle.bakeChunk(1000)) {
    if (++guard > 100) throw new Error('bake never completed');
  }

  const frames: string[] = [];
  for (let k = 0; k <= 20; k++) {
    handle.seek(k / 20);
    frames.push(pieces.map((el) => el.style.transform).join('|'));
  }

  const duration = handle.duration;
  handle.destroy();
  root.remove();
  return { duration, frames };
}

describe('collapse bake determinism', () => {
  it('replays identically for the same seed', () => {
    const a = sampleRun(0xc0ffee);
    const b = sampleRun(0xc0ffee);
    expect(a.duration).toBe(b.duration);
    expect(a.frames).toEqual(b.frames);
    // Settle margin (spec §6, gate item 2). A solver that stops resolving
    // contacts still free-falls deterministically: `clampFloor` zeroes only
    // `velocity.y`, so the burst `velocity.x` / `angularVelocity` never decay,
    // `isSettled` never fires, and the bake runs to MAX_FRAMES (480 · 1/120 =
    // 3.99s). Without this bound every other assertion here still passes on a
    // broken solver. Shipped fixture settles at 1.175s.
    expect(a.duration).toBeLessThan(2.5);
  });

  it('differs for a different seed', () => {
    const a = sampleRun(1);
    const b = sampleRun(2);
    expect(a.frames).not.toEqual(b.frames);
  });

  it('actually moves the pieces', () => {
    const { frames } = sampleRun(7);
    expect(frames[0]).not.toBe(frames[frames.length - 1]);
    expect(frames.some((f) => f.includes('translate'))).toBe(true);
  });
});
```

The second and third cases are not padding. Without them, a bug that leaves every transform empty —
or freezes every piece — passes the equality assertion trivially, and the gate silently protects
nothing.

**Corrected 2026-08-13 — three deviations the shipped test needed. Carry them.**

1. **The settle-margin assertion above was missing from this plan entirely.** Spec §6 lists it as
   portfolio-side gate item 2 ("settle stays well inside `MAX_FRAMES = 480`… the margin is the
   signal that solver behavior did not shift"), and dropping it left a gate that is **green on a
   broken solver** — see the comment in the code. This is the single most important correction on
   this page.
2. **`sampleRun` must assert the piece count before baking.** `createCollapse` returns a
   `NOOP_HANDLE` when the harvest finds nothing (`collapse-engine.ts:400`), whose `bakeChunk`
   returns `true` immediately with `duration: 0`. Assert the exact expected count
   (`expect(handle.pieceCount).toBe(12)`), not `> 0` — a fixture that silently drifts to 1-2 pieces
   passes every other assertion while covering almost nothing. Cases 2 and 3 *would* catch a full
   no-op handle, so this guard is diagnostic rather than protective: it fails at the cause instead
   of producing a baffling "different seeds produced identical frames".
3. **Reset the DOM between runs** — `document.body.innerHTML = ''` at the top of `buildFixture`.
   `createCollapse` detaches simulated pieces onto `document.body` and mutates its inline style, so
   run B inheriting run A's leftovers is a live contamination risk in a test whose entire purpose is
   A-vs-B equality. Rule it out by construction.

**What actually happened when this ran:** no fixture/API mismatch on the first run, and **no
same-seed divergence**. The fixture bakes `pieceCount: 12`, `duration: 1.175s` (~142 frames), stable
across four consecutive runs. `destroy()` needed no `{ restoreScroll: false }` workaround —
happy-dom tolerates `scrollTo`'s `behavior` option.

- [ ] **Step 2: Run it and read the failure carefully**

```bash
pnpm test --filter @grzott/web
```

Expected first failure: a fixture or API mismatch — an option name, a rect field happy-dom needs,
`pieceCount` being 0 because the selector found nothing. Fix the **test** until it runs.

**If the first real failure is `a.frames` ≠ `b.frames` under one seed, stop.** That means the bake is
non-deterministic even with the RNG pinned, which contradicts the migration contract's central
claim and blocks the whole migration. Investigate before going further: the likely suspects are
`Date.now()` in the settle logic, iteration over a non-deterministically ordered collection, or a
second RNG source the contract missed.

- [ ] **Step 3: Delete the smoke test**

```bash
rm apps/web/src/lib/__smoke.test.ts
```

It has served its purpose; a real test now exercises the same wiring. (**Corrected 2026-08-13:** was
`git rm` — see Step 5.)

- [ ] **Step 4: Run the portfolio's full gate**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

**Corrected 2026-08-13:** `pnpm test` at the root was red when this plan was written, for a
pre-existing `apps/cms` reason unrelated to this work (see Task 1). That has since been fixed, so
the bare command is correct again — but if the root is red for a reason you did not cause, the
scoped `pnpm test --filter @grzott/web` is this task's actual gate, and the cms failure is a
separate finding to report rather than absorb.

- [ ] **Step 5: Emit the commit block — do not run it**

**Corrected 2026-08-13:** was `git add` / `git rm` / `git commit`; see Task 1 Step 7 for why. Scope
was `test(collapse)`, which **fails the portfolio's commitlint scope enum** — use `web`.

```
git add apps/web/src/components/page-collapse/collapse-engine.test.ts apps/web/src/components/page-collapse/collapse-engine.ts
git commit -m "test(web): Gate seeded bake determinism for page collapse"
```

The deleted `__smoke.test.ts` needs no `git rm` in the block: it was created and removed inside this
same branch, so if it was never committed it is simply absent. `collapse-engine.ts` is in the block
because of the doc-comment fix below.

- [ ] **Step 6: Correct the `rng` doc comment in the source**

**Added 2026-08-13.** `collapse-engine.ts:33-38` told the reader the migration requires a
"byte-identical-bake gate". Spec §4 corrects that framing — there is no stored golden timeline and
no cross-version byte-fidelity contract. Since this task creates the real gate, update that comment
to describe it (same-seed reproducibility, sampled from playback transforms) and point at the test
file. Leaving it would ship a known-false pointer in the exact place a future reader looks.

---

### Task 3: Correct the trigger copy

**Files:**
- Modify: `apps/web/src/components/page-collapse/page-collapse.tsx:585-588`
- Modify: `docs/reference-collapse-flare-engine-integration.md`

**Interfaces:**
- Consumes: nothing. Independent of every other task — worth doing even if the lift is abandoned.

- [ ] **Step 1: Read the current copy**

**Corrected 2026-08-13: there are THREE sites, not one.** This step originally named only the link
text, and the file table pinned it to `585-588`. Line numbers drift — find the **elements**: the
collapse trigger `<button>` and the badge `<Link href="/projects/flare-engine">` directly below it.
As executed, all three carried the same claim:

```
page-collapse.tsx  button aria-label   "…physics demo built with my engine"
page-collapse.tsx  button title        "…my own 2D rigid-body engine…"
page-collapse.tsx  link text           "built with my 2D engine"
```

The `title` is the one an executor will talk itself out of — it never names Flare, so it reads
innocent. Reject that defense: the *original* link text never named Flare either. Proximity plus the
word "engine", inches from a link labelled Flare engine, is what made the claim misleading, and that
is exactly the shape of the `title`.

- [ ] **Step 2: Replace with a claim that is true today**

The link stays; only the framing changes — from powered-by to related-work, in the shape of "by the
author of Flare engine", with the accessible name (`aria-label` / `title`) attributing the physics to
the local module rather than the engine. **The exact wording is the owner's editorial call — do not
invent public-facing copy unilaterally.** Propose, get approval, then edit.

- [ ] **Step 3: Check for the same claim elsewhere**

```bash
grep -rn "2D engine\|built with my\|powered by" apps/web/src docs/blog --include="*.tsx" --include="*.ts" --include="*.md"
```

Any other instance needs the same correction or the fix is cosmetic. While here, fix
`docs/reference-collapse-flare-engine-integration.md`, which cites this location as `399-403` — that
range is now the `activate` callback, and the copy lives at `585-588`.

- [ ] **Step 4: Run the portfolio's full gate, then emit the commit block**

**Corrected 2026-08-13:** do not run git (Task 1 Step 7), and `fix(collapse)` fails the portfolio's
commitlint scope enum — use `web`.

```
git add apps/web/src/components/page-collapse/page-collapse.tsx docs/reference-collapse-flare-engine-integration.md
git commit -m "fix(web): Reframe the collapse engine attribution copy"
```

**As executed 2026-08-13.** Owner approved a *prototype-for* framing over the reference doc's
suggested *related-work* one, because the local module's own header already records the intent to
become `@flare-engine/dynamics`:

- link text → `a prototype for Flare engine`
- link `aria-label` → `a prototype for Flare engine — my 2D engine project; this demo's physics is a
  separate module of mine`
- button `aria-label` → `Collapse the page — physics demo built on my own rigid-body module`
- button `title` → `Physics demo — my own rigid-body module. Click to collapse; Shift-click to
  shatter.`

Note the link's accessible name **leads with the visible badge text verbatim**. That is WCAG 2.5.3
"Label in Name" — a speech-input user saying the visible words must be able to activate the control.
Do not reorder it in Task 10's second pass.

One residual read, accepted knowingly: "a prototype **for** Flare engine" can also parse as "a
prototype **of** Flare engine" — an early version of the engine itself. The accessible names
disambiguate, but `title` is hover-only and `aria-label` is AT-only, so a sighted touch user sees
only the five visible words. Rated low severity against the claim it replaced.

---

## Phase 1 — post-flip, `flare-engine`

### Task 4: `math` — `Vec2.perp` and `Vec2.crossSV`

**Files:**
- Modify: `packages/math/src/vec2.ts`
- Modify: `packages/math/tests/vec2.test.ts`

**Interfaces:**
- Consumes: the existing `Vec2` namespace object at `packages/math/src/vec2.ts:13`.
- Produces: `Vec2.perp(v: Vec2, out?: Vec2): Vec2` and `Vec2.crossSV(s: number, v: Vec2, out?: Vec2):
  Vec2`. Tasks 6 and 7 depend on both.

- [ ] **Step 1: Write the failing tests**

Append to `packages/math/tests/vec2.test.ts`:

```ts
describe('Vec2.perp', () => {
  it('returns the left-hand perpendicular', () => {
    expect(Vec2.perp({ x: 1, y: 0 })).toEqual({ x: 0, y: 1 });
    expect(Vec2.perp({ x: 3, y: -4 })).toEqual({ x: 4, y: 3 });
  });

  it('writes into out and returns it', () => {
    const out = { x: 0, y: 0 };
    const result = Vec2.perp({ x: 3, y: -4 }, out);
    expect(result).toBe(out);
    expect(out).toEqual({ x: 4, y: 3 });
  });

  it('is safe when out aliases the input', () => {
    const v = { x: 3, y: -4 };
    Vec2.perp(v, v);
    expect(v).toEqual({ x: 4, y: 3 });
  });
});

describe('Vec2.crossSV', () => {
  it('crosses a scalar with a vector', () => {
    expect(Vec2.crossSV(2, { x: 1, y: 3 })).toEqual({ x: -6, y: 2 });
  });

  it('writes into out and returns it', () => {
    const out = { x: 0, y: 0 };
    const result = Vec2.crossSV(2, { x: 1, y: 3 }, out);
    expect(result).toBe(out);
    expect(out).toEqual({ x: -6, y: 2 });
  });

  it('is safe when out aliases the input', () => {
    const v = { x: 1, y: 3 };
    Vec2.crossSV(2, v, v);
    expect(v).toEqual({ x: -6, y: 2 });
  });
});
```

The aliasing cases are not padding: both functions read `v.y` after computing `out.x`, so an
implementation that assigns straight into `out` corrupts an aliased input. That is exactly how the
solver will call them.

- [ ] **Step 2: Run the tests and verify they fail**

```bash
cd packages/math && bun test tests/vec2.test.ts
```

Expected: FAIL — `Vec2.perp is not a function`.

- [ ] **Step 3: Implement**

In `packages/math/src/vec2.ts`, inside the `Vec2` namespace object, after `cross`:

```ts
  /** Left-hand perpendicular. `perp` of a unit normal gives its tangent. */
  perp(v: Vec2, out?: Vec2): Vec2 {
    const x = -v.y;
    const y = v.x;
    if (out) {
      out.x = x;
      out.y = y;
      return out;
    }
    return { x, y };
  },

  /** Cross of a scalar (angular) with a vector: `w x r` → velocity at offset `r`. */
  crossSV(s: number, v: Vec2, out?: Vec2): Vec2 {
    const x = -s * v.y;
    const y = s * v.x;
    if (out) {
      out.x = x;
      out.y = y;
      return out;
    }
    return { x, y };
  },
```

Staging into `x`/`y` locals before writing `out` is what makes the aliasing tests pass.

- [ ] **Step 4: Run the tests and verify they pass**

```bash
cd packages/math && bun test tests/vec2.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/math/src/vec2.ts packages/math/tests/vec2.test.ts
git commit -m "feat(math): add Vec2.perp and Vec2.crossSV"
```

---

### Task 5: `dynamics` scaffold and `body.ts`

**Files:**
- Create: `packages/dynamics/package.json`, `tsconfig.json`, `tsdown.config.ts`
- Create: `packages/dynamics/src/body.ts`
- Create: `packages/dynamics/tests/body.test.ts`
- Modify: `scripts/check-deps-tiers.mjs` (`LAYER_MAP`)

**Interfaces:**
- Consumes: `type Vec2` from `@flare-engine/math`.
- Produces:
  - `interface Body { position: Vec2; velocity: Vec2; angle: number; angularVelocity: number; half:
    Vec2; invMass: number; invInertia: number; restitution: number; friction: number }`
  - `interface BodyOptions { position: Vec2; half: Vec2; density?: number; velocity?: Vec2; angle?:
    number; angularVelocity?: number; restitution?: number; friction?: number; static?: boolean }`
  - `createBody(opts: BodyOptions): Body`, `isStatic(b: Body): boolean`
  - `writeBoxVertices(b: Body, out: Float64Array, offset: number): void` — 4 corners as x,y pairs
  - `writeBoxNormals(verts: Float64Array, vOffset: number, cx: number, cy: number, out: Float64Array,
    offset: number): void` — 4 outward face normals as x,y pairs
  - `writeAabb(verts: Float64Array, vOffset: number, out: Float64Array, offset: number): void` —
    `minX, minY, maxX, maxY`
  - Tasks 6, 7, and 8 depend on these exact names and signatures.

- [ ] **Step 1: Scaffold the package manifest**

Copy the `packages/physics/` structure. `packages/dynamics/package.json`:

```json
{
  "name": "@flare-engine/dynamics",
  "version": "0.3.1",
  "description": "2D rigid bodies: oriented boxes, contact manifolds, sequential-impulse solver",
  "keywords": ["flare-engine", "physics", "rigid-body", "obb", "solver"],
  "license": "Apache-2.0",
  "author": "Grzegorz Otto",
  "homepage": "https://github.com/grzott/flare-engine#readme",
  "bugs": { "url": "https://github.com/grzott/flare-engine/issues" },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/grzott/flare-engine.git",
    "directory": "packages/dynamics"
  },
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
      "require": { "types": "./dist/index.d.ts", "default": "./dist/index.js" }
    }
  },
  "files": ["dist", "README.md", "LICENSE", "NOTICE"],
  "scripts": {
    "build": "tsdown",
    "test": "bun test",
    "lint": "biome check src/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": { "@flare-engine/math": "workspace:*" },
  "engines": { "node": ">=20" },
  "publishConfig": { "access": "public", "registry": "https://registry.npmjs.org/" },
  "sideEffects": false
}
```

Set `version` to whatever the fleet is at when this runs, and `publishConfig.access` to match the
sibling packages post-flip. **There must be no `"types"` key at the `"."` level of `exports`** —
that is the attw masquerade OSS-C2 removed everywhere; re-introducing it fails `check:exports`.

`tsconfig.json` and `tsdown.config.ts` are byte-copies of `packages/physics/`'s.

- [ ] **Step 2: Register the tier before writing any source**

In `scripts/check-deps-tiers.mjs`, add to `LAYER_MAP` beside the other tier-2 entries:

```js
  dynamics: 2,
```

A scoped package missing from `LAYER_MAP` is a hard error, so doing this first keeps
`bun run check:deps` meaningful for the rest of the task.

- [ ] **Step 3: Write the failing tests**

`packages/dynamics/tests/body.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { createBody, isStatic, writeAabb, writeBoxNormals, writeBoxVertices } from '../src/body.js';

describe('createBody', () => {
  it('derives mass and inertia from extents and density', () => {
    const b = createBody({ position: { x: 0, y: 0 }, half: { x: 2, y: 1 }, density: 1 });
    // mass = density * w * h = 1 * 4 * 2 = 8; inertia = m*(w^2+h^2)/12 = 8*20/12
    expect(b.invMass).toBeCloseTo(1 / 8, 12);
    expect(b.invInertia).toBeCloseTo(1 / ((8 * 20) / 12), 12);
  });

  it('marks static bodies with zero inverse mass and inertia', () => {
    const b = createBody({ position: { x: 0, y: 0 }, half: { x: 5, y: 5 }, static: true });
    expect(b.invMass).toBe(0);
    expect(b.invInertia).toBe(0);
    expect(isStatic(b)).toBe(true);
  });

  it('copies input vectors instead of aliasing them', () => {
    const position = { x: 3, y: 4 };
    const velocity = { x: 1, y: 2 };
    const b = createBody({ position, half: { x: 1, y: 1 }, velocity });
    position.x = 99;
    velocity.x = 99;
    expect(b.position.x).toBe(3);
    expect(b.velocity.x).toBe(1);
  });

  it('exposes position and velocity as writable fields', () => {
    const b = createBody({ position: { x: 0, y: 0 }, half: { x: 1, y: 1 } });
    b.position.y = 42;
    b.velocity.y = -7;
    expect(b.position.y).toBe(42);
    expect(b.velocity.y).toBe(-7);
  });
});

describe('geometry writers', () => {
  it('writes axis-aligned corners for an unrotated box', () => {
    const b = createBody({ position: { x: 10, y: 20 }, half: { x: 2, y: 3 } });
    const verts = new Float64Array(8);
    writeBoxVertices(b, verts, 0);
    expect(Array.from(verts)).toEqual([8, 17, 12, 17, 12, 23, 8, 23]);
  });

  it('writes unit-length normals pointing away from the center', () => {
    const b = createBody({ position: { x: 0, y: 0 }, half: { x: 1, y: 1 } });
    const verts = new Float64Array(8);
    const normals = new Float64Array(8);
    writeBoxVertices(b, verts, 0);
    writeBoxNormals(verts, 0, 0, 0, normals, 0);
    for (let i = 0; i < 4; i++) {
      const nx = normals[i * 2]!;
      const ny = normals[i * 2 + 1]!;
      expect(Math.sqrt(nx * nx + ny * ny)).toBeCloseTo(1, 12);
      const j = (i + 1) % 4;
      const mx = (verts[i * 2]! + verts[j * 2]!) / 2;
      const my = (verts[i * 2 + 1]! + verts[j * 2 + 1]!) / 2;
      expect(nx * mx + ny * my).toBeGreaterThan(0);
    }
  });

  it('writes bounds that contain a rotated box', () => {
    const b = createBody({ position: { x: 0, y: 0 }, half: { x: 1, y: 1 }, angle: Math.PI / 4 });
    const verts = new Float64Array(8);
    const aabb = new Float64Array(4);
    writeBoxVertices(b, verts, 0);
    writeAabb(verts, 0, aabb, 0);
    const r = Math.SQRT2;
    expect(aabb[0]).toBeCloseTo(-r, 12);
    expect(aabb[1]).toBeCloseTo(-r, 12);
    expect(aabb[2]).toBeCloseTo(r, 12);
    expect(aabb[3]).toBeCloseTo(r, 12);
  });

  it('writes at an offset without touching earlier slots', () => {
    const b = createBody({ position: { x: 100, y: 200 }, half: { x: 1, y: 1 } });
    const verts = new Float64Array(16);
    verts.fill(-7, 0, 8);
    writeBoxVertices(b, verts, 8);
    expect(Array.from(verts.subarray(0, 8))).toEqual(new Array(8).fill(-7));
    expect(verts[8]).toBe(99);
    expect(verts[9]).toBe(199);
  });
});
```

- [ ] **Step 4: Run and verify they fail**

```bash
cd packages/dynamics && bun test
```

Expected: FAIL — module `../src/body.js` not found.

- [ ] **Step 5: Implement `src/body.ts`**

Port `grzott-portfolio/apps/web/src/lib/dynamics/body.ts`. `createBody` and `isStatic` transfer
verbatim (construction, not a hot path) except that `Vec2` now comes from the engine:

```ts
import type { Vec2 } from '@flare-engine/math';
```

The three geometry functions become writers over a caller-supplied `Float64Array`. Preserve the
donor's arithmetic order exactly — corner offsets rotated, then translated:

```ts
/** The four world-space corners of `b`, written as x,y pairs at `offset`. */
export function writeBoxVertices(b: Body, out: Float64Array, offset: number): void {
  const c = Math.cos(b.angle);
  const s = Math.sin(b.angle);
  const hx = b.half.x;
  const hy = b.half.y;
  const px = b.position.x;
  const py = b.position.y;
  let o = offset;
  for (let i = 0; i < 4; i++) {
    const lx = i === 0 || i === 3 ? -hx : hx;
    const ly = i === 0 || i === 1 ? -hy : hy;
    out[o] = px + (lx * c - ly * s);
    out[o + 1] = py + (lx * s + ly * c);
    o += 2;
  }
}
```

`writeBoxNormals` mirrors the donor's per-edge loop, keeps the `|| 1` degenerate-edge guard and the
flip-if-pointing-inward correction, and normalizes with `Math.sqrt` per the global constraint.
`writeAabb` scans the four already-written corners — it must **not** recompute vertices, which is
half the point of the split.

- [ ] **Step 6: Run and verify they pass**

```bash
cd packages/dynamics && bun test
```

Expected: PASS.

- [ ] **Step 7: Verify the tier gate sees the new package**

```bash
bun run check:deps
```

Expected: green. A failure naming `dynamics` as unmapped means Step 2 was skipped.

- [ ] **Step 8: Commit**

```bash
git add packages/dynamics scripts/check-deps-tiers.mjs
git commit -m "feat(dynamics): add the package scaffold and rigid bodies"
```

---

### Task 6: `pool.ts` and `manifold.ts`

**Files:**
- Create: `packages/dynamics/src/pool.ts`
- Create: `packages/dynamics/src/manifold.ts`
- Create: `packages/dynamics/tests/manifold.test.ts`

**Interfaces:**
- Consumes: `Body`, `writeBoxVertices`, `writeBoxNormals`, `writeAabb` from Task 5; `Vec2.perp` from
  Task 4.
- Produces:
  - `interface ManifoldPoint { x: number; y: number; penetration: number; normalImpulse: number;
    tangentImpulse: number; raX: number; raY: number; rbX: number; rbY: number; massNormal: number;
    massTangent: number; bias: number }`
  - `interface Manifold { a: Body; b: Body; normalX: number; normalY: number; tangentX: number;
    tangentY: number; friction: number; pointCount: number; points: ManifoldPoint[] }`
  - `interface SolverPool { manifolds: Manifold[]; manifoldCount: number; verts: Float64Array;
    normals: Float64Array; aabbs: Float64Array; capacityBodies: number }`
  - `createPool(): SolverPool`
  - `ensureBodyCapacity(pool: SolverPool, count: number): void`
  - `ensureManifoldCapacity(pool: SolverPool, count: number): void`
  - `collideInto(a: Body, b: Body, verts: Float64Array, normals: Float64Array, ai: number, bi:
    number, out: Manifold): boolean` — `ai`/`bi` are body indices into `verts`/`normals`, which hold
    8 doubles per body
  - Task 7 depends on all of these.

Note the flattening: contact points carry their own solver scratch (`raX`…`bias`) instead of a
parallel `SolvePoint` structure. That removes one pool and one indirection versus the donor's
`Constraint`/`SolvePoint` split, and nothing outside `world.ts` reads those fields.

- [ ] **Step 1: Write the failing tests**

`packages/dynamics/tests/manifold.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { type Body, createBody, writeBoxNormals, writeBoxVertices } from '../src/body.js';
import { collideInto } from '../src/manifold.js';
import { createPool, ensureBodyCapacity, ensureManifoldCapacity } from '../src/pool.js';

function setup(a: Body, b: Body) {
  const pool = createPool();
  ensureBodyCapacity(pool, 2);
  ensureManifoldCapacity(pool, 1);
  const bodies = [a, b];
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i]!;
    writeBoxVertices(body, pool.verts, i * 8);
    writeBoxNormals(pool.verts, i * 8, body.position.x, body.position.y, pool.normals, i * 8);
  }
  return pool;
}

const unit = (x: number, y: number) => createBody({ position: { x, y }, half: { x: 1, y: 1 } });

describe('collideInto', () => {
  it('reports no contact for separated boxes', () => {
    const a = unit(0, 0);
    const b = unit(10, 0);
    const pool = setup(a, b);
    expect(collideInto(a, b, pool.verts, pool.normals, 0, 1, pool.manifolds[0]!)).toBe(false);
  });

  it('builds a two-point manifold for a face-on overlap', () => {
    const a = unit(0, 0);
    const b = unit(0, 1.5);
    const pool = setup(a, b);
    const m = pool.manifolds[0]!;
    expect(collideInto(a, b, pool.verts, pool.normals, 0, 1, m)).toBe(true);
    expect(m.pointCount).toBe(2);
    // Normal points from a toward b: +y.
    expect(m.normalX).toBeCloseTo(0, 12);
    expect(m.normalY).toBeCloseTo(1, 12);
    for (let i = 0; i < m.pointCount; i++) {
      expect(m.points[i]!.penetration).toBeCloseTo(0.5, 12);
    }
  });

  it('orients the normal from a toward b regardless of argument order', () => {
    const a = unit(0, 0);
    const b = unit(0, 1.5);
    const pool = setup(b, a);
    const m = pool.manifolds[0]!;
    expect(collideInto(b, a, pool.verts, pool.normals, 0, 1, m)).toBe(true);
    expect(m.normalY).toBeCloseTo(-1, 12);
  });

  it('reuses the same point objects across calls', () => {
    const a = unit(0, 0);
    const b = unit(0, 1.5);
    const pool = setup(a, b);
    const m = pool.manifolds[0]!;
    collideInto(a, b, pool.verts, pool.normals, 0, 1, m);
    const first = m.points[0]!;
    collideInto(a, b, pool.verts, pool.normals, 0, 1, m);
    expect(m.points[0]!).toBe(first);
  });

  it('resets accumulated impulses on each rebuild', () => {
    const a = unit(0, 0);
    const b = unit(0, 1.5);
    const pool = setup(a, b);
    const m = pool.manifolds[0]!;
    collideInto(a, b, pool.verts, pool.normals, 0, 1, m);
    m.points[0]!.normalImpulse = 123;
    collideInto(a, b, pool.verts, pool.normals, 0, 1, m);
    expect(m.points[0]!.normalImpulse).toBe(0);
  });

  it('sets a tangent perpendicular to the normal', () => {
    const a = unit(0, 0);
    const b = unit(0, 1.5);
    const pool = setup(a, b);
    const m = pool.manifolds[0]!;
    collideInto(a, b, pool.verts, pool.normals, 0, 1, m);
    expect(m.normalX * m.tangentX + m.normalY * m.tangentY).toBeCloseTo(0, 12);
  });
});
```

The reuse and reset cases are the ones that catch a pooling bug: reuse without a reset carries stale
impulses into the next step and makes contacts explode.

- [ ] **Step 2: Run and verify they fail**

```bash
cd packages/dynamics && bun test tests/manifold.test.ts
```

Expected: FAIL — module `../src/pool.js` not found.

- [ ] **Step 3: Implement `src/pool.ts`**

A plain factory plus two growth helpers. Growth doubles capacity and copies nothing — pool contents
are rebuilt from scratch every step, so a fresh larger array is correct and simpler:

```ts
export function ensureBodyCapacity(pool: SolverPool, count: number): void {
  if (count <= pool.capacityBodies) return;
  let cap = pool.capacityBodies === 0 ? 8 : pool.capacityBodies;
  while (cap < count) cap *= 2;
  pool.verts = new Float64Array(cap * 8);
  pool.normals = new Float64Array(cap * 8);
  pool.aabbs = new Float64Array(cap * 4);
  pool.capacityBodies = cap;
}
```

`ensureManifoldCapacity` grows `pool.manifolds` by pushing fully-formed `Manifold` objects, each
carrying two pre-created `ManifoldPoint`s. Never truncate the array — manifolds past
`manifoldCount` are simply unused, and keeping them is what makes the steady state allocation-free.

- [ ] **Step 4: Implement `src/manifold.ts`**

Port `collision.ts`. Structural changes, all mechanical:

- `support` and `leastPenetration` read `Float64Array` slices at an offset instead of `Vec2[]`, and
  return scalars. `leastPenetration` returns the separation and writes the winning face index into a
  module-level `Int32Array(1)` scratch, avoiding a result object.
- `clip` writes into a module-level 4-slot `Float64Array` and returns the resulting point count.
- The single `normalize(sub(v2, v1))` at the side-plane step becomes an inline sqrt normalization,
  per the global constraint.
- `biasGreaterThan`, the reference/incident face selection, and the `refIsA` normal negation
  transfer unchanged — pure control flow.
- On success, write into `out`, set `out.pointCount`, and **zero `normalImpulse` and
  `tangentImpulse` on every point written**.
- Compute `out.tangentX/Y` here with `Vec2.perp` semantics from Task 4, and `out.friction` as
  `Math.sqrt(a.friction * b.friction)`.

- [ ] **Step 5: Run and verify they pass**

```bash
cd packages/dynamics && bun test tests/manifold.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/dynamics/src/pool.ts packages/dynamics/src/manifold.ts packages/dynamics/tests/manifold.test.ts
git commit -m "feat(dynamics): add pooled contact manifold generation"
```

---

### Task 7: `world.ts` and the public barrel

**Files:**
- Create: `packages/dynamics/src/world.ts`
- Create: `packages/dynamics/src/index.ts`
- Create: `packages/dynamics/tests/world.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 4–6.
- Produces the public surface, which must match the consumer contract exactly:
  - `interface WorldOptions { gravity?: Vec2; iterations?: number }`
  - `interface World { bodies: Body[]; gravity: Vec2; iterations: number }`
  - `createWorld(opts?: WorldOptions): World`
  - `addBody(world: World, body: Body): Body`
  - `step(world: World, dt: number): void`
- `src/index.ts` exports exactly: types `Body`, `BodyOptions`, `World`, `WorldOptions`; values
  `createBody`, `isStatic`, `createWorld`, `addBody`, `step`. Nothing from `pool.ts` or
  `manifold.ts` is public.

**Pool ownership:** `World` keeps the three-field public shape. The pool lives in a module-level
`WeakMap<World, SolverPool>` populated by `createWorld`, matching the per-world WeakMap memoization
pattern already used in this codebase. One lookup per `step`, not per body, and no internal type
leaks into the published `.d.ts`.

- [ ] **Step 1: Write the failing tests**

`packages/dynamics/tests/world.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { createBody } from '../src/body.js';
import { addBody, createWorld, step, type World } from '../src/world.js';

const DT = 1 / 120;

function floorWorld(): World {
  const world = createWorld({ gravity: { x: 0, y: 1800 } });
  addBody(world, createBody({ position: { x: 0, y: 100 }, half: { x: 500, y: 10 }, static: true }));
  return world;
}

function settle(world: World, steps: number): void {
  for (let i = 0; i < steps; i++) step(world, DT);
}

describe('step', () => {
  it('is inert for a non-positive dt', () => {
    const world = floorWorld();
    const b = addBody(world, createBody({ position: { x: 0, y: 0 }, half: { x: 5, y: 5 } }));
    step(world, 0);
    step(world, -1);
    expect(b.position.y).toBe(0);
    expect(b.velocity.y).toBe(0);
  });

  it('accelerates a free body under gravity', () => {
    const world = createWorld({ gravity: { x: 0, y: 1800 } });
    const b = addBody(world, createBody({ position: { x: 0, y: 0 }, half: { x: 5, y: 5 } }));
    step(world, DT);
    expect(b.velocity.y).toBeCloseTo(1800 * DT, 12);
    expect(b.position.y).toBeCloseTo(1800 * DT * DT, 12);
  });

  it('never moves a static body', () => {
    const world = floorWorld();
    const floor = world.bodies[0]!;
    addBody(world, createBody({ position: { x: 0, y: 0 }, half: { x: 5, y: 5 } }));
    settle(world, 600);
    expect(floor.position.y).toBe(100);
    expect(floor.angle).toBe(0);
  });

  it('brings a falling box to rest on the floor', () => {
    const world = floorWorld();
    const b = addBody(world, createBody({ position: { x: 0, y: 0 }, half: { x: 5, y: 5 } }));
    settle(world, 600);
    // Floor top is y=90; a half-height-5 box rests centered near y=85.
    expect(b.position.y).toBeLessThan(96);
    expect(b.position.y).toBeGreaterThan(78);
    expect(Math.abs(b.velocity.y)).toBeLessThan(1);
  });

  it('does not let a stack sink through the floor', () => {
    const world = floorWorld();
    const boxes = [];
    for (let i = 0; i < 5; i++) {
      boxes.push(
        addBody(world, createBody({ position: { x: 0, y: -i * 12 }, half: { x: 5, y: 5 } })),
      );
    }
    settle(world, 1200);
    for (const b of boxes) expect(b.position.y).toBeLessThan(96);
  });

  it('does not gain energy over a long run', () => {
    const world = floorWorld();
    const b = addBody(
      world,
      createBody({
        position: { x: 0, y: 0 },
        half: { x: 5, y: 5 },
        velocity: { x: 40, y: 0 },
        angularVelocity: 3,
      }),
    );
    settle(world, 60);
    const peak = b.velocity.x * b.velocity.x + b.velocity.y * b.velocity.y;
    settle(world, 2400);
    const final = b.velocity.x * b.velocity.x + b.velocity.y * b.velocity.y;
    expect(final).toBeLessThan(peak);
  });

  it('is deterministic for identical inputs', () => {
    const run = () => {
      const world = floorWorld();
      const bodies = [];
      for (let i = 0; i < 8; i++) {
        bodies.push(
          addBody(
            world,
            createBody({
              position: { x: i * 3 - 12, y: -i * 11 },
              half: { x: 5, y: 5 },
              angle: i * 0.37,
              angularVelocity: i * 0.11,
            }),
          ),
        );
      }
      settle(world, 900);
      return bodies.flatMap((b) => [b.position.x, b.position.y, b.angle]);
    };
    expect(run()).toEqual(run());
  });
});
```

- [ ] **Step 2: Run and verify they fail**

```bash
cd packages/dynamics && bun test tests/world.test.ts
```

Expected: FAIL — module `../src/world.js` not found.

- [ ] **Step 3: Implement `src/world.ts`**

Four phases, same order as the donor, with the pooling and scalar collapses from spec §5:

1. **Integrate velocities.** Unchanged from the donor.
2. **Broadphase.** Grow the pool to `bodies.length`, then one pass writing every body's vertices,
   normals, and AABB into the pool. The nested pair loop then reads precomputed AABBs — removing
   both the per-pair allocation and the donor's O(n²) `aabbOf(b)` recompute. Static-vs-static pairs
   skip before any work. Each surviving pair calls `ensureManifoldCapacity(pool, pool.manifoldCount
   + 1)` then `collideInto` on `pool.manifolds[pool.manifoldCount]`, incrementing on `true`.
3. **Prepare.** Fold the donor's `prepare` into a loop over live manifolds, writing `raX`…`bias`
   onto each contact point in place. `restThreshold` keeps `Math.hypot(gravity.x, gravity.y) * dt` —
   once per step, not a hot path. The `BAUMGARTE = 0.2` and `PENETRATION_SLOP = 0.5` constants
   transfer unchanged.
4. **Solve, then integrate positions.** Both unchanged in structure.

Two collapses that remove allocation and work together, per spec §5:

```ts
/** Relative velocity at a contact projected onto (dx, dy). The vector never escapes. */
function relativeVelocityAlong(
  a: Body, b: Body, raX: number, raY: number, rbX: number, rbY: number, dx: number, dy: number,
): number {
  const vax = a.velocity.x - a.angularVelocity * raY;
  const vay = a.velocity.y + a.angularVelocity * raX;
  const vbx = b.velocity.x - b.angularVelocity * rbY;
  const vby = b.velocity.y + b.angularVelocity * rbX;
  return (vbx - vax) * dx + (vby - vay) * dy;
}

function applyImpulse(body: Body, ix: number, iy: number, rx: number, ry: number): void {
  if (body.invMass === 0) return;
  body.velocity.x += ix * body.invMass;
  body.velocity.y += iy * body.invMass;
  body.angularVelocity += body.invInertia * (rx * iy - ry * ix);
}
```

`relativeVelocityAlong` inlines the donor's `crossSV` expansion (`w × r = (-w·ry, w·rx)`) and the
dot product in one pass, so its three temporaries per call disappear; `applyImpulse` taking scalars
removes the two negated-vector literals per point per iteration.

- [ ] **Step 4: Write `src/index.ts`**

```ts
export { type Body, type BodyOptions, createBody, isStatic } from './body.js';
export { addBody, createWorld, step, type World, type WorldOptions } from './world.js';
```

- [ ] **Step 5: Run and verify they pass**

```bash
cd packages/dynamics && bun test
```

Expected: PASS, all files. If the rest and stack cases fail while free-fall passes, the bug is in
phase 2 or 3 — check the AABB precompute indices before suspecting the solver.

- [ ] **Step 6: Commit**

```bash
git add packages/dynamics/src/world.ts packages/dynamics/src/index.ts packages/dynamics/tests/world.test.ts
git commit -m "feat(dynamics): add the sequential-impulse world step"
```

---

### Task 8: The zero-alloc gate

**Files:**
- Create: `packages/dynamics/tests/allocation.test.ts`

**Interfaces:**
- Consumes: the public barrel from Task 7.
- Produces: nothing. This is the gate that keeps the package honest against AGENTS.md.

- [ ] **Step 1: Write the test**

```ts
import { describe, expect, it } from 'bun:test';
import { addBody, createBody, createWorld, step } from '../src/index.js';

describe('step allocation', () => {
  it('does not grow the heap in steady state', () => {
    const world = createWorld({ gravity: { x: 0, y: 1800 } });
    addBody(
      world,
      createBody({ position: { x: 0, y: 100 }, half: { x: 500, y: 10 }, static: true }),
    );
    for (let i = 0; i < 12; i++) {
      addBody(world, createBody({ position: { x: i * 9 - 40, y: -i * 13 }, half: { x: 5, y: 5 } }));
    }

    // Warm up: let the pools reach steady-state capacity and the pile settle.
    for (let i = 0; i < 600; i++) step(world, 1 / 120);

    Bun.gc(true);
    const before = process.memoryUsage().heapUsed;
    for (let i = 0; i < 20_000; i++) step(world, 1 / 120);
    Bun.gc(true);
    const after = process.memoryUsage().heapUsed;

    expect(after - before).toBeLessThan(256 * 1024);
  });
});
```

This measures retained heap across a forced GC, not allocation rate — a leak-shaped assertion rather
than a strict zero-allocation proof. It is the strongest check available from inside Bun without a
profiler, and it catches the failure that matters: pooled structures being recreated per step.

- [ ] **Step 2: Run it against the current implementation**

```bash
cd packages/dynamics && bun test tests/allocation.test.ts
```

Expected: PASS if Tasks 5–7 pooled correctly. **If it fails, that is a real finding** — locate the
per-step allocation rather than loosening the threshold.

- [ ] **Step 3: Prove the test can fail**

Temporarily break one pooled structure — build a fresh `Manifold` object inside the broadphase loop
instead of reusing `pool.manifolds[n]`. Re-run and confirm the test now fails. Revert. A gate never
observed failing is not a gate.

- [ ] **Step 4: Commit**

```bash
git add packages/dynamics/tests/allocation.test.ts
git commit -m "test(dynamics): gate steady-state step allocation"
```

---

### Task 9: Packaging, docs, and the changeset

**Files:**
- Create: `packages/dynamics/README.md`, `.changeset/dynamics-rigid-body-package.md`
- Modify: `packages/engine/src/index.ts`, `packages/engine/package.json`
- Modify: `docs/design/api-specs.md`, `docs/design/architecture.md`, `docs/plans/todo.md`

**Interfaces:**
- Consumes: the public barrel from Task 7.
- Produces: the published package Task 10 installs.

- [ ] **Step 1: Write the README**

Cover: what the package is, the `physics` boundary ("`physics` answers *did these overlap*;
`dynamics` answers *where do they end up*"), a runnable quickstart, and an explicit limits section
naming what is absent — joints, sleeping, CCD, non-box shapes, and any broadphase beyond the
brute-force pass. Every snippet must compile: `bun run check:readme` executes them.

- [ ] **Step 2: Wire the umbrella barrel**

In `packages/engine/src/index.ts`, beside the `@flare-engine/physics` re-export at line 13:

```ts
export * from '@flare-engine/dynamics';
```

Add `"@flare-engine/dynamics": "workspace:*"` to `packages/engine/package.json` dependencies.

- [ ] **Step 3: Check for export collisions**

```bash
bun run build --filter=@flare-engine/engine
```

`export *` is silently lossy on name collisions. `physics` exports no `Body`, `World`, `step`,
`createBody`, `createWorld`, `addBody`, or `isStatic` — but confirm rather than assume, since `ecs`
and `simulation` are also in the umbrella and `World` is a plausible clash. Resolve any collision
before proceeding; renaming a public export after this ships is a breaking change.

- [ ] **Step 4: Add the docs entries**

Add `dynamics` to the package tables in `docs/design/architecture.md` (tier 2, beside `physics`) and
its API surface to `docs/design/api-specs.md`. One source per fact: describe the package once and
link to the spec for rationale rather than restating it.

- [ ] **Step 5: Write the changeset**

`.changeset/dynamics-rigid-body-package.md`:

```markdown
---
"@flare-engine/dynamics": minor
"@flare-engine/math": minor
---

New package `@flare-engine/dynamics`: 2D rigid bodies over oriented boxes — SAT plus reference/
incident face clipping for 1-2 point contact manifolds, and a sequential-impulse solver with
Coulomb friction, restitution, and Baumgarte de-penetration. Bodies are plain objects with mutable
`position` / `velocity`; all per-step structures are pooled per world, so `step()` allocates
nothing in steady state. Complements `@flare-engine/physics`, which stays collision detection only.

`@flare-engine/math` gains `Vec2.perp` and `Vec2.crossSV`, both with optional `out` parameters.
```

Versioning is `fixed` lockstep, so the whole fleet moves together regardless of what is listed —
never write `major`, which would force 1.0.0.

- [ ] **Step 6: Seed the Arc DYN row in `todo.md`**

Add below Arc HYG, as a lean pointer per the one-source-per-fact rule:

```markdown
### Arc DYN — rigid-body dynamics + the portfolio dogfood (post-flip)

Goal: make the portfolio's page-collapse showcase actually run engine code. **Full design in the
SoT: [dynamics-lift-2026-08.md](dynamics-lift-2026-08.md)**; task breakdown in
[dynamics-lift-2026-08-tasks.md](dynamics-lift-2026-08-tasks.md). Rows are `packages/**` →
engine-builder. Not before the flip.

- **DYN-1 — `@flare-engine/dynamics` package.** OBB rigid bodies lifted from the portfolio donor,
  zero-alloc pass, behavioral gates, packaging. One lockstep minor changeset. Spec: §2, §5, §6.
- **DYN-2 — consumer swap (cross-repo, `grzott-portfolio`).** Delete the local module, repoint the
  one import, verify settle parity. Runs in the portfolio's own harness. Spec: §7.
```

- [ ] **Step 7: Run the full gate**

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run check:deps
bun run check:changeset
bun run check:exports
bun run check:readme
bun run check:publish-safety
```

Expected: all green. `check:exports` failing on `dynamics` almost always means a `"types"` key crept
into the `"."` level of the exports map (Task 5, Step 1).

- [ ] **Step 8: Commit**

```bash
git add packages/dynamics/README.md packages/engine docs/design docs/plans/todo.md .changeset
git commit -m "feat(dynamics): wire the umbrella, docs, and changeset"
```

---

## Phase 2 — post-flip, `grzott-portfolio`

### Task 10: Swap the consumer

**Files:**
- Delete: `apps/web/src/lib/dynamics/` (all 5 files)
- Modify: `apps/web/src/components/page-collapse/collapse-engine.ts:17`, `apps/web/package.json`
- Modify: `apps/web/src/components/page-collapse/page-collapse.tsx` (trigger copy, second pass)
- Modify: `docs/reference-collapse-flare-engine-integration.md`

**Interfaces:**
- Consumes: `@flare-engine/dynamics` from public npm at the version Task 9 published; the
  determinism gate from Task 2.

- [ ] **Step 1: Record the reference numbers before changing anything**

**Already done — captured 2026-08-13 against the pre-swap local module:**

| Metric | Pre-swap value |
|---|---|
| `handle.pieceCount` (test fixture) | 12 |
| `handle.duration` | **1.175 s** (~142 frames @ 1/120) |
| `MAX_FRAMES` cap | 480 frames = 3.9917 s |
| Determinism | identical across two same-seed runs, stable over 4 consecutive runs |

The test now **asserts** the margin (`expect(a.duration).toBeLessThan(2.5)`), so Step 6's comparison
is automatic rather than an operator eyeball: if the swapped solver stops settling, the gate goes
red on its own. Re-run it before the swap anyway to confirm the pre-swap number still reads 1.175 s
— if it has drifted since August, something changed in the interim and that is worth knowing before
you attribute a delta to the engine.

Note the frame counts in spec §6 ("roughly 200 frames today") and here (142) describe **different
things**: §6 means a real page collapse in the browser, this means the 12-box test fixture. Do not
reconcile them.

- [ ] **Step 2: Install the dependency**

```bash
pnpm add @flare-engine/dynamics@^0.4.0 --filter @grzott/web
```

Pin the major/minor the engine actually published. Being pure TypeScript with a dual CJS/ESM build,
it needs no `transpilePackages` entry — confirm `pnpm build` succeeds before assuming otherwise.

- [ ] **Step 3: Repoint the import**

`apps/web/src/components/page-collapse/collapse-engine.ts:17` becomes:

```ts
import { type Body, type World, addBody, createBody, createWorld, step } from '@flare-engine/dynamics';
```

No re-export shim: one consumer, one line, and the repo's KISS rule bans one-thing wrappers.

- [ ] **Step 4: Delete the local module**

```bash
git rm -r apps/web/src/lib/dynamics
grep -rn "lib/dynamics\|@/lib/dynamics" apps/web/src
```

The grep must come back empty. A surviving reference means a second consumer existed and the
migration contract's single-consumer assumption was wrong — stop and reassess scope.

- [ ] **Step 5: Typecheck and run the determinism gate**

```bash
pnpm typecheck
pnpm test --filter @grzott/web
```

The Task 2 test must still pass: one seed still replays identically. It will produce *different*
transforms than the pre-swap solver did, and that is expected — the sanctioned `normalize` change
(spec §4). The gate asserts reproducibility, not historical equality.

- [ ] **Step 6: Verify behavioral parity**

Compare against Step 1's baseline: settle must stay well inside `MAX_FRAMES = 480` — roughly 200
frames before the swap, so a jump toward the cap signals that solver behavior shifted even with
every test green. Then trigger a real collapse in the browser and watch it: pieces fall, pile, and
come to rest without jitter, tunneling, or drift.

- [ ] **Step 7: Update the copy and the reference doc**

Reword the trigger a second time — it can be a powered-by claim now, because it is true. **All
three sites** (button `aria-label`, button `title`, link text + `aria-label`) carry the claim; see
Task 3 Step 1. Preserve the WCAG 2.5.3 property: the link's accessible name must still lead with its
visible text verbatim.

**Corrected 2026-08-13 — most of this step's doc work is already done.** Phase 0 already: fixed the
stale `page-collapse.tsx:399-403` citation (now `585-589`), marked Opt D done in the options table
and the recommended-sequence line, added a dated pointer under "## The question" and "## Answer
(verified)", and corrected **three** statements that mandated a byte-identical-bake gate spec §4
had already retired — including one at the Migration-contract section that was *actively false*
about the shipped test ("it hashes the pre-playback bake buffer": the gate samples playback
transforms and is downstream of playback, not upstream).

What remains for this step: mark the migration contract itself as executed with a pointer to this
plan's spec, and drop the options table now that A/B/D/E are all closed.

- [ ] **Step 8: Run the portfolio's full gate, then commit**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

```bash
git add -A
git commit -m "feat(collapse): run the collapse on @flare-engine/dynamics"
```

---

## Notes for whoever executes this

- **Written 2026-08-13 for post-flip execution.** Phases 1 and 2 will be months old when they run.
  Re-read the spec and re-verify every file:line reference against HEAD before starting a task; the
  task boundaries, tests, and gates are the durable parts — the line numbers are not.
- **Phase 0 is DONE (2026-08-13)** and was independent, as predicted — it would have lost nothing if
  the lift were deferred. `apps/web` now has a Vitest + happy-dom lane wired into Turbo and CI, a
  determinism gate, and honest trigger copy.
- **`bun run test` at the engine repo root, never raw `bun test`** — the raw form reports phantom
  mock failures in this workspace.
- **Do not run `git add` / `commit` / `push` from a builder agent.** Both repos block it; emit the
  commit block and let the owner run it. The Phase 0 task steps originally contradicted this in four
  places; they are corrected inline, but check any step you are about to follow.
- **The portfolio's commitlint enforces a scope enum** — `web | cms | schemas | db | ui | config |
  repo | deps | docs | ci` — with sentence-case subjects ≤72 chars. This plan's original commit
  blocks used `test(collapse)` / `fix(collapse)`, which would have been rejected. Corrected inline.
- **Phase 0's execution surfaced a real, unrelated bug in the portfolio**: `PostRow` in
  `packages/db/src/types.ts` was missing all three columns added by the 2026-04-30 syndication
  migration (`cross_posts`, `octalysis_drives`, `series`), so `apps/cms`'s schema-drift test failed
  and `mapPost` silently dropped the values on the web side. Fixed 2026-08-13. Mentioned here only
  so nobody re-diagnoses it as fallout from the lift.
