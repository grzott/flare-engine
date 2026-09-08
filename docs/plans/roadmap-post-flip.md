# Post-flip module roadmap

**Status:** produced 2026-09-07 by the pre-flip audit's W3 panel. Proposals only — nothing here is
scheduled, and nothing here happens before the October flip. How the audit ran:
[pre-flip-audit-2026-09.md](pre-flip-audit-2026-09.md). Launch queue: [road-to-oss-2026-09.md](road-to-oss-2026-09.md).

Produced by 4 angle-diverse proposers (extensibility-first, ecosystem/plugin-first, perf-ceiling-first,
content-pipeline-first) plus one code-grounding pass — 21 tracks — scored independently by 3 judges on
modularity, feasibility-against-real-code, and YAGNI. Duplicate proposals were merged; the panel's own
"what did nobody propose" answers added two tracks and killed four.

**The owner constraint every track had to pass:** it ships as its own package, or as a bounded addition to
exactly one existing package, and it appears in the roadmap as its own line. And it must help someone
*build a game*. A cross-cutting refactor wearing a module costume is not a track.

**Standing context:** `@flare-engine/*` is lockstep-versioned, so any of these opens a minor; deps flow
downward only; zero-alloc rules bind `update()`/`render()`. The owner's own first post-flip arc is already
fixed — the **devtools live-tweak inspector** (road-to-oss §0.6) — and this roadmap sits behind it.

**Consumer correction (2026-09-08, owner).** These tracks were ranked while Berek was on file as
"a ~342-LOC tilemap proof" (road-to-oss §0.8, since reworded). Berek is in fact the owner's flagship
title in design: a 2.5D JRPG with two coexisting modes — a Zelda-like open world and base-launched
"Expeditions" — plus a day/night system that gates content, base building and weapon crafting. Its
design corpus lives in the Berek repo at `docs/design-refs/`; its build is deferred until after the flip,
but its requirements are not hypothetical. **T7 (TM-LEVEL) and T8 (SHAPES-ATLAS) therefore have a
named consumer**, and their "second wave — wait for demand" ranking predates that fact. Re-ranking
these tracks against both named consumers is its own arc; brief in
`_local/game-driven-audit-handoff.md` (private, untracked).

---

## 1. The ranked tracks

| # | Track | Ships as | Tier | Cost | Panel |
|---|---|---|---|---|---|
| T1 | **ECS-R** — per-World component registry | `ecs` | 1 | 1 session | added by the panel |
| T2 | **ECS-128** — 128-component archetype mask | `ecs` | 1 | 2 sessions | 24/30, top modularity |
| T3 | **POSTFX-OPEN** — open the effect enum | `postfx` (+1 line in `react`) | 3.5 | 2–3 sessions | top YAGNI |
| T4 | **RENDER-FLIP** — sprite horizontal mirror | `render` | 2 | 1 session | added by the panel |
| T5 | **CLI-BANK** — `flare sprite-bank` | `cli` | 4 | 2 sessions | 24/30, top feasibility |
| T6 | **CLI-PLUGIN** — the CLI plugin seam | `cli` | 4 | 1–1.5 sessions | reduced from a package |
| T7 | **TM-LEVEL** — level loader + spawn registry | `tilemap` | 3 | 2 sessions | second wave |
| T8 | **SHAPES-ATLAS** — `createShapeAtlas` | `shapes` | 2 | 1–2 sessions | second wave |

Sequencing: **T1 → T2** (registry before mask, see below), **T4 → T5** (mirror before frame-banking, or the
CLI bakes mirrored PNGs forever), **T3 and T6 are independent** and can go any time. T7/T8 wait for demand.

---

## 2. Track specs

### T1 · ECS-R — per-World component registry

Retire the module-global component-id counter and `_resetComponentIds` in favour of a registry a `World`
owns. `createComponentRegistry(): ComponentRegistry`, `defineComponent(name, defaults?, registry?)`.

**Why it is its own row, ahead of T2.** `todo.md` XR-8 already says option C lands *first*; both ECS
proposers attached it to the mask lift as a rider, which is exactly the cross-cutting-refactor-in-costume
the constraint forbids. It is independently valuable: it fixes the CJS+ESM dual-load id collision, and it
makes ids per-World so two engines in one process stop fighting. Doing it first also means T2 changes a mask
whose ids are already sanely owned.

**Risk.** `_resetComponentIds` is currently exported (XR-8 owns that); anything in `tests/` depending on the
global counter has to move to a registry.

### T2 · ECS-128 — lift the 32-component ceiling

`MAX_COMPONENTS = 128`. The archetype mask stops being a JS number and becomes 4 words.
`ComponentDef` gains `word` (`id >>> 5`); `bit` becomes `1 << (id & 31)` — **byte-identical to today for ids
0–31**, so nothing that reads `.bit` changes. `Query.requiredMask/excludedMask: number` become
`Int32Array(4)`, and `matches()` compares word-wise.

**Grounded.** `packages/ecs/src/component.ts:30` throws at `id >= 32`; `world.ts:146` folds `mask |= c.bit`,
archetypes are `Map<number, number>`; `query.ts` matches with `archetype & required === required`. Exactly
three files plus tests. A grep across `packages/*/src` finds no external reader of the mask fields.

**Risk — the real one.** `add`/`remove` already loop every live query (`world.ts:73-75`, `:95-97`); a 4-word
compare quadruples that inner loop. The churn benchmark rows are the ones that will move, and the match path
must not allocate per entity per frame. Budget the bench recapture: a tier-1 edit stales every node suite
**and** all three web lanes, and the android lane needs the phone.

### T3 · POSTFX-OPEN — open the closed effect enum

Today adding one effect means editing five sites: the `EffectKind` union (`postfx/src/effect.ts:12-24`), the
`EffectUniforms` union (`:104-115`), `SKSL_SOURCE` (`runtime.ts:98-111`), the `packUniforms` switch
(`:166-261`) and the `scaleIntensity` switch (`:267-315`). Ship `createCustomEffect(id, { sksl, uniforms,
children?, intensityKey? })` plus uniform metadata, with the runtime caching custom shaders by SkSL string
and packing uniforms by declared layout instead of a hand-maintained slot switch.

**Why the YAGNI judge ranked this first.** It is the only track with recorded consumer demand: the one
shipping game forced six new effect kinds *into the engine* because no custom path exists. After the flip
that route is closed to everyone else — a third party cannot add a kind to a published union.

**Includes a one-line cross-package fix.** `react/src/game-view.tsx:357` never binds `pass.children` on
native, so a custom effect sampling an extra texture works on web (`render-web/src/postfx-surface.ts:180`)
and silently loses its child on device. Land that line with this track; the whole LUT/extra-sampler class is
blocked without it.

**Scope discipline.** "PostFX authoring surface" here means *opening the enum plus parameter metadata*. A
shader-editor UI is ruled out by the owner (in-browser live editor = never, road-to-oss §0.6) and this
roadmap must not imply one.

### T4 · RENDER-FLIP — horizontal sprite mirror

A `flipX` on the sprite draw path (`render`, tier 2). The engine has no horizontal mirror at all today,
which is why every frame-banking proposal independently decided to **bake mirrored PNGs to disk** — paying
double the atlas bytes to work around a missing boolean. Related to the M10 render table-stakes row.

### T5 · CLI-BANK — `flare sprite-bank`

Generate left/right movement-state frames from one static top-down sprite: `flare sprite-bank <sprite.png>
[--frames 3] [--max-bank] [--shear] [--shade] [--out] [--json aseprite|tp-hash] [--sheet] [--preview]`, plus
a programmatic `spriteBank(opts)`. This is the owner's seed topic 3, and it needs **no new dependency** —
`cli` already has `sharp ^0.34.5` (`pack-atlas.ts:4`) and already drives `sharp({create}).composite()`, so
`affine`/`extend`/`extract`/`flop` are the same install. Output flows through the existing
`pack-atlas → parseTexturePackerHash → frameMap` path unchanged. Pair with `pack-atlas --tags` so the
generated frames arrive as named animations.

**Risk, and it is aesthetic not technical.** The squash+shear+shade heuristic reads as banking only for
roughly symmetric top-down sprites with a wing silhouette; side-view or asymmetric art smears. Ship
conservative defaults, document it as a heuristic, and make `--preview` a contact sheet so the user sees the
result before adopting it.

### T6 · CLI-PLUGIN — the plugin seam, and *only* the seam

`FlarePlugin { name, register(program, ctx) }`, `buildProgram({ plugins })`, and a `flare.config` loader.
`cli/src/cli.ts:47-105` hardcodes its three commands today and commander 13.1.0 already has `addCommand`, so
the seam is ~1 session.

**What the panel cut, and why it matters.** Four proposers wanted a `@flare-engine/pipeline` *package* with a
step contract, a runner and its own bin. All four scored 2–3 on YAGNI. The grounding pass also established
the fatal asymmetry: **a Blender add-on is Python** — it cannot be an `@flare-engine/*` TS package, cannot
pass Biome, cannot live under `packages/**` — and a ComfyUI "plugin" is a workflow JSON plus a server call.
So the engine-side deliverable is a seam plus a documented interchange contract; the Blender and ComfyUI
halves live outside this repo and are reference implementations, not packages. Do not ship a pipeline
framework for two hypothetical steps.

### T7 · TM-LEVEL — level loader + spawn registry *(second wave)*

`createLevelManifest(map, opts)`, `bindTilesetImages(renderer, map, resolve)`, and a spawn registry that
unifies Tiled `MapObject` and LDtk `LDtkEntity` — two shapes for one concept today
(`tilemap-data.ts:68-85` vs `ldtk-parser.ts:84-95`). `TilesetRef.image` is documented as "may need
resolving" and nothing resolves it.

**Guard.** It must stay data + draw. The moment it grows update, camera or lifecycle it collides with
`@flare-engine/scene`, and image resolution must stay injected so `tilemap` never learns `fetch`.

### T8 · SHAPES-ATLAS — `createShapeAtlas` *(second wave)*

`assets/src/procedural-atlas.ts:88-96` already promises "a game can ship a full shape atlas … declarative
shape spec → Skia draw calls → SpriteSheet" while the engine ships only coloured rects. This closes the gap
the docstring already advertises, and it can generate banked variants procedurally — the T5 result without
the image pipeline. Requires widening the structural Skia type from `Surface.Make/Paint/XYWHRect` to include
`Path.Make`/`MakeFromSVGString` and canvas transforms.

---

## 3. Rejected, with the reason

| Proposal | Why not |
|---|---|
| `@flare-engine/pipeline` as a package (4 independent proposals) | YAGNI 2–3 from every judge. A framework for two steps that cannot both be TS. Reduced to T6. |
| `@flare-engine/plugin-blender`, `plugin-comfyui` | Cannot exist as `@flare-engine/*` packages: Blender add-ons are Python, ComfyUI is workflow JSON + a server. Reference implementations outside the repo. |
| PHYS-GRID — SoA rebuild-per-frame broadphase | YAGNI 2, explicit reject. The uniform spatial hash already shipped (CW7-8); no consumer is hitting its ceiling. |
| RENDER-INST — instanced atlas lane | YAGNI 3, explicit reject. Speculative until a real game is draw-call bound; would likely trip the package byte ceiling too. |
| ECS columnar archetype table | Feasibility 4 — a much larger change than the mask lift for benefit nobody has measured. Not a separate track. |
| PostFX authoring as a shader-editor UI | Owner-ruled-out (in-browser live editor = never). T3 is the honest subset. |

---

## 4. What the panel says is still missing

The judges were asked what nobody proposed. Their answers, kept verbatim in substance because they are the
most useful output of the exercise:

1. **Consumer-asked rows with demand already on file were ignored by every proposer** — `CollisionWorld.getCollider`
   readback and making the `ui` packages importable under a test runner (Arc CW7-Q). Proposers optimise for
   interesting; the queue already knows what is wanted.
2. **Bundle-size ceilings were costed by exactly one track.** Any `physics`/`render` addition will likely trip
   its `.perf-baseline.json` bytes row and need an owner-authorised raise.
3. **Perf-freshness blast radius was under-budgeted.** Any `packages/physics` or `packages/render` edit stales
   the node suites *and* all three web lanes, exactly as a tier-1 `ecs` edit does. T2's 2-session estimate is
   the only one that includes recapture.
4. **The `render-web` postfx shim exposes only `makeShaderWithChildren`-shaped surface**, which bounds what any
   custom-effect track can promise on web.

---

## 5. Relationship to the existing plan

This file is proposals for **after** the flip. It does not renumber, reschedule or supersede anything in
[road-to-oss-2026-09.md](road-to-oss-2026-09.md), and it does not touch the freeze. The already-fixed
post-flip decisions it must not contradict: planck.js rigid body is a separate opt-in package, C++/Nitro is
adjudicated no, the devtools live-tweak inspector is the first post-flip arc, and the in-browser live editor
is never.
