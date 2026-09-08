# Pre-flip audit 2026-09 — verified code findings

**Status:** W1 complete 2026-09-07. This file is the source of truth for the audit code findings.
How the audit runs is [pre-flip-audit-2026-09.md](pre-flip-audit-2026-09.md); the launch queue remains
[road-to-oss-2026-09.md](road-to-oss-2026-09.md). Rows derived from these findings live in [todo.md](todo.md).

Per fixed decision **D1**, nothing here was fixed in place — the audit made zero `packages/**` edits.
Every finding below becomes a row executed later behind the normal per-row gate.

---

## 0. Method, and how much to trust each finding

15 read-only finder agents swept `packages/**` as 5 LOC-balanced shards (~6k lines each, grouped along the
`LAYER_MAP` tiers) times 3 lenses — correctness-bug, perf/zero-alloc-hot-path, and SOLID/DRY/YAGNI/KISS.
279 src files, ~29.9k LOC. Raw output was **95 findings; 5 same-site overlaps collapsed in-script to 90 distinct**.

> **What the panel size verifies, and what it does not — added 2026-09-07 after Arc PFA ran.**
> The recorded verification covers the **Defect** claim: that the described thing is true at the cited
> site. It does **not** independently verify the **Impact** paragraph, the severity, or the suggested
> **Fix** — those are the finder's argument, and a refuter corrects them only where it chose to look.
> Arc PFA hit this four times: F049's severity and its storage advice, F078's "every `purchasedAt` is
> wrong", F038's claim about which input layout the bug reached, and a `Uint32Array` fix that would not
> have compiled. Two of the four reached a consumer-facing document before review caught them.
> So: **read the Verifier corrections before the Fix, treat verifier silence on a detail as unverified
> rather than endorsed, and re-confirm at HEAD before repeating any of this prose in a changeset, an
> ADR, `api-specs.md` or a README.** The rule now also lives in `AGENTS.md`, which every agent reads.

> **This document is incomplete in a way you must account for — measured 2026-09-07.**
> **76 paragraphs across 47 of the 90 findings end in a literal `…`**: their text was elided when this
> file was synthesised and the remainder is **not recoverable**. The elision is visible rather than
> silent, which is the one mercy, but note *where* it falls — **46 of the 76 are the Verifier
> corrections**, the exact paragraph the rule above tells you to read first and to prefer over the
> finder's text. So for those findings the authoritative half is the half that got cut.
>
> **What this means in practice, by whether the finding has been actioned:**
> - **28 of the 47 were remediated in Arc PFA** (2026-09-07). The elision was survivable there only
>   because every row re-verified its sites at HEAD and a reviewer independently re-derived the
>   claims — not because the text was sufficient.
> - **19 of the 47 sit in post-flip Arc HYG rows that have not run yet.** Whoever implements those
>   cannot read the full verifier correction and **must not assume the visible fragment is the whole
>   of it**. Re-derive the finding at HEAD before acting; if the fragment and the code disagree, the
>   code wins and the row should say so.
>
> Do not attempt to "restore" an elided paragraph by inference. Writing a plausible completion and
> presenting it as the verifier's words would be worse than the gap.

Verification followed **D4**, and the panel size is recorded per finding because it is the main thing that
should change your confidence:

| Panel | Findings | Outcome |
|---|---|---|
| 3 perspective-diverse refuters (does-it-reproduce / is-it-deliberate / does-it-matter-and-is-it-tagged-right) | 12 | 0 killed; 4 drew one refuting vote; 8 unanimous |
| 1 combined-lens refuter | 38 | 0 killed |
| none — shipped explicitly unverified | 40 | severity `low` only |

**Read the 0/38 medium result with care.** A single verifier that refutes nothing is much weaker evidence than
the three-voter panel, which did produce dissent on 4 of 12. Treat unanimous single-refuter mediums as
"probably real, unproven" rather than confirmed, and re-check the site before opening a row.

Verifiers were told to default to *refuted* under uncertainty, and they corrected severity freely: **21 findings**
moved severity (20 down, 1 up — F080 medium to high) and 1 moved tag. The tables below are the adjudicated
result, not the finders original claims.

### The `preFlip` / `postFlipHYG` split

One rule decides it, per **D2**: *does the fix change the published API surface* — an exported name, a signature,
a type, the exports map, a peer floor, or observable behaviour a consumer could depend on. If yes it is `preFlip`,
because npm does not take a publish back. If no it is `postFlipHYG` and it waits for Arc HYG.
Severity is orthogonal: a high-severity internal bug is still `postFlipHYG`.

| | preFlip | postFlipHYG | total |
|---|---|---|---|
| high | 1 | 6 | 7 |
| medium | 19 | 9 | 28 |
| low | 17 | 38 | 55 |
| **total** | **37** | **53** | **90** |

---

## 1. Pre-flip findings — must land before the Oct 5 freeze

These change the published surface. Shipping them after the flip means a breaking change against real
consumers instead of a free correction inside the restricted window.

#### F076 · cli tiled-to-flare emits a layer/tileset shape that @flare-engine/tilemap parseTiled rejects

| | |
|---|---|
| Package | `cli` |
| Site | `packages/cli/src/tiled-to-flare.ts:125` |
| Severity | **high** |
| Lens | correctness |
| Verification | 3 perspective-diverse refuters, 0 refuted |

**Defect.** convertTiled writes layers as `{ kind: 'tile' | 'object' }` with no `type`, converts object `properties` to a Record, and drops every tileset's `tiles[]` (the only place `solid`/`collision` flags live). Nothing in the engine reads that shape: `parseTiled` (the only tilemap importer) requires `type: 'tilelayer' | 'objectgroup'` and throws on anything else, so the CLI's documented purpose — producing 'runtime JSON consumed by @flare-engine/tilemap' and being the fix for external tilesets — is unreachable.

**Impact.** A consumer with an external tileset follows the parser's own error message, runs `flare tiled-to-flare`, then `parseTiled(require('./zone1.flare.json'))` throws `unsupported type "undefined"`; even with a shape fix, every `solid` tile flag is lost so collision grids come out empty. The output shape is a published format, so it must be settled before the freeze.

**Evidence.** tiled-to-flare.ts:125-133 `const tile: FlareTileLayer = { kind: 'tile', name: layer.name, ... }`; :147-153 `kind: 'object'`; :91-102 resolveTileset returns only name/firstgid/tilewidth/.../imageheight — `tiles` is never copied; :145 `properties: propsToRecord(o.properties)`. Consumer side, packages/tilemap/src/tiled-parser.ts:180-185 `if (layer.type === 'tilelayer') ... if (layer.type === 'objectgroup') ... throw new TilemapParseError(`parseTiled: layer "..." has unsupported type "${l.type}"`)`; :138-150 solid flags come only from `ts.tiles`. Contract: docs/design/api-specs.md:752 'Tiled `.tmj` → normalized runtime JSON consumed by `@flare-engine/tilemap`', :260 'left external and run…

**Fix.** Either emit Tiled-shaped JSON (keep `type: 'tilelayer'/'objectgroup'`, `properties` as `{name,type,value}[]`, and copy the tileset's `tiles[]` through when embedding) so `parseTiled` accepts the file, or ship a `parseFlareMap` importer in tilemap and correct api-specs/README/error text to match; add a cli test that round-trips the output through `parseTiled`.

**Verifier corrections.** Claim, impact and fix are accurate. Two additions: (1) beyond `type`, `properties` and tileset `tiles[]`, the CLI also drops `rotation` on objects, `offsetx`/`offsety`, per-layer `properties` and tileset `properties`, all of which `parseTiled` reads (tiled-parser.ts:212-214, 227, 237) — so "emit Tiled-shaped JSON" must be a pass-through of the original layer/tileset objects (minus group/image layers and with external tilesets inlined), not a re-projection through the current `Flare*` interfaces. (2) The `--no-embed-tilesets` output is also unconsumable by design: it preserves `source`, which `parseTiled` rejects at tiled-parser.ts:129-133 — so that flag has no working consumer either and should be documented as such or dropped. Also note `FlareMap`/`FlareTileLayer`/`FlareObjectLayer` types are exported from the package barrel (packages/cli/src/index.ts:8-11), so the shape is public API… — Claim/fix stand. Add: object `properties` emitted as a Record also breaks parseProperties (tiled-parser.ts:95-101 has no `length` guard for objects → `for (const p of props)` throws), and the cli's `TiledTilesetRef` (tiled-to-flare.ts:44-55) must gain `tiles`/`properties` so embedding carries them through. Severity medium: loud failure, workaround in the same error message; still a shipped false promise in a documented command. — Claim, impact and fix are accurate; two additions. (1) Beyond `tiles[]`, the CLI also drops tileset/layer `properties`, tile-layer `offsetx/offsety`, and object `rotation` (cli TiledObject at tiled-to-flare.ts:20-31 has no rotation field; parseObjectLayer reads `obj.rotation` at tiled-parser.ts:227), so a shape-only fix would still yield undefined rotation and lost layer metadata — the Tiled-shaped emit option should pass those through as well. (2) The fix must also update tiled-to-flare.test.ts:73-74, which currently pins `kind`, and the round-trip test should assert `solidTiles` survives for an external tileset with `tiles[{id, properties:[{name:'solid',value:true}]}]`, since that is exactly the case the parser's error message sends users to the CLI for. Note the manual-test-protocol.md:128-130 M4 item is the owner-side step that would have caught this.

#### F002 · definePrefab plain-object data is shared by reference across every spawned entity

| | |
|---|---|
| Package | `ecs` |
| Site | `packages/ecs/src/prefab.ts:38` |
| Severity | **medium** _(finder said high; verifiers corrected)_ |
| Lens | correctness |
| Verification | 3 perspective-diverse refuters, 1 refuted |
| Prior art | HYG2 |

**Defect.** When a prefab entry passes component data as a plain object (the form the first test and the docstring show), `spawn()` hands the very same object to `world.add` on every spawn, so all entities from that prefab alias one component instance; mutating one (e.g. createMovementSystem's `pos.x += ...`) moves them all.

**Impact.** `definePrefab('Bullet', [Position, {x:0,y:0}], [Velocity, {x:0,y:-300}])` then two spawns + createMovementSystem: both bullets share one Position and one Velocity object, so they move as one and a per-entity tweak leaks to every sibling. Silent, no error, and it is the natural form a consumer reaches for first.

**Evidence.** prefab.ts:37-39: const data = typeof entry.data === 'function' ? (entry.data as () => unknown)() : entry.data; world.add(entity, entry.def, data); world.ts:64: store.set(entityId, data !== undefined ? data : def.create()); // stores the caller's reference prefab.test.ts:16-22 spawns with `[PPos, { x: 100, y: 200 }]` and only checks toEqual, never identity or a second spawn; only the factory-function form is tested for uniqueness (:33-42). Nothing in README/api-specs (`definePrefab(name, components)`, api-specs.md:67) says object data is shared.

**Fix.** Shallow-clone non-function object data at spawn (`{ ...data }`) or narrow the entry type to `() => T` so the aliasing form cannot be expressed; either changes published semantics/type, so decide before the freeze (fold into HYG2, which already touches this file, and pull it forward).

**Verifier corrections.** Not a HIGH correctness bug: by-reference object data is the designed contract (factory form = the tested per-spawn-uniqueness path, mirroring world.add). Residual is docs-only: add to the `definePrefab` JSDoc (prefab.ts:17-22) and api-specs.md:67 'plain-object data is stored by reference and shared by every spawn; pass `() => T` for per-entity mutable state', optionally with a second-spawn `toBe` identity test pinning it. Fold into HYG2 (post-flip); do not clone or narrow the type. — Claim and impact stand. Fix is misstated: a blanket `{ ...data }` shallow clone is wrong for the general `T` — `data?: T | (() => T)` admits primitive T (spread of a number yields `{}`), typed arrays (`{...Float32Array}` becomes a plain index object) and nested objects (still aliased one level down). Prefer narrowing PrefabEntry.data / the definePrefab tuple to `() => T` only (pre-flip type break, cheap now; matches the tested uniqueness path at prefab.test.ts:33-41), or keep the union and document in the docstring + api-specs.md:67 + ecs README that object-form data is shared by reference and only for immutable data. Either way land it with HYG2's `overrides` cleanup on the same file, pulled forward before the freeze. — Claim stands. Corrections: (1) the proposed `{ ...data }` fix is wrong as written — spread turns a primitive T (`defineComponent<number>`) into `{}`, turns an array into an index-keyed object, and still aliases nested objects; a clone must guard `typeof data === 'object' && data !== null` (and arrays), or the entry type should be narrowed to `() => T` only. (2) `tests/prefab.test.ts:33` is titled "supports factory functions for unique data per spawn", which suggests the original author intended plain-object data to be shared — so the honest third option is to document the sharing in the docstring + api-specs and keep the semantics. Whichever option is picked is a published-contract decision (behaviour or type), so it must be made before the Oct freeze. (3) Severity down to medium: the aliasing is immediately visible on first run (all spawned entities move as one), not latent corruption;…

#### F005 · CoroutineManager.cancel()/clear()/promise-rejection never close the generator: finally never runs, rejection reason dropped

| | |
|---|---|
| Package | `core` |
| Site | `packages/core/src/coroutine.ts:55` |
| Severity | **medium** |
| Lens | correctness |
| Verification | 1 refuter, not refuted |
| Prior art | package-findings-2026-07.md §core (coroutine.ts:54-56,86-91 cancel/clear never call gen.return) — listed as a verified bug but no todo row (XR/OSS/HYG) picked… |

**Defect.** Cancelling a coroutine, clearing the manager, or a yielded Promise rejecting only flips `state.done = true`; `gen.return()`/`gen.throw()` are never called, so `try/finally` cleanup inside the generator never executes and the rejection error is silently swallowed with `handle.done === true` indistinguishable from success.

**Impact.** A coroutine such as `try { sprite.show(); yield 2; } finally { sprite.dispose(); }` leaks `sprite` on cancel/clear/scene teardown; a failed `yield fetch(...)` kills the coroutine with no error surfaced to the game, so asset/network failures inside coroutines are silent.

**Evidence.** coroutine.ts:54-56: cancel() { state.done = true; }, coroutine.ts:87-92: clear() { for (const state of this.coroutines) { state.done = true; } this.coroutines.length = 0; } coroutine.ts:111-119: value.then(() => { state.waitingForPromise = false; }, () => { /* On rejection, stop the coroutine */ state.done = true; }); No `gen.return(`/`gen.throw(` anywhere in the file. coroutine.test.ts:105-128 pins only `reached === false && handle.done === true` on rejection, nothing about finally or the error.

**Fix.** In cancel()/clear() call `state.gen.return()` (guarded by try/catch); on rejection call `state.gen.throw(err)` so the generator can catch, and mark done if it does not; expose the failure on the handle. This changes the observable semantics of `CoroutineHandle.cancel()` and `yield Promise`, so it belongs before the freeze.

**Verifier corrections.** Claim, impact and tag stand. Two fix details are understated: (1) `gen.return()` throws `TypeError: Generator is already running` when `cancel()`/`clear()` is invoked from inside the running generator — a path pinned by coroutine.test.ts:226-249 ("clear() called inside a running coroutine does not throw") — so the close must be try/catch-guarded or deferred until the generator is suspended, not merely "guarded" as an afterthought. (2) `gen.throw(err)` runs inside the promise rejection callback (a microtask); if the generator does not catch, the rethrow becomes an unhandled rejection, and if it does catch and yields again, the `IteratorResult` from `gen.throw()` must be dispatched exactly like `gen.next()` in `advance()` (number → waitTime, Promise → waitingForPromise, done → state.done). Exposing the failure means adding a field to the published `CoroutineHandle` interface…

#### F007 · Query exposes only for-of iteration; every system allocates an iterator per frame, per entity on Hermes

| | |
|---|---|
| Package | `ecs` |
| Site | `packages/ecs/src/query.ts:101` |
| Severity | **medium** |
| Lens | perf |
| Verification | 1 refuter, not refuted |

**Defect.** `Query` keeps `entities` private and its only walk is `[Symbol.iterator]()`, which returns a fresh ArrayIterator. Every built-in system, the render system and the shmup template therefore iterate with `for...of` on the hot path; V8 can elide this only after inlining, and Hermes (RN default) allocates the iterator plus one `{value, done}` result object per entity per system per frame. There is no zero-alloc indexed accessor.

**Impact.** On the primary RN runtime the ECS's hottest loop allocates N+1 objects per system per frame (5 built-in systems + render + consumer systems), scaling with entity count; GC pressure lands exactly in the shmup churn path XR-7 is trying to measure, and the node bench cannot show it.

**Evidence.** query.ts:36 `private entities: number[] = [];` and :101-102 `[Symbol.iterator](): IterableIterator<number> { return this.entities[Symbol.iterator](); }` — no `at(i)`/`entities` getter. Per-frame chain: game-loop.ts:133 `this.onUpdate.emit(dt)` → world.ts:216 `sys.fn(this, dt)` → systems.ts:26 `for (const id of entities) {` (also :61, :102, :130, :163); render-system.ts:94 `for (const entityId of query) {`; template shmup logic.ts:315/318 nests `for (const eId of state.enemyQuery)` inside `for (const bId of state.bulletQuery)` (one enemy iterator per bullet per frame). benchmarks/src/ecs.bench.ts:36 uses the same for-of, on node/V8, so no published number sees it and no `alloc.*` counter…

**Fix.** Add a zero-alloc walk to the published `Query` (e.g. `get entities(): readonly number[]` or `at(i): number` next to `count`), switch systems.ts and render-system.ts to index loops, and document for-of as the convenience form. Adding the member is an API-surface change, so it belongs before the freeze.

**Verifier corrections.** Claim, impact and tag hold. Two refinements: (1) the fix should be `get entities(): readonly number[]` (or equivalent indexed walk) rather than only `at(i)`, and it must also rewrite the taught idiom — README `for (const id of movers)`, `system.ts:24` docstring, and the api-specs rows that currently claim `createMovementSystem` is "Zero-alloc." and `createLifetimeSystem` is "Zero-alloc steady state" — because those claims are false on Hermes today; (2) preFlip is additive (a new member, not a break), so the argument is "land before the freeze so the documented idiom consumers copy is the zero-alloc one", not that it cannot ship later. Sibling defect of the same class (not this row): `packages/events/src/signal.ts:53` `for (const handler of this.handlers)` over a Set is also generic-protocol iteration on Hermes despite the "Zero-alloc on the hot path" docstring — already noted in…

#### F011 · Vec2.normalizeOut is the repo's only `…Out` zero-alloc name and it does not normalize

| | |
|---|---|
| Package | `math` |
| Site | `packages/math/src/vec2.ts:90` |
| Severity | **medium** |
| Lens | hygiene |
| Verification | 1 refuter, not refuted |

**Defect.** Every other mandatory-out zero-alloc export in packages/** (19 of them: bezier2Into, segmentIntersectionInto, worldToScreenInto, rollInto, collideInto, …) uses the `…Into` suffix AGENTS.md prescribes; `Vec2.normalizeOut` is the single `…Out` name, and it scales the direction to `speed` rather than to unit length, so the name is wrong twice. Vec2/Mat3 additionally use a third convention (optional `out?`) for the same allocate-or-write choice.

**Impact.** Consumers learn `…Into` from 19 names and will not find the hot-path Vec2 form; the name promises a unit vector and returns one only when `speed === 1`. Renaming after the flip is a breaking change on the hottest package; before it, it is free.

**Evidence.** vec2.ts:89-101: `/** Zero-alloc; writes into `out`. Mandatory `out` … */ normalizeOut(dx: number, dy: number, speed: number, out: Vec2): Vec2 { … const inv = speed / len; out.x = dx * inv; …`. Sibling convention in the same package: curves.ts:18 `export function bezier2Into(…, out: Vec2)`, intersection.ts:212 `export function segmentIntersectionInto(…, out: Vec2)`; render's Camera2D per api-specs.md:92 `worldToScreenInto(x, y, out)`. A repo-wide grep of `export function \w+Out\(` / method `\w+Out(` finds only `normalizeOut` (plus the easing names springOut/springInOut, which are not out-params). AGENTS.md: "Provide `out`-parameter (`…Into`) zero-alloc form alongside allocating form".

**Fix.** Rename to `Vec2.scaleToLengthInto(dx, dy, length, out)` (or `directionInto`) with an identical body (byte-identical output must be preserved — see the ULP note in scalar.ts), update api-specs.md:15 and any PT call site; optionally give `turnVelocityToward` the same suffix in the same commit.

**Verifier corrections.** Claim/fix hold with three refinements. (1) The `out?`-optional dual form on Vec2/Mat3 is not a third deviant convention — AGENTS.md:39 asks for an allocating form alongside the out form, and README.md:3 documents 'zero-alloc forms take an out parameter'; only the `…Out` suffix and the `normalize` verb are the defect. (2) The scale-to-`speed` behaviour is deliberate and pinned by vec2.test.ts:234-247, so the row is a pure rename with a byte-identical body (keep the `len <= 1e-6` guard, which also differs from `normalize`'s `len === 0`); the new docstring should state 'direction of (dx,dy) scaled to `length`'. (3) In-repo references to update are vec2.ts:89-101, api-specs.md:15 and the test describe-name; roadmap.md:103 and docs/conventions/git.md:16 are historical (lift table / commit example) and may stay. There is no PT call site in this repo — PT consumes the engine from npm and picks…

#### F012 · Exported QueryBuilder.build() returns an orphan Query; registration is bolted on via a one-override subclass

| | |
|---|---|
| Package | `ecs` |
| Site | `packages/ecs/src/query.ts:136` |
| Severity | **medium** |
| Lens | hygiene |
| Verification | 1 refuter, not refuted |

**Defect.** `QueryBuilder` is a public value export whose only correct entry point is `world.queryBuilder()`; calling the exported class directly yields a Query the World never populates or updates. The registration is added by `_WorldQueryBuilder`, a subclass with exactly one override, which in turn needs the public underscore method `World._registerQuery` — whose body duplicates `World.query()` lines 150-156. Neither README nor api-specs mention QueryBuilder.

**Impact.** A consumer who imports the exported class (`new QueryBuilder().with(Position).build()`) gets a permanently empty query with no error; once published, `QueryBuilder`'s constructor signature and `World._registerQuery` are frozen API.

**Evidence.** query.ts:135-138: `/** Build the query (called internally by World). */ build(): Query { return new Query(this.required, this.excluded); }`. index.ts:9: `export { Query, QueryBuilder } from './query.js';`. world.ts:233-246: `class _WorldQueryBuilder extends QueryBuilder { private world: World; … override build(): Query { const q = super.build(); this.world._registerQuery(q); return q; } }`. world.ts:220-227: `/** @internal Register a query for auto-update. */ _registerQuery(q: Query): void { this.queries.push(q); for (const [entityId, arch] of this.archetypes) { q._check(entityId, arch); } }` — identical to world.ts:151-156 inside `query()`. Grep: no test, README or api-specs line uses `new…

**Fix.** Make `QueryBuilder` own the world: `constructor(private world: World)` and have `build()` push+populate (via a private `World` hook or by calling `world.query`-style logic once), delete `_WorldQueryBuilder` and `_registerQuery`, and have `World.query()` reuse the same registration routine; or export `QueryBuilder` as a type only.

**Verifier corrections.** Claim and impact are accurate. Two refinements to the fix: (1) `World.queries` is private, so a `QueryBuilder` in query.ts cannot register itself against a `World` without a public hook; the clean shape is `World.queryBuilder()` constructing the builder with a registration callback that closes over a single private `register(q)` method (`this.register` inside the World method), which `query()` also calls — this deletes `_WorldQueryBuilder` and `_registerQuery`, removes the duplicated push+populate loop, and gives `QueryBuilder` a required constructor argument so bare `new QueryBuilder()` no longer type-checks. Alternatively keep the class un-exported (type-only export) and let `queryBuilder()`'s return type carry it. (2) Note the same orphan trap exists for `new Query(mask, 0)` (public constructor, world.ts:150 uses it); leave `Query`'s constructor alone (needed for `instanceof`/types)…

#### F016 · drawShip discards engine ox/oy/rot: engine square always painted at the ship centre

| | |
|---|---|
| Package | `shapes` |
| Site | `packages/shapes/src/draw.ts:496` |
| Severity | **medium** |
| Lens | correctness |
| Verification | 1 refuter, not refuted |
| Prior art | OSS-B26 — fixed only the bounds half (engine offset counted in radius); draw.ts still discards the same offset, so tile size and painted geometry now disagree. |

**Defect.** `drawSquare` copies `spec.ox/oy/rot` into a RectSpec and then calls `drawRect` directly, which never reads those fields (only `drawShape` applies them). `ShipSpec.engine` offsets and rotation are silently ignored, while `bounds.ts` (OSS-B26) sizes tiles as if the engine were offset.

**Impact.** Any consumer ShipSpec with `engine: { kind: 'square', size, oy: N }` renders the engine block on top of the hull centre instead of at the tail; the atlas tile is padded for an engine that is never drawn there. Glow on the engine is also dropped (drawSquare never emits it).

**Evidence.** draw.ts:485-496: `const rectSpec: RectSpec = { kind: 'rect', w: spec.size, h: spec.size, ..., ox: spec.ox, oy: spec.oy, rot: spec.rot }; drawRect(Skia, canvas, paint, rectSpec, cx, cy, rot);` — drawRect (172-194) does `canvas.translate(cx, cy); if (rot !== 0) canvas.rotate(...)` and never touches `spec.ox/oy/rot`. Offsets are applied only in drawShape:104-106 (`const cx = x + (spec.ox ?? 0)`), which drawShip:513 bypasses for the engine (`drawSquare(Skia, canvas, paint, spec.engine, cx, cy, rot)`) while routing hull/weapons through drawShape (514-518). Contrast bounds.ts:49 `const engineReach = Math.hypot(engine.ox ?? 0, engine.oy ?? 0) + engine.size * 0.6` and the test 'ship glow radius…

**Fix.** Route the engine through `drawShape` like hull/weapons (or apply ox/oy/rot inside drawSquare before delegating to drawRect); add a draw test asserting the engine rect's translate uses cx+engine.ox / cy+engine.oy.

**Verifier corrections.** Claim, impact and tag stand. Fix wording: `spec.engine` cannot be passed to `drawShape` as written because `SquareSpec` is intentionally excluded from the `ShapeSpec` union (types.ts:152, api-specs.md:993). Correct fix: in `drawSquare`, either call `drawShape(Skia, canvas, paint, rectSpec, cx, cy, rot)` with `glow: spec.glow` added to the RectSpec (so ox/oy/rot and glow are applied by the dispatcher), or compute `cx + (spec.ox ?? 0)`, `cy + (spec.oy ?? 0)`, `rot + (spec.rot ?? 0)` and emit the glow ring inside `drawSquare` before delegating to `drawRect`. Add a draw.test.ts case with `engine: { kind: 'square', size: 10, oy: 40 }` asserting the engine's `canvas.translate` args are `[cx, cy + 40]` (and that a `glow` on the engine emits its ring). Also delete the vestigial ox/oy/rot copies if the in-drawSquare variant is chosen.

#### F017 · shapeBoundsRadius omits stroke width and glow ring although its contract says it includes them

| | |
|---|---|
| Package | `shapes` |
| Site | `packages/shapes/src/bounds.ts:67` |
| Severity | **medium** |
| Lens | correctness |
| Verification | 1 refuter, not refuted |

**Defect.** `shapeBoundsRadius` documents 'max half-extent ... including their ox/oy offsets and stroke widths', but only adds a fixed +2 margin; stroke width (except polyline) and the glow rings drawn by `drawShape` are not counted, so tiles sized by it clip the stroke and cut off the glow entirely.

**Impact.** A consumer that sizes atlas tiles with `shapeBoundsRadius` (its documented purpose, README 'Bounds' section) gets a `glow: 'friendly'` ring that lies wholly outside the tile (r+2.5..r+5.5 vs tile edge r+2) — the glow tag is invisible on baked shapes — and any strokeWidth > 4 is clipped by (strokeWidth/2 − 2) px.

**Evidence.** bounds.ts:58-59 doc: `Returns the max half-extent from origin across all shapes (including their ox/oy offsets and stroke widths)`. bounds.ts:67 `const reach = Math.hypot(ox, oy) + r + 2;` where `r = boundsR(s)` → `singleShapeRadius` → for circle `return spec.r` (line 13) with no strokeWidth term. draw.ts:51-52 friendly glow: `applyStroke(paint, friendlyGlowArgb(), 3); canvas.drawCircle(cx, cy, r + 4, paint);` → outer edge r+5.5, while shapeBoundsRadius([{kind:'circle', r, glow:'friendly'}]) = r+2 (pinned by bounds.test 'single shape with no offset returns its radius + 2').

**Fix.** In `shapeBoundsRadius` add `(spec.strokeWidth ?? 1) / 2` for stroked kinds and the glow extent (+5.5 friendly, +2.25 hazard) when `spec.glow` is set; update the README/api-specs row and the +2 test.

**Verifier corrections.** Claim and fix are right in substance; two refinements. (1) Impact: 'glow tag is invisible on baked shapes' is exactly true for kinds where boundsR == singleShapeRadius (circle, ring, ngon, star, triangle, arc, annulus, path) and for the hazard outer ring it is half-clipped; for rect/gradient-rect/trapezoid the tile uses 0.75 while the glow uses 0.6, so the friendly ring is partly visible and fully contained once max(w,h) >= ~23. Ship tiles get +4 (inner +2 via boundsR('ship') plus outer +2) so a hull-dominated glowed ship clips ~1.5px rather than losing the ring. (2) Fix: add the stroke term only where a stroke is actually painted (ring/polyline always; other kinds only when `stroke !== undefined`, matching draw.ts), and take it as `max(2, strokeWidth/2)` plus the glow extent (+5.5 friendly, +2.25 hazard) rather than replacing the +2, so the existing pinned +2 values for…

#### F018 · createWebSurface hides the CK surface: it can never be flushed, presented, or deleted

| | |
|---|---|
| Package | `render-web` |
| Site | `packages/render-web/src/web-surface.ts:31` |
| Severity | **medium** |
| Lens | correctness + hygiene |
| Verification | 1 refuter, not refuted |
| Prior art | HYG8 — lists the `{flush,dispose}` handle as post-flip hygiene; materially different: the current export is non-functional (never presents) and the fix changes… · HYG8 |

**Defect.** `createWebSurface` creates a WebGL CanvasKit surface, wraps only save/restore/translate/scale/rotate/clear, and returns no handle to the surface. CanvasKit shows nothing until `surface.flush()`, and the surface can never be `delete()`d, so the export is unusable for its documented purpose ('Pass to Renderer.setCanvas()') and leaks GPU resources.

**Impact.** A web consumer following api-specs (`createWebSurface` → `Renderer.setCanvas()`) renders nothing on screen and leaks a GPU surface per call; the return type `CanvasLike | null` is public, so adding the missing flush/dispose handle is an API-shape change that must land before the freeze.

**Evidence.** web-surface.ts:31 `const surface = kit.MakeWebGLCanvasSurface(canvas);` then :33-45 `const ck = surface.getCanvas(); return { save: ..., restore: ..., translate: ..., scale: ..., rotate: ..., clear: ... };` — `surface` never escapes. Its own docstring :14-16: 'The surface is not exposed here; the caller should call `surface.flush()` / `surface.delete()` via the `PostFxSurface` wrapper' — but `createPostFxSurface` builds its own separate context/surfaces (postfx-surface.ts:110-120) and cannot reach this one. The README's own presentation example (README.md:66-73) avoids `createWebSurface` and calls `kit.MakeWebGLCanvasSurface` + `surface.flush()` directly.

**Fix.** Return `{ canvas: CanvasLike, flush(): void, dispose(): void }` (or expose the CK canvas/surface) and update api-specs:410 + README; or fold into `createWebFrameRenderer` as HYG8 suggests.

**Verifier corrections.** The defect is real but the finding is not new: docs/plans/_local/deep-audit-2026-07-05.md:47 row C12 already recorded verbatim "createWebSurface discards the owning WebGL Surface — no flush/dispose path exposed; standalone use can't present + leaks GPU surface on re-create" and routed it to HYG8 (todo.md:337). So the "materially different" priorArt framing is wrong; what this finding legitimately does is pull ONE HYG8 sub-item pre-freeze under pre-flip-audit-2026-09.md D2's exception ("anything that changes the published API surface is pulled pre-freeze") — that is the correct disposition, and HYG8 must be edited to drop the item. Impact is slightly misdescribed: a consumer cannot even draw through the returned object (CanvasLike has only save/restore/translate/scale/rotate/clear; the CK canvas is also hidden), so the export is dead for presentation, not merely un-flushed; no in-repo…

#### F031 · COMPOSITE_SKSL clouds branch drifted from WEATHER_CLOUDS_SKSL: weatherDirection is packed but ignored

| | |
|---|---|
| Package | `postfx` |
| Site | `packages/postfx/src/shaders.ts:433` |
| Severity | **medium** |
| Lens | hygiene |
| Verification | 1 refuter, not refuted |
| Prior art | HYG3 (todo.md:332) owns assembling COMPOSITE_SKSL from shared fragments post-flip and assumes the branches are equivalent ("rain layers ≡ WEATHER_RAIN"); this… |

**Defect.** The composite shader is a hand-copied union of the standalone shaders, and the copy has already diverged: OSS-B19 (commit cfa69ce) wired `direction` into `WEATHER_CLOUDS_SKSL` but left the composite `weatherKind == 4` branch on the old X-only scroll, so `CompositeUniforms.weatherDirection` is honoured for rain and sun-shaft but silently ignored for clouds.

**Impact.** `createPostFxComposite({ weatherKind: 4, weatherDirection: 90 })` renders differently from `createWeatherClouds({ direction: 90 })` with no documentation of the difference. Fixing it changes observable rendering for anyone already using the composite clouds path, so it must land before the API/behaviour freeze, not as part of the post-flip dedupe.

**Evidence.** Standalone, shaders.ts:254-259: ``` float rad = direction * 3.14159 / 180.0; float2 scrollDir = float2(cos(rad), sin(rad)); float2 cloudUv = float2( uv.x + scrollOffsetX * scrollDir.x / resolution.x, uv.y * 0.5 + scrollOffsetX * scrollDir.y / resolution.y ``` Composite, shaders.ts:431-433: ``` } else if (wk >= 3.5) { // clouds float2 cloudUv = float2(uv.x + weatherScrollX / resolution.x, uv.y * 0.5); ``` Header shaders.ts:286 documents slot 16 as `weatherDirection (degrees)` with no clouds exclusion; `git show cfa69ce^:packages/postfx/src/shaders.ts` line 426 is byte-identical to HEAD:433, i.e. B19 touched only the standalone shader. The R1 row (todo.md:1631) shows the intent is to keep the…

**Fix.** Port the 5-line rotated-scroll block into the composite clouds branch (using `weatherDirection`/`weatherScrollX`) and add a parity test that both shaders contain the same clouds body; then HYG3's fragment assembly keeps them from drifting again.

**Verifier corrections.** Claim, impact and fix are accurate. Two additions for the fix: (1) docs/design/api-specs.md:627 still documents the standalone clouds layout as `clouds=[resW,resH,intensity,scrollOffsetX]` (4 floats) — stale since B19 made it 5 floats with `direction` at index 4 (runtime.ts:233); update it in the same row. (2) No test today pins the composite clouds branch at all (composite.test.ts:309-370 pins only rain content + uniform declarations), so the parity test the finding proposes is the only thing that would have caught this — it should assert the composite clouds body references `weatherDirection`, not merely a shared substring.

#### F038 · InputManager.pointer is driven by every touch id, not the primary touch it is documented to be

| | |
|---|---|
| Package | `input` |
| Site | `packages/input/src/input-manager.ts:66` |
| Severity | **medium** |
| Lens | correctness |
| Verification | 1 refuter, not refuted |

**Defect.** `onPointerDown/Move/Up(id, …)` forward every touch, regardless of `id`, into the single `pointer` state. With two fingers down (joystick + fire button — the standard mobile layout), the second finger's down teleports `pointer.position` and injects a large `delta`, and lifting the second finger sets `pointer.isDown = false` / `justReleased = true` while the first finger is still on screen. The public contract says `pointer` is the primary touch.

**Impact.** Any game using `input.pointer` for a drag/aim/joystick while a second finger taps another control sees the drag jump, `delta` spike, and a spurious release mid-gesture; on RN this is reachable through `GameView` without any consumer code.

**Evidence.** input-manager.ts:28 `/** Primary pointer (first touch or mouse). */ readonly pointer`, :65-68 `onPointerUp(id: number, x: number, y: number): void { pointerUp(this.pointer, x, y); this._removeTouch(id); }` (same unconditional call in `onPointerDown` :53-56 and `onPointerMove` :59-62; `id` only reaches `_touchMap`). api-specs:108 `pointer (primary touch)`, README:3 '`Pointer` exposes primary touch'. The engine's own wiring exercises it: react/src/game-view.tsx:345-350 loops `changedTouches` and calls `ctx.input.onPointerUp(Number(t.identifier), …)` for each released finger. tests/input-manager.test.ts:55-64 ('tracks multiple touches') asserts only `touches`, never `pointer`, so the contract…

**Fix.** Track the primary touch id (set on the first `onPointerDown` while no touch is active, cleared on its `onPointerUp`) and only route that id's events into `pointer`; document that other touches are visible only via `touches`. Add a two-finger test asserting `pointer.isDown` stays true when the second finger lifts.

**Verifier corrections.** Claim, fix and tag hold. Impact framing needs one narrowing: the engine's own `<VirtualJoystick>`/`<VirtualButton>` overlays never route through `InputManager` (virtual-joystick.tsx:87-91 owns its responder with `onResponderTerminationRequest={returnFalse}`; virtual-button.tsx:52-54 uses raw `onTouchStart/End/Cancel`; api-specs:377 documents them as independent of the GameView routing), so the "joystick + fire button" standard layout built from engine overlays is NOT affected. The affected consumer is one reading `input.pointer` directly for a canvas drag/aim/tap while any second finger lands on the GameView surface (custom control read via `touches`, a resting thumb, a two-finger gesture) — reachable with zero consumer wiring since CW7-1 (9a58db7) made GameView forward every `changedTouches` entry with its real id. Fix detail worth adding: after the primary finger lifts while a…

#### F039 · findPathJPS advertises an A*-equivalent fallback for weighted grids that does not exist — costs are ignored

| | |
|---|---|
| Package | `pathfinding` |
| Site | `packages/pathfinding/src/jps.ts:166` |
| Severity | **medium** |
| Lens | correctness |
| Verification | 1 refuter, not refuted |
| Prior art | OSS-B18 fixed heap growth and pinned the corner-cut divergence; it did not touch the cost-fallback claim or the geometry-only edge cost. · docs/plans/package-findings-2026-07.md:87 (pathfinding ledger entry — "JPS weighted-cost fallback — JPS ignores costs"); identified, never assigned to a queue… |

**Defect.** api-specs and the module header state JPS 'falls back to A*-equivalent moves when costs vary' / 'if weighted costs are detected', but nothing in jps.ts reads tile costs: `jump()` only calls `isWalkable`, and the edge cost is computed purely from geometry. On a grid with `setCost` > 1 the returned path routes straight through expensive tiles and `PathResult.cost` is reported as if every tile cost 1.

**Impact.** A consumer who reads the spec and calls `findPathJPS` on a weighted grid gets a silently non-optimal path with a wrong `cost` value, with no error or warning — the exact 'valid-looking wrong answer' class B18 just fixed for the heap.

**Evidence.** jps.ts:1-4 `Jump Point Search — an optimization over A* for uniform-cost grids. Only works when all walkable tiles have cost 1. Falls back to A* behavior if weighted costs are detected.` — no detection code anywhere in the file. jps.ts:162-167 `const diag = Math.min(dx, dy); const straight = Math.abs(dx - dy); const dist = diag * SQRT2 + straight; const tentativeG = g[currentIdx]! + dist;`. jps.ts:280 `if (!isWalkable(grid, nx, ny)) return -1;` is the only grid read in `jump()`. docs/design/api-specs.md:290 `findPathJPS … falls back to A*-equivalent moves when costs vary`. Contrast astar.ts:215-226 which multiplies by `tileCost`. tests/jps.test.ts only compares against A* on a uniform grid…

**Fix.** Either implement the documented behaviour (scan `grid.data` for any value > 1 and delegate to `findPath` with `diagonal: true`, or reject weighted grids with a typed error) or delete the claim from api-specs:290 and the jps.ts header and state that costs are ignored. Add a weighted-grid test either way.

**Verifier corrections.** Claim, impact and fix are accurate; corrections are to provenance and scope. (1) Prior art is docs/plans/package-findings-2026-07.md:87, which already recorded "JPS weighted-cost fallback — JPS ignores costs" — not only B18; the defect was ledgered in July and then fell between rows: B18 deferred phantom docs to Arc D, D3 fixed the package README (now honestly "for uniform-cost grids"), and f4b0cd5 rewrote api-specs:290 but kept the fallback clause. (2) The live contradiction is therefore api-specs.md:290 + jps.ts:3-4 versus README.md:3, not a uniformly false doc set; the jps.ts header does not ship in dist/index.d.ts, so the consumer-facing false claim is api-specs (linked from the README) plus GitHub source. (3) Concrete repro for the test: 5x5 grid, `setCost(g,2,2,100)`, `findPathJPS(g,0,2,4,2)` returns the straight row through (2,2) with `cost: 4`; `findPath` detours with cost ≈…

#### F049 · `Collider` is a public component that `CollisionWorld.add` cannot accept; README re-flattens it

| | |
|---|---|
| Package | `physics` |
| Site | `packages/physics/src/collision-world.ts:72` |
| Severity | **medium** _(finder said high; verifiers corrected)_ |
| Lens | hygiene |
| Verification | 3 perspective-diverse refuters, 1 refuted |

**Defect.** The package exports a `Collider` data object and its constructor, but the only API that consumes colliders takes seven positionals and re-declares the same four fields as a private `CollisionEntry`. Nothing in the repo passes a `Collider` anywhere; the README unpacks it by hand and hard-codes `isTrigger`.

**Impact.** A collider built with `createCollider(shape, { isTrigger: true })` and added per the canonical README example is silently solid (`false` literal). The 7-positional `add` freezes at publish and the `Collider` type becomes a permanent orphan export.

**Evidence.** collider.ts:16 `export function createCollider(shape: Shape, opts?: Partial<Omit<Collider, 'shape'>>): Collider`. collision-world.ts:72-80 `add(entity: number, shape: Shape, x: number, y: number, isTrigger = false, layer = 1, mask = 0xffffffff)` → :81 `const entry: CollisionEntry = { entity, shape, x, y, isTrigger, layer, mask };` where `CollisionEntry` (:16-24) is `Collider` plus `{entity, x, y}`. packages/physics/README.md:24-25: `const colliderA = createCollider(AABB(32, 32), { layer: 1, mask: 2 }); world.add(entityA, colliderA.shape, x, y, false, colliderA.layer, colliderA.mask);`. `grep -rn createCollider packages/*/src` → only its own definition and barrel; sole other use is…

**Fix.** `add(entity: number, collider: Collider, x: number, y: number)`, storing the `Collider` reference in `CollisionEntry` instead of copying its fields; `createCollider` becomes the one constructor; update README and api-specs.md:121.

**Verifier corrections.** Not a defect. If anything is filed, it is a one-line README polish: packages/physics/README.md:25 should pass `colliderA.isTrigger` rather than the literal `false` so the example stays correct when a reader adds `{ isTrigger: true }` to the `createCollider` call. Low, postFlipHYG. — The facts hold, but the severity and the fix are overstated. There is no engine runtime defect: `add` does exactly what api-specs.md:121 documents, and `createCollider` returns correct data. The only concrete wrong result is a doc footgun: README.md:25 (and its compiled twin scripts/readme-snippets/physics__1.ts:10) drops `colliderA.isTrigger` for a `false` literal, so a reader who sets `isTrigger: true` in `createCollider` and copies the line verbatim gets a solid body. The D1 snippet gate cannot catch this because the line typechecks. The "permanent orphan" impact is also weaker than stated: an additive `addCollider(entity, collider, x, y)` fixes the orphan post-flip without a semver-major; only removing the 7-positional `add` is breaking. Corrected fix: (1) README.md:25 pass `colliderA.isTrigger` (or the new method); (2) add an additive `addCollider(entity, collider, x, y)` rather… — Claim and fix stand; impact is overstated. The only runtime trap is documentary: a consumer who copies README.md:25 verbatim and later sets `isTrigger: true` via `createCollider` gets a solid body because the snippet hard-codes the `false` literal — and that misfire is immediately visible (onCollisionStart fires instead of onTriggerEnter), not silent data corruption. The actual cost is API-shape debt that freezes at the flip: `Collider`/`createCollider` ship as a permanent orphan export (zero consumers in packages/**; only its own unit test and the README use it) and `add` freezes at seven positionals whose trailing `isTrigger, layer, mask` already tripped the maintainer while writing M11's tests (todo.md:784). Fix as proposed — `add(entity, collider: Collider, x, y)` — is a signature change, hence preFlip is the right tag; pre-flip breaks are cheap (restricted scope). Two notes for the…

#### F052 · `GestureDetector` times one press with two independent clocks

| | |
|---|---|
| Package | `input` |
| Site | `packages/input/src/gestures.ts:85` |
| Severity | **medium** |
| Lens | hygiene |
| Verification | 1 refuter, not refuted |
| Prior art | package-findings-2026-07 §input records 'GestureDetector: dual time sources' as an observation; no todo row owns it (HYG5 takes only the `_pinchActive`… |

**Defect.** Tap/swipe use the caller-supplied `elapsedSinceDown` while long-press uses an internally accumulated `_startTime` (which is an elapsed value, not a start time). `pointerUp` never checks `_longPressFired`, so the two clocks can each fire for the same press.

**Impact.** A host that feeds `update(dt)` and passes an approximate or stale `elapsedSinceDown` gets `onLongPress` (internal clock ≥ 0.5 s) followed by `onTap` (param says ≤ 0.3 s) for one press. Removing the parameter is a signature change, so it must land before the freeze.

**Evidence.** :85 `pointerUp(x: number, y: number, elapsedSinceDown: number)` → :92 `const duration = elapsedSinceDown;` drives :95/:109. :121-123 `update(dt, currentX, currentY) { if (!this._isTracking) return; this._startTime += dt;` → :126 `if (!this._longPressFired && this._startTime >= this.longPressMinDuration)`. `_startTime` is zeroed at :79 and only ever accumulates. No reference to `_longPressFired` anywhere in :85-113.

**Fix.** Drop `elapsedSinceDown`; `pointerUp` reads the internal accumulator (renamed `_elapsed`) and skips tap/swipe when `_longPressFired`. One clock, one state.

**Verifier corrections.** Claim stands; two refinements. (1) Impact: under default thresholds (tap<=0.3, swipe<=0.4, longPress>=0.5) a host whose `elapsedSinceDown` tracks its `update(dt)` sum does NOT double-fire; the default-config double-fire needs a host that passes a wrong/zero elapsed. But the missing `_longPressFired` guard in `pointerUp` is host-independent: any config with `tapMaxDuration >= longPressMinDuration` (the package's own test at tests/gestures.test.ts:154-166 sets `tapMaxDuration: 1.0` against the 0.5 long-press default) emits `onLongPress` then `onTap` for one still 0.6 s hold even with a perfectly consistent clock. There is no public accessor for `_longPressFired`, so a consumer can only suppress the spurious tap by self-tracking `onLongPress`. (2) Fix: dropping `elapsedSinceDown` outright regresses event-only hosts — every existing tap/swipe test drives `pointerDown`/`pointerUp` with no…

#### F059 · DocumentStore.load() treats any migration throw as 'corrupt' and persists defaults over a valid document

| | |
|---|---|
| Package | `storage` |
| Site | `packages/storage/src/document-store.ts:88` |
| Severity | **medium** |
| Lens | correctness |
| Verification | 1 refuter, not refuted |

**Defect.** `tryParseEnvelope` wraps `runMigrations` in the same `catch { return undefined }` used for JSON/envelope failures. `runMigrations` throws for a stored version higher than the app's (`cannot migrate backwards`) and for any error inside a consumer migration. `load()` then calls `parse(undefined)` and **writes the defaults back to the adapter**, destroying a well-formed newer-version document. api-specs limits the silent fallback to 'unparseable/malformed data'; a newer envelope is neither. `createStorage.loadSlot` throws in the same situation (storage.ts:91), so the two stores disagree.

**Impact.** A user who installs a build with a lower `version` (store rollback, side-loaded APK, staged rollout revert) has their settings/progress document overwritten with defaults on first launch; reinstalling the newer build cannot recover it. A single throwing migration in a consumer's chain has the same effect for every user on upgrade.

**Evidence.** document-store.ts:84-92 `try { const parsed = JSON.parse(raw); if (!isDocEnvelope(parsed)) return undefined; return runMigrations(parsed.data, parsed.version, version, migrations); } catch { return undefined; }` → :104-110 `const migrated = tryParseEnvelope(raw); if (migrated === undefined) { let doc = parse(undefined); ... await persistRaw(doc); ... }`. migrations.ts:24-25 `if (from > to) throw new Error('... cannot migrate backwards ...')`. api-specs.md:463: 'silent fallback to parse(undefined) → onFirstRun on unparseable/malformed data'. Tests at `tests/document-store.test.ts:150-168` pin only invalid-JSON and non-envelope inputs.

**Fix.** Catch only around `JSON.parse` + envelope check; let `runMigrations` errors propagate from `load()` (or resolve to defaults without persisting). Document the behaviour in api-specs — this changes `load()` from never-throws to may-throw on version mismatch, so it has to be decided before the freeze.

**Verifier corrections.** Claim and fix stand; two refinements. (1) Impact vectors: an end-user "store rollback / side-loaded APK" is rarely installable (Android refuses versionCode downgrades without uninstall, which wipes data anyway); the realistic triggers are a web deploy rollback (IndexedDB adapter keeps the newer envelope), a hotfix build that reverts a schema-version bump while carrying a higher build number, and any consumer migration that throws for a subset of stored docs, which silently wipes every affected user on upgrade. (2) `importJSON` (document-store.ts:134-140) shares `tryParseEnvelope`, so importing a newer-version export also silently degrades to defaults; the fix must narrow the catch there too while keeping the pinned corrupt-JSON import fallback (tests/document-store.test.ts:219-228). Add tests for newer-version envelope and throwing migration on both `load()` and `importJSON`, and update…

#### F069 · Scene factory must supply world/camera that SceneManager unconditionally discards

| | |
|---|---|
| Package | `scene` |
| Site | `packages/scene/src/scene.ts:13` |
| Severity | **medium** |
| Lens | hygiene |
| Verification | 1 refuter, not refuted |

**Defect.** `Scene.world` and `Scene.camera` are required, non-optional members of the object every `SceneFactory` must return, yet `SceneManager._getOrCreate` overwrites both immediately after the factory runs. Consumers are forced to fabricate values that are thrown away; the package's own README resorts to `declare const` and every test to `world: null!`.

**Impact.** Any consumer who follows the README and passes a real `World` (e.g. one they pre-populated with entities in the factory) silently loses it: entities spawned on the factory-supplied world never exist in the scene. Everyone else must write `null!` / `as unknown as World`, which the repo's own style rules forbid. The shape is frozen at publish.

**Evidence.** scene.ts:12-16: /** ECS World for this scene (created by SceneManager). */ world: World; /** Camera for this scene (created by SceneManager). */ camera: Camera2D; scene-manager.ts:189-192: scene = factory(); // Inject World and Camera scene.world = new World(); scene.camera = new Camera2D(); README.md:20-27: // world and camera are injected by SceneManager after the factory runs declare const world: World; declare const camera: Camera2D; ... manager.register('menu', () => ({ name: 'menu', world, camera, ... tests/scene-manager.test.ts:9-10 (and 11 more sites): `world: null!, camera: null!`

**Fix.** Make the factory contract honest before the freeze: type `SceneFactory` as `() => Omit<Scene, 'world' | 'camera'>` (manager assigns them) or pass `(world, camera)` into the factory; update README/api-specs and drop the `null!` in tests.

**Verifier corrections.** Impact nuance: the engine's own GameView/createGame never consume `scene.world`/`scene.camera` (render system runs on the game-context world), so the injected World is a per-scene sandbox the consumer must wire themselves. The silent-loss path is therefore: a consumer passes `game.world` (the only rendered world) into the factory expecting `this.world` to be it, then spawns via `this.world` in `onInit`/`onEnter` — entities land in an orphan World and nothing renders; or a consumer pre-populates a World in the factory and loses it. Fix as stated (`SceneFactory = () => Omit<Scene,'world'|'camera'>` with the manager assigning, or `(world, camera) => Scene`); whichever is chosen, also update api-specs.md:206 to state that World/Camera are manager-created and drop the README `declare const` placeholder and the 20 `null!` test sites.

#### F078 · RevenueCat adapter reads `purchaseDateMillis`, a field the real SDK never sends; purchasedAt is always Date.now()

| | |
|---|---|
| Package | `iap-revenuecat` |
| Site | `packages/iap-revenuecat/src/provider.ts:153` |
| Severity | **medium** |
| Lens | correctness |
| Verification | 1 refuter, not refuted |
| Prior art | OSS-B12 (road-to-oss-2026-09.md:371; closed todo.md:1586) — B12's fix (4) reads `purchaseDateMillis`, which does not exist on the SDK, and its tx-id fix only… |

**Defect.** The structural SDK types declare `purchaseDateMillis` on both entitlements and non-subscription transactions, but react-native-purchases (the installed 10.0.1 and the ≥8 peer floor) exposes `latestPurchaseDateMillis`/`originalPurchaseDateMillis` on entitlements and `purchaseDate: string` (ISO) on transactions. Every `?? Date.now()` fallback therefore fires on the real SDK. `purchase()` also ignores `MakePurchaseResult.transaction` and scans `nonSubscriptionTransactions`, so subscription purchases still get the `originalPurchaseDate` date-string id.

**Impact.** Every restored/observed purchase reports `purchasedAt` = the moment of the call, so consumers persisting Transaction records get wrong dates and cannot dedupe by time; subscription purchases return a date string (shared across products) as `Transaction.id` — exactly the B12 defect, still live on the subscription path.

**Evidence.** provider.ts:48 `purchasedAt: ent.purchaseDateMillis ?? Date.now()`, :60 `purchasedAt: tx.purchaseDateMillis ?? Date.now()`, :143 `const { customerInfo } = await Purchases.purchaseStoreProduct(product);` (drops `transaction`), :150-153 `id: tx?.transactionIdentifier ?? customerInfo.originalPurchaseDate ?? String(Date.now()), ... purchasedAt: tx?.purchaseDateMillis ?? Date.now()`, :196 same in the listener; types.ts:39 `purchaseDateMillis?: number;`, :47 same. Real SDK: node_modules/@revenuecat/purchases-typescript-internal/dist/customerInfo.d.ts:45 `readonly latestPurchaseDateMillis: number;`, :53 `readonly originalPurchaseDateMillis: number;`, :227-235 `PurchasesStoreTransaction {…

**Fix.** Model the real fields in the structural types (`latestPurchaseDateMillis`, `purchaseDate: string` → `Date.parse`), take `id`/`purchasedAt` from `MakePurchaseResult.transaction` in `purchase()`, and rewrite the fake-SDK tests to use the real field names.

**Verifier corrections.** Claim is real but overstated on one path. (a) Entitlement sites provider.ts:48 (restore) and :196 (onTransaction listener) read `ent.purchaseDateMillis`, which the SDK neither declares (customerInfo.d.ts:21-117 has only `latestPurchaseDateMillis`/`originalPurchaseDateMillis`) nor emits at runtime (purchases-hybrid-common 18.1.0 iOS EntitlementInfo+HybridAdditions.swift and Android EntitlementInfoMapper.kt emit no `purchaseDateMillis`) — so every entitlement-derived Transaction has purchasedAt = Date.now(). CONFIRMED. (b) The non-subscription-transaction sites (:60, :153) are NOT phantom at runtime: hybrid common 18.1.0 StoreTransaction+HybridAdditions.swift and StoreTransactionMapper.kt both emit `purchaseDateMillis` alongside `purchaseDate`, so restore()'s nonSubscriptionTransactions loop and non-subscription purchase() get real dates today, via an undeclared bridge key (the .d.ts only…

#### F079 · GameView throws without <SafeAreaProvider> even when `safeArea` is passed; doc/spec claim a zero fallback

| | |
|---|---|
| Package | `react` |
| Site | `packages/react/src/game-view.tsx:157` |
| Severity | **medium** |
| Lens | correctness |
| Verification | 1 refuter, not refuted |
| Prior art | WEB-4 (todo.md:1291-1296; web-target-2026-08.md:537-541) recorded the false JSDoc and left it open with no owning row; this finding covers the code path… |

**Defect.** `useSafeAreaInsets()` is called unconditionally and react-native-safe-area-context throws when no provider is mounted, so the `safeArea` prop cannot bypass the peer dependency and the JSDoc/api-specs promise ('optional peer dep', 'falls back to zero insets when no provider is mounted') is false in the shipped .d.ts.

**Impact.** A consumer who passes explicit `safeArea` (or trusts the 'optional' wording) and omits the provider gets `No safe area value available` on first render — a blank app with a stack trace; the templates only work because WEB-4 wrapped each one.

**Evidence.** game-view.tsx:157-158 `const insets = useSafeAreaInsets(); const resolvedSafeArea: SafeArea = safeArea ?? insets;`; JSDoc :137-140 'If omitted, resolved from react-native-safe-area-context via `useSafeAreaInsets()` (requires a `<SafeAreaProvider>` ancestor; falls back to zero insets when no provider is mounted)'. node_modules/react-native-safe-area-context/src/SafeAreaContext.tsx:149-155 `export function useSafeAreaInsets(): EdgeInsets { const insets = React.useContext(SafeAreaInsetsContext); if (insets == null) { throw new Error(NO_INSETS_ERROR); } return insets; }`. docs/design/api-specs.md:377 'insets are resolved from `react-native-safe-area-context` (optional peer dep) and fall back to…

**Fix.** Read `useContext(SafeAreaInsetsContext)` (exported by RN-SAC) and fall back to `{0,0,0,0}` when null / when `safeArea` is supplied, or delete the fallback claim from the JSDoc and api-specs and document the provider as required.

**Verifier corrections.** Claim, impact and fix stand. Two refinements: (1) the api-specs:377 'optional peer dep' wording is wrong on its own terms independent of the provider question — `react-native-safe-area-context` is a required peer in packages/react/package.json (not in peerDependenciesMeta.optional) and a static value import, as README.md:11 already states; the fix should also align api-specs with the manifest. (2) WEB-4's pointer to the JSDoc (`game-view.tsx:91-93`) is stale; the claim now lives at :137-140. WEB-4 is prior art that recorded the defect but deliberately left it unowned, so no existing row owns the fix.

#### F085 · iap-revenuecat types mirror a `purchaseDateMillis` field the RevenueCat SDK does not have

| | |
|---|---|
| Package | `iap-revenuecat` |
| Site | `packages/iap-revenuecat/src/types.ts:47` |
| Severity | **medium** _(finder said high; verifiers corrected)_ |
| Lens | hygiene |
| Verification | 3 perspective-diverse refuters, 1 refuted |
| Prior art | OSS-B12 — B12 fixed restore-active-only, listener lifecycle and the tx id, and introduced the `purchasedAt`-from-`purchaseDateMillis` path; the field itself… · F078 |

**Defect.** The hand-written structural SDK types declare `purchaseDateMillis` on both entitlements and non-subscription transactions; the real react-native-purchases surface has `latestPurchaseDateMillis`/`originalPurchaseDateMillis` on entitlements and an ISO `purchaseDate: string` on store transactions. Every `purchasedAt` the adapter emits therefore falls through to `Date.now()`.

**Impact.** On a device every `Transaction.purchasedAt` from `purchase()`, `restore()` and the `onTransaction` stream is the wall-clock time of the call, never the store's purchase date; consumers ordering or persisting purchases by `purchasedAt` (and `EntitlementStore.restoreOnBoot` raw payloads) get restore-time stamps. The local interface exists only to avoid depending on the SDK types, and it drifted with no compile-time signal.

**Evidence.** types.ts:39 `purchaseDateMillis?: number;` (RevenueCatEntitlement) and :47 `purchaseDateMillis?: number;` (RevenueCatNonSubscriptionTransaction). Consumed at provider.ts:48 `purchasedAt: ent.purchaseDateMillis ?? Date.now(),`, :60 `purchasedAt: tx.purchaseDateMillis ?? Date.now(),`, :153 `purchasedAt: tx?.purchaseDateMillis ?? Date.now(),`, :196 `purchasedAt: ent.purchaseDateMillis ?? Date.now(),`. Installed SDK react-native-purchases 10.0.1 -> node_modules/@revenuecat/purchases-typescript-internal/dist/customerInfo.d.ts: PurchasesEntitlementInfo has `readonly latestPurchaseDateMillis: number;` (:45) and `readonly originalPurchaseDateMillis: number;` (:53); PurchasesStoreTransaction…

**Fix.** Model the real shape in types.ts (`latestPurchaseDateMillis: number` on entitlements; `purchaseDate: string` on store transactions, parsed with `Date.parse`), update the four provider.ts sites, and have the test fakes typed against `import type` from react-native-purchases so the fake cannot diverge again. Exported `RevenueCatPurchasesModule` embeds `RevenueCatCustomerInfo`, so the published .d.ts and `purchasedAt` semantics change.

**Verifier corrections.** Fold into F078 with this corrected claim: only the ENTITLEMENT paths are broken — provider.ts:48 (restore over entitlements.active) and :196 (onTransaction listener) read `ent.purchaseDateMillis`, which the SDK entitlement object never carries (it has latestPurchaseDateMillis/originalPurchaseDateMillis), so subscription/entitlement-derived Transactions get wall-clock purchasedAt. The TRANSACTION paths at :60 and :153 work on device: the hybrid bridge (native PurchasesHybridCommon 18.1.0 and the RN web hybrid mappings) emits an undeclared `purchaseDateMillis` on every StoreTransaction alongside the typed ISO `purchaseDate`. Corrected fix: entitlements → `latestPurchaseDateMillis: number` (keep `originalPurchaseDateMillis` if first-purchase semantics are wanted); transactions → declare the typed `purchaseDate: string` and use `purchaseDateMillis ?? Date.parse(purchaseDate)` so the code no… — Claim: only the entitlement-derived sites are broken — restore()'s active-entitlement loop (provider.ts:48) and the onTransaction listener (:196) always emit Date.now(), because RevenueCat entitlements expose `latestPurchaseDateMillis`/`originalPurchaseDateMillis` (plus ISO `latestPurchaseDate`, which the local type already declares but never reads), never `purchaseDateMillis`. The non-subscription-transaction sites (purchase() :153, restore() tx loop :60) do get the store date at runtime: the hybrid layer emits an undeclared `purchaseDateMillis` alongside the declared ISO `purchaseDate`, so provider.test.ts:354 pins real behaviour — but that field is absent from the public PurchasesStoreTransaction type, so it is a soft dependency. Impact: no in-engine logic reads purchasedAt (EntitlementStore grants by productId), so this is consumer-observable wrong timestamps on restore/listener… — Real defect, but the claim is overstated by half. RevenueCat's runtime customer-info dictionary (native purchases-hybrid-common 18.1.0, which RN-purchases' Android/iOS bridges delegate to; JS parity in @revenuecat/purchases-js-hybrid-mappings) emits BOTH `purchaseDate` (ISO) and `purchaseDateMillis` on every store transaction — the field is merely undeclared in `PurchasesStoreTransaction`. So provider.ts:60 (restore non-subscription txs) and :153 (purchase()) resolve the real store date on device. Only the two ENTITLEMENT paths are broken: provider.ts:48 (restore of subscription entitlements) and :196 (onTransaction listener) read `ent.purchaseDateMillis`, which never exists on an entitlement (runtime + type have `latestPurchaseDateMillis`/`originalPurchaseDateMillis`), so those always fall through to `Date.now()`. Nothing in-engine consumes `Transaction.purchasedAt` (only…

#### F086 · PaywallModal grants a single prop-supplied key, bypassing the catalog the store is bound to

| | |
|---|---|
| Package | `ui-shop` |
| Site | `packages/ui-shop/src/PaywallModal.tsx:52` |
| Severity | **medium** |
| Lens | hygiene |
| Verification | 1 refuter, not refuted |
| Prior art | OSS-B20 — covered the ShopPanel name collision and the mid-purchase backdrop guard only; the split grant path is untouched. |

**Defect.** PaywallModal takes both `productId` and `entitlementKey` and calls `grant(entitlementKey)`, while ShopScreen and RestorePurchasesButton call `grantProduct(productId)` on the same store. The store already owns the catalog, so the prop is redundant and a multi-grant product purchased via the paywall is only partially entitled.

**Impact.** A season-pass product bought through the paywall grants one key; the remaining catalog grants only appear after the next restore or onTransaction event, so the same purchase yields different entitlement sets depending on which ui-shop component performed it. Callers must also re-encode the catalog mapping in props.

**Evidence.** PaywallModal.tsx:15-16 `readonly productId: ProductId; readonly entitlementKey: EntitlementKey;` and :52 `entitlementStore.grant(entitlementKey);`. ShopScreen.tsx:89 `entitlementStore.grantProduct(id);`; RestorePurchasesButton.tsx:40 `entitlementStore.grantProduct(r.transaction.productId);`. The store is catalog-bound at construction: entitlements.ts:45-49 `createEntitlementStore(catalog: ProductCatalog, ...)`. catalog.ts:15-18 documents `A single product may unlock multiple entitlements (e.g., season pass).` api-specs.md:918 pins `Calls entitlementStore.grant(entitlementKey)`.

**Fix.** Call `entitlementStore.grantProduct(productId)` and drop the `entitlementKey` prop (or make it an optional extra key); update api-specs.md:918-919 and switch the PaywallModal.test.ts:206 `grant` spy to `grantProduct`. Prop removal is a signature change, so it must land before freeze.

**Verifier corrections.** Claim, impact and tag stand; three refinements. (1) The proposed test change is hollow: `packages/ui-shop/tests/PaywallModal.test.ts:204-272` never invokes the component — it re-implements the purchase flow inline (`patchedStore.grant('full_game')` at :232) and `tests/integration.test.ts:131-132` does the same (`// PaywallModal calls grant(entitlementKey), not grantProduct.`). Swapping the spy pins nothing; the fix needs a test that drives the rendered CTA `onPress` -> `handlePurchase` -> `grantProduct` (the pattern B20 already used for ShopScreen). (2) Impact nuance: with a real adapter AND `store.attachProvider(provider)` wired, the RevenueCat customerInfo listener (`iap-revenuecat/src/provider.ts:191-199`) later calls `grantProduct` per active entitlement, so the missing keys arrive asynchronously; with `NoopIAPProvider` (never emits) or without `attachProvider` (README example does…

#### F030 · PostFxSurface.composite(k) overwrites the caller-owned chain's globalIntensity every frame

| | |
|---|---|
| Package | `render-web` |
| Site | `packages/render-web/src/postfx-surface.ts:285` |
| Severity | **low** _(finder said high; verifiers corrected)_ |
| Lens | hygiene |
| Verification | 3 perspective-diverse refuters, 1 refuted |

**Defect.** `composite(globalIntensity)` takes an intensity parameter AND writes it into the `EffectChain` the caller already owns and passed at construction, so the chain field has two owners: `EffectChain.globalIntensity`/`setGlobalIntensity` (driven by `PostFxController.setMotionScale`, which the a11y bridge calls) and the per-frame `composite()` argument. The documented recipe `surface.composite(1)` silently resets any reduced-motion scale each frame.

**Impact.** On web, a game that wires `createA11yBridge().attachPostfx(controller)` and follows the render-web README gets reduced-motion undone every frame: the a11y scale written into the shared chain is clobbered by `composite(1)` before `buildPass` reads it. The redundant parameter is part of the published `PostFxSurface` interface, so removing it after the flip is a breaking change.

**Evidence.** postfx-surface.ts:282-289: ``` composite(globalIntensity) { if (lost || !scene) return; scene.flush(); chain.globalIntensity = globalIntensity; const img = scene.makeImageSnapshot(); ``` packages/postfx/src/controller.ts:125-127: `setMotionScale(k: number): void { chain.setGlobalIntensity(k); }` packages/a11y/src/bridge.ts:44: `target.setMotionScale(motionScale(manager.settings));` scripts/readme-snippets/render-web__4.ts:21 (the README recipe): `surface.composite(1); // runs the shader chain, presents the scene` The runtime already reads the chain value itself — packages/postfx/src/runtime.ts:152 `const scale = chain.globalIntensity;` — so the parameter adds nothing the chain does not…

**Fix.** Drop the parameter — `composite(): void` reads `chain.globalIntensity` (the runtime already does) — or make it optional and only assign when provided; update the `PostFxSurface` interface, README snippet and api-specs:411 row before the freeze.

**Verifier corrections.** Claim and fix are accurate. Impact is overstated in one respect: the fix is not inherently post-flip-breaking — `composite(globalIntensity?: number)` that assigns only when the argument is provided is additive and can land any time; only removing the parameter outright is breaking, so the pre-flip window is where the clean removal is free, not the only window for a fix. Either way the README/snippet recipe must change from `composite(1)` to `composite()` or the clobber persists for anyone copying it. Also note the surface bypasses `PostFxController.runtime`/`buildPass` entirely (own runtime at postfx-surface.ts:185), so the shared EffectChain is the sole state channel between the a11y bridge and the web surface. — If kept as hygiene: "composite(globalIntensity) duplicates EffectChain.setGlobalIntensity, giving the chain's intensity two writers on web; make the parameter optional (`composite(globalIntensity?: number)`, assign only when provided) and point the render-web README at `chain.setGlobalIntensity`/`PostFxController.setMotionScale` for a11y. Non-breaking, so post-flip HYG (fold into HYG8's render-web bucket), not a pre-flip freeze item." — Claim stands but is overstated. What is true: `composite(globalIntensity)` unconditionally writes the caller-owned chain's `globalIntensity` every frame (postfx-surface.ts:285), the runtime already reads the chain field (runtime.ts:152), and the neutral/native path (render/frame-renderer.ts:887-888) calls `rt.buildPass(ch, w, h)` WITHOUT touching it — so identical `attachPostfx(controller)` wiring honours reduced-motion on native and is silently clobbered on web by the README's literal `surface.composite(1)`. That cross-platform asymmetry plus the two-owner field is a real API footgun. What is overstated: (1) the parameter is DOCUMENTED ("run the chain at `globalIntensity`", :41 and api-specs:411), so a consumer passing `1` is passing the intensity they asked for; the escape is one argument (`composite(motionScale(a11y.settings))`); (2) the affected composition —…

#### F032 · BaseSpec.glow is a closed two-entry game palette; glow helpers carry a dead _Skia parameter

| | |
|---|---|
| Package | `shapes` |
| Site | `packages/shapes/src/types.ts:35` |
| Severity | **low** _(finder said medium; verifiers corrected)_ |
| Lens | hygiene |
| Verification | 1 refuter, not refuted |
| Prior art | package-findings-2026-07.md:67 flagged the hardcoded PT palette in `draw.ts:33-39`; no todo row owns it (HYG4 covers fill/stroke + colour unpack only, OSS-B22… |

**Defect.** `glow?: 'friendly' | 'hazard'` bakes two fixed ARGB colours, ring widths and offsets into a public engine primitive: a consumer cannot pick a glow colour or add a third glow without forking. The two exported ring painters `applyFriendlyGlow`/`applyHazardGlow` also take a `_Skia` parameter they never use, and `friendlyGlowArgb()`/`hazardGlowArgb()` are zero-arg functions returning literals.

**Impact.** Open/closed violation on a published type: the only extension path is a new enum member inside the engine. Every caller of the exported helpers must pass a Skia module for nothing. Both the enum shape and the helper signatures are frozen at the flip.

**Evidence.** types.ts:35: `readonly glow?: 'friendly' | 'hazard';` draw.ts:34-36: `export function friendlyGlowArgb(): number { return (0x40 << 24) | 0x6fa66b; }` draw.ts:43-53: ``` export function applyFriendlyGlow( _Skia: Skia, canvas: SkCanvas, paint: SkPaint, cx: number, cy: number, r: number, ): void { applyStroke(paint, friendlyGlowArgb(), 3); canvas.drawCircle(cx, cy, r + 4, paint); } ``` (`_Skia` likewise unused in `applyHazardGlow`, draw.ts:55-67.) README.md:125-126 documents the tags as "Player ships, pickups" / "Enemy bullets, danger cues" with fixed `#6FA66B`/`#E84B2A`.

**Fix.** Replace the tag with data — `glow?: { color: number; width?: number; offset?: number; rings?: 1 | 2 }` (keep the two presets as exported consts) — and drop `_Skia` from `applyFriendlyGlow`/`applyHazardGlow`; the palette functions become `const`s.

**Verifier corrections.** Narrow the finding to the dead parameter only. (1) The closed `glow?: 'friendly' | 'hazard'` enum and its two fixed ARGB recipes are the documented contract (types.ts:28-35 JSDoc, README.md:119-126, api-specs.md:991/996/997) pinned by four tests (draw.test.ts:513-549), and the owner already disposed of the shapes PT-vocabulary generalization as post-flip: road-to-oss-2026-09.md:938-940 ("document what IS, including the PT-vocabulary surface as-is; renaming ShipSpec etc. is a post-flip API-generality item") and api-specs.md:993. The "cannot pick a glow colour without forking" impact is also overstated: `applyFriendlyGlow` is literally one stroked `drawCircle(cx, cy, r + 4)` at width 3, reproducible data-only as `{ kind: 'ring', r: R + 4, stroke: 0xAARRGGBB, strokeWidth: 3 }` placed before the body in a `ShapeSpec[]` composition, the pattern README.md:79-83 already teaches. Do not file…

#### F043 · GamepadSource.poll() + applyRemap allocate ~20 objects per pad every frame; the seam contract is not zero-alloc

| | |
|---|---|
| Package | `input` |
| Site | `packages/input/src/gamepad-source.ts:60` |
| Severity | **low** _(finder said medium; verifiers corrected)_ |
| Lens | perf |
| Verification | 1 refuter, not refuted |
| Prior art | HYG5 — owns `applyRemapInto` + the double Map get as post-flip internal hygiene; materially different here: the allocation is dominated by… · HYG5 |

**Defect.** The per-frame gamepad path allocates a fresh result array, a fresh GamepadSnapshot, a buttons array, one object per button (17 by default) and an axes array per connected pad on every poll, then applyRemap allocates the same set again when a remap is installed — even though the only consumer, updateGamepadFromSnapshot, copies the values into persistent state in place, so the snapshot layer is pure churn.

**Impact.** With one pad and a remap: ~40 short-lived objects per frame (2400/s at 60 fps) on a path the README documents as per-frame, on JSC/Hermes where escape analysis will not remove them. The interface `GamepadSource.poll(): (GamepadSnapshot | null)[]` (api-specs:571, 'the seam for the native backend' :579) returns fresh objects today; a zero-alloc fix must either reuse the returned records (observable: a held snapshot mutates on the next poll) or add a `pollInto`/`applyRemapInto` contract — both consumer-visible on a published seam that third-party native adapters will implement.

**Evidence.** Per-frame chain: README:3 'InputManager polls per frame' → input-manager.ts:92-105 `pollGamepads(source)` → `const snapshots = source.poll();` … `applyRemap(snap, this._gamepadRemaps.get(i) as RemapTable)` → `updateGamepadFromSnapshot(pad, remapped, …)`. gamepad-source.ts:45 `const out: (GamepadSnapshot | null)[] = new Array(pads.length);` :52 `out[i] = webGamepadToSnapshot(p);` :60-67 `const buttons = new Array<{ pressed: boolean; value: number }>(p.buttons.length); for (…) { buttons[i] = { pressed: b?.pressed ?? false, value: b?.value ?? 0 }; } const axes = new Array<number>(p.axes.length); … return { id: p.id, index: p.index, timestamp: p.timestamp, buttons, axes };`. remap.ts:33-45…

**Fix.** Decide the seam before freeze: document `poll()` results as reused-between-calls (mirroring `CollisionWorld.raycast`) and have `createWebGamepadSource` keep one out array + one snapshot per slot, and give `applyRemap` an `applyRemapInto(snapshot, table, out)` twin that `pollGamepads` uses with a per-slot scratch snapshot.

**Verifier corrections.** Allocation is real and the count is right (poll: 1 out array + per pad {snapshot, buttons[], 17 button objects, axes[]} = ~20; applyRemap: another ~20 when a remap is installed). Three misstatements: (1) The JSC/Hermes framing over-attributes — `createWebGamepadSource` only runs where `navigator.getGamepads` exists (browsers), and no native adapter is shipped (api-specs:579 "react-native-gamepad adapter lands alongside the demo wiring"), so on RN only `applyRemap` can allocate, and only when a remap is installed via a consumer-written source. On web, Chrome's `getGamepads()` already returns fresh Gamepad/GamepadButton objects per call, so the engine layer roughly doubles an existing browser-level churn rather than introducing the only one. (2) `applyRemap`'s freshness IS pinned by its docstring (remap.ts:31 "returning a new snapshot"), so that half cannot become reuse-in-place; the…

#### F050 · `NavMeshPolygon.neighbors` is a required public field that nothing reads

| | |
|---|---|
| Package | `pathfinding` |
| Site | `packages/pathfinding/src/navmesh.ts:16` |
| Severity | **low** _(finder said medium; verifiers corrected)_ |
| Lens | hygiene |
| Verification | 1 refuter, not refuted |

**Defect.** `neighbors` duplicates `portals[].neighborId` and is never consulted by the A* walk, the funnel, or `findPolygonAt`; consumers must populate it for no effect.

**Impact.** A `neighbors` array that disagrees with `portals` is silently tolerated, and every mesh author fills a dead field; once published the field cannot be removed without a break.

**Evidence.** navmesh.ts:15-18 `readonly neighbors: readonly number[]; ... readonly portals: readonly Portal[];`. The only adjacency walk is :176-178 `for (let i = 0; i < current.portals.length; i++) { const portal = current.portals[i]!; const neighborId = portal.neighborId;` and the funnel matches on :239 `if (poly.portals[j]!.neighborId === nextId)`. `grep -n neighbors packages/pathfinding/src/navmesh.ts` → line 16 only. api-specs.md:291 already describes the type as 'each NavMeshPolygon carries its own portals (shared-edge list)' with no mention of `neighbors`.

**Fix.** Delete `neighbors` from `NavMeshPolygon` (drop the key from the tests/navmesh.test.ts fixtures); if bare adjacency is ever needed, derive it from `portals`.

**Verifier corrections.** Claim and fix are accurate; only the severity is overstated. Corrected impact: no runtime defect is reachable — a divergent `neighbors` is ignored, not mis-routed — so the cost is a mandatory dead field on a public interface with zero consumers that becomes un-removable after the October freeze. Fix as filed (delete `neighbors` from `NavMeshPolygon` at navmesh.ts:15-16, drop the key from the 7 fixture literals in tests/navmesh.test.ts, and tidy the `portals` docstring at :17) plus a changeset; note removal of a required field is consumer-observable, so it needs to land before the 0.4.0 cut rather than as a post-flip HYG row.

#### F051 · Three vocabularies for the same per-frame edge flag inside one package

| | |
|---|---|
| Package | `input` |
| Site | `packages/input/src/gamepad.ts:57` |
| Severity | **low** _(finder said medium; verifiers corrected)_ |
| Lens | hygiene |
| Verification | 1 refuter, not refuted |

**Defect.** `Pointer` and `VirtualButtonState` say `justPressed/justReleased`, `KeyboardState` says `wasPressed()/wasReleased()`, `GamepadButtonState` says `pressedThisFrame/releasedThisFrame` with accessor `wasButtonPressed()`. A duplicate free function exists only to paper over the shape split.

**Impact.** A consumer writing generic 'any input pressed this frame' code must special-case each source; after the flip every rename is a break, so this is the last free moment to unify.

**Evidence.** pointer.ts:12 `justPressed: boolean;` / virtual-button.ts:6 `justPressed: boolean;` / keyboard.ts:35 `wasPressed(code: string): boolean;` / gamepad.ts:57 `pressedThisFrame: boolean;` + gamepad.ts:206 `export function wasButtonPressed(state: GamepadState, button: number)`. keyboard.ts:102-105 `/** Free-function parity with resetPointerFrame. Delegates to kb.reset(). */ export function resetKeyboardFrame(kb: KeyboardState): void { kb.reset(); }`. All three vocabularies are documented in api-specs.md:108, :567, :590.

**Fix.** Pick one vocabulary (the ui focus driver already binds structurally to `wasPressed(code)`, so `wasPressed/wasReleased` is the least disruptive), rename the other two, and drop `resetKeyboardFrame` (or make `reset` the free function everywhere).

**Verifier corrections.** The three vocabularies exist, but the finding misreads the shape and so proposes the wrong fix. Two of the three are keyed QUERY functions and are already consistent with each other: `KeyboardState.wasPressed(code)` / `wasReleased(code)` (keyboard.ts:35-37), `wasButtonPressed(state, button)` / `wasButtonReleased` (gamepad.ts:205-211) and `wasActionPressed/Released(kb, bindings, action)` (keyboard.ts:162-191) all use `was…Pressed/Released`. The per-state boolean FIELDS use `justPressed/justReleased` on both `Pointer` (pointer.ts:12-14) and `VirtualButtonState` (virtual-button.ts:6-8), and keyboard reuses those very fields internally (keyboard.ts:63/69). The only outlier is `GamepadButtonState.pressedThisFrame/releasedThisFrame` (gamepad.ts:57-59). Corrected fix: rename those two fields to `justPressed/justReleased` and update the docstring at gamepad.ts:115-117 plus…

#### F064 · TileLayer.tiles is a plain number[] read per visible tile per frame; type is public, so the typed-array switch is breaking post-flip

| | |
|---|---|
| Package | `tilemap` |
| Site | `packages/tilemap/src/tilemap-data.ts:55` |
| Severity | **low** _(finder said medium; verifiers corrected)_ |
| Lens | perf |
| Verification | 1 refuter, not refuted |

**Defect.** The bulk w*h GID grid is held as `tiles: number[]` on the exported `TileLayer` type and indexed per visible tile every frame by the renderer. The repo rule is typed arrays for bulk numeric data; because `tiles` is part of the published type, moving it to `Uint32Array` after the flip is a breaking change to `TileLayer`, so the choice is irreversible once frozen.

**Impact.** Runtime: any Tiled flip bit (0x80000000 > SMI max) pushes the whole layer array to double elements (8 B/GID vs 4 B), and the `?? 0` hole check runs once per visible tile per frame. API: after October a consumer can hold `layer.tiles` as `number[]` (e.g. `.map`, `.slice`, `toEqual`), so the typed-array fix becomes a major-flavoured break the lockstep policy explicitly avoids.

**Evidence.** tilemap-data.ts:55 `tiles: number[];` (exported `TileLayer`, re-exported from index.ts:28). Built by tiled-parser.ts:209 `tiles: layer.data.slice(),` and ldtk-parser.ts:288 `const tiles = new Array(mapWidth * mapHeight).fill(0) as number[];`. Per-frame read: tilemap-renderer.ts:85 `const gid = getTileAt(layer, col, row);` → tilemap-data.ts:170 `return layer.tiles[row * layer.width + col] ?? 0;`. Caller chain from a loop: packages/react/src/game-view.tsx:236 `if (onRenderBackground) onRenderBackground(ctx, ctx.renderer.canvas);` (inside the per-frame render callback) → create-flare-app templates/topdown/src/App.tsx:49 `tilemapRef.current?.drawInto(ctx.camera, ctx.batch);` → `_drawTileLayer`…

**Fix.** Decide before the freeze: change `TileLayer.tiles` to `Uint32Array` (not `Float32Array` — the 24-bit mantissa cannot hold flip-bit GIDs), build it with `Uint32Array.from(layer.data)` / `new Uint32Array(w*h)` in both parsers, drop the `?? 0` in `getTileAt`, and update the `toEqual` pins (`Array.from`) in ldtk-parser/tiled-parser/renderer tests.

**Verifier corrections.** Real as a time-boxed API-shape decision, not as a runtime defect. Claim stands: `TileLayer.tiles: number[]` (tilemap-data.ts:55, exported index.ts:28) is bulk numeric data read per visible tile per frame (`_drawTileLayer` tilemap-renderer.ts:85 -> `getTileAt` :170), reached every frame via game-view.tsx:236 `onRenderBackground` -> topdown App.tsx:49 `drawInto`; and both parsers build plain arrays (tiled-parser.ts:209 `layer.data.slice()`, ldtk-parser.ts:217/:288 `new Array(n).fill(0)`). Impact is overstated: (a) no tilemap benchmark exists (benchmarks/src has ecs/physics/particles/render/integration only; PERF-4b todo.md:269 still plans one), so the cost is unmeasured; the `?? 0` is one nullish compare per tile and is dwarfed by the `getTilesetForGid` linear scan + `drawRaw` already in the loop; (b) the SMI->double transition is V8-only (Hermes, the primary RN target, stores every Array…

#### F087 · ui still ships a second shop list (`ShopPanel`) with zero consumers next to ui-shop's ShopScreen

| | |
|---|---|
| Package | `ui` |
| Site | `packages/ui/src/shop-panel.tsx:46` |
| Severity | **low** _(finder said medium; verifiers corrected)_ |
| Lens | hygiene |
| Verification | 1 refuter, not refuted |
| Prior art | OSS-B20 — resolved only the export-name collision by renaming ui-shop's component; package-findings-2026-07.md:141 ('two ShopPanels ... decide and document… |

**Defect.** Two overlapping shop-list components with divergent item models are public: ui's `ShopPanel`/`ShopItem` (owned-ness via `ownedKeys`) and ui-shop's `ShopScreen` (owned-ness via catalog grants). ui-shop does not use ShopPanel, and nothing in the repo renders it.

**Impact.** Both components freeze at the flip and must be maintained in lockstep forever; `ui`'s README advertises `ShopPanel` and `ui-shop`'s advertises `ShopScreen` for the same job, with `ownedKeys` duplicating what `CatalogEntry.grants` already encodes.

**Evidence.** shop-panel.tsx:8-24 `export interface ShopItem { readonly productId: string; ... readonly ownedKeys?: readonly string[]; ... }` and :46 `export function ShopPanel({ items, isEntitled, onPurchase, ownedLabel = 'Owned', purchaseLabelFor, style }: ShopPanelProps)`. ShopScreen.tsx:9 `import { Button, Label, Panel } from '@flare-engine/ui';` and :124-127 derives owned-ness from `catalog.entries.find(...)?.grants.some(...)`, rebuilding the same owned/available list from primitives. Repo-wide `ShopPanel` references: ui/src/index.ts:51, a comment at iap-revenuecat/tests/integration.test.ts:102, and a type-only probe; no runtime consumer and no ui test renders it.

**Fix.** Decide before freeze: delete `ShopPanel`/`ShopItem`/`ShopPanelProps` from ui (an export removal, hence pre-flip), or make `ShopScreen` render through `ShopPanel` and drop `ownedKeys` in favour of catalog grants.

**Verifier corrections.** Claim stands with two adjustments. (1) The item-model divergence (`ShopItem.ownedKeys` vs `CatalogEntry.grants`) is the intended decoupling of an iap-free UI kit — packages/ui declares no @flare-engine/iap dependency — so it is not itself the defect; the DRY defect is that ui-shop's ShopScreen re-implements shop-panel.tsx's list body instead of composing ShopPanel as SESSION_LOG.md:288 says it should. (2) The iap-revenuecat/tests/integration.test.ts:102 comment 'mirrors ShopPanel.handlePurchase' refers to ui-shop's pre-B20 ShopPanel (now ShopScreen), not ui's — a stale comment, not a reference. Corrected fix: a decision row before the freeze — either (a) drop `ShopPanel`/`ShopItem`/`ShopPanelProps` from ui's barrel + README (pre-freeze export removal, lockstep minor), or (b) keep it and make it real: add an api-specs row (it is absent from docs/design/api-specs.md:529-546 while…

### Unverified pre-flip findings (severity `low`, no refuter ran)

Filed for completeness per D4 rather than silently dropped. Confirm the site before acting.

| id | package | site | finding | fix |
|---|---|---|---|---|
| F073 | `devtools` | `packages/devtools/src/context.ts:25` | devtools exposes the same pause/step/resume three ways; HUD and Panel duplicate a button component | Before the freeze drop `pause/step/resume` from `DevtoolsContextValue` (keep `scrubber` + `useTimeScrub`) and fix api-specs:801; post-flip fold `HudButton`/`DevButton` into one… |
| F090 | `leaderboards` | `packages/leaderboards/src/memory.ts:26` | `MemoryLeaderboards` is a public zero-content alias of `LeaderboardsProvider` | Return `LeaderboardsProvider` from `createMemoryLeaderboards` and delete the alias and its index.ts export before freeze. |
| F046 | `physics` | `packages/physics/src/solid-grid.ts:70` | SolidGrid stores occupancy in a Set<number> that isBlockedAABB hashes into per tile per frame | Before the freeze change `SolidGrid.solid` to a `Uint8Array` of `width * height` (index = `row * width + col`) built in `buildSolidGrid`, read it with `grid.solid[row * grid.width… |
| F056 | `physics` | `packages/physics/src/spatial-index.ts:4` | `SpatialEntry<T>` is exported but no public signature can produce or accept one | Drop `SpatialEntry` from the barrel and make `_Entry` the sole entry type. |
| F033 | `postfx` | `packages/postfx/src/controller.ts:45` | PostFxController.triggerTimed is declared optional but unconditionally implemented | Make `triggerTimed` required on the interface, keep one JSDoc block, drop the `!` in the tests. |
| F034 | `render` | `packages/render/src/frame-renderer.ts:70` | render exports `ColorLike`, a type alias nothing in the repo references | Delete the alias and its re-export before the freeze (or use it in the `*Like` signatures if it is meant to be the colour contract). |
| F070 | `tilemap` | `packages/tilemap/src/tilemap-data.ts:36` | `TileData` is a dead exported interface nothing constructs or reads | Delete the interface and the barrel line before the freeze (or, if it is meant as the future flip-aware tile record, have `getTileAt`-style helper return it — but then it needs a… |
| F071 | `tilemap` | `packages/tilemap/src/tilemap-renderer.ts:94` | `getTileSourceRect` allocates per call with no `...Into` form; renderer inlines a private copy | Add `getTileSourceRectInto(tileset, gid, out: Rect): Rect` in tilemap-data.ts, have `getTileSourceRect` delegate to it, and make `_drawTileLayer` read from a reusable `_srcBuf`… |
| F072 | `tilemap` | `packages/tilemap/src/tiled-parser.ts:111` | `parseTiled` blind-casts its input while `parseLDtk` validates; garbage yields TypeError not TilemapParseError | Add the same top-level guard `parseLDtk` has (`typeof json === 'object'`, `Array.isArray(layers)`, `Array.isArray(tilesets)`, numeric width/height) and throw… |
| F083 | `ui` | `packages/ui/src/list.tsx:23` | List treats a nested child array as one item, so mapped children get no gap | Use `Children.toArray(children)` (which flattens nested arrays and drops null/false) instead of the manual `Array.isArray` split. |

---

## 2. Post-flip findings — Arc HYG

Internal only: a consumer of the published package cannot observe the fix. Per **D2** these are specced now and
executed after the flip. Note that six are high severity — "internal" is not "harmless".

#### F024 · createRenderSystem discards last frame's sort and re-sorts unordered query order every frame: O(n^2)

| | |
|---|---|
| Package | `render` |
| Site | `packages/render/src/render-system.ts:94` |
| Severity | **high** |
| Lens | perf |
| Verification | 3 perspective-diverse refuters, 0 refuted |
| Prior art | XR-7 (todo.md:84) landed the Query swap-remove and notes render-system.ts:94 only for z tie-break/output stability (external NEW-4); neither it nor NEW-4… |

**Defect.** The per-frame render system overwrites `entries[0..count)` in Query iteration order and then insertion-sorts it. Query order is explicitly unordered (append on match, swap-remove on leave), so the insertion sort's 'nearly-sorted frame-to-frame' premise (api-specs.md:93) is never supplied by the engine's own caller; every inversion between the query order and z is paid again on every frame.

**Impact.** For n sprites spread over L interleaved z layers the sort performs about n^2(1-1/L)/4 element shifts per frame (1000 sprites / 3 layers ~ 1.7e5 shifts, every frame, on the JS thread; worst case n^2/2 when a low-z layer is spawned after a high-z one). No gate sees it: the `render.flush` rows drive SpriteBatch + frame renderer directly (render.bench.ts:120-121) and the `sort` rows sort a `{z: i}` array with `jitter` random swaps (render.bench.ts:164-175), i.e. only nearly-sorted input.

**Evidence.** render-system.ts:94-105: `for (const entityId of query) { ... const entry = entries[i]!; entry.entityId = entityId; entry.z = sprite.z; i++; }` then :113 `sortByDrawOrder(entries, count);` — the previous frame's sorted order is gone before the sort runs. draw-order.ts:21-29 is a plain insertion sort: `while (j >= 0 && items[j]!.z > item.z) { items[j + 1] = items[j]!; j--; }`. ecs/src/query.ts:21-24: "Matching entity IDs, in no guaranteed order. Entities are appended as they begin matching and removed by swapping the last element into the hole"; :101-102 `[Symbol.iterator]() { return this.entities[Symbol.iterator](); }`. api-specs.md:93: "nearly-sorted frame-to-frame input makes it O(n)".…

**Fix.** Keep `entries` sorted across frames and only patch membership: subscribe to `query.onEntityAdded`/`onEntityRemoved` (both public) to append/mark-dead, refresh `z` in place, then run the insertion sort so it is O(n + inversions-since-last-frame). Alternatively fall back to a non-quadratic sort when the first pass detects many inversions. Add a bench row that sorts through `createRenderSystem` with interleaved layers so the regression is measurable.

**Verifier corrections.** Claim, impact and fix stand. Three refinements: (1) the "worst case n^2/2" is the many-distinct-z reverse-order bound; for one high-z block spawned before one low-z block it is n^2/4 (250,000 shifts at n=1000). (2) The defect predates XR-7/swap-remove — plain `push` order was already interleaved by spawn history; swap-remove only adds disorder — so it is not an ADR-0003 regression, but ADR-0003:70-72's stated reversal check (render.flush / alloc.render rows) cannot observe it because none of those rows executes sortByDrawOrder; integration.bench.ts:156 also masks it by sorting a persistent already-sorted array. (3) Fix must keep the `world.get(entityId, spriteDef)` undefined-skip at :96 when patching membership via query.onEntityAdded/onEntityRemoved, and the new bench row should build the world through spawn-interleaved z layers so the query order — not a hand-built array — feeds the… — Claim, impact and tag stand. Three refinements: (1) this pre-dates XR-7 — the overwrite-then-sort shape is in the initial commit dbf2eb3 and Query order was always append-order, so swap-remove did not introduce the quadratic, it only strips incidental spawn-order clustering; (2) ADR-0003 "What would reverse this #1" names `render.flush` / `alloc.render … 8 atlas` as the check for exactly this degradation, but those rows never call createRenderSystem, so the bench row in the fix is required to make the ADR's reversal trigger observable, not optional; (3) the "worst case n^2/2" for one low-z layer spawned after one high-z layer is n^2/4 (two equal halves fully reversed); n^2/2 is the fully-reversed bound across many layers. On the fix: subscribing to query.onEntityAdded/onEntityRemoved inside createRenderSystem adds a subscription with no teardown on a function that returns a bare `() =>… — Claim and fix stand. Two sharpenings: (1) the defect predates XR-7/ADR-0003 — append-on-match order already interleaves layers whenever spawns interleave, so swap-remove is not the cause; (2) ADR-0003's revisit trigger #1 names `render.flush` / `alloc.render 8 atlas` as the check for exactly this degradation, and both bypass createRenderSystem (as does integration.bench's persistent pre-sorted array), so the ADR's own canary is blind — the new bench row in the fix should be cited there. Measured on V8: 1000 sprites/3 layers ~330 us per frame vs ~3 us sorted; 5000 sprites ~7.5 ms — larger than the 782 us churn cost ADR-0003 fixed.

#### F036 · CollisionWorld.raycast with maxDist=Infinity (or an infinite position) hangs the JS thread in SpatialIndex

| | |
|---|---|
| Package | `physics` |
| Site | `packages/physics/src/spatial-index.ts:122` |
| Severity | **high** |
| Lens | correctness |
| Verification | 3 perspective-diverse refuters, 0 refuted |

**Defect.** SpatialIndex derives its cell range with Math.floor/Math.ceil and loops `for (cx = cxMin; cx <= cxMax; cx++)`; an infinite bound makes cxMax = Infinity and the loop never terminates. `CollisionWorld.raycast` feeds it `ox + dx * maxDist` with no validation, so the natural 'unbounded ray' call `world.raycast(x, y, 1, 0, Number.POSITIVE_INFINITY)` is a hard hang, and `setPosition(e, Infinity, 0)` / `add` at an infinite coordinate hangs `_link` the same way.

**Impact.** Any consumer casting an unbounded ray (Unity-style `Mathf.Infinity` default) or whose integrator produces an infinite position freezes the game loop permanently — not a NaN that propagates, a hang on the JS thread. B23 hang-guards covered animator/sfx/core only; PERF-9/OSS-M11 do not touch this.

**Evidence.** spatial-index.ts:38-40 `function _cMax(v) { return Math.ceil(v / CELL) - 1; }` → Infinity. spatial-index.ts:117-123 `const cxMax = _cMax(qMaxX); ... for (let cx = cxMin; cx <= cxMax; cx++) { for (let cy = cyMin; cy <= cyMax; cy++) {`. collision-world.ts:288-302 `const ex = ox + dx * maxDist; ... this.raycastBounds.width = Math.abs(ex - ox) + RAY_BOUNDS_PAD * 2;` then `:305 this.spatial.query(this.raycastBounds, this.raycastCandidates);` — no finite check on maxDist. Same loop shape in `_link` (:148-153) via `update()`/`insert()`. With dx=0 and maxDist=Infinity the bound is NaN instead (`0 * Infinity`), so the loop silently runs zero times and every collider is missed. The standalone…

**Fix.** Guard non-finite inputs: in `CollisionWorld.raycast` reject/clamp a non-finite `maxDist` (e.g. clamp to a large finite span or return null with a dev warn), and in `SpatialIndex` refuse to link/query non-finite bounds (`Number.isFinite` on the four extents) so the cell loops are always bounded. Add tests for `maxDist = Infinity` and `setPosition(e, Infinity, 0)`.

**Verifier corrections.** Claim and fix are right; two precision fixes to impact. (a) The "integrator produces an infinite position" path is overstated: an integrator overflowing to ±Infinity needs magnitude > 1.8e308, and the realistic integrator failure is NaN, which makes both loops run zero times (silent miss, no hang). The realistic hang triggers are an explicit `Infinity` maxDist (the Unity `Physics.Raycast` default idiom) or an explicit infinite coordinate (e.g. parking an inactive entity at Infinity). (b) The `add`/`setPosition`-at-Infinity case is worse than a hang: `_key(Infinity, cy)` evaluates to Infinity, a valid Map key, so `_link` pushes the same entry into one bucket forever — unbounded memory growth on top of the spin. In `query` the bucket lookup just returns undefined, so that path is a pure busy hang. Also note the horizontal-ray case (dy=0, maxDist=Infinity): the cy range is NaN so the inner… — Claim holds and is slightly under-scoped. Confirmed by reading the code and by pure-arithmetic simulation of the loop: `_cMax(Infinity)` = Infinity so `for (cx = cxMin; cx <= cxMax; cx++)` never exits; `_link`/`_unlink` share the loop, so `add`/`setPosition` at an infinite coordinate hang too. Two refinements: (1) the hang is not only for non-finite input — any finite coordinate >= ~5.8e17 (64 * 2^53) also hangs because `cx++` is a no-op past 2^53, so a `Number.isFinite` guard alone is not sufficient; clamp/reject on magnitude (the packed key already documents a ±2,097,152 world range at spatial-index.ts:21-22) or bound the loop. (2) NaN never hangs — it silently unlinks/misses (loop runs zero times), which is why a vertical unbounded ray (`dx=0`, `maxDist=Infinity` → `0*Infinity=NaN`) returns null rather than hanging; only rays with a non-zero component on an axis hang. Fix belongs at… — Claim and impact are accurate. Two refinements to the fix: (1) `_link` at an infinite coordinate is not only a hang but unbounded memory growth — every iteration pushes the entry into the bucket at packed key `Infinity` (spatial-index.ts:154-160). (2) A `Number.isFinite` guard alone does not bound the loops: the cell walk is O((maxX-minX)/64 × (maxY-minY)/64) regardless of how many cells are populated, so a finite-but-huge span (`maxDist = Number.MAX_VALUE` → cxMax ≈ 2.8e306; `1e12` → ~1.5e10 cell visits) is the same hang in practice. The fix should also bound the walked range — clamp query/link extents to the index's supported cell range (±32768 cells, the documented ±2,097,152 world span at spatial-index.ts:21-22) and/or fall back to iterating `_cells` directly when the requested cell count exceeds `_cells.size`. `CollisionWorld.raycast` should additionally clamp a…

#### F057 · parseLDtk drops every AutoLayer tile: `gridTiles ?? autoLayerTiles` picks the empty gridTiles array

| | |
|---|---|
| Package | `tilemap` |
| Site | `packages/tilemap/src/ldtk-parser.ts:289` |
| Severity | **high** |
| Lens | correctness |
| Verification | 3 perspective-diverse refuters, 0 refuted |

**Defect.** Real LDtk JSON always emits BOTH `gridTiles` and `autoLayerTiles` as arrays on every layer instance (an AutoLayer has `gridTiles: []`, `autoLayerTiles: [...]`). The nullish-coalescing chain therefore selects the empty `gridTiles` for AutoLayer layers and silently produces an all-zero tile grid. The parser's local types mark both fields optional and every test fixture omits the unused one, so the suite never sees the real shape.

**Impact.** Any consumer exporting a real LDtk project with an AutoLayer (the standard way to author auto-tiled terrain) gets an empty layer with no error — visual layers vanish, and `extractColliders` never sees those tiles. First LDtk user after the flip hits it immediately.

**Evidence.** ldtk-parser.ts:289 `const tileInstances = layer.gridTiles ?? layer.autoLayerTiles ?? [];` — `??` only falls through on null/undefined, never on `[]`. Fixtures (`tests/fixtures/two-tileset-intgrid.ts:66,79`, `entities-ldtk.ts:69`, `ldtk-parser.test.ts:65`) only ever set `gridTiles`; no fixture or test contains `autoLayerTiles` (grep count 0 outside the type). api-specs.md:266 advertises `Tiles / AutoLayer` as supported.

**Fix.** Select by `__type` or by non-emptiness: `const tileInstances = layer.__type === 'AutoLayer' ? (layer.autoLayerTiles ?? []) : (layer.gridTiles ?? [])` (or `gridTiles.length ? gridTiles : autoLayerTiles`), and add a fixture that carries both arrays the way LDtk writes them.

**Verifier corrections.** Claim, impact and fix are accurate. Two refinements: (1) prefer the `__type`-keyed form (`layer.__type === 'AutoLayer' ? layer.autoLayerTiles : layer.gridTiles`, each `?? []`) over the `.length` heuristic, since a genuinely empty Tiles layer with a non-empty `autoLayerTiles` cannot occur but the type-keyed form is the one LDtk's own docs define; (2) the new fixture must carry BOTH arrays on every layer instance (as LDtk writes them) and assert the AutoLayer's tiles resolve to `firstGid + t` — a fixture omitting `gridTiles` would still pass on the current code. Separate, out-of-scope caveat: LDtk `autoLayerTiles` may stack several tiles in one cell (display-ordered); the single-gid grid keeps only the last one written, which is a known limitation, not part of this defect. — Impact is overstated in one clause: "`extractColliders` never sees those tiles" is moot. Def-backed tilesets are created with `solidTiles: new Set()` (ldtk-parser.ts:191) and tilemap-collider.ts:60 only emits a collider when `tileset.solidTiles.has(localId)`, so Tiles/AutoLayer tiles produce no colliders even when parsed correctly — LDtk collision comes solely from IntGrid. The real loss is purely the visual layer (which is still an unplayable-looking map, hence high stays). Fix as proposed is right; prefer the `__type === 'AutoLayer'` branch over a non-emptiness check (an AutoLayer with zero rule output is legitimately empty). Iterating `autoLayerTiles` in order with last-write-wins is correct because LDtk sorts it in display order (topmost last). The new fixture must carry all four arrays as LDtk writes them (`gridTiles: []`, `autoLayerTiles: [...]`, `intGridCsv: []`,…

#### F058 · installGlobalErrorCapture: a rejecting transport re-enters the unhandledrejection handler in an unbounded loop

| | |
|---|---|
| Package | `errors` |
| Site | `packages/errors/src/global-capture.ts:111` |
| Severity | **high** |
| Lens | correctness + hygiene |
| Verification | 3 perspective-diverse refuters, 0 refuted |

**Defect.** `emit` fires the transport with `void transport.report(payload)` inside a try/catch that only catches synchronous throws. `CrashTransport.report` is typed `void | Promise<void>`; when a transport returns a rejecting promise (e.g. a `fetch`-based reporter while offline) the rejection is unhandled, the page's `unhandledrejection` listener installed by this very function fires, `emit` runs again, the transport rejects again, and so on — each iteration also sends a new payload whose 'error' is the previous transport failure.

**Impact.** On web, a consumer whose transport is `report: (p) => fetch(url, {...})` (the obvious implementation) enters a self-sustaining reporting storm the moment the network drops or the endpoint 500s — exactly when crash reporting matters. Hits after the flip for anyone not using the bundled transports.

**Evidence.** global-capture.ts:110-114 `try { void transport.report(payload); } catch (err) { console.error(...) }`; :120-122 `const onRejection = (event) => { emit(unwrapEvent(event, 'reason'), { source: 'unhandledrejection' }); }`; :129 `target.addEventListener?.('unhandledrejection', onRejection)`. Same `void next.report(payload)` in `setTransport` drain at :159. The only test for transport failure (`tests/global-capture.test.ts:246` 'a throwing transport does not escape') covers a synchronous `throw`, not a rejected promise. Built-in transports happen to swallow internally (`compose.ts:7-11`, `transports/sentry.ts:45-53`), so only user-written async transports trigger it.

**Fix.** Normalise the call in `emit` and the drain to `Promise.resolve().then(() => transport.report(payload)).catch(err => console.error(...))` (or a `try { await } catch`), so a transport failure never becomes an unhandled rejection; add a rejecting-transport test asserting one report per event.

**Verifier corrections.** Claim and fix are right; two impact details are overstated/incomplete. (1) A bare `report: (p) => fetch(url, ...)` does NOT reject on an HTTP 500 — fetch resolves on any HTTP status and rejects only on network-level failure (offline, DNS, CORS, aborted). The '500s' case only loops if the consumer's transport throws on `!res.ok`. (2) The loop is serial and task-paced (one re-emit per `unhandledrejection` dispatch, each waiting on the previous rejection), not synchronous re-entrancy, and it self-terminates the first time the transport resolves (network back). While offline it is still an unbounded fetch/console storm. Scope note: error-boundary.tsx:40 also calls `this.props.transport?.report(payload)` with no catch; with the global capture installed, a rejecting boundary transport seeds the same loop, so the fix should normalise that call too. — Claim holds; three corrections. (1) The loop is async, not a stack overflow: one iteration per `unhandledrejection` task, rate bounded only by how fast the transport rejects (offline `fetch` rejects within ms, so hundreds-thousands of iterations/s on the game's main thread, each allocating a payload with a captured stack), and it ends by itself once the transport resolves again. (2) Trigger is narrower than stated: `fetch` resolves (ok:false) on an HTTP 500 — only a network failure (offline/DNS/CORS) or a consumer-thrown `!ok` produces a rejection; and every bundled transport is immune (`compose.ts:7-11` catches per child, `transports/sentry.ts:36-53` catches, `createClientTransport` is sync try/catch), so exposure is a consumer-authored async transport passed bare to `installGlobalErrorCapture` on web (RN's `globalThis` has no `addEventListener`, so `canListen` is false and the… — Claim and fix stand; two details of the impact are misstated. (1) `report: (p) => fetch(url, {...})` does not typecheck against `void | Promise<void>` (returns `Promise<Response>`); the obvious type-correct form is `async report(p) { await fetch(url, {...}) }`, which rejects identically on a network failure. (2) An endpoint returning 500 does NOT trigger it with a plain `await fetch` — fetch resolves on HTTP 5xx; the loop needs `report` to reject, i.e. offline/DNS/CORS/connection failure, or a transport that throws on `!res.ok`. Loop pacing: in a browser the `unhandledrejection` event is dispatched from a task, so with a real fetch the storm is paced by the fetch-failure latency (fast when offline) rather than starving the event loop outright; in a host where the rejection is immediate (the Node simulation) it starves timers entirely. Also note `ErrorBoundary` (error-boundary.tsx:40) is…

#### F077 · Button re-registers on every onPress identity change; unregister of the focused node moves focus

| | |
|---|---|
| Package | `ui` |
| Site | `packages/ui/src/button.tsx:45` |
| Severity | **high** |
| Lens | correctness |
| Verification | 3 perspective-diverse refuters, 0 refuted |

**Defect.** Button's registration effect lists `onPress` in its deps, so any parent render that passes an inline handler runs the cleanup (`manager.unregister(id)`) and re-registers. `unregister` of the currently focused id immediately refocuses `orderedIds()[0]`, and React runs every passive cleanup before any re-mount, so a menu of N inline-handler buttons cascades focus a→b→…→null on every parent render. A single changed button also loses its tab position (new `seq`, end of its tabIndex group).

**Impact.** Keyboard/gamepad users lose the focus ring (or see it jump to the first item) whenever the screen re-renders — pressing Enter on a menu button whose handler calls setState, a HUD counter updating, a ShopScreen purchase flipping `inFlight`. Focus navigation, the feature OSS-B15/B28/M1 shipped, is unreliable in any non-memoized tree.

**Evidence.** button.tsx:35-45 `useEffect(() => { ... return manager.register({ id, tabIndex, disabled, onActivate: () => { if (!disabled) onPress?.(); } }); }, [manager, id, tabIndex, disabled, onPress]);` — focus.ts:101-108 `unregister(id) { ... nodes.delete(id); if (focusedId === id) { const order = orderedIds(); setFocused(order[0] ?? null); } }` and :95 `const entry: Entry = { ...node, seq: seqCounter++ }`. The kit's own composites pass fresh arrows every render: shop-panel.tsx:83 `onPress={() => onPurchase(item.productId)}`, ui-shop ShopScreen.tsx:186-188 `onPress={() => { void handlePurchase(p.id); }}`, PaywallModal.tsx:82-84. Pinned only at the manager level: tests/focus.test.ts:97-103 asserts…

**Fix.** Hold `onPress` (and `disabled`) in a latest-ref inside Button and drop them from the effect deps (the pattern `useGameLoop` and `ShopScreen.onErrorRef` already use); optionally make `register` of an already-registered id keep its `seq` and make a same-tick re-register not disturb `focusedId`.

**Verifier corrections.** Claim and impact hold (note: ShopScreen's state is `inFlight` at ShopScreen.tsx:43, `purchasing` is the per-item derived bool at :167). The fix is misstated in two ways. (1) `disabled` cannot simply move to a latest-ref and leave the deps: the manager keeps a snapshot `Entry` and both `orderedIds()` (focus.ts:54) and `focus()` (focus.ts:111) read `entry.disabled`, so a stale entry would leave disabled buttons navigable. (2) "make register of an already-registered id keep its seq" cannot help as written, because the effect cleanup already deleted the node before the setup re-registers; the disposer, not register, is the churn. Correct shape: split Button's effect into (a) a register/unregister effect keyed only on [manager, id] whose onActivate reads latest-refs for onPress and disabled, and (b) an in-place update for tabIndex/disabled that does not unregister -- either add… — Claim and impact hold. The fix is misstated in one respect: `disabled` cannot be moved into a latest-ref, because the manager reads it from the registered entry (focus.ts:54 `filter((e) => !e.disabled)`, focus.ts:111 `entry.disabled`), so a `disabled` flip must reach the manager. And a latest-ref for `onPress` alone does not fix the kit's own purchase flows: PaywallModal.tsx:81/91 give BOTH buttons `disabled={purchasing}` and ShopScreen.tsx:185 flips `disabled` on the purchased row, so `[disabled]` in deps still runs unregister→refocus on every purchase. Robust fix is manager-side: make `register()` of an already-registered id update the entry in place (keep `seq`, do not touch `focusedId`) and/or split Button's effect into a `[manager, id]`-keyed register/unregister plus a field-update path, with `onActivate` reading a latest-ref. Also note the symptom changed in OSS-B28 (7b43158):… — Claim holds but needs two refinements. (1) `disabled` cannot simply move to a ref: `orderedIds()` filters on the registered entry's `disabled` (focus.ts:54) and FocusManager has no update API, so `disabled` must stay in deps; a disabled toggle still re-registers (fresh seq, focus jump if focused) unless a manager-level update/idempotent-register is added. (2) Impact is narrower than "any non-memoized tree": it needs FocusProvider + a driver (opt-in, not wired by any template), something already focused, and a state-changing render that keeps the menu mounted; ui-shop's ShopScreen/PaywallModal mount no FocusProvider themselves and MainMenuKit's unique tabIndex per item makes the seq-loss half irrelevant there. Also note the Pressable path: a click calls `manager.focus(id)` then `onPress` (button.tsx:87-91), so the click-painted ring is wiped by the ensuing re-render (cosmetic). Fix: keep…

#### F080 · VirtualJoystick default knob is a touch target, so locationX/Y are knob-relative and the stick oscillates

| | |
|---|---|
| Package | `react` |
| Site | `packages/react/src/virtual-joystick.tsx:106` |
| Severity | **high** _(finder said medium; verifiers corrected)_ |
| Lens | correctness |
| Verification | 1 refuter, not refuted |

**Defect.** React Native reports `locationX/Y` relative to the deepest view under the touch. The custom `base`/`thumb` wrappers set `pointerEvents="none"`, but the default knob View does not, so a gesture that starts on the 40×40 knob (the centre of the 100×100 base — where thumbs land) delivers knob-space coordinates that `handleTouch` compares against the base centre `w/2,h/2`. Because the knob is then translated by the resulting offset, the next event is measured against a moved origin and the offset alternates between ~(-30,-30) and 0.

**Impact.** Touching the joystick centre and holding still produces a spurious up-left direction of magnitude ~0.8 on the first event and a jittering stick afterwards; every scaffolded topdown/shmup app ships with it.

**Evidence.** virtual-joystick.tsx:52-59 `const { locationX, locationY } = e.nativeEvent; const { w, h } = sizeRef.current; updateJoystick(stateRef.current, w / 2, h / 2, locationX, locationY, config);` — :98-104 custom thumb `<View style={{ transform: [...] }} pointerEvents="none">` vs :106-108 default `<View style={[styles.knob, { transform: [{ translateX: knob.x }, { translateY: knob.y }] }]} />` (no pointerEvents); :93-97 base wrapper also `pointerEvents="none"`. node_modules/react-native/Libraries/Types/CoreEventTypes.js:237-240 `/** The X position of the touch, relative to the element */ locationX: number`. Both scaffolder templates use the default knob (templates/shmup/src/App.tsx:159,…

**Fix.** Add `pointerEvents="none"` to the default knob View (mirroring the custom-thumb branch), or compute the touch position from `pageX/pageY` minus the base's measured page offset so the target element is irrelevant.

**Verifier corrections.** Claim holds and is understated on Android. iOS (Paper and Fabric) pins the touch's target view at touchesBegan and converts through the view's transform, so a gesture that STARTS on the 40x40 knob is knob-relative for its whole life and can never reach the correct offset (a drag to base (90,50) alternates between (10,-30) and (0,0)); a gesture started on the ring is fine. Android re-hit-tests on every ACTION_MOVE (JSTouchDispatcher.kt:156-158 findTargetTagAndSetCoordinates), and because a correctly tracked knob is centred exactly under the finger, EVERY gesture alternates correct/(-30,-30) on successive move events regardless of where it started. Web (react-native-web) is unaffected: createResponderEvent.js:133-135 measures locationX against responderEvent.currentTarget. Impact: on native the default-knob joystick (the only configuration both scaffolder templates use, shmup App.tsx:159…

#### F001 · Signal.once / EventEmitter.once re-fire on nested emit; ECS once-handler that spawns recurses to stack overflow

| | |
|---|---|
| Package | `events` |
| Site | `packages/events/src/signal.ts:30` |
| Severity | **medium** _(finder said high; verifiers corrected)_ |
| Lens | correctness |
| Verification | 3 perspective-diverse refuters, 0 refuted |

**Defect.** `once` is implemented as `add(wrapper)` where the wrapper calls `unsub()` then the handler. During an emit, `remove()` is deferred to `pendingRemove`, so the wrapper stays in the live `Set`; any nested emit of the same Signal/event runs it again. The documented 'fires once' contract breaks exactly in the ECS case where a once-handler mutates the world.

**Impact.** Any `once` subscriber whose handler (or a sibling handler in the same emit) causes a nested emit of the same signal runs 2+ times; with Query.onEntityAdded/onEntityRemoved, a once-handler that spawns/adds a matching entity recurses until the stack overflows. GameLoop, Query, ScreenManager all broadcast via Signal, so this is engine-wide.

**Evidence.** signal.ts:28-35: once(handler) { const wrapper = (value: T) => { unsub(); handler(value); }; const unsub = this.add(wrapper); signal.ts:38-44: remove(handler) { if (this.emitDepth > 0) { this.pendingRemove.push(handler); } ... } signal.ts:54: for (const handler of this.handlers) { handler(value); } // live Set, wrapper still present at depth 2 Same shape in emitter.ts:37-45 (`unsub(); (handler as Function)(...args)`) + emitter.ts:49-51 deferral. Repro: const q = world.query(Position); q.onEntityAdded.once(() => { world.add(world.spawn(), Position); }); world.add(world.spawn(), Position); → world.add → query._check (query.ts:65 emit, depth 1) → wrapper → handler adds a matching entity →…

**Fix.** Guard the wrapper with a local `fired` flag (`if (fired) return; fired = true; unsub(); handler(value);`) in both Signal.once and EventEmitter.once, and add a nested-emit regression test.

**Verifier corrections.** Claim and fix are correct. Two refinements: (1) the ECS framing is sufficient but not necessary — a bare `signal.once(() => signal.emit())` or `emitter.once('e', () => emitter.emit('e'))` overflows on its own, and the more insidious variant is the silent one: any regular sibling handler that performs one nested emit makes every once-subscriber run twice with no error. (2) The class docstrings (signal.ts:9-10, emitter.ts:13-14) legitimately document deferred removal for plain handlers; the bug is that once() reuses that mechanism without its own guard, so the fix (local `fired` flag) does not conflict with the documented remove-during-emit semantics. Impact statement "engine-wide" overstates: no in-repo consumer calls once(); exposure is external consumers post-flip. — Claim and fix are correct; impact is overstated and one stronger case is missing. (1) The re-fire does NOT require the once-handler itself to be re-entrant: any sibling handler that nests an emit of the same signal makes a `once` handler run twice (verified: sibling-before-wrapper nesting one emit → once handler count 2). (2) "Engine-wide" overstates reach: `grep -rn "\.once(" packages/*/src apps scripts` finds zero call sites outside packages/events tests, so no shipped engine path triggers it — it is a consumer-facing contract bug in a public primitive, not a live engine fault. Stack overflow needs a once-handler that synchronously re-triggers its own signal (e.g. spawning a matching entity inside `Query.onEntityAdded.once`), a pattern the engine itself sanctions (`world.ts:171-172` docstring: "a one-shot `onEntityAdded`"). Fix as filed: closure `fired` flag in both `Signal.once`… — Severity medium. Impact wording: 'ScreenManager' does not broadcast via Signal (no `new Signal` under packages/scene; the core site is `Screen.onResize` in core/screen.ts:39) — that phrase is inherited from the July audit row 9. Reach is consumer game code only: zero in-repo `src` callers of `.once(`. Concrete outcomes: bounded nesting (sibling handler re-emits once, or a handler whose re-emit terminates) silently fires the once-handler 2..N times; unbounded nesting (once-handler spawns/destroys a matching entity per fire on Query.onEntityAdded/onEntityRemoved) recurses to RangeError. Fix as stated (local `fired` guard in both Signal.once and EventEmitter.once, keep `unsub()` so pendingRemove still cleans up, plus a nested-emit regression test in both test files) is correct and patch-level; also add one line to the class docstring/README noting `once` is guarded independently of…

#### F003 · rayVsRect returns NaN for an axis-parallel ray whose origin sits on that slab's edge (0 * Infinity)

| | |
|---|---|
| Package | `math` |
| Site | `packages/math/src/intersection.ts:117` |
| Severity | **medium** |
| Lens | correctness |
| Verification | 1 refuter, not refuted |

**Defect.** For `dirX === 0` the code substitutes `invDx = +Infinity`; when `originX` equals `r.x` or `r.x + r.width`, `(0) * Infinity` is NaN, NaN poisons min/max, both rejection tests are false against NaN, and the function returns NaN instead of `number | null`.

**Impact.** Grid-snapped positions make `originX === tile.x` common: a straight-down cast from an entity standing on a tile's left edge returns NaN, passes the consumer's `t !== null` check, and NaN propagates into positions/velocities.

**Evidence.** intersection.ts:114-127: const invDx = dirX !== 0 ? 1 / dirX : Number.POSITIVE_INFINITY; ... const tx1 = (r.x - originX) * invDx; // 0 * Infinity → NaN when originX === r.x const tx2 = (r.x + r.width - originX) * invDx; const tMin = Math.max(Math.min(tx1, tx2), Math.min(ty1, ty2)); // NaN const tMax = Math.min(Math.max(tx1, tx2), Math.max(ty1, ty2)); // NaN if (tMax < 0 || tMin > tMax) return null; // both false for NaN return tMin >= 0 ? tMin : tMax; // returns NaN Tests (intersection.test.ts:123-144) never cast with a zero direction component.

**Fix.** Handle the zero-direction axis explicitly: if `dirX === 0`, reject when `originX < r.x || originX > r.x + r.width`, otherwise use `-Infinity/+Infinity` for that slab (same for y); add tests for on-edge axis-parallel rays.

#### F004 · GameLoop: stop() then start() from inside a frame callback leaves two live rAF chains

| | |
|---|---|
| Package | `core` |
| Site | `packages/core/src/game-loop.ts:156` |
| Severity | **medium** |
| Lens | correctness |
| Verification | 1 refuter, not refuted |

**Defect.** The frame callback unconditionally calls `scheduleFrame()` after `step()`. If a signal handler calls `stop()` (rafId reset to 0; the firing frame cannot be cancelled) and then `start()` (schedules frame A), the callback still schedules frame B, so two independent chains run forever and every frame steps/renders twice.

**Impact.** After an in-handler restart, `onUpdate/onLateUpdate/onPreRender/onPostRender` fire twice per display frame (second with rawDt 0 under rAF, or with real dt under a custom timer `tick`, i.e. 2x simulation speed), `clock.frame` double-increments, render cost doubles; each further restart adds another chain. A later `stop()` cancels only the last rafId, so the extra chains keep running until `running` is checked.

**Evidence.** game-loop.ts:143-157: this.rafId = request((time) => { if (!this.running) return; ... this.step(rawDt); this.scheduleFrame(); // no re-check of `running` / no pending-frame guard }); game-loop.ts:65-73 stop(): `this.running = false; ... cancel(this.rafId); this.rafId = 0;` — the currently-executing frame is not cancellable. game-loop.ts:55-62 start(): `this.running = true; ... this.scheduleFrame();` — sets rafId = A; the outer callback then overwrites rafId with B; A is never tracked or cancelled again. Repro: loop.onUpdate.add(() => { if (gameOver) { loop.stop(); loop.start(); } }).

**Fix.** After `this.step(rawDt)` re-check `this.running` and only reschedule if no frame is already pending (e.g. track a `framePending` flag set in scheduleFrame and cleared at callback entry), and add a restart-inside-handler test using the custom `tick` driver.

**Verifier corrections.** Claim and fix stand; two impact details are misstated. (1) "2x simulation speed under a custom timer tick" is wrong: `lastTime` is shared by both chains (game-loop.ts:152-153), so the rawDt handed to the two chains always sums to real elapsed time — the second chain's step gets ~0 dt under any monotonic driver (rAF, setTimeout, or @flare-engine/testing createFakeClock). Simulation speed is unchanged; the cost is doubled step()/render emissions per display frame, doubled `clock.frame`, and extra dt=0 onUpdate/onLateUpdate emissions (consumer code dividing by dt gets Infinity/NaN). (2) After a later out-of-handler `stop()`, the orphan chains do not "keep running": their pending callback fires once more, hits `if (!this.running) return` (line 144) and dies without stepping — unless `start()` is called again before that fire, in which case they revive. Trigger is also broader than stated:…

#### F025 · frame-renderer allocates two slice() arrays every time consecutive runs differ in length

| | |
|---|---|
| Package | `render` |
| Site | `packages/render/src/frame-renderer.ts:421` |
| Severity | **medium** |
| Lens | perf |
| Verification | 1 refuter, not refuted |

**Defect.** `getCachedSrcSlice`/`getCachedXformSlice` memoise a single slice keyed only on the last `n`. Any frame whose flush runs have differing lengths (mixed textures, alphas, effects, or a HUD run after a bullet run) allocates `srcRects.slice(0, n)` and `xforms.slice(0, n)` on every run-length change, i.e. per run in steady state.

**Impact.** Two O(n)-sized array allocations per run-length change per frame on both backends; a z-sorted scene with K runs of varying length allocates up to 2K arrays per frame (hundreds/frame in an interleaved shmup scene), churning the young generation on exactly the path the repo machine-gates as zero-alloc.

**Evidence.** frame-renderer.ts:419-424: `if (_cachedSrcSlice !== null && _cachedSrcSliceLen === n) return _cachedSrcSlice; _cachedSrcSlice = srcRects.length === n ? srcRects : srcRects.slice(0, n);` and :426-431 the same for `xforms`. Called per run at :857-858 `const srcs = getCachedSrcSlice(n); const dsts = getCachedXformSlice(n);` and in `drawOutlined` :732/:736/:742. Per-frame chain: game-view.tsx:239 `ctx.batch.flush(bridge.drawAtlas, ctx.renderer)` -> sprite-batch.ts:209 `drawAtlas(run.image, run.commands)` (one call per key change) -> frame-renderer.ts:796 `drawAtlas(image, commands)`. The alloc gate never sees it: every FLUSH_GATES scenario (benchmarks/src/alloc.ts:137-253) has uniform run…

**Fix.** Internal fix: cache slices per length (small array-of-arrays indexed by n, capped at the pool size) so each distinct run length allocates once. The cleaner design — pass a `count` through `DrawSurfaceLike.drawAtlas` and let backends read only `count` entries — changes the exported `DrawSurfaceLike` contract (implemented by render-web and react), so if that route is preferred it must land before the freeze.

**Verifier corrections.** Claim and fix hold; two refinements. (1) The impact line "hundreds/frame in an interleaved shmup scene" is an upper bound, not the typical case: a fully interleaved scene (run length 1 everywhere, the bench's "8 atlas interleaved") always HITS the cache because every run has the same n. The miss needs two ADJACENT runs of different length while n is below the pool's high-water mark, so the steady-state cost is exactly 2 x (number of adjacent run-length changes per frame) short-lived reference arrays — typically tens per frame in a z-sorted multi-texture scene, hundreds only when hundreds of runs alternate lengths. No retention, no correctness effect. (2) The repo already names these cached slices as the alloc counters' blind spot and claims a backstop that does not exist: benchmarks/src/alloc.ts:19-23 and docs/references/benchmarks.md:134 say "the cached slices in frame-renderer.ts are…

#### F037 · parseAseprite hash format loses every frame name — Object.values() discards the keys

| | |
|---|---|
| Package | `assets` |
| Site | `packages/assets/src/sprite-sheet.ts:154` |
| Severity | **medium** _(finder said high; verifiers corrected)_ |
| Lens | correctness |
| Verification | 3 perspective-diverse refuters, 0 refuted |

**Defect.** Aseprite's hash JSON (the CLI/dialog default, `--format json-hash`) keys `frames` by filename and the value objects carry no `filename` property; the parser converts the object with `Object.values()` and then reads `entry.filename`, so every frame is pushed with `name: undefined` and `frameMap` collapses to a single `undefined` key. `getFrame(sheet, 'player 0.ase')` returns undefined for every frame of a default Aseprite export.

**Impact.** A consumer exporting from Aseprite with default settings gets a SpriteSheet whose frames are all unnamed; every `getFrame`/name-based lookup and `animations`-by-tag flow silently fails. The documented Aseprite support only works for the non-default array export.

**Evidence.** sprite-sheet.ts:152-154 `const frameEntries: AsepriteFrame[] = Array.isArray(data.frames) ? data.frames : Object.values(data.frames);` then :156-168 `const entry = frameEntries[i]; ... sheet.frames.push({ name: entry.filename, ... }); sheet.frameMap.set(entry.filename, i);`. Contrast `parseTexturePackerHash` (:78-86) which correctly uses `Object.entries` and the key as the name. The only hash-format test (tests/sprite-sheet.test.ts:101-114) fabricates a `filename: 'idle_0'` field inside the value, which real Aseprite hash output does not contain, so the pin does not reflect the format the docs advertise (api-specs:187 'Aseprite JSON', README:3).

**Fix.** In the hash branch iterate `Object.entries(data.frames)` and use the key as the name when `entry.filename` is absent (`name: entry.filename ?? key`); fix the test fixture to omit `filename` in the hash case so it actually discriminates.

**Verifier corrections.** Claim and fix are correct; impact is overstated in one respect. The frameTags → animations flow does NOT fail: `parseAseprite` builds `frameIndices` from `tag.from..tag.to` (sprite-sheet.ts:173-202) and `@flare-engine/animation` resolves them by index (`state.sheet.frames[globalIdx]`, sprite-animator.ts:103), and `Object.values` preserves Aseprite's emission order, so rects and tag animations still render correctly. What actually breaks on a default (hash) Aseprite export: every `SpriteFrame.name` is `undefined` (violating the `name: string` type), `frameMap` collapses to a single `undefined` key, and `getFrame(sheet, <any name>)` returns undefined. Severity medium: real, silent, documented-format defect in a published package, but the primary animation path works and the fix is ~3 lines (`Object.entries`, `name: entry.filename ?? key`) plus dropping the fabricated `filename` from the… — Claim and fix stand. Impact should read: on a default (json-hash) Aseprite export, `parseAseprite` still yields correctly ordered frame rects and working tag-driven animations (SpriteAnimator is index-based), but every `SpriteFrame.name` is `undefined` (violating the `name: string` type), `frameMap` collapses to one `undefined` key, and `getFrame`/any name-based lookup returns undefined. The 'animations-by-tag flow silently fails' part of the impact is wrong. Severity medium: documented feature broken on the tool's default export, but no crash/corruption, primary animation path intact, one-line fix with no API-surface change. — Claim and fix are correct; impact is overstated in one clause. Aseprite's json-hash export (the CLI default per aseprite.org/docs/cli `--format json-hash (default format)`; confirmed in aseprite/src/app/doc_exporter.cpp where JsonHash sets `filename_as_key = true; filename_as_attr = false` and only JsonArray writes a `"filename"` attribute) carries no `filename` inside the frame values, so parseAseprite's `Object.values()` branch pushes every frame with `name: undefined` and `frameMap` collapses to a single `undefined` key holding the last index. Pure-JS repro of the function on a two-frame hash fixture: frames serialize as `[{x,y,w,h},{x,y,w,h}]` (no name), `frameMap = [[undefined, 1]]`, `getFrame(sheet, 'player 0.ase')` → undefined. What is NOT broken: the frameTags → `animations` flow. Tags are resolved by index (`sheet.animations.set(tag.name, { frameIndices })`,…

#### F040 · rayVsAABB/rayVsAABBInto produce a NaN hit when the origin sits exactly on a slab plane of an axis-parallel ray

| | |
|---|---|
| Package | `physics` |
| Site | `packages/physics/src/raycast.ts:236` |
| Severity | **medium** |
| Lens | correctness |
| Verification | 1 refuter, not refuted |

**Defect.** For an axis-aligned ray (`dx === 0`) the code substitutes `invDx = Infinity`; when the origin's x equals the box's min or max x the slab product is `0 * Infinity = NaN`. NaN survives every comparison, so the function returns a hit with `distance`, `point` and `normal` all NaN. In the standalone `raycast()` that NaN hit becomes `closest` and shadows every later real hit; in `CollisionWorld.raycast` it is silently dropped, turning a grazing hit into a miss.

**Impact.** Tile-aligned games routinely cast vertical/horizontal probes from tile edges (ground checks at a column boundary); such a ray returns garbage NaN coordinates from `raycast()` and hides closer colliders, or a false miss from the world variant.

**Evidence.** raycast.ts:233-236 `const invDx = dx !== 0 ? 1 / dx : Number.POSITIVE_INFINITY; ... const tx1 = (bx - hw - ox) * invDx;` → NaN when `ox === bx - hw`. :241-251 `const tMinX = Math.min(tx1, tx2); ... const tMin = Math.max(tMinX, tMinY); ... if (tMax < 0 || tMin > tMax) return null; const t = tMin < 0 ? tMax : tMin; if (t > maxDist || t < 0) return null;` — every comparison against NaN is false, so it falls through to `out.distance = t` (:254). Same pattern in the allocating `rayVsAABB` :106-125. raycast.ts:46 `if (hit && (closest === null || hit.distance < closest.distance)) closest = hit;` accepts the NaN hit first and then rejects all subsequent candidates (`x < NaN` is false). Worked…

**Fix.** Handle the parallel case explicitly: when `dx === 0`, return null if `ox < minX || ox > maxX`, otherwise set `tMinX = -Infinity, tMaxX = +Infinity` (same for y); apply to both the allocating and the `Into` variant and add an on-edge test.

**Verifier corrections.** Claim, impact and severity hold. One refinement to the fix: the finder's proposed parallel-axis check (`return null if ox < minX || ox > maxX`, else tMinX=-Inf/tMaxX=+Inf) makes an on-edge grazing ray a HIT (closed interval), whereas OSS-M11's remaining boundary bullet (todo.md:315-319) intends strict `<` (exactly-touching = no collision) for the overlap predicates. Choose the raycast on-edge convention to match whatever M11 lands and document it in the docstring; either choice is correct as long as the NaN is gone and a test pins the on-edge case in both `raycast()` and `CollisionWorld.raycast`. Also note the standalone-variant shadowing is order-dependent: a NaN hit shadows later real hits only if it is tested first; if a real hit comes first the NaN hit is dropped instead.

#### F044 · findPath/findPathJPS allocate three full-grid typed arrays plus a heap on every call

| | |
|---|---|
| Package | `pathfinding` |
| Site | `packages/pathfinding/src/astar.ts:174` |
| Severity | **medium** |
| Lens | perf |
| Verification | 1 refuter, not refuted |
| Prior art | package-findings-2026-07.md:87 records 'findPath allocates 4 full-grid arrays + per-node objects per call', but no Arc B/XR/HYG row owns it — OSS-B18 fixed… |

**Defect.** Both searches allocate scratch proportional to the whole grid (13 bytes per cell across g/closed/cameFrom plus the heap) on every call, with no reuse across calls on the same immutable Grid, so the cost of a search scales with map size rather than nodes explored.

**Impact.** A 256×256 grid costs ~850 KB of fresh typed arrays per search; the repo's own fixture size (heap-growth.test.ts:49 `const n = 2048`) costs ~54 MB per call. A game re-pathing a handful of agents per second from update() churns megabytes per second and pays the fill() of the entire grid even for a 10-tile path. No in-repo per-frame caller exists (package has zero consumers), so this is per-search, not per-frame-proven.

**Evidence.** astar.ts:170-184 `const total = w * grid.height; const g = new Float64Array(total); g.fill(Number.POSITIVE_INFINITY); const closed = new Uint8Array(total); const cameFrom = new Int32Array(total); cameFrom.fill(-1); … const heap = heapCreate(Math.min(total, 4096));`. jps.ts:124-138 is the same block verbatim: `const g = new Float64Array(total); … const closed = new Uint8Array(total); const cameFrom = new Int32Array(total); … const heap = heapCreate(Math.min(total, 4096));`. `Grid.data` is `readonly` (grid.ts:9), so the scratch could be keyed to the grid.

**Fix.** Keep a module-level WeakMap<Grid, {g, closed, cameFrom, heap}> scratch (or an explicit reusable search context) sized to the grid and reset only the touched indices (or fill once per call, which is still far cheaper than allocate+fill); share it between astar and jps via the HYG6 `heap.ts` split.

**Verifier corrections.** Claim/impact hold with three small corrections. (1) The Grid is not immutable — `setWalkable`/`setCost` (grid.ts:57-65) mutate `data` in place; only `width`/`height` are effectively fixed, which is all a per-grid scratch needs, so the fix still stands. (2) Numbers: 256x256 ≈ 880 KB per call (832 KB scratch + 48 KB heap), 2048x2048 ≈ 52 MB (not 54). (3) Fix caveats: `PathOptions.heuristic`/`JpsOptions.heuristic` is a user callback invoked mid-search, so a shared per-grid scratch must guard against re-entrant `findPath` on the same grid (in-use flag → fall back to fresh allocation); a generation-stamp array (valid iff stamp === current search id) removes the O(W*H) fill entirely rather than merely cheapening it; the per-node `{x,y}` objects in `reconstructPath`/`buildPath` are the `PathResult.path` API shape (api-specs.md:295) and are out of this finding's scope. Ownership: no existing…

#### F060 · SceneManager.go() interrupted mid-fade leaves the abandoned pending scene cached and marked initialized without onInit

| | |
|---|---|
| Package | `scene` |
| Site | `packages/scene/src/scene-manager.ts:76` |
| Severity | **medium** |
| Lens | correctness |
| Verification | 1 refuter, not refuted |
| Prior art | OSS-B5 — B5 fixed restart-same-scene reuse and awaited onPreload in the transition path; it did not cover a second go() interrupting an in-flight out-phase,… |

**Defect.** The animated `go()` path creates the target via `_getOrCreate` (which caches it in `_scenes`), stores it in `_pendingScene`, and adds it to `_initialized` before `onInit` has run — `onInit` only runs later in `_finishOutPhase`. If another `go()` arrives before the out-phase completes, `_pendingScene` is overwritten and the first target is never initialised, never destroyed, and never evicted. A later `push(name)` or instant `go(name)` returns that cached instance and `_initIfNeeded` short-circuits, so the scene becomes active having never had `onInit` called; its `World`/`Camera2D` from the abandoned attempt is also leaked.

**Impact.** A menu that fires `go('level')` and then `go('settings')` within one 300 ms fade (double-tap, back button) leaves `level` half-constructed; the next `push('level')` runs with no entities/systems and no diagnostic. Assets loaded in the abandoned `onPreload` are never released via `onDestroy`.

**Evidence.** scene-manager.ts:73-80 `this._scenes.delete(name); this._initialized.delete(name); const scene = this._getOrCreate(name)!; this._pendingScene = scene; ... this._initialized.add(scene.name);` — `_getOrCreate` caches at :193 `this._scenes.set(name, scene)`. Nothing removes the old `_pendingScene` when `go()` runs again while `_transitionState.phase === 'out'` (:70-107). `_initIfNeeded` :197-199 `if (this._initialized.has(scene.name)) return;` and `push` :121 `const scene = this._getOrCreate(name)` hand the un-inited instance back. `destroy()` :158-169 nulls `_pendingScene` without `onDestroy`.

**Fix.** When `go()` replaces a pending scene (or `destroy()` runs with one pending), call its `onDestroy?.()` and delete it from `_scenes`/`_initialized`; alternatively only add to `_initialized` in `_finishOutPhase` after `onInit`.

**Verifier corrections.** Claim and impact are accurate. Fix needs one correction: adopt only the first option (when go() overwrites a non-null _pendingScene, and when destroy() runs with one pending, call its onDestroy?.() and delete it from _scenes/_initialized — or evict/destroy the previous pending before :73). The alternative 'only add to _initialized in _finishOutPhase after onInit' is unsafe: :80 exists so that a push(name) issued during the out-phase does not re-run onPreload/onInit on the pending instance via _initIfNeeded (:198); removing it reintroduces a double-init. Also note the same-name double-tap (go('X') twice) is a milder variant of the same hole — :73 evicts the first instance so no stale cache, but its onDestroy still never fires. Natural landing spot is HYG6's _teardownStack() refactor (todo.md:335).

#### F081 · createStorageAchievements memoizes a rejected hydrate promise, poisoning every later call

| | |
|---|---|
| Package | `achievements` |
| Site | `packages/achievements/src/memory.ts:112` |
| Severity | **medium** |
| Lens | correctness |
| Verification | 1 refuter, not refuted |
| Prior art | "" |

**Defect.** `hydrate()` caches `store.get(key).then(...)` unconditionally; the `.then` callback only catches JSON errors. If the first `store.get` rejects (transient AsyncStorage/IO failure), `hydration` stays a rejected promise for the provider's lifetime, so every subsequent `unlock`/`getState`/`getAll` rejects with the stale error and no retry is ever attempted — the opposite of the documented 'a parse error hydrates empty' resilience.

**Impact.** One failed read at boot turns the achievements provider permanently broken until app restart — every unlock rejects and `getAll` never returns — while an equivalent corrupt payload is tolerated.

**Evidence.** memory.ts:110-123 `function hydrate(): Promise<void> { if (hydration === undefined) { hydration = store.get(key).then((raw) => { if (raw === null) return; try { ... } catch { // Corrupt payload — hydrate empty. } }); } return hydration; }` — no rejection handler and no reset; :131-134 `const run = tail.then(async () => { await hydrate(); ... })`, :141-148 `await hydrate();` in both readers.

**Fix.** Clear the memo on rejection (`hydration = undefined` in a `.catch`, compare-and-clear as in iap-revenuecat's ensureConfigured) so the next call retries, or treat a get failure as empty like a parse failure; add a test with a store whose first `get` rejects.

**Verifier corrections.** Claim and impact are accurate. The fix needs narrowing: of the two options offered, only the "clear the memo on rejection so the next call retries" variant (compare-and-clear as in packages/iap-revenuecat/src/provider.ts:109-119) is safe. The alternative "treat a get failure as empty like a parse failure" is a data-loss hazard: a transient read failure would hydrate `states` empty, and the very next `unlock` calls `persist()` (memory.ts:126), overwriting the intact stored JSON array with a single-entry list — the consumer silently loses every achievement previously earned. The corrupt-payload path tolerates this only because the payload was already unreadable. Recommended fix: `hydration = store.get(key).then(...)`, then in `hydrate()` (or a `.catch`) compare-and-clear `hydration = undefined` and rethrow, plus a test with a store whose first `get` rejects and second resolves, asserting…

#### F010 · lineVsRect allocates an array of four object literals on every call

| | |
|---|---|
| Package | `math` |
| Site | `packages/math/src/intersection.ts:48` |
| Severity | **low** _(finder said medium; verifiers corrected)_ |
| Lens | perf + hygiene |
| Verification | 1 refuter, not refuted |

**Defect.** The Liang-Barsky predicate builds an `edges` array of four `{p, q}` objects and destructures them per iteration, so a boolean collision test allocates five objects per call while every sibling predicate in the file is allocation-free.

**Impact.** Any consumer calling it per bullet per frame pays five allocations per test; the result is identical to a branch-unrolled form, so the cost is pure waste.

**Evidence.** intersection.ts:48-53 `const edges = [ { p: -dx, q: x1 - r.x }, { p: dx, q: r.x + r.width - x1 }, { p: -dy, q: y1 - r.y }, { p: dy, q: r.y + r.height - y1 }, ];` and :55 `for (const { p, q } of edges) {`. Exported via index.ts:548 and the engine barrel. No in-repo per-frame caller exists (templates use a local `aabbOverlap`); the function's only purpose is per-frame segment-vs-AABB testing by consumers, and the math README (line 3) sells the package as zero-alloc in game loops.

**Fix.** Unroll the four edge tests into a small inline helper or a straight-line sequence of clip steps (same signature, same results).

**Verifier corrections.** Claim holds; nuance and impact narrowed. lineVsRect allocates one array literal plus four object literals per call, and the `for (const {p,q} of edges)` adds an array-iterator allocation on engines that do not inline iteration (Hermes on RN), so it is 5 allocs on V8-optimised code at best and 6 on Hermes. Impact is bounded: no in-repo caller exists outside index.ts and the test file, the shmup template uses its own `aabbOverlap`, and entity hitscans have `raycast` in packages/physics/src/raycast.ts, so only a consumer that picks this specific predicate for a per-bullet loop pays. The README's zero-alloc promise (line 3) is scoped to `out`-parameter forms, so no documented contract is breached; this is a house-rule/sibling-consistency wart, not a correctness or API defect. Fix: replace the array with four straight-line clip steps (or a scalar helper called four times), keeping the 1e-12…

#### F026 · Custom-shader effect re-queries the shader's uniform layout via reflection on every run, every frame

| | |
|---|---|
| Package | `render` |
| Site | `packages/render/src/frame-renderer.ts:1004` |
| Severity | **low** _(finder said medium; verifiers corrected)_ |
| Lens | perf |
| Verification | 1 refuter, not refuted |

**Defect.** `applyCustom`/`fillCustomUniforms` call `getUniformFloatCount()`, `getUniformCount()`, and per uniform `getUniform(i)` + `getUniformName(i)` on every drawAtlas run that carries a `custom` effect. The layout of a compiled shader never changes, yet each call crosses into Skia and materialises a fresh info object and name string; the web wrapper adds a second object literal per uniform.

**Impact.** For a shader with U uniforms: 2 + 2U Skia reflection calls and about 2U JS allocations (name string + info object, plus the web wrapper literal) per run per frame, on both backends. The alloc gate has no custom-effect scenario (alloc.ts FLUSH_GATES covers tint/outline/stretch/zone-bg only), so it is invisible.

**Evidence.** frame-renderer.ts:498 `const floatCount = shader.getUniformFloatCount();` and :1001-1006: `const count = shader.getUniformCount(); ... for (let i = 0; i < count; i++) { const info = shader.getUniform(i); const name = shader.getUniformName(i); const value = effect.uniforms[name];`. Reached per run from :859 `resolveEffectPaint(effect)` -> :756 `applyCustom(effect)` -> :501 `fillCustomUniforms(...)`. Web wrapper web-skia-module.ts:148-151: `getUniform: (i) => { const u = eff.getUniform(i); return { columns: u.columns, rows: u.rows, slot: u.slot }; }` — a new object per call on top of CanvasKit's own. sprite-effects.ts:215-217 documents `custom` as a per-frame animated effect ("uniforms may be…

**Fix.** Resolve the layout once per compiled shader (WeakMap<RuntimeEffectLike, {names: string[], slots: Int32Array, sizes: Int32Array, floatCount}>) on first use and index it in the per-run fill loop; no exported signature changes.

**Verifier corrections.** Claim, path and fix are accurate. Severity overstated: the per-run cost the finding counts (2+2U reflection calls, ~2U-3U short-lived allocs) sits next to the unavoidable `customPaint.setShader(shader.makeShader(customUniforms))` at frame-renderer.ts:502, which already allocates a fresh SkShader host object per run per frame and which the proposed WeakMap cache does not remove. Custom-effect runs are typically few per frame (backgrounds, a handful of sprites), so the saving is a modest constant per run, not a per-sprite cost (drawAtlas batches the n sprites in one call). Real, invisible to consumers, belongs in the post-flip hot-path/HYG queue; not medium.

#### F045 · findNavMeshPath rebuilds the id index and re-allocates polygon centroids on every node expansion

| | |
|---|---|
| Package | `pathfinding` |
| Site | `packages/pathfinding/src/navmesh.ts:194` |
| Severity | **low** _(finder said medium; verifiers corrected)_ |
| Lens | perf |
| Verification | 1 refuter, not refuted |

**Defect.** Inside the A* loop the search calls `centroid()` — which re-sums every vertex and allocates a fresh Vec2 — once per popped polygon and once more per portal edge, recomputing a loop-invariant property of an immutable mesh; it also rebuilds a `byId` Map from `mesh.polygons` on every call even though `NavMesh.polygons` is readonly.

**Impact.** A search over a corridor of E portal visits allocates E+V Vec2 objects and re-walks every polygon's vertex list E+V times, plus an O(P) Map rebuild per call — all on data that cannot change under the declared types. On the 'large open zones' api-specs:291 targets (hundreds of polygons, frequent boss/agent re-paths) this is the dominant per-search cost; the linear open-set scan (:140-150) is documented as intentional ('fine for <1000 polygons') and is not the issue here.

**Evidence.** navmesh.ts:77-86 `function centroid(verts) { let cx = 0; … return { x: cx / n, y: cy / n }; }`. Per call: :115-119 `const byId = new Map<number, NavMeshPolygon>(); for (…) byId.set(p.id, p);`. Per expansion: :173 `const currentCenter = centroid(current.vertices);`. Per neighbour edge: :194 `const neighborCenter = centroid(neighbor.vertices);` inside `for (let i = 0; i < current.portals.length; i++)` (:176). Types are immutable: :14 `readonly vertices: readonly Vec2[]`, :31 `readonly polygons: readonly NavMeshPolygon[]`.

**Fix.** Precompute per-mesh `byId` and one centroid per polygon once (in `createNavMesh`, or lazily in a module WeakMap<NavMesh, …> keyed on the mesh so the exported types stay unchanged) and read `centroids[id]` in the loop; keep `gScore`/`fScore`/`cameFrom` as reusable scratch.

**Verifier corrections.** Claim is accurate but the per-edge count and the impact are overstated. centroid() at :194 runs per successful relaxation, not per portal edge — the guard at :189 `if (prevG !== undefined && tentativeG >= prevG) continue;` skips it for non-improving edges. More importantly the centroid/byId work is NOT the dominant per-search cost: per expansion it is O(k) (k = 3-6 vertices) plus one small object, whereas the linear open-set scan at :143-150 does one Map.get per open entry per expansion (O(|open|), typically tens-to-hundreds on a several-hundred-polygon mesh), and the two findPolygonAt scans at :101-102 already walk up to every vertex of every polygon twice per call; the O(P) byId rebuild is the same order as those. The function also allocates 3 Maps, 2 Sets, corridor, path and portalsLeft/Right per call by contract (it returns a fresh Vec2[] path), so it is not and cannot be a…

#### F053 · Ray-vs-AABB and ray-vs-circle math is written twice in raycast.ts and has already diverged

| | |
|---|---|
| Package | `physics` |
| Site | `packages/physics/src/raycast.ts:89` |
| Severity | **low** _(finder said medium; verifiers corrected)_ |
| Lens | hygiene |
| Verification | 1 refuter, not refuted |

**Defect.** The allocating `raycast()` path keeps its own `rayVsAABB`/`rayVsCircle` beside the zero-alloc `rayVsAABBInto`/`rayVsCircleInto`; the two copies of the slab test no longer agree on degenerate directions or the early reject.

**Impact.** Any future fix to the intersection test (boundary semantics, NaN handling) must be applied twice and will be missed once; `raycast()` also allocates three objects per candidate where one per call would do.

**Evidence.** `rayVsAABB` :89-145 vs `rayVsAABBInto` :220-265; `rayVsCircle` :147-191 vs `rayVsCircleInto` :267-307. Divergence: :106 `const invDx = dx !== 0 ? 1 / dx : dx >= 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;` vs :233 `const invDx = dx !== 0 ? 1 / dx : Number.POSITIVE_INFINITY;`; :122 `if (tMax < 0 || tMin > tMax || tMin > maxDist) return null;` vs :248 `if (tMax < 0 || tMin > tMax) return null;`. The file's own comment :197-200 says the Into variant 'exists so CollisionWorld.raycast can test a whole broadphase cell without allocating' — i.e. it was added beside, not instead of, the old code.

**Fix.** Implement `raycast()` as a loop over `rayVsShapeInto` into a module-level scratch, copy the winner into one fresh `RaycastHit`, and delete `rayVsShape`/`rayVsAABB`/`rayVsCircle`. Signature and results unchanged; the README's 'fresh hit per candidate' paragraph becomes moot.

**Verifier corrections.** Claim: the intersection math is written twice (rayVsAABB/rayVsCircle at raycast.ts:89-191 beside rayVsAABBInto/rayVsCircleInto at :220-307), but the copies have NOT diverged behaviourally. The two textual differences are dead/redundant code, not semantic drift: (1) at :106-107 the `dx >= 0 ? +Inf : -Inf` ternary only runs when `dx === 0`, and `-0 >= 0` is true, so the `-Infinity` branch is unreachable and both copies yield +Infinity; (2) the extra `tMin > maxDist` at :122 is subsumed by `t > maxDist` at :125 for every sign of tMin. A node sweep of both AABB copies and both circle copies over 2,974,320 grid cases (dx/dy in {0,-0,NaN,+-1e-7,...}, origin on edges/inside, maxDist in {-1,0,NaN,Inf,...}, zero-extent boxes) plus 300k random rays produced 0 differing outputs (Object.is per field). The circle copies differ only in statement order. Impact is therefore pure hygiene: a future edit…

#### F054 · `Music.play` and `Music.crossfadeTo` duplicate the whole start-track block

| | |
|---|---|
| Package | `audio` |
| Site | `packages/audio/src/music.ts:99` |
| Severity | **low** _(finder said medium; verifiers corrected)_ |
| Lens | hygiene |
| Verification | 1 refuter, not refuted |

**Defect.** Twenty lines of source/gain creation, wiring, `start()`, state assignment and the `onended` cleanup closure are byte-identical in both methods; only the gain's initial value differs.

**Impact.** The onended/cleanup contract lives in two places; any change to how a finished track releases state must be mirrored or the two entry points drift.

**Evidence.** play() :44-65 and crossfadeTo() :99-121 both contain `const source = this.ctx.createBufferSource(); source.buffer = buffer; source.loop = loop; const gain = this.ctx.createGain(); ... source.connect(gain); gain.connect(this.output); source.start(); this.currentSource = source; this.currentGain = gain; this.currentName = name; source.onended = () => { if (this.currentSource === source) { this.currentSource = null; this.currentGain = null; this.currentName = null; } gain.disconnect(); };` — differing only at :49 `gain.gain.value = 1;` vs :104-105 `gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(1, now + duration);`. `stop()` :69-71 is a one-line wrapper over…

**Fix.** Private `startTrack(name, buffer, loop, prime: (gain: GainNodeLike) => void)` used by both; fold `stopInternal` into `stop`.

**Verifier corrections.** Claim, fix and tag hold; severity overstated. This is pure DRY hygiene in a 139-line class: consumer-invisible, no correctness defect, and Music.play/crossfadeTo are not per-frame hot paths (they already allocate source/gain nodes and an onended closure), so a `prime` callback adds nothing that matters. One caveat on the fix: folding `stopInternal` into public `stop()` makes `play()` call an overridable method (subclass interception) — harmless but a strictly observable change for subclassers; keeping the private helper and only extracting `startTrack` avoids it. Natural home is the post-flip Arc HYG audio bucket (HYG5 currently owns only the `AudioManager.factory` dead field).

#### F061 · createNativeShareTransport claims canShare() for screenshot payloads then silently drops the image

| | |
|---|---|
| Package | `share` |
| Site | `packages/share/src/share.ts:118` |
| Severity | **low** _(finder said medium; verifiers corrected)_ |
| Lens | correctness |
| Verification | 1 refuter, not refuted |
| Prior art | OSS-B25 — B25 fixed the native transport's `dismissedAction` handling only; the screenshot drop is untouched. · OSS-B3 out-of-scope clause (road-to-oss-2026-09.md:217) + §13 post-flip backlog "share native-transport screenshot path (deferred from B3)"… |

**Defect.** `SharePayload.screenshot` is documented as 'Optional screenshot to share as an image attachment', and the README's own example passes `screenshot: shot` through a `ShareManager` whose only registered transport is the native one. The native transport's `canShare()` returns `true` unconditionally, so the cascade stops there, and its `share()` builds `{ title, message, url }` and never reads `payload.screenshot` — the screenshot is discarded while the result reports `dispatched: true`.

**Impact.** Every native consumer following the README believes they shipped a screenshot share; the user gets a text-only sheet. Because `canShare` is true, registering a second transport that could handle images never helps.

**Evidence.** share.ts:118-120 `canShare() { return true; }`; :122-126 `const content = {}; if (payload.title !== undefined) content.title = ...; if (payload.message ...) ...; if (payload.url ...) ...; const res = await rnShare.share(content);` — no reference to `payload.screenshot`. share.ts:10-11 `/** Optional screenshot to share as an image attachment. */ screenshot?: Screenshot;`. README.md:24-29 `.register(createNativeShareTransport(Share))` … `await share.share({ message: 'New high score!', url: 'https://example.com', screenshot: shot })`. The web transport by contrast gates on it (`canShare` :53-63 requires `fileCtor` + `nav.canShare({files})`).

**Fix.** Either honour the attachment (RN `Share.share({ url: 'data:image/<fmt>;base64,' + screenshot.base64 })` on iOS, `message`+file on Android via an injected file writer) or make `canShare(payload)` return `false` when `payload.screenshot` is set so the cascade can fall through — and state the rule in the JSDoc/README. Either option changes the transport's observable contract, so it belongs before the freeze.

**Verifier corrections.** The defect is real and already known/triaged. Corrections: (1) priorArt is wrong — OSS-B25 never claimed this; the owner is OSS-B3's explicit deferral (road-to-oss-2026-09.md:217 "Out of scope (post-flip): native transport dropping `payload.screenshot`") plus the §13 post-flip backlog entry at :1227-1228 ("share native-transport screenshot path + ScreenshotTarget dims (deferred from B3)"), first recorded in package-findings-2026-07.md:36/:109. (2) Impact is overstated: the native path still shares title/message/url and `dispatched` honestly reflects RN's action per the documented "kicked off successfully" contract; only the image is missing. The sole historical native consumer (PT, ddf8418 `shareHighScore`) never passed a screenshot. (3) Tag: the finding's preFlip rationale ("either option changes the observable contract") only holds for the bad option (canShare→false, which would turn…

#### F084 · GameView onPreRender allocates Object.keys per bound postfx pass every frame, and builds passes even with no binding

| | |
|---|---|
| Package | `react` |
| Site | `packages/react/src/game-view.tsx:444` |
| Severity | **low** _(finder said medium; verifiers corrected)_ |
| Lens | perf |
| Verification | 1 refuter, not refuted |
| Prior art | OSS-B16 (DONE, todo.md:1580) added the samePasses gate and EMPTY_PASSES collapse; it does not cover the comparator's own Object.keys allocation (added in the… |

**Defect.** The B16 gate that stops per-frame setPasses is itself allocating on the hot path: sameUniforms() calls Object.keys(a) and Object.keys(b) (plus a for-of array iterator) for every bound pass on every native frame, and the native branch calls bridge.buildPostFxPasses(null,null,w,h) unconditionally even when bridge.hasPostFxBinding() is false, so a fresh [] is produced each frame just to be discarded by the length check.

**Impact.** On native with any postfx chain bound (the PT configuration) every frame allocates two key arrays plus an iterator per pass inside onPreRender — the one callback AGENTS.md forbids allocation in, and the same yardstick that made the curried runOnUI wrapper a tracked defect (todo.md:535-540). With no chain bound, an empty array is still allocated per frame by a call the react side could skip. Steady GC pressure on the JS thread at 60 fps on floor devices; consumer-invisible.

**Evidence.** Per-frame chain: game-view.tsx:223 `const unsubscribePre = ctx.loop.onPreRender.add(() => {` → :272-277 `if (!isWeb) { const built = bridge.buildPostFxPasses(null, null, w, h) as readonly PostFxPassDescriptor[]; if (!samePasses(prevBuilt, built)) {` → :427 `if (!sameUniforms(pa.uniforms, pb.uniforms)) return false;` → :444-446 `const aKeys = Object.keys(a); if (aKeys.length !== Object.keys(b).length) return false; for (const key of aKeys) {`. The bridge already exposes a pure guard the web branch uses (:278 `bridge.hasPostFxBinding()`), and render's `buildPostFxPasses` returns a fresh literal for the unbound case (frame-renderer.ts:882 `if (rt === null || !rt.supported) return [];`). The…

**Fix.** Guard the native block with `if (bridge.hasPostFxBinding())` before calling buildPostFxPasses (else collapse to EMPTY_PASSES), and rewrite sameUniforms as an allocation-free walk (`for (const key in a)` with a counter, or compare the underlying Float32Array slots carried on the descriptor) so the per-pass compare allocates nothing.

**Verifier corrections.** Both mechanics are real, but the finding misattributes where the allocation lives and one of its fixes is wrong. (1) In the bound case the comparator is a minor share: before samePasses ever runs, postfx `buildPass` (packages/postfx/src/runtime.ts:150-168) allocates a fresh `out` array, a generator object from `chain.enabled()` (chain.ts:109 `*enabled()`), a `new Float32Array([...])` (plus the literal) per effect via `packUniforms`, and one CompiledPass object per effect; then `buildPostFxPasses` (packages/render/src/frame-renderer.ts:889-918) allocates another `out`, a `uniforms` Record per pass, a `vec` array per vector uniform, and one descriptor per pass. Rewriting sameUniforms removes ~3 of ~10+ per-pass allocations; onPreRender stays allocating by design of the descriptor-per-frame path, so "the defect is the comparator's allocation, not the gate" is the wrong diagnosis — the…

#### F088 · useOverlayFade and useCountUp are the same 35-line rAF tween differing only in easing

| | |
|---|---|
| Package | `react` |
| Site | `packages/react/src/overlay-hooks.ts:41` |
| Severity | **low** _(finder said medium; verifiers corrected)_ |
| Lens | hygiene |
| Verification | 1 refuter, not refuted |

**Defect.** Both hooks duplicate the full state/ref/rAF/cleanup body verbatim; the only differences are the `visible ? 1 : 0` target mapping and `* t` versus `* easeOutCubic(t)`.

**Impact.** The stale-`from` bug recorded in todo.md:358 had to be fixed in one copy and hand-mirrored into the other ('mirroring the correct useOverlayFade'); the next rAF or cleanup fix needs the same double edit and the same double test.

**Evidence.** overlay-hooks.ts:5-39 and :41-74 both read: `const [v, setV] = useState<number>(target); const vRef = useRef<number>(v); const startRef = useRef<number | null>(null); const rafRef = useRef<number | null>(null); vRef.current = v; useEffect(() => { if (typeof requestAnimationFrame === 'undefined') { setV(target); return; } const from = vRef.current; startRef.current = null; if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); const step = (now: number) => { if (startRef.current === null) startRef.current = now; const t = Math.min((now - startRef.current) / durationMs, 1); setV(from + (target - from) * ___); if (t < 1) { rafRef.current = requestAnimationFrame(step); } };…

**Fix.** One internal `useTween(target, durationMs, ease)`; `useOverlayFade` becomes `useTween(visible ? 1 : 0, ms, identity)` and `useCountUp` becomes `useTween(target, ms, easeOutCubic)`. Public exports and signatures unchanged.

**Verifier corrections.** Impact misreads todo.md:358: the stale-`from` bug was present only in useCountUp (it read from a prevRef of the previous target); useOverlayFade was already correct and the fix hand-copied its valueRef pattern into useCountUp before commit 11842a1. The duplication risk is therefore "two independently written copies already diverged once", not "one fix applied twice". Fix as stated is fine; name the non-exported helper distinctly (e.g. `useRafTween(target, durationMs, ease: EasingFn)` using `linear`/`easeOutCubic` from @flare-engine/math) so it is not confused with the public `useTween` React binding that consumer-enablement-2026-08.md §9 explicitly cut under YAGNI. Severity low; fold into Arc HYG (nearest home is HYG8, react hygiene), not a pre-flip row.

### Unverified post-flip findings (severity `low`, no refuter ran)

| id | package | site | finding | fix |
|---|---|---|---|---|
| F042 | `animation` | `packages/animation/src/spring.ts:57` | updateSpring is only conditionally stable — a single GameLoop-clamped hitch frame (dt 0.25) overshoots 6x, sustained large dt diverges to Infinity | Sub-step inside `updateSpring` (split dt into steps ≤ ~1/120 or ≤ 1/(4·sqrt(stiffness/mass))) or use the closed-form damped-oscillator solution; either is invisible to the API.… |
| F009 | `core` | `packages/core/src/game-loop.ts:143` | GameLoop.scheduleFrame allocates a fresh rAF callback closure every frame | Hoist the callback to a single instance field (`private readonly onFrame = (time: number) => {…}`) and pass `request(this.onFrame)`; tests that stub `tick`/`cancelTick` keep… |
| F014 | `core` | `packages/core/src/pool.ts:82` | Pool.tryAcquire duplicates acquire's pop-or-create body instead of sharing it | Add `private take(): T` holding the shared body; `acquire()` returns `this.take()`, `tryAcquire()` does the cap check then `return this.take()`. |
| F066 | `debug` | `packages/debug/src/overlay.ts:77` | DebugOverlay.drawRect/drawCircle/drawLine allocate a fresh command object per call, discarded every frame by clear() | Pool: keep three typed pools (rect/circle/line) of mutable command objects with a count cursor, have the draw methods write into the next slot, and let `clear()` reset the… |
| F068 | `debug` | `packages/debug/src/frame-budget.ts:42` | frame-budget recordFrame re-sums the whole ring every frame once full, instead of keeping a running sum | Keep `let sum = 0` alongside the ring: in `recordFrame` do `sum += dtSec - ring[head]` before overwriting the slot, make `getAvgFps` return `filled < ringSize ? 0 : ringSize /… |
| F063 | `dialogue` | `packages/dialogue/src/text-reveal.ts:62` | updateTextReveal punctuation 'delay' is a speed override: slow text speeds UP after punctuation | Model the pause as additive time: advance at `speed` but subtract `punctDelay` worth of progress (or hold a separate `_pauseRemaining` countdown) when the cursor crosses a… |
| F067 | `dialogue` | `packages/dialogue/src/text-reveal.ts:68` | updateTextReveal re-slices visibleText every frame even when the revealed character count did not change | Insert `if (charCount === state.visibleText.length) return;` between the `charCount` computation and the slice (the completion branch is unreachable in that case because… |
| F008 | `ecs` | `packages/ecs/src/world.ts:36` | World.destroy walks every component store with an entries tuple per store, deleting from stores the entity never had | Iterate `this.componentStores.values()` (no tuple), or better walk the set bits of `arch` and delete only from the matching stores; behaviour and API unchanged. |
| F013 | `ecs` | `packages/ecs/src/world.ts:71` | World copy-pastes the deferred-removal query-notify block three times | Extract `private notifyArchetype(entityId: number, arch: number)` and `private notifyDestroyed(entityId: number)` that own the depth bookkeeping; the three callers become one line… |
| F089 | `engine` | `packages/engine/src/index.ts:120` | engine index.ts re-types the entire headless.ts export list instead of re-exporting it | index.ts becomes `export * from './headless.js';` followed by only the dynamics, postfx and react blocks. The emitted .d.ts surface is identical. |
| F062 | `errors` | `packages/errors/src/global-capture.ts:150` | uninstall() leaves the RN ErrorUtils handler live when no previous handler was captured | Guard the closure with `if (!installed) return previousHandler?.(error, isFatal);` and, in `uninstall`, when there was no previous handler install a pass-through (or the captured… |
| F075 | `errors` | `packages/errors/src/global-capture.ts:197` | `createClientTransport` lives in global-capture.ts and duplicates sentry.ts's payload→Error rebuild | Add `payloadToError(payload): Error` in crash-payload.ts, use it from both transports, and move `createClientTransport` + `ErrorClientLike` to transports/client.ts; barrel exports… |
| F006 | `math` | `packages/math/src/vec2.ts:160` | Vec2.slerp returns a degenerate/garbage vector for exactly antiparallel unit inputs | Add an antiparallel branch: when `theta > Math.PI - 1e-6`, rotate `a` by `t * Math.PI` via `Vec2.perp` (pick a fixed perpendicular) and document the chosen turning direction. |
| F047 | `pathfinding` | `packages/pathfinding/src/jps.ts:189` | JPS identifySuccessors allocates a fresh number[] for every expanded node inside the search loop | Use a module-level `Int32Array(16)` scratch (max 8 successors × 2) that identifySuccessors fills and whose count it returns, then iterate `for (let i = 0; i < count; i += 2)` in… |
| F048 | `pathfinding` | `packages/pathfinding/src/jps.ts:314` | JPS jump() is self-recursive per tile although its comment says the cardinal case is iterative | Rewrite the cardinal continuation as a `while (true)` loop that advances nx/ny and re-runs the forced-neighbour/goal checks, keep only the diagonal case recursive (calling the… |
| F041 | `physics` | `packages/physics/src/spatial-index.ts:70` | SpatialIndex.insert on an already-indexed item leaves a phantom entry that query returns forever | Make `insert` an upsert: if `_slots.has(item)` route to `update(item, bounds)` and return. One-line guard, no surface change; add a double-insert test asserting `size === 1` and… |
| F055 | `physics` | `packages/physics/src/collision-world.ts:168` | Trigger-vs-collision pair dispatch is copied three times in `CollisionWorld` | Private `emitPair(key: number, entering: boolean)` called from `remove()` and both `step()` loops. |
| F019 | `postfx` | `packages/postfx/src/controller.ts:86` | triggerTimed re-trigger overwrites the pre-trigger snapshot with mid-trigger uniforms | Only snapshot when `!timedRemaining.has(effectId)`; add a test that re-triggers after a mid-trigger setUniforms and asserts the original values are restored. |
| F028 | `postfx` | `packages/postfx/src/controller.ts:93` | PostFxController.update(dt) allocates a uniforms object, a find() closure and an expired[] array while any effect is active | Mutate the existing `grayscale-flash` uniforms in place after a one-time kind check (or store the Effect reference at construction); keep a persistent `expired` scratch array… |
| F015 | `progression` | `packages/progression/src/collectible-registry.ts:99` | createCollectibleRegistry docstring contradicts itself and the code about capstone ∈ ids | Delete the first paragraph and rewrite the second to state the real behaviour (or, as a behaviour change that would be preFlip, throw in `createCollectibleRegistry` when `ids`… |
| F020 | `render` | `packages/render/src/camera2d.ts:78` | Perlin shake indexes a 256-entry PERM with PERM[xi]+yi (up to 510) — half the lattice reads undefined | Allocate `PERM` as 512 entries and mirror the first 256 into the second half (standard Perlin), or mask the inner index `& 255`. |
| F021 | `render` | `packages/render/src/sprite-font.ts:126` | BMFont text uses charCodeAt, so glyphs with id > 0xFFFF can never be matched or drawn | Iterate code points (`for (const ch of text) { const code = ch.codePointAt(0)! ... }` or `codePointAt` + surrogate skip) in both functions; add a test with an astral glyph id. |
| F022 | `render` | `packages/render/src/frame-renderer.ts:820` | Zone-bg effects fall back to drawing opaque black rects when RuntimeEffect is absent or fails | Make the zone-bg apply functions return `null` (or have `drawAtlas` check `Skia.RuntimeEffect`/compile result) and fall through to the plain atlas draw or skip the rects when no… |
| F023 | `render-web` | `packages/render-web/README.md:72` | README presentation flow never deletes the per-frame CanvasKit Picture returned by endFrame | Add `picture.delete()` (cast) to the README flow and state picture ownership in the `endFrame`/`PictureLike` docs and api-specs:409; optionally have `createWebFrameRenderer`… |
| F027 | `render-web` | `packages/render-web/src/web-skia-module.ts:254` | render-web builds a fresh 9-closure canvas wrapper and two scratch buffers on every beginRecording (per frame) | Create the wrapper once per recorder with a mutable `ck` slot (or a `bind(ck)` method) and return the same object from `beginRecording`; keep a pre-allocated Float32Array(4) for… |
| F029 | `render-web` | `packages/render-web/src/web-skia-module.ts:110` | render-web drawAtlas allocates two subarray views per run, contradicting the api-specs 'zero-alloc steady state' claim | Cache the two views per `n` (array indexed by n, invalidated when `ensureCapacity` reallocates), or back the scratch with `kit.Malloc` and cache its views so CanvasKit passes the… |
| F035 | `render-web` | `packages/render-web/src/postfx-surface.ts:173` | render-web wraps CanvasKit RuntimeEffect.Make twice with two incompatible shapes | Make `wrapRuntimeEffect` in web-skia-module.ts return an object satisfying both `RuntimeEffectLike` and `SkiaRuntimeEffectLike` (add `makeShaderWithChildren`), export it… |
| F074 | `storage` | `packages/storage/src/document-store.ts:56` | Slot and document stores each define an identical envelope type + guard | Move one `VersionedEnvelope` + `isVersionedEnvelope` into migrations.ts (both files already import from it) and delete the two local copies; fold into HYG7's storage pass. |
| F065 | `tilemap` | `packages/tilemap/src/tilemap-renderer.ts:88` | Tile draw loop re-resolves tileset (linear scan) and image (string-keyed Map.get) for every visible tile every frame | Resolve images once: keep an `SkImageLike[]` parallel to `map.tilesets` filled in `setTilesetImage`; in the loop memoize `lastTileset/lastImage` and only re-resolve when `(gid &… |
| F082 | `ui` | `packages/ui/src/focus.ts:98` | FocusManager.register returns a disposer bound to `this`; throws when register is called unbound | Hoist `unregister` to a module-level/closure function and call it directly from the disposer (`return () => unregister(node.id)`). |


---

## 3. Corpus findings — the plans and docs audit (W2)

21 agents: 8 readers over the 25-file plan corpus (~1.1 MB), 5 claimed-DONE verifiers sharding
`todo.md` arcs against git history and code, 3 one-source-per-fact hunters (versions/dates,
architecture, process), 3 docs-split designers (one lost to a session limit), 2 critics. **183 issues.**

Dedup here was by title only, and it collapsed nothing — the agents phrase the same problem differently.
So a handful of entries below are two views of one defect (the road-to-oss changeset contradiction, the
OSS-H1 minor, the AGENTS.md 0.2.1 line, and XR-7 open-vs-landed each appear twice). They are kept rather
than merged by hand, because the two views usually carry *different* fixes and collapsing them would drop
one of the two.

Unlike the code findings in §1–§2, these were **not** put through a refuter panel — the claims carry
their own verification method inline (each says how it established reality: a git sha, a code path, a
second document). Two critics reviewed the set; their output is §3.4.

| severity | n | | kind | n |
|---|---|---|---|---|
| high | 46 | | stale claim | 65 |
| medium | 83 | | contradiction | 52 |
| low | 54 | | one-source violation | 29 |
| | | | gap | 15 |
| | | | broken ref | 11 |
| | | | structure | 6 |
| | | | unverifiable DONE | 5 |

### 3.1 High severity — fix before the freeze

These are claims someone would **act on** before Oct 5: a wrong package count in a flip step, a
changeset policy that contradicts the gate that enforces it, a row marked open that is landed.

#### DYN-2 portfolio swap is recorded as done elsewhere, but spec §7 and Task 10 still call it the next row

- **Kind** — stale claim
- **Where** — docs/plans/dynamics-lift-2026-08.md:295-298 + docs/plans/dynamics-lift-2026-08-tasks.md:1483-1595 (second: docs/plans/portfolio-collapse-needs-2026-08.md:19-20, docs/plans/todo.md:242-246)
- **Says** — §7 item 3: "Portfolio swap (= DYN-2, this is now the next row) — delete apps/web/src/lib/dynamics/, repoint the single import at collapse-engine.ts:17 ... Then reword the trigger copy a second time". Task 10 lays out the whole swap (Steps 1-8) as unexecuted.
- **Reality** — portfolio-collapse-needs-2026-08.md:6-20 (commit edb8517, 2026-08-26): "grzott-portfolio is a real consumer as of 2026-08-25 ... dynamics — the collapse solver — collapse-engine.ts:18-25 ... This closes CE-W7 / DYN-2 ... the swap is done and merged", pinned at engine 8701b58 via vendored tarballs (§5), donor-vs-engine divergence 6.8e-13 measured (§6). packages/dynamics/CHANGELOG.md 0.3.1 entry corroborates: "Found by the first external consumer, grzott-portfolio, while swapping its hand-rolled solver for this package." todo.md:242-246 has quietly reframed DYN-2 as retiring the vendor/ tarballs, so three in-repo docs describe three different states of the same row.
- **Fix** — In spec §7 item 3 and at the top of Task 10, add an "EXECUTED 2026-08-25/26 (vendored, engine 8701b58)" marker pointing at portfolio-collapse-needs-2026-08.md §5-§6, and state DYN-2's residual scope (registry install replacing vendor/flare-engine/, second-pass trigger copy if still pending) once, in todo.md only.

#### Task 10 installs @flare-engine/dynamics@^0.4.0 — a version reserved for the Oct 5 freeze cut

- **Kind** — stale claim
- **Where** — docs/plans/dynamics-lift-2026-08-tasks.md:1521 (also :1494 "from public npm", :1524 "Pin the major/minor the engine actually published")
- **Says** — `pnpm add @flare-engine/dynamics@^0.4.0 --filter @grzott/web`; Task 10 "Consumes: @flare-engine/dynamics from public npm at the version Task 9 published".
- **Reality** — packages/dynamics/package.json version is 0.3.1, publishConfig.access "restricted"; git log packages/dynamics shows 905d4d4 (0.3.0) and 516d313 (0.3.1). todo.md:214-218 and roadmap.md:14: "the October launch cut becomes 0.4.0 ... OSS-H1 cuts 0.4.0", and todo.md:244 "@flare-engine/dynamics@0.3.1 is on the registry as restricted". No 0.4.0 exists; a builder running this line fails or, worse, waits for the freeze cut. It also contradicts the spec's own decision 2 ("No version number is stated anywhere") and §3 ("Do not write the number into this document").
- **Fix** — Replace `@^0.4.0` with `@^0.3.1` (or `@^<current line, see todo.md>`), and change "from public npm" to "from the restricted registry (token) or the vendored tarball".

#### §8 '.npmrc + NPM_TOKEN ... Verified 2026-08-14' is contradicted by two sibling docs that ask for its correction

- **Kind** — contradiction
- **Where** — docs/plans/dynamics-lift-2026-08.md:313-324 (second: docs/plans/portfolio-collapse-needs-2026-08.md:258-275; docs/plans/pan-tvardowski-needs-2026-08.md:38-40)
- **Says** — "grzott-portfolio needs the same four lines and nothing else — it has no .npmrc today. So the swap works pre-flip: no vendoring, no transpilePackages, no dev-link. Verified 2026-08-14." (echoed at tasks.md:29-31).
- **Reality** — portfolio-collapse-needs-2026-08.md:239-240: the portfolio "does not install from npm. It vendors committed npm pack tarballs in vendor/flare-engine/"; :258-265 the recipe was "verified against flare-engine-page, not the portfolio" and a restricted install needs a read token on the Cloudflare Pages build; :272-275 "contrary to dynamics-lift-2026-08.md:316-324 ('verified 2026-08-14') ... Worth correcting in that doc." pan-tvardowski-needs-2026-08.md:38-40 narrows it further: the mechanism works for PT against 0.3.0; the failure was specific to unpublished packages. git log on the spec shows no edit since e803e8f/cba464d — the flagged text is unchanged.
- **Fix** — Rewrite the §8 bullet: recipe verified for flare-engine-page and PT (published packages); the portfolio chose vendored tarballs because the Pages build has no secret; a registry install there is gated on an end-to-end token-install check on the Pages build. Drop "no vendoring".

#### docs-sync plan sends the portfolio ledger to 0.3.0 and to retired Power-Saver microbench numbers

- **Kind** — stale claim
- **Where** — docs/plans/consumer-docs-sync-2026-08.md:77, :81, :82-84, :98-101 (plus :3-4 gate premise)
- **Says** — `engine-version` becomes 0.3.0; re-pin the ledger to the 0.3.0 commit; the recapture moved `render.flush 1000 / 1 atlas` 55.6 → 56.3 µs and `ecs.step 1000` 23.2 → 23.1 µs, both inside run-to-run spread — growth/noise, not a correction.
- **Reality** — Current line is 0.3.1: `packages/*/package.json` version 0.3.1, release commit `516d313` (2026-08-28), roadmap.md:14. docs/references/benchmarks.md:15/:17 now reads ecs.step 1000 = 9.3 µs and render.flush 1000/1 atlas = 22.8 µs after `f457e82` (2026-08-19, 'perf(bench): re-capture on High performance (2.5x correction)') — an instrument fault, which the sibling docs themselves call a correction (pan-tvardowski-needs:159-162, consumer-needs-audit:98-99). This file is unchanged since `e1cfbbc` (2026-08-18); todo.md:219-221 already had to bolt on 'sync to 0.3.1, not 0.3.0' beside it, and CE-W8 is still open (todo.md:294), so the plan will be executed as written.
- **Fix** — Rewrite §2's stale-row list: version 0.3.1, pin `516d313`; replace the microbench bullet with 'node numbers were re-captured 2026-08-19 after a ~2.5x Power-Saver instrument fault — this IS a correction, route it through the ledger's POSTMORTEMS protocol and take current values from benchmarks.md, do not copy them here'; adjust §2 item 4 and §4 done-when to match.

#### Portfolio §5 still says the .npmrc recipe fails because dynamics is unpublished, right under its own CORRECTION

- **Kind** — contradiction
- **Where** — docs/plans/portfolio-collapse-needs-2026-08.md:272-275 and :279-280 vs :243-256
- **Says** — '`.npmrc` + `${NPM_TOKEN}` does not work for this consumer ... That verification held for `flare-engine-page`, which resolves packages that were actually published. It does not hold for `dynamics`'; and the migration 'needs a paid npm org and a real publish'.
- **Reality** — The CORRECTION block at :243-256 (`edb8517`, 2026-08-26) established that `dynamics` and eight siblings are on registry.npmjs.org at 0.3.0 restricted (todo.md:1220-1224 records the same `npm view` result); pan-tvardowski-needs:38-40 reports the recipe working against 0.3.0 today; dynamics-lift-2026-08.md:313-324 — the text being 'corrected' — is right. Consequences 1 and the 'real publish' clause were written in `f99b6cd` and left untouched by `edb8517`.
- **Fix** — Rewrite consequence 1 as 'not adopted here by choice — vendoring is secret-free and fork-buildable; verify a token install end-to-end on the Pages build before deleting vendor/' (which the CORRECTION already says), and drop 'and a real publish' from :280.

#### DYN-2 is 'closed' in the portfolio doc but open in todo.md, and docs-sync assumes a registry install

- **Kind** — contradiction
- **Where** — docs/plans/portfolio-collapse-needs-2026-08.md:19-20, :218, :239-241 vs docs/plans/todo.md:242-246 and docs/plans/consumer-docs-sync-2026-08.md:3-4, :116
- **Says** — 'This closes CE-W7 / DYN-2 ... Both landed; the swap is done and merged'; docs-sync: 'both repos install from the restricted registry' and DYN-2 done-when = 'landed and the settle-parity assertion passes'.
- **Reality** — todo.md:242-246 keeps DYN-2 OPEN and re-scopes it: 'the swap can install rather than vendor; the portfolio's committed `npm pack` tarballs in `vendor/flare-engine/` are the thing this row retires'. portfolio:239-241 states the consumer does NOT install from npm — it vendors tarballs pinned at engine `8701b58` (2026-08-25, verified in git). The solver swap and parity gate (6.8e-13, portfolio:297) are done; DYN-2 as the queue now defines it is not, and docs-sync's install premise is false for the portfolio.
- **Fix** — Choose one definition. Either close DYN-2 in todo.md as done 2026-08-25 and file 'retire vendoring / registry install' as its own row, or amend portfolio:19-20 to 'closes the swap; DYN-2's registry-install half stays open in todo'. Fix docs-sync:3-4 to say the portfolio vendors and only the page installs.

#### PT doc §10 and §6 still present the broadphase as the open top ask after §3.1 was ANSWERED as shipped

- **Kind** — contradiction
- **Where** — docs/plans/pan-tvardowski-needs-2026-08.md:430-432, :557, :298 vs :150-188
- **Says** — '§3.1 (grid/hash broadphase for `SpatialIndex`) remains PT's single highest-value gameplay ask and is unchanged: a brute-force linear scan measured at 11.8-13.2 ms per 1000 colliders'; §10.6 #1 'unchanged, still the top gameplay ask'; §6 row 2 open at effort L.
- **Reality** — The ANSWERED block at :150-188 (`e4c9e5a`, 2026-08-27) says it shipped in 0.3.1 and that the 11.8-13.2 ms figure was a retired Power-Saver number. packages/physics/src/spatial-index.ts:43-44 is a uniform spatial hash; todo.md:307-310 marks CW7-8 DONE with 'Do not re-do this'; consumer-needs-audit:97-102 confirms. The retired figure is restated verbatim at :432. Note consumer-needs-audit:8-9 ('nothing here edits them') is already false — `e4c9e5a` added 42 lines to this file — so the correction is half-done, not forbidden.
- **Fix** — Strike :430-432 and :557 with 'shipped 0.3.1 — see §3.1 ANSWERED'; mark §6 row 2 shipped; while there mark §6 rows 1/3/4/6 and §9.1, §9.2, §10.2 as shipped (CW7-1..7, `516d313`) so each ask carries one status. Fix audit:8-9 to say corrections are appended as dated ANSWERED blocks.

#### Benchmarking runbook still lists §3 + §1c re-capture as the critical path; both are done, 0.3.0 shipped

- **Kind** — stale claim
- **Where** — docs/plans/benchmarking-completion-2026-08.md:1-12 (header/state) and :107-119 (§3)
- **Says** — "What is left before the benchmark story can ship with 0.3.0"; "check:perf-freshness is still RED ... Remaining critical path: §3 (web staleness guard) and the re-capture in §1c"; §3 "Web lanes have no staleness guard — close it ... nothing in scripts/ or CI watches the web captures at all".
- **Reality** — §3 was closed as PERF-15 on 2026-08-21 (todo.md:1364-1376): scripts/check-perf-freshness.mjs:193-270 judges the three web lanes and .perf-baseline.json:373-387 carries `freshness.webLanes`. The §1c re-capture landed as e7e169e (2026-09-06, `chore(bench): re-capture all lanes at fd8df76`): microbench.json, web.json, web-gpu.json and web-android.json all record commit fd8df76 and `git log fd8df76..HEAD -- packages benchmarks/src apps/bench-web` is empty, so the freshness gate is no longer red. 0.3.0 itself shipped 2026-08-25 (905d4d4, todo.md:1205). The file has not been touched since e803e8f (2026-08-19) per `git log -- docs/plans/benchmarking-completion-2026-08.md`.
- **Fix** — Rewrite the state block: mark §3 DONE (PERF-15, 2026-08-21) and §1c re-capture DONE (e7e169e at fd8df76, 2026-09-06), replace the 0.3.0 framing with the 0.4.0 freeze cut, and either close the runbook as historical or reduce it to the still-live re-capture procedure (1a-1c) plus the owner scope decision.

#### web-bench task plan reads as never executed: every checkbox unchecked, 'Known state' bullets now false

- **Kind** — stale claim
- **Where** — docs/plans/web-bench-2026-08-tasks.md:3-5, :44-58, :85-328, :344-348
- **Says** — "REQUIRED SUB-SKILL: ... implement this plan task-by-task"; all Steps are `- [ ]`; "Playwright is not a dependency anywhere in the repo"; "TestingBot appears only in docs, plans, and a token-pattern in scripts/audit-tarballs.mjs"; "benchmarks/package.json exports currently exposes only the two results JSON files"; "check:perf-freshness is RED at HEAD" (also Out of scope :346).
- **Reality** — PERF-6 C1-C5 are Done 2026-08-16 (todo.md:1521-1536, commits 9d2b812, 4b06ac1, 4a371be, 97644d3, ed579be, 2cbd92f, f030217). apps/bench-web/package.json:29 pins playwright 1.62.1; apps/bench-web/scripts/testingbot-probe.mjs + testingbot-session-smoke.mjs exist; benchmarks/package.json:19-25 exports three web result files plus ./scenarios; benchmarks/src/scenarios/{ecs,integration,particles,physics,render,index}.ts exist; freshness is green at HEAD (all lanes at fd8df76, no measured-path commits since). The plan file has a single commit (3f6fb11) and was never updated.
- **Fix** — Tick C1-C5 checkboxes with the landing shas from todo.md:1521-1536, add a one-line 'EXECUTED 2026-08-16; C6 parked' banner under the title, and delete or date-stamp the 'Known state, verified 2026-08-16' block so nobody re-runs the plan.

#### §2 item 4 tells the flip executor to treat the `@flare-engine/benchmarks` changeset ignore as a bug

- **Kind** — contradiction
- **Where** — docs/plans/engine-deep-audit-2026-07.md:56 + docs/plans/road-to-oss-2026-09.md:149
- **Says** — "Note `.changeset/config.json` ignores `@flare-engine/benchmarks`, a package that doesn't exist." (inside the flip-order list, item 4, right beside the access-flip mechanics)
- **Reality** — The package exists: `benchmarks/package.json:2` is `"name": "@flare-engine/benchmarks"` (`private: true`), root `package.json:17` lists `benchmarks` in workspaces, and `todo.md:1545` (PERF-1) wires `@flare-engine/benchmarks#test` in turbo. road-to-oss:149 explicitly says "Do NOT 'fix' `.changeset/config.json`'s ignore … the ignore is correct." The doc's header only disclaims the September heading and the date sweep, so item 4 reads as live and contradicts the winning doc.
- **Fix** — In engine-deep-audit:56 delete the sentence, or replace with "(the ignore is correct — `benchmarks/` is a private workspace member; road-to-oss §A0)". Do not restate the config elsewhere.

#### E1 row still says `createWebFrameRenderer` is not exported; it has shipped since 2026-07-09

- **Kind** — stale claim
- **Where** — docs/plans/game-migration-audit-2026-07.md:105-108 + docs/plans/todo.md:350
- **Says** — "E1 — engine-side: `render-web` XP2 row claims `createWebFrameRenderer` is exported; `packages/render-web/src/index.ts` exports only `loadCanvasKit`/`createWebSurface`/`createWebSkiaModule`/`createPostFxSurface`. Export it or correct the row."
- **Reality** — `packages/render-web/src/index.ts:3` is `export { createWebFrameRenderer } from './web-frame-renderer.js';` — landed in ff62507 (2026-07-09, "feat(engine,render-web): peer/skia decouple + web renderer (OSS-C1)"). todo.md:350 already records "OSS-C1 implemented + exported it … so the row's export claim now holds". road-to-oss:600-607 only asked to touch the E1 note in the STOP case; the ship case never closed the row here. The open row is the only forward-queue item left in this file, so a reader picks it up as work.
- **Fix** — Replace game-migration:105-108 with one line: "E1 — DONE 2026-07-09 by OSS-C1 (todo.md XP2 correction); no engine-side rows remain." Keep the resolution detail only in todo.md:350.

#### Private "full ledger" for the 2026-07-03 final audit is missing from `docs/plans/_local/`

- **Kind** — broken ref
- **Where** — docs/plans/engine-deep-audit-2026-07.md:8 + docs/plans/road-to-oss-2026-09.md:1286
- **Says** — "A 2026-07-03 final audit (road-to-oss §16) added launch-blocker rows on top of this pass; full ledger in `_local/final-audit-2026-07-03.md`."
- **Reality** — `ls docs/plans/_local/` (gitignored per `.gitignore:58`) holds only `deep-audit-2026-07-05.md`, `f3-tarball-audit.md`, `monetization-strategy-2026-07.md`, `oss-launch-audit-2026-07.md`. `git log --all -- docs/plans/_local/final-audit-2026-07-03.md` returns nothing (never committed, by design). SESSION_LOG.md:7464 records it as "NEW, private — full evidence ledger, NOT committed". The evidence behind launch-blocker rows B21–B24 (road-to-oss §16) is therefore unrecoverable on this machine; pre-flip-audit:52 expects auditors to cross-check against it.
- **Fix** — Either restore the file from a backup into `docs/plans/_local/`, or change both references to "ledger lost; road-to-oss §16 rows are the surviving record (re-verified against HEAD 2026-07-03)". Record the outcome once, in road-to-oss:1286, and make engine-deep-audit:8 a pointer to it.

#### Both bug ledgers carry 20+ fixed defects with no status and package-findings has no superseded header

- **Kind** — stale claim
- **Where** — docs/plans/package-findings-2026-07.md:3 (and :53-131) + docs/plans/engine-deep-audit-2026-07.md:24-45
- **Says** — Present-tense defects: share `capture.ts:41` FORMAT_CODES {png:3,jpeg:2}; ecs "queries only ever pushed, no removal API"; devtools `nextId` cast; pathfinding heap "never grows"; camera rotate contract break; scene never awaits onPreload; Signal no try/finally; engine barrel RN-only; testing `package.json` homepage → grzott/engine; haptics/tier-2 "0.2.0 adapter" promises; etc.
- **Reality** — All 20 ledger rows are DONE as OSS-B1…B20 in todo.md (2026-07-05 → 2026-09-02). Code: `packages/share/src/capture.ts:43` `{ png: 4, jpeg: 3 }` (6078b5a); `packages/ecs/src/world.ts:175` `removeQuery`, `:132` `forEachEntity` (47ad74f); `packages/devtools/src/hooks.ts:24` uses `forEachEntity`; `packages/pathfinding/src/astar.ts:80` heap doubles (911cb69, 2026-09-02); `packages/render/src/renderer.ts:8` `rotate(degrees…)` (3ab5f93); `packages/scene/src/scene-manager.ts:200` `await scene.onPreload?.()`; `packages/events/src/signal.ts:57` `finally`; `packages/engine/package.json:31` `./headless` subpath (360657d); `packages/testing/package.json:8` → grzott/flare-engine (5478900); `packages/haptics/README.md:3` ships Expo + Web adapters (7637296); no "0.2.0" left in leaderboards/achievements/analytics READMEs (8128b8b). engine-deep-audit:3 says "evidence ledger only", but package-findings:3…
- **Fix** — Add one header line to package-findings:3: "Snapshot of HEAD on 2026-07-02. Every bug row became an OSS-B row; status lives ONLY in todo.md/road-to-oss — do not re-verify or re-file from here." Do not add per-row status (that would mirror todo.md).

#### Plan A is fully executed (2026-08-15) but every step is still an unchecked `- [ ]` with no status banner

- **Kind** — stale claim
- **Where** — docs/plans/consumer-enablement-2026-08-tasks-a.md:3-5, :44, :57 (first checkbox; all 8 tasks unchecked through :1371)
- **Says** — Header instructs 'REQUIRED SUB-SKILL: … implement this plan task-by-task'; Task 1 says `perp`/`crossSV` 'Confirmed absent from packages/math/src/vec2.ts'; Task 3 says `createPostFxSurface` still builds via `MakeWebGLCanvasSurface` at `postfx-surface.ts:57`; Task 6 says `loader.ts:24` never clears `pending`; Task 8 says CODEOWNERS and the cfa CHANGELOG are to be created; Task 7 says render-web measures 21995 B against a 24195 ceiling.
- **Reality** — All eight tasks landed 2026-08-15: `6a10aa9 feat(math): add Vec2.perp and Vec2.crossSV`, `c57f760 fix(render-web): own the WebGL context and self-heal on loss`, `c5f1af0 chore(repo): add CODEOWNERS and the cfa changelog` (git log on the target paths). Code: vec2.ts:116 `perp`, :128 `crossSV`; postfx-surface.ts:110 `GetWebGLContext`, :158 `webglcontextlost` listener, :164 `fx.setBlendMode(kit.BlendMode.Src)`, :310 `isLost`; loader.ts:9 `LoadCanvasKitOptions`, :41-42 clears `pending` on rejection; tests/support/mock-kit.ts, .github/CODEOWNERS, packages/create-flare-app/CHANGELOG.md all exist. Both named changesets are gone (consumed by `905d4d4` 0.3.0 cut). todo.md:1503-1510 records 'CE-W1..W5 … (2026-08-15/16)'; dynamics-lift-2026-08-tasks.md:536-539 says 'Delivered ahead of this plan … commit 6a10aa9'. Internal refs are stale too: `.perf-baseline.json:299-303` is now ceiling 40947 /…
- **Fix** — Add a one-line banner under the title: 'EXECUTED 2026-08-15 — commits 6a10aa9, c57f760, c5f1af0; shipped in 0.3.0. Historical; do not re-run.' Tick or strip the checkboxes so `/start` and the executing-plans skill cannot pick it up again.

#### §11.4 XR-1 design SoT still says peer `>=3.19.1`, Reanimated 3 viable, old-arch claim 'stays true'

- **Kind** — stale claim
- **Where** — docs/plans/external-review-2026-08.md:609-614 (design item 1); also :667-668 (XR-1b step 4 'must show the react-native-reanimated: >=3.19.1 peer')
- **Says** — 'packages/react/package.json gains "react-native-reanimated": ">=3.19.1" — matching rn-skia's own floor, deliberately not >=4, so Reanimated 3 stays viable and packages/engine/README.md:42's old-architecture claim stays true.' todo.md:9-14 names this §11 as the SoT for 'the XR-1 design'.
- **Reality** — packages/react/package.json peerDependencies now carry `react-native-reanimated: >=4.0.0` and `react-native-worklets: >=0.7.0` (commit `7b4f56f` 2026-09-05, `feat(react): dispatch native capture via worklets scheduleOnUI`). docs/design/adr-0002-worklets-migration-and-new-arch-floor.md is Status: Accepted (owner, 2026-09-05), Consumer impact: breaking, and requires the New Architecture. packages/engine/README.md:40-44 now says '`@flare-engine/react` requires the New Architecture … Old-architecture support was dropped deliberately, in ADR-0002'. todo.md:532-548 (XR-13, session #318) records the peer move. The review never mentions ADR-0002 (grep: zero hits for `ADR-0002`, `>=4.0.0`, `scheduleOnUI`).
- **Fix** — Append a dated §11.4e 'Superseded by ADR-0002 (2026-09-05, XR-13)': peer floor is `react-native-reanimated >=4.0.0` + `react-native-worklets >=0.7.0`, Reanimated 3 / old architecture are no longer supported, the 'stays true' rationale is withdrawn; point to the ADR rather than restating its reasoning. Leave §11.4 item 1 as dated history with a one-word '(superseded — §11.4e)' marker.

#### AGENTS.md says 0.2.1 is on npm; the review, every manifest and the root CHANGELOG say 0.3.1

- **Kind** — contradiction
- **Where** — docs/plans/external-review-2026-08.md:12 + AGENTS.md:46
- **Says** — AGENTS.md:46: 'Status: 0.2.1 on npm (restricted)'. external-review:12: 'Measured at engine `516d313` (`0.3.1`, clean tree, `main`)'.
- **Reality** — `git log --oneline -1 516d313` → `chore(release): 0.3.1 — consumer-needs fixes and spatial hash` (2026-08-28); `905d4d4` = `chore(release): 0.3.0 lockstep across 42 packages` (2026-08-25). packages/react|math|render-web|create-flare-app/package.json all `"version": "0.3.1"`. Root CHANGELOG.md:4 names 'Flare 0.3.1'. todo.md:50 says 'published pre-XR-1a `0.3.1`'. AGENTS.md is two releases behind and is loaded into every session (the orchestrator brief for this audit itself said 0.3.0).
- **Fix** — Edit AGENTS.md:46 to '0.3.1 on npm (restricted)' — or, to stop the drift class, replace the literal with 'current version: see CHANGELOG.md' so the version has one source (the lockstep manifests / root CHANGELOG).

#### §11.7 PERF-7 still specs a TestingBot revival the owner retired for a local adb-attached phone

- **Kind** — stale claim
- **Where** — docs/plans/perf-measurement-2026-07.md:771-801 (items 4 and 7: lines 792-794, 799-800); mirrored at docs/plans/todo.md:284
- **Says** — PERF-7 revives the device lane per B21 order: 'TestingBot account/plan/device-catalog verification FIRST → ... → weekly cron'; owner OOB = 'engine-repo TESTINGBOT_KEY/SECRET + BENCH_APK_URL; TestingBot account/credits'.
- **Reality** — todo.md:1531-1536 (PERF-6 Done entry) records the owner's 2026-08-18 decision to get real mobile numbers 'via a locally adb-attached Pixel ... instead, web lane first, then apps/bench-native (PERF-7); that likely retires the TestingBot spend entirely.' That lane exists and is published: this file's own §12 F1 (lines 1001-1012) describes the adb-attached driver, and benchmarks/results/web-android.json carries 18 records with "model": "Pixel 7" (benchmarks.md:280, captured 2026-09-06). apps/bench-native and .github/workflows/perf-bench.yml do not exist (ls). A builder picking PERF-7 today would start with a TestingBot account audit the owner has abandoned.
- **Fix** — Re-scope §11.7 against the adb-attached lane: bench-native drives the same USB Pixel 7 through `preflightAndroid()`-style checks; drop or mark conditional items 4 and 7 (TestingBot verification, TESTINGBOT_KEY/SECRET, BENCH_APK_URL, cloud cron) and replace the 'weekly cron' with the local scheduled-script runner §11.5b already decided. Update the todo.md:284 pointer text to match.

#### §11.9 PERF-9 items 2-3 already shipped by CW7-8; O(n²) premise and all line anchors are gone

- **Kind** — stale claim
- **Where** — docs/plans/perf-measurement-2026-07.md:962-991 (items 2-3 at 974-980; title at 962; B27 at 371); mirrored at docs/plans/todo.md:285 and :310-311
- **Says** — PERF-9 replaces `entries.find((e) => e.item === item)` at spatial-index.ts:49-51 with a Map index and stops destructuring `[entityA, entryA]` at collision-world.ts:137; B27 calls the broadphase 'brute-force' and the row 'O(n²) update'; pair buffers at collision-world.ts:56-60,:133-135.
- **Reality** — `git log -S'entries.find' -- packages/physics/src/spatial-index.ts` and `git log -S'[entityA, entryA]' -- packages/physics/src/collision-world.ts` both show b617e49 (2026-08-27, 'perf(physics): uniform spatial hash broadphase, surface frozen', CW7-8) as the removing commit. Current spatial-index.ts uses `_slots = new Map<T, number>()` (update() at :53-54 is an O(1) slot lookup) and a `_cells` spatial hash (:52); collision-world.ts:142-143 iterates `this.entries.values()` and reads `entryA.entity`; pair buffers now sit at :63-65 and :139-140. Only items 1 (Hermes verify), 4 (pair-Set swap) and 5 (re-measure) remain. todo.md:310 still says 'PERF-9 separately owns ... SpatialIndex.update's per-entity closure and O(n) find, which this row did not touch' — contradicted by the diff.
- **Fix** — Strike items 2-3 as 'done in CW7-8 (b617e49)', retitle the row to the pair-Set allocation (B27 item 4), re-anchor the remaining line refs (collision-world.ts:63-65, :139-140), note that the 38x footprint figure predates the spatial-hash broadphase and must be re-measured before item 4 is decided; fix todo.md:285 and :310-311 to match.

#### Routing/sequencing paragraph is mirrored in todo.md and both copies are stale

- **Kind** — one-source violation
- **Where** — docs/plans/perf-measurement-2026-07.md:8-9 and :379-385 + docs/plans/todo.md:255; also :288 ('pending PERF-6/PERF-7')
- **Says** — 'PERF-1→5 are the pre-freeze must ... PERF-8 is cheap and pre-freeze-preferred; PERF-6/7 slide post-flip if the calendar tightens, with PERFORMANCE.md declaring the blank'; '§10 adds findings B11–B26'. todo.md:255 restates the same routing, sequencing and 'B11–B26' near-verbatim.
- **Reality** — PERF-1, 2, 3, 4a, 5, 8, 10, 11 closed 2026-07-28..30 (todo.md:1538-1545, this file §11.4a/§11.5/§11.8/§11.10/§11.11 DONE markers); PERF-6 delivered 2026-08-16 (todo.md:1521; this file :114 and :247). §10's table runs to B29 (:371-373), not B26. The only open Arc PERF rows are PERF-17, 4b, 14b, 7, 9 (todo.md:257-285). Two copies of the same paragraph have drifted identically stale — exactly the mirror-row failure the repo rule forbids.
- **Fix** — Keep one copy: reduce todo.md:255 to a one-line pointer at §11, and rewrite §11's preamble to the current state (done rows listed by section; open rows 4b/7/9/14b/17 with their pre-/post-flip status). Change 'B11–B26' to 'B11–B29' at :9 and :351; change :288 'pending PERF-6/PERF-7' to 'pending PERF-7 (web delivered by PERF-6/13)'.

#### check:bump will refuse the OSS-H1 freeze minor as the plans currently specify it

- **Kind** — gap
- **Where** — docs/plans/versioning-and-announcements.md:51-55 + docs/plans/flip-runbook.md:135-136 (spec being acted on: docs/plans/road-to-oss-2026-09.md:1125-1127, docs/plans/todo.md:297)
- **Says** — "Land pre-freeze minors as unreleased changesets that ride into 0.4.0"; H1 = "author ONE changeset (minor, lockstep …); bun run version"; the runbook describes `bun run version` as running `changeset version` and `concretize-workspace-deps` only.
- **Reality** — package.json:52 `"version": "bun run check:bump && changeset version && …"` (51de0e2, 2026-09-05, after every H1/runbook edit). scripts/check-bump-level.mjs:128-155 exits 1 for ANY above-patch changeset that cites no `Status: Accepted` ADR; there is no env override. docs/design/ holds only adr-0001/0002/0003 — none covers the 0.4.0 cut. Of the 14 pending changesets only `.changeset/xr13-worklets-scheduleonui.md` is minor and it cites ADR-0002; an H1 lockstep minor authored per spec cites nothing and fails the gate on Oct 5. Neither the H1 row, versioning §Reserved numbers, nor runbook step 5 mention `check:bump`.
- **Fix** — In versioning §Reserved numbers and the H1 row state how the freeze minor is authorised: either the ADR-backed minor already pending (xr13/ADR-0002) carries the bump and the H1 summary changeset is `patch`, or the H1 changeset must cite an accepted ADR written beforehand. Amend flip-runbook step 5 to say `bun run version` runs `check:bump` first.

#### "1.0.0 is the public launch" contradicts the runbook's 0.4.x public release

- **Kind** — contradiction
- **Where** — docs/plans/versioning-and-announcements.md:56 (and :51) + AGENTS.md:23 vs docs/plans/flip-runbook.md:120-123 and :202
- **Says** — versioning:51 "0.4.0 is the freeze/launch cut"; versioning:56 "1.0.0 is the public launch … never a routine cut"; AGENTS.md:23 "(0.4.0 = freeze cut, 1.0.0 = launch)".
- **Reality** — flip-runbook step 4/5: the flip adds "a version-bump-only lockstep patch changeset" and re-cuts the group public as 0.4.x; :202 "fixes go out as 0.4.x patches"; manual-test-protocol:159 same; road-to-oss:34-36,41 "Everything pre-flip ships as one 0.4.0 … The flip makes existing versions public", "0.4.0 as the freeze/launch cut". scripts/check-bump-level.mjs:12 treats a major as a "stray". Within versioning the word "launch" is assigned to both 0.4.0 and 1.0.0; both files were written in the same commit a1c0af4 (2026-09-05).
- **Fix** — Define the terms once in versioning §Reserved numbers: October flip = the 0.4.x public re-cut (runbook step 5); 1.0.0 is reserved and unscheduled and is never the flip cut. Change AGENTS.md:23 to "0.4.0 = freeze cut, 1.0.0 = reserved".

#### flip-runbook step 4 still says 40 packages; 41 restricted manifests exist

- **Kind** — stale claim
- **Where** — docs/plans/flip-runbook.md:111-113 and :115
- **Says** — "changeset publish would skip the 40 already-published scoped packages"; "Agent: packages/*/package.json — 40× \"publishConfig\": { \"access\": \"restricted\" } → \"public\"".
- **Reality** — `grep -l '"access": *"restricted"' packages/*/package.json | wc -l` = 41 (dynamics added 2026-08-16; all 42 dirs at 0.3.1). Commit f016c2e (2026-08-19, "correct the flip-runbook package counts") updated step 3 ("41 scoped", "exactly 41") and step 5 ("all 42") but left step 4's two 40s. A per-package publishConfig overrides `.changeset/config.json`, so one manifest left restricted publishes restricted after the flip.
- **Fix** — Step 4: "41 already-published scoped packages" and "41× publishConfig … → public"; add a verify line: `grep -L '"access": "public"' packages/*/package.json` prints nothing.

#### Consumer-enablement's pre-flip bake objective is now silently post-flip in todo

- **Kind** — contradiction
- **Where** — docs/plans/consumer-enablement-2026-08.md:8-12 and :241-247 vs docs/plans/todo.md:294 (and :225-229)
- **Says** — "This release makes both consumers real, then lets them bake for the weeks before the flip"; W7 (page D3 swap + portfolio dynamics swap) follows W6 in §10.
- **Reality** — W6 cut 2026-08-25 (905d4d4). As of 2026-09-06 CE-W7 (page) and DYN-2 (portfolio) are open (todo.md:225-229, :231), todo.md:294 classes "CE-W7/W8, DYN-2/3 … explicitly post-flip-acceptable", and versioning-and-announcements.md:41-43 records the portfolio is not present in the workspace. `render-web` and `dynamics` still have no consumer running them; the doc's decision 1 ("pre-freeze, not post-flip") has been reversed without an owner note.
- **Fix** — Add a status header to consumer-enablement recording the owner call: either W7 (page D3 + DYN-2) becomes a dated pre-freeze row and todo.md:294 is corrected, or the objective is amended to "post-flip" and §10 W7 says so. One decision, one place.

#### §2.5 'No changesets per row; one minor lands in H1' contradicts the live changeset gates

- **Kind** — contradiction
- **Where** — docs/plans/road-to-oss-2026-09.md:111 vs docs/plans/todo.md:20-22 + scripts/check-changeset.mjs:2-13 + docs/plans/versioning-and-announcements.md:51-55
- **Says** — "No changesets per row; one minor changeset lands in OSS-H1 (lockstep). No publishes mid-arc" — builders are told not to write changesets.
- **Reality** — Per-row changesets are mandatory and already the practice: `scripts/check-changeset.mjs` fails any publishable `src/**` change without a covering changeset; `.changeset/` holds 16 pending per-row files at HEAD 0b613e4 (oss-b18, oss-b23b, oss-m7, oss-m8, oss-m8b, oss-m9, oss-m11, xr1*, xr7, xr12, xr13); todo.md Arc XR header (:20-22) sets the rule "patch while 0.3.x is the line ... minor once that line opens, never major"; AGENTS.md makes patch the default and `check:bump` refuses anything above patch without an Accepted ADR; versioning-and-announcements.md:53-54 says pre-freeze minors ride as unreleased changesets into 0.4.0. 0.3.0 itself consumed 51 per-row changesets (905d4d4).
- **Fix** — Rewrite §2.5 to: every row that changes `packages/*/src/**` lands its own changeset (patch by default; minor only when it cites an Accepted `ADR-NNNN`, per `check:bump`); H1 consumes the pending set via `bun run version` — no omnibus changeset. Keep the F2/I1 publish exemptions.

#### H1 spec tells the freezer to hand-author the 0.4.0 minor; the minor is already pending and ADR-gated

- **Kind** — stale claim
- **Where** — docs/plans/road-to-oss-2026-09.md:1127-1130 (also :34-36 and todo.md:317)
- **Says** — H1: "author ONE changeset (minor, lockstep — summary assembled from the Arc B/C/M intentional-change notes in todo rows); `bun run version` ... owner publishes 0.4.0"; §0.5: "the peer-floor bump alone forces the minor".
- **Reality** — The Arc B/C/M changesets were consumed by the 0.3.0 cut (commit 905d4d4 "0.3.0 lockstep across 42 packages", 51 changesets; 0.3.1 followed 2026-08-27, tags `@flare-engine/ui@0.3.0/0.3.1`), so there are no B/C/M notes left to assemble. The 0.4.0 minor already exists: `.changeset/xr13-worklets-scheduleonui.md` (react + engine: minor, "Per ADR-0002"; ADR-0002 Status Accepted 2026-09-05). `bun run version` is now `bun run check:bump && changeset version && concretize && bun install` (package.json:52) and `scripts/check-bump-level.mjs` refuses any above-patch changeset that does not cite an Accepted ADR — the H1 row never mentions this gate. The C1 peer-floor bump shipped in 0.3.0, so it no longer 'forces' 0.4.0's minor; XR-13/ADR-0002 does.
- **Fix** — Rewrite H1 bullet 1: verify the pending `.changeset/` set contains at least one minor citing an Accepted ADR (today xr13 → ADR-0002); do NOT author an omnibus changeset; run `bun run version` (check:bump gate runs first); then the restricted publish. Rewrite §0.5's rationale to name ADR-0002 as what opens 0.4.0. Mirror the same one-line fix on todo.md:317.

#### F1/F2/F3/§13/C3 still count 40 scoped packages; dynamics made it 41 (42 dirs) and the runbook was already corrected

- **Kind** — contradiction
- **Where** — docs/plans/road-to-oss-2026-09.md:997,998,1000,1003,1011,1021,1024,1054,1220,1532 vs docs/plans/flip-runbook.md Step 3 ('41 scoped', 'exactly 41') and Step 5 ('all 42')
- **Says** — "npm access set status=public over the 40 scoped packages", "40× publishConfig.access", "skip the 40 already-published", "release for all 41", "dry-run mode lists exactly the 40 scoped names", "publish ALL 41 (40 scoped + create-flare-app)", "all 41 manifests", "all 40 names", "per-package config ×40", "LAYER_MAP filled to all 40 scoped".
- **Reality** — `ls packages` = 42 dirs (41 scoped + create-flare-app); `@flare-engine/dynamics` landed DYN-1 2026-08-16 and shipped in 0.3.0 (roadmap.md:14, architecture.md:11 "42 package dirs — 41 scoped"). `scripts/flip-access.mjs` derives the set from `packages/*` at runtime, so its dry run prints 41 — F1's done-when ("exactly the 40 scoped names") would read as a script bug. flip-runbook.md was corrected to 41/42 in f016c2e (2026-08-19, 'correct the flip-runbook package counts'); this file was not.
- **Fix** — Sweep the listed lines to 41 scoped / 42 total (F1 done-when: "lists exactly the 41 scoped names"; F2: "ALL 42 (41 scoped + create-flare-app)", "all 42 manifests"; F3: "all 41 names"; §13: "×41"). Leave the D5 :937 wording as historical or update to 42/41.

#### F3 audits only 0.1.0–0.2.1; 0.3.0 and 0.3.1 are now published and no re-run is scheduled before the flip

- **Kind** — stale claim
- **Where** — docs/plans/road-to-oss-2026-09.md:1050-1051 (also :1064, :1418-1419) + scripts/audit-tarballs.mjs:58
- **Says** — "The access flip exposes all previously published versions (0.1.0, 0.2.0, 0.2.1) retroactively — audit them, not just 0.4.0."
- **Reality** — 0.3.0 (2026-08-25, 905d4d4) and 0.3.1 (2026-08-27) are on the registry restricted (git tags `@flare-engine/ui@0.3.0`, `@0.3.1`; roadmap.md:14; todo.md:217). OSS-F3 ran 2026-07-24 (session #256, todo.md:1548) before either cut — the authenticated published-version half covered three versions × 40 names. CI's `check:tarballs` (ci.yml:62) is `--head-only`. `PUBLISHED_VERSIONS_EXPECTED = ['0.1.0','0.2.0','0.2.1']` (audit-tarballs.mjs:58) is the fallback when `npm view` fails. flip-runbook pre-flight still shows `[ ] F3 done`, yet todo.md's 2026-09-01 recompute (:298) lists only XR-1b/1c/2/6, F4, H1 as remaining — nothing re-runs the published half over 0.3.x + dynamics.
- **Fix** — Update the F3 row to the five published versions (0.1.0, 0.2.0, 0.2.1, 0.3.0, 0.3.1; dynamics absent before 0.3.0 → n/a) and add a bullet: "re-run the authenticated published-version half at freeze (Oct 2–5, with F4); `PUBLISHED_VERSIONS_EXPECTED` extended to the 0.3.x line". File the re-run as a todo row so the runbook's `F3 done` box has an owner.

#### XR-7 is fully landed and green in the tree but the Active row still says it is open

- **Kind** — stale claim
- **Where** — docs/plans/todo.md:85 (also :93-99, :104-116)
- **Says** — "CODE LANDED (`0ef1aec`); the row stays open ONLY for the baseline re-capture"; the retune is "session #319, uncommitted at time of writing"; the captures in history.ndjson "predate the retune, so fresh ones are required"; `baseline.test.ts` "is red until a promote"; the close sequence (commit retune → 5x bench:pinned → promote → md) is still to do; the tail (:104-116) still lists "Two blockers before this is plannable".
- **Reality** — Every step of the close sequence has landed. Retune committed as 87527aa (2026-09-06 14:56, ecs.bench.ts + scenarios/ecs.ts). Re-capture committed as e7e169e (2026-09-06 21:42) touching all 8 lane files: benchmarks/results/microbench.json now has gitSha fd8df7648783, runs 5, gitDirty false and all four `ecs.churn` rows; web.json, web-gpu.json and web-android.json each carry commit fd8df7648783 with runs 5; docs/references/benchmarks.md is rendered at fd8df76 and lists ecs.churn 500/1000/2000/5000 at lines 63-66. `bun scripts/check-perf-freshness.mjs` run read-only at HEAD: "OK — 5 suite(s) captured at fd8df7648783 still describe HEAD", exit 0. todo.md was last touched at fd8df76, i.e. before the re-capture, so the row was never updated. (baseline.test.ts not executed per audit rules; its contract check compares the promoted baseline to scenario-contract.ts, which now lists the churn…
- **Fix** — Move XR-7 to Done with the closing facts (87527aa retune, e7e169e 8-lane re-capture at fd8df76, freshness green with no override, churn 5000 entities 664→154 µs A/B, ADR-0003). Delete the "uncommitted"/"red until a promote"/"Sequence to close" text and the superseded "Two blockers before this is plannable" tail; keep only the tier-1 8-lane scope warning as a one-line note (or move it to perf-measurement-2026-07.md).

#### XR-1 Active row asserts the reanimated floor is >=3.19.1 / old-arch kept; XR-13 and the tree say >=4 / old-arch dropped

- **Kind** — contradiction
- **Where** — docs/plans/todo.md:29-31, :59, :70-72 + docs/plans/todo.md:532-545 (XR-13 Done)
- **Says** — "`\"react-native-reanimated\": \">=3.19.1\"` is declared as a required peer (`package.json:57`)"; design: "Declare `>=3.19.1` (rn-skia's own floor, not `>=4` — keeps Reanimated 3 and the old-architecture claim alive)"; residue: "the old-architecture claim is now qualified in both shipped READMEs ... to match ADR-0001's finding" (i.e. 'intended but not verified').
- **Reality** — XR-13 (commit 7b4f56f, session #318, ADR-0002 Status: Accepted 2026-09-05) reversed all three the same day the residue closed. packages/react/package.json peerDependencies now: `react-native-reanimated: >=4.0.0` and `react-native-worklets: >=0.7.0`. packages/react/README.md:13-17 and packages/engine/README.md:38-44 now say "The New Architecture is required" / "Old-architecture support was dropped deliberately, in ADR-0002" — the 'intended but not verified' wording the XR-1 residue claims to have shipped no longer exists. game-view.tsx:17,261 imports `scheduleOnUI` from react-native-worklets. The Done XR-13 row records this correctly; the Active XR-1 row was never reconciled.
- **Fix** — Rewrite XR-1's current-state paragraph to name the final peer floor (`>=4.0.0` + worklets `>=0.7.0`, ADR-0002, New-Arch required) and mark the `>=3.19.1` / old-arch-kept / 'qualified README' statements as superseded by XR-13, or move the entire XR-1 history to Done and leave one Active line for the owner-owed npm half (b).

#### Pending XR-1 changeset still ships the '>=3.19.1 / old-arch intended' story XR-13 reversed

- **Kind** — one-source violation
- **Where** — .changeset/xr1-old-arch-claim-qualified.md:1-13 + .changeset/xr13-worklets-scheduleonui.md:1-16; docs/plans/todo.md XR-1 (residue) Done row and the Active XR-1 row (Active XR-1 'RESIDUE CLOSED' sentence)
- **Says** — XR-1 residue (DONE 2026-09-05, #317): both shipped READMEs 'now qualify it [old-architecture support] and link the ADR [0001]', changeset engine+react patch. That changeset text says the `react-native-reanimated >=3.19.1` and `react-native >=0.79` floors 'are chosen to keep old-architecture apps viable' and the READMEs 'now say intended but not verified'.
- **Reality** — Same day, XR-13 (todo.md:532-559, commit 7b4f56f) raised the peers to reanimated >=4.0.0 + worklets >=0.7.0 and dropped old-arch support. Tree: packages/engine/README.md:38-44 and packages/react/README.md:13-19 say 'The New Architecture is required' and link ADR-0002 only — `grep ADR-0001 packages/{engine,react}/README.md` returns nothing. Both changesets are still pending under lockstep `fixed` (.changeset/config.json), so the 0.4.0 freeze cut (OSS-H1) will generate two contradictory entries in the same package CHANGELOGs, one describing a peer floor that no longer exists. check:changeset gates coverage only, so nothing catches it.
- **Fix** — Delete .changeset/xr1-old-arch-claim-qualified.md (engine + react stay covered by xr13-worklets-scheduleonui.md, so check:changeset still passes) or fold its one surviving fact (ADR-0001 §5 reverser struck) into the xr13 changeset. Append 'Superseded 2026-09-05 by XR-13: READMEs now state New Architecture required, link ADR-0002' to todo.md:608 and to the RESIDUE CLOSED sentence at todo.md:59.

#### XR-7 is fully landed (re-capture in e7e169e) but the Active row still says open

- **Kind** — unverifiable DONE
- **Where** — docs/plans/todo.md:84-99 (XR-7 Active row) + todo.md:471-473 (PERF-18 gate sentence)
- **Says** — XR-7: 'CODE LANDED 2026-09-05 (0ef1aec); the row stays open ONLY for the baseline re-capture … committed baseline predates the four ecs.churn rows, so baseline.test.ts is red until a promote. The scenarios were retuned afterwards (session #319, uncommitted at time of writing) … Sequence to close: commit the retune, then 5x bench:pinned -> bench:promote -> bench:md.' PERF-18 (DONE 2026-09-06): 'Gate green except the pre-existing XR-7 baseline-contract test … and check:perf-freshness, red before this session and unchanged in kind by it.'
- **Reality** — Everything the row lists as remaining is in HEAD: the retune is committed (87527aa 'chore(bench): pool churn payloads, stabilise sample sizes' — benchmarks/src/ecs.bench.ts + scenarios/ecs.ts), and e7e169e 'chore(bench): re-capture all lanes at fd8df76' rewrote benchmarks/results/microbench.json (gitSha fd8df7648783, gitDirty false, runs 5) with all four `ecs.churn` rows (:78/:91/:104/:117) matching EXPECTED_SCENARIOS in benchmarks/src/scenario-contract.ts:29-36, plus web.json / web-gpu.json / web-android.json and docs/references/benchmarks.md:63-66. The only commits after fd8df76 touch results and docs/plans, so baseline.test.ts's contract check and check:perf-freshness have nothing left to be red about (gates not re-run here — read-only audit).
- **Fix** — Move XR-7 to Done citing 0ef1aec (code), 87527aa (retune), e7e169e (8-lane re-capture); delete the 'uncommitted at time of writing' paragraph and the 'Sequence to close' list. Append to PERF-18 at todo.md:473: 'both cleared by the e7e169e re-capture the same day'. Keep the EIGHT-lanes scope warning as a general note (memory tier1_change_stales_all_lanes), not as XR-7 residue.

#### "B/C/D/M launch rows all shipped in 0.3.0" is false: 7 M/B rows landed after 0.3.1, unreleased

- **Kind** — stale claim
- **Where** — docs/plans/todo.md:294
- **Says** — "Recomputed 2026-09-01 ... The B/C/D/M launch rows all shipped in `0.3.0`; what is left above the freeze line is XR-1b, XR-1c, XR-2, XR-6, OSS-F4, OSS-H1."
- **Reality** — 0.3.0 = 905d4d4 (2026-08-25), 0.3.1 = 516d313 (2026-08-28). After that tag: OSS-B23b 4ac7c58 (09-02), OSS-B18 911cb69 (09-02), OSS-M7 15424ba (09-03), OSS-M8 2740004 + M8b ddd8116 (09-03), OSS-M9 da81c97 (09-03), OSS-M11-additive b5d0a97 (09-04). All seven sit as PENDING patch changesets in .changeset/ (oss-m7-*, oss-m8-*, oss-m8b-*, oss-m9-*, oss-b18-*, oss-b23b-*, oss-m11-*); CHANGELOG.md 0.3.1 section (lines 25-44) lists none of them. They are Done rows (todo.md:755-950) but have never been published; the freeze/manual-test plan that assumes the owner tests a published 0.3.x containing them is wrong until H1 cuts 0.4.0.
- **Fix** — Rewrite the paragraph: "B/C/D rows shipped in 0.3.0/0.3.1; M7, M8, M8b, M9, B18, B23b and M11-additive are landed but UNRELEASED (patch changesets pending) and ride into 0.4.0 at H1 — 16 changesets pending at HEAD." Add a line to the OSS-H1 row that the freeze cut folds those seven plus the XR set.

#### Same paragraph names XR-1b/XR-1c/XR-6 as remaining and XR-1c as the binding constraint; all closed

- **Kind** — contradiction
- **Where** — docs/plans/todo.md:294 + docs/plans/todo.md:45-58, docs/plans/todo.md:979
- **Says** — "what is left above the freeze line is XR-1b, XR-1c, XR-2, XR-6, OSS-F4, OSS-H1 ... The calendar is no longer the binding constraint — XR-1c is, because it needs a physical Pixel 7 and neither of XR-1's two required verification halves has evidence yet."
- **Reality** — Same file, XR-1 row: "XR-1b DONE 2026-09-01, session #299" (:45), "RESOLVED 2026-09-01, session #300 ... Device-verified on the Pixel 7" (:52-54), "RESIDUE CLOSED 2026-09-05, session #317 ... XR-1 is therefore no longer a launch-blocker" (:56-58); commits a630580, 7b4f56f, 14ed248, 96f6893. XR-6 is a Done entry at todo.md:979 (session #305, c5a6310). HEAD is session #320 (2761ec5, e7e169e); the paragraph says "#297 is the last landed".
- **Fix** — Recompute at HEAD: remaining above the freeze line = OSS-F4, OSS-H1, the owner-owed XR-1 half (b) (npm-install probe), and the P2 cut-line (M10, M11 boundary bullet). Delete the "XR-1c is the binding constraint" sentence and the "#297 is the last landed" stamp, or date the paragraph and keep it short enough to re-stamp every close.

#### OSS-H1's "one lockstep minor changeset" is silent on the ADR that check:bump now demands

- **Kind** — gap
- **Where** — docs/plans/todo.md:297 + docs/plans/road-to-oss-2026-09.md:1125-1130
- **Says** — H1: "FREEZE: one lockstep minor changeset + 0.4.0 restricted publish"; spec: "author ONE changeset (minor, lockstep — summary assembled from the Arc B/C/M intentional-change notes); `bun run version`". Neither mentions an ADR.
- **Reality** — 51de0e2 (2026-09-05) added scripts/check-bump-level.mjs: any changeset above patch must cite an `ADR-NNNN` whose Status is Accepted (isAccepted regex, :50-57), no env override. It runs inside `bun run version` (package.json:52: "check:bump && changeset version ..."), in CI (.github/workflows/ci.yml:33) and in .claude/hooks/verify.sh:90. versioning-and-announcements.md:46 says "Record the obligation on the row in todo.md when the ADR is accepted, so it is not discovered at freeze time" — nothing is recorded on H1. Today the tree passes only because .changeset/xr13-worklets-scheduleonui.md (minor, react+engine) cites ADR-0002 (Accepted 2026-09-05, Consumer impact: breaking); H1's own freeze changeset will be refused unless it cites one too. Separately, Arc XR's header (todo.md:20-22) still says "Changeset level: patch while 0.3.x is the line — a minor would open 0.4.0 early" while that…
- **Fix** — On the H1 row and in §11 H1: name the ADR the freeze changeset cites (ADR-0002, or a new ADR-000N "0.4.0 freeze cut" written from adr-0000-template.md and accepted before Oct 5), note that check:bump runs inside `bun run version`, and record the ADR-0002 posting obligation (flare-engine-page + portfolio) on the row per versioning-and-announcements.md:36-46. Update the Arc XR header's changeset-level sentence to the versioning doc's rule.

#### M11/PERF-9/HYG5 still owe SpatialIndex.update's "per-entity closure + O(n) find"; CW7-8 already fixed it

- **Kind** — stale claim
- **Where** — docs/plans/todo.md:308-309 (M11 bullet) + docs/plans/todo.md:285 (PERF-9) + docs/plans/todo.md:334 (HYG5)
- **Says** — M11: "PERF-9 separately owns what CW7-8 did *not* touch: `SpatialIndex.update`'s per-entity closure and O(n) find." PERF-9: "`SpatialIndex.update`'s per-entity closure + O(n) find; `entries` destructuring in the broadphase loop; the reused pair-`Set`". HYG5: "`SpatialIndex` Map-keyed O(1) update/remove".
- **Reality** — b617e49 (CW7-8, 2026-08-27, in 0.3.1) replaced both. Pre-commit (b617e49^ spatial-index.ts:38,:50): `this.entries.findIndex((e) => e.item === item)` / `this.entries.find((e) => e.item === item)` — the closure + O(n) find. HEAD packages/physics/src/spatial-index.ts:51 `_slots = new Map<T, number>()`, :76-79 and :92-94 `this._slots.get(item)` — Map-keyed O(1); docstring :44 says so. The broadphase-loop destructuring (`for (const [entityA, entryA] of this.entries)` at 47ad74f) became `for (const entryA of this.entries.values())` (collision-world.ts:142) in the same commit. Only PERF-9's pair-Set swap survives (collision-world.ts:63-65,:139,:199). The ledger line the rows derive from (_local/deep-audit-2026-07-05.md:122 "spatial-index.ts:37-73 O(n) find ... Map-key → O(1)") is exactly what CW7-8 shipped.
- **Fix** — Strike the SpatialIndex sentence from the M11 bullet, strike "per-entity closure + O(n) find" and "`entries` destructuring" from PERF-9 (re-scope PERF-9 to the JSC pair-Set finding only, citing b617e49 for the rest), and strike "`SpatialIndex` Map-keyed O(1) update/remove" from HYG5.

#### bench:promote's power-plan and CPU-pinning refusals are dead code; current baseline is an unpinned fold

- **Kind** — unverifiable DONE
- **Where** — benchmarks/src/promote.ts:111 (early return) + :204 / :227 (pushes into `problems` after it) + :243 / :273 / :279 (later returns read only `environment` / `unstable`); claims at docs/plans/todo.md:1392-1403 (PERF-14 Done) and benchmarks/src/index.ts:713 ("warn here, refuse at promote")
- **Says** — PERF-14 Done: "`benchmarks/src/power.ts` ... refuses a capture under Power saver, and `promote` refuses a window whose runs disagree on it"; commit 6b12524 "feat(bench): refuse unpinned captures on a hybrid CPU"; affinity.ts:18 "recorded on every capture, and refused at promote".
- **Reality** — `aggregateRuns` returns on `problems` once at promote.ts:111; the power loop (:196-206) and affinity loop (:207-227) push into `problems` AFTER that check and nothing reads it again — both refusals have been unreachable since 5be8ce7 (2026-08-19) inserted the loop below the early return (diff verified) and 6b12524 copied the pattern. `sharedField` (:67-71) never compares `powerSchemeGuid`, so "disagree on it" was never implemented. No test covers either (promote.test.ts: zero hits for power/affinity). Proven live: the committed `benchmarks/results/microbench.json` (generated 2026-09-06T19:21, gitSha fd8df76, runs 5, aggregatedFrom = the last five history.ndjson rows) folds five runs recording `affinityMask 0xffffffff / affinityCpus 32 / hostPhysicalCores 24 / hostLogicalCpus 32` — exactly the input `judgeAffinity` (affinity.ts:96-108) returns `refuse` for — while every prior published…
- **Fix** — Add `if (problems.length > 0) return { ok: false, problems };` after the affinity loop (or push both verdicts into `environment`); add `powerSchemeGuid` to the `sharedField` set; add two mutation-verified promote tests (a Power-saver run refused; an unpinned 24c/32t run refused). Then re-capture the node lane pinned (`bench:pinned` x5 → `bench:promote` → `bench:md`) before the freeze, and decide whether the web lanes (also 0xffffffff on every capture, recorded-only) need the same rule.

#### The 2026-09-06 node re-capture (e7e169e) is off-protocol and recorded nowhere

- **Kind** — gap
- **Where** — benchmarks/results/history.ndjson (last 5 rows, sha fd8df76); docs/references/benchmarks.md:5; docs/plans/todo.md:84-97 (XR-7) + :672-676 (2026-09-05 re-capture Done); SESSION_LOG.md:11949-11995
- **Says** — XR-7 (todo.md:84-97): "Sequence to close: commit the retune, then 5x `bench:pinned` -> `bench:promote` -> `bench:md`"; the retune is "uncommitted at time of writing" and baseline.test.ts is red. 2026-09-05 Done: captures "pinned to 16 P-core threads ... 5.9% foreign load".
- **Reality** — 87527aa (2026-09-06) committed the retune and e7e169e re-captured all lanes at fd8df76 — microbench.json now carries the four `ecs.churn` rows, so the baseline-contract test XR-7 owns is satisfied and the XR-7 text is stale. But the window was taken unpinned (mask 0xffffffff, not `bench:pinned`), one of its five runs hit 12.15% foreign load and read `render.flush 1000 / 1 atlas` 51.08 µs and `integration.frame 1000` 672 µs against ~22.5 / ~395 µs in the other four (the PERF-14b straddle shape, absorbed by the one-outlier allowance), and benchmarks.md:5 now publishes "Foreign load: 12.2%". No Done row mentions fd8df76/e7e169e (grep: 0 hits) and the session-320 block predates it (still says perf-freshness red), so the capture that cleared the 8-lane debt has no record.
- **Fix** — Record the fd8df76 capture in `## Done` (unpinned, 12.2% load, superseded) or in XR-7's close; rewrite XR-7's "what is left" to the single remaining step — a pinned node re-capture — and drop the "uncommitted" sentence; after issue 1's fix, redo the node lane pinned and hand-write the SESSION_LOG block verify.sh never appended.

#### AGENTS.md still says the published line is 0.2.1; it is 0.3.1

- **Kind** — stale claim
- **Where** — AGENTS.md:46 (vs CHANGELOG.md:17, docs/plans/roadmap.md:14)
- **Says** — AGENTS.md:46: "Status: 0.2.1 on npm (restricted)".
- **Reality** — All 42 package.json files read "version": "0.3.1" (create-flare-app too). Git tags @flare-engine/*@0.3.0 -> 905d4d4 (2026-08-25) and @0.3.1 -> 516d313 (2026-08-28, "chore(release): 0.3.1"). CHANGELOG.md:17-18 indexes 0.3.1/0.3.0; roadmap.md:14 says "Current line 0.3.1". AGENTS.md is imported by CLAUDE.md, so every agent session reads the wrong line.
- **Fix** — Remove the number from AGENTS.md:46 and point at the owner: "Status: published restricted; current line = top row of CHANGELOG.md". Do not restate the version anywhere that is not the CHANGELOG index.

#### Tier assignment for 11 packages differs across five maps; only LAYER_MAP is enforced

- **Kind** — contradiction
- **Where** — scripts/check-deps-tiers.mjs:37-84 (LAYER_MAP) vs docs/design/architecture.md:17-57,244-260 vs README.md:27-47,89-98 vs docs/design/api-specs.md:445,605,644-711,739,789,816,910,960 vs docs/plans/roadmap.md:24-35
- **Says** — Five documents each carry a full tier map and they disagree on where haptics, cli, devtools, ui-shop, iap-revenuecat, the four Tier-2 packages, and localization/deep-links/share/a11y sit. LAYER_MAP: haptics 2.5, devtools 3, cli 4, ui-shop/iap-revenuecat/leaderboards/achievements/iap/analytics 3.5. README diagram (:42-45) and table (:89-98): haptics, cli, devtools, create-flare-app, iap-revenuecat and the Tier-2 four have NO layer ('—'), ui-shop 3.5. api-specs: cli/create-flare-app/devtools under a '## Layer 5: Tooling' heading (:739),…
- **Reality** — scripts/check-deps-tiers.mjs is the executable truth: `bun run check:deps` runs in ci.yml and release.yml (CONTRIBUTING.md:66-69) and its LAYER_MAP comment (:33-35) mandates that every scoped package has a numeric tier or the gate hard-errors (:212-215, :255-263). Layers 5 and 6 exist in no gate; a package documented as 'Layer 6' could legally depend on react (4) per api-specs but the gate would reject it (haptics is 2.5, ui-shop 3.5). Verified same-tier reality from manifests: packages/ui-shop/package.json:40-41 depends on iap + ui (both 3.5), packages/iap-revenuecat/package.json:40 on iap (3.5).
- **Fix** — Make docs/design/architecture.md the single prose owner of the tier map and have it reproduce LAYER_MAP exactly (numeric tier per package incl. haptics 2.5, devtools 3, cli 4, ui-shop/iap-revenuecat/Tier-2 3.5; add the missing 2.5 layer and ui/ui-shop to the mermaid diagram; delete the unnumbered 'Tooling'/'Tier-2 stubs'/'Device-feedback' groupings or give them their LAYER_MAP numbers). Delete the tier maps from README.md:27-47 and the Layer column at README.md:55-98, and from roadmap.md:24-35, replacing each with a one-line link to architecture.md. In api-specs.md rename '## Layer 5'/'## Layer 6' headings to the LAYER_MAP tiers (or drop layer numbers from api-specs headings entirely and…

#### Downward-only rule stated nine times with two incompatible semantics (strict < vs equal-or-lower)

- **Kind** — contradiction
- **Where** — CONTRIBUTING.md:103 + .github/PULL_REQUEST_TEMPLATE.md:21 (strict) vs scripts/check-deps-tiers.mjs:33 (equal-or-lower); mirrors at AGENTS.md:3, docs/design/architecture.md:9, docs/design/architecture.md:11, README.md:25, docs/plans/roadmap.md:22, docs/conventions/code.md:58, scripts/check-deps-tiers.mjs:8-11
- **Says** — CONTRIBUTING.md:103 'Layer N may only import from layer < N. No circular imports.' and PULL_REQUEST_TEMPLATE.md:21 'layer N imports only from layer < N' forbid same-tier dependencies. check-deps-tiers.mjs:33 'A package may depend only on EQUAL-or-lower tier.' AGENTS.md:3 'deps flow downward only', architecture.md:9 'lower layers never import from higher layers', :11 'Dependency edges flow strictly downward', README.md:25 'strict downward-only dependencies — every arrow points down, none point up or sideways across unrelated branches', roadmap.md:22, code.md:58 'Only import from lower layers'…
- **Reality** — The enforced rule is equal-or-lower (check-deps-tiers.mjs:220 flags only depTier > selfTier), and the shipped graph relies on it: packages/ui-shop/package.json:40-41 (3.5) depends on @flare-engine/iap and @flare-engine/ui (both 3.5); packages/iap-revenuecat/package.json:40 (3.5) depends on @flare-engine/iap (3.5); packages/engine/package.json:66 (4) depends on @flare-engine/react (4). A contributor following CONTRIBUTING/PR-template would reject code the gate accepts, and README's 'none point sideways' is literally false for ui-shop and iap-revenuecat.
- **Fix** — Choose AGENTS.md:3 as the owner and state the exact semantics there once ('a package may depend only on packages at an equal or lower tier; engine is the umbrella exception'). Rewrite CONTRIBUTING.md:103 and PULL_REQUEST_TEMPLATE.md:21 to 'equal-or-lower tier (enforced by `bun run check:deps`)' or replace with a link to AGENTS.md; drop the 'none point sideways' clause from README.md:25; reduce architecture.md:9/:11, roadmap.md:22, code.md:58 to a link to the AGENTS.md rule plus the check-deps-tiers.mjs pointer.

#### README claims pathfinding ships flow fields; architecture.md and the code say it does not

- **Kind** — stale claim
- **Where** — README.md:82 vs docs/design/architecture.md:272 + packages/pathfinding/README.md:3
- **Says** — README.md:82: '`@flare-engine/pathfinding` | 3 | beta — no production consumer | A\* grid + JPS, flow fields.'
- **Reality** — architecture.md:272 (Post-launch roadmap table): 'A\* + Jump-Point Search + a convex-polygon navmesh ship today; flow fields are not implemented.' packages/pathfinding/README.md:3 lists findPath / findPathJPS / findNavMeshPath only. `grep -rniE 'flow ?field' packages/pathfinding/src packages/pathfinding/README.md docs/design/api-specs.md` returns zero hits; packages/pathfinding/src/index.ts exports jps + navmesh, no flow-field symbol. The root README — the first thing a public consumer reads at the flip — advertises an API that does not exist.
- **Fix** — Edit README.md:82 to 'A\* grid + JPS + polygon navmesh' (or drop the feature list and link to the package README). Longer term the README package table's Description column duplicates packages/*/README.md:3 for all 42 packages; replace it with a link per package so feature claims have one owner.

#### api-specs (canonical) says the ECS 32-component cap is per World; code and READMEs say module-global

- **Kind** — contradiction
- **Where** — docs/design/api-specs.md:63 vs packages/ecs/README.md:3 + README.md:60,102
- **Says** — api-specs.md:63 (`World` row): 'Max 32 component types per world.' README.md:102: 'the component-id bitmask is **module-global — shared across every `World` in the process**, not per-`World`. Two worlds in one process draw on the same 32-slot budget.' packages/ecs/README.md:3: 'Max 32 component types total — the component-id bitmask is module-global, shared across all `World` instances.' README.md:60: 'FSM (32-type cap)'.
- **Reality** — packages/ecs/src/component.ts:20 `let nextComponentId = 0;` is module scope; :29-31 increments it in defineComponent and throws at id >= 32 regardless of which World is involved. The cap is module-global. docs/README.md:19 declares api-specs.md 'Canonical … Divergence from code is treated as a spec bug' — the canonical document is the one that is wrong, and the same constraint is prose-restated in three places.
- **Fix** — Correct api-specs.md:63 to 'Max 32 component types per process (module-global id counter shared by every World)'. Then make api-specs the single owner of the constraint: shorten README.md:102 and packages/ecs/README.md:3 to one sentence linking to the api-specs ecs section instead of restating the mechanism, built-in count and remaining-slot arithmetic.

#### road-to-oss §2 'no changesets per row' contradicts the gate, AGENTS.md, todo.md and .changeset/

- **Kind** — contradiction
- **Where** — docs/plans/road-to-oss-2026-09.md:111 + docs/plans/road-to-oss-2026-09.md:1127; vs AGENTS.md:11-18, docs/plans/todo.md:20-23, docs/plans/todo.md:133, .claude/hooks/verify.sh:78, .github/workflows/ci.yml:29, scripts/check-changeset.mjs:64-110, docs/plans/todo.md:1206-1208, docs/plans/consumer-enablement-2026-08-tasks-a.md:35, docs/plans/dynamics-lift-2026-08-tasks.md:56-57, docs/plans/perf-measurement-2026-07.md:381
- **Says** — Execution contract item 5: 'No changesets per row; one minor changeset lands in OSS-H1 (lockstep).' H1 row (:1127) repeats: 'author ONE changeset (minor, lockstep — summary assembled from the Arc B/C/M intentional-change notes in todo rows)'.
- **Reality** — Per-row changesets are mandatory and are what actually happens. check:changeset (verify.sh:78, ci.yml:29; scripts/check-changeset.mjs:64-110) fails any packages/*/src change that no pending changeset covers, so a row cannot close without one. AGENTS.md:11 says 'patch is the default and needs no permission'; todo.md:20-23 and :133 say 'Changeset level: patch while 0.3.x is the line, minor once 0.4.0 opens, never major'; todo.md:1206 records that 51 per-row changesets were folded into the 0.3.0 cut; .changeset/ holds 15 pending per-row files today (2 minor, 15 patch entries). Item 5 was written in ba173cc (2026-07-03), before the 0.3.0 resequence (2026-08-18) and the check:bump gate (51de0e2, 2026-09-05); H1's summary-assembly sentence describes a mechanism that no longer exists.
- **Fix** — Rewrite road-to-oss §2 item 5 to: 'Changeset per row as the gate requires; level per AGENTS.md (patch default, above-patch only with an accepted ADR — check:bump). No publishes mid-arc — exemptions: F2 verdaccio, I1 flip-day.' Rewrite the H1 bullet at :1127 to 'run `bun run version` over the pending changesets' and drop the one-changeset/summary-assembly clause. Reduce todo.md:20-23 and :133 to a link to AGENTS.md:11-24 instead of restating the level rule.

#### 'two known gate blind spots' in road-to-oss §2 are both closed; verify.sh already runs them

- **Kind** — stale claim
- **Where** — docs/plans/road-to-oss-2026-09.md:105-107; vs .claude/hooks/verify.sh:66-73, package.json:21, biome.json:43-52, .github/workflows/ci.yml:40, CONTRIBUTING.md:46-48
- **Says** — Item 3: full gate per row 'plus root tsc -p tsconfig.json (test files) and biome on changed tests/ scripts/ (the two known gate blind spots)' — i.e. every row must run two manual extra checks because the gate cannot.
- **Reality** — Both holes are wired into the gate. `bun run lint` has been `biome check .` since 97b0fd6 (2026-07-09, OSS-C3) and biome.json:43-52 includes `**` minus dist/node_modules, so tests/ and scripts/ are linted by the first gate step. verify.sh:73 runs `typecheck:tests` (root `tsc --noEmit -p tsconfig.json`, package.json:23) after build since 4801128 (2026-09-04, HYG9), and ci.yml:40 runs it too. Item 3 dates from ba173cc (2026-07-03) and was never updated; a builder following it repeats work the gate does and is told the gate is blind when it is not.
- **Fix** — Replace item 3 with 'Full gate green per row — the gate list is `.claude/hooks/verify.sh`, not this doc.' Delete the blind-spot parenthetical. Keep CONTRIBUTING.md:46-48 (it correctly says per-package typecheck is src-only and points to typecheck:tests).

#### /close skill and CLAUDE.md describe a 4-gate verify.sh; the script runs 12

- **Kind** — stale claim
- **Where** — .claude/skills/close/SKILL.md:44-48 + .claude/skills/close/SKILL.md:3 + CLAUDE.md:18 + .claude/hooks/verify.sh:2 + .claude/hooks/verify.sh:170-174; vs .claude/hooks/verify.sh:58-112. Order also restated at docs/plans/road-to-oss-2026-09.md:105, CONTRIBUTING.md:38-45 (test→typecheck→lint→build), CONTRIBUTING.md:116-121 (typecheck→lint→test→build), .github/PULL_REQUEST_TEMPLATE.md:10-13,…
- **Says** — close/SKILL.md:44-48: 'The script runs: 1. bun run lint 2. bun run typecheck 3. bun run test 4. bun run build — engine + mixed only.' CLAUDE.md:18 and verify.sh:2 say the same four; the SESSION_LOG block verify.sh emits (:170-174) records only those four as green.
- **Reality** — verify.sh:58-112 runs lint, typecheck, test, build, typecheck:tests, check:deps, check:changeset, check:peers, check:bump, hook-guard (pre-bash-guard.test.sh), check:perf, check:perf-freshness — eight gates the skill never mentions, including the two that most often fail a row (changeset, perf-freshness — todo.md:727-728 shows the real list). close/SKILL.md:44-48 last changed 0c491914 (2026-06-10); typecheck:tests/peers/hook-guard landed 2026-09-04, bump 2026-09-05. The four-step order is additionally restated in 13 more places in four different orders (CONTRIBUTING's own two lists disagree with each other), none of which match ci.yml's build-before-test sequence.
- **Fix** — Make verify.sh the single owner of the gate list and order. close/SKILL.md step 3 → 'runs every gate in verify.sh; on failure fix and re-run' (no enumeration); CLAUDE.md:18 → 'runs the full gate (see verify.sh)'; verify.sh:2 header and the :170-174 SESSION_LOG block → enumerate the actual gates (or print the names that ran). CONTRIBUTING.md:38-45/:116-121, PR template :10-13, flare-game-dev:30, game-builder:29 and the plan docs → 'run the gate: `bash .claude/hooks/verify.sh`' or a link, not a re-ordered list.

#### git.md lists 7 commit types; commitlint (the enforcer) and architecture.md say 9; history uses build/ci

- **Kind** — contradiction
- **Where** — docs/conventions/git.md:11; vs commitlint.config.ts:5-9, docs/design/architecture.md:301, docs/history/build-plan-archive.md:16
- **Says** — git.md:11: 'Types: feat, fix, perf, refactor, test, docs, chore.'
- **Reality** — commitlint.config.ts:8 (`type-enum`, enforced by .husky/commit-msg) accepts feat, fix, perf, refactor, test, docs, build, ci, chore — nine. architecture.md:301 and the archived build plan list the same nine. `git log` has 11 commits typed build/ci (e.g. 51de0e2 'build: require an accepted ADR…', 97b0fd6 'ci: publint+attw…'), so the two omitted types are in active use. git.md:11 was written f38ceae (2026-05-13), after commitlint.config.ts (2026-04-17), and is simply incomplete. A builder reading git.md would relabel a CI change as chore.
- **Fix** — git.md:11 → 'Types: the `type-enum` in [commitlint.config.ts](../../commitlint.config.ts) (enforced at commit-msg).' architecture.md:301 → drop its type list and link the same file. Never restate the enum in prose.

### 3.2 Medium severity

Real drift, but nobody is about to act on it. Batch by file.

| kind | where | issue | fix |
|---|---|---|---|
| contradiction | docs/plans/dynamics-lift-2026-08-tasks.md:56-57 and :1421-1425; docs/plans/dynamics-lift-2026-08.md:98 and :108 (second: AGENTS.md 'Tooling' bullet… | Both files mandate a 'minor' changeset; since 2026-09-05 check:bump refuses above-patch without an accepted ADR | Change both constraints to "patch by default; a minor needs an accepted ADR (AGENTS.md / check:bump)" and mark the Task 9 Step 5 changeset as consumed in 0.3.0 (d5286bc). |
| unverifiable DONE | docs/plans/dynamics-lift-2026-08-tasks.md:662-1479 (Phase 1 body); docs/plans/dynamics-lift-2026-08.md:304-307 | Tasks 5-9 carry unchecked boxes and no DONE marker although DYN-1 shipped 2026-08-16; §7 capacity-risk paragraph likewise stale | Add one "Phase 1 EXECUTED 2026-08-16 — d5286bc / 623b992 / 8701b58" header above Task 5 (or a status line at the top of the tasks doc), and strike or date the §7 capacity-risk paragraph. |
| contradiction | docs/plans/dynamics-lift-2026-08-tasks.md:533, :1483, :1444-1449, :1601 (second: docs/plans/road-to-oss-2026-09.md:1119) | 'post-flip' framing survives in four places of the tasks doc and in road-to-oss-2026-09.md:1119 | Retitle the two phase headers "pre-freeze (executed)", update the Notes line, and change road-to-oss-2026-09.md:1119 to "the dynamics lift shipped in 0.3.0 (DYN-1); DYN-2/3 are post-flip-acceptable". |
| one-source violation | docs/plans/dynamics-lift-2026-08-tasks.md:1439-1455 (second: docs/plans/todo.md:231-251) | Task 9 Step 6 mirrors the todo.md Arc DYN block verbatim, and the two have already drifted | Replace the fenced block with "Seeded in todo.md (cba464d) — Arc DYN is the SoT for row state"; never restate row text in the tasks doc. |
| stale claim | docs/plans/dynamics-lift-2026-08.md:78-81 and :330-331 (second: docs/plans/dynamics-lift-2026-08-tasks.md:1107-1109;… | Spec §2 freezes a six-name public surface; the shipped barrel is nine names and the six-name version was a 0.3.0 defect | §2 lists the nine-name surface (or points at docs/design/api-specs.md:139-160 as the surface SoT) and §8's "exactly §2" then follows; note 8701b58 as the correction. |
| stale claim | docs/plans/dynamics-lift-2026-08-tasks.md:1390-1398 (second: packages/engine/src/index.ts:8-16, docs/design/api-specs.md:438) | Task 9 Step 2 prescribes `export *` in the umbrella; reality is an aliased named re-export that omits the three 0.3.1 names | Record the aliased-re-export outcome in Step 2/3, and file a row (fold into CW7-Q9) to add `BodyOptions`, `WorldOptions`, `isStatic` to the umbrella's dynamics export list. |
| contradiction | docs/plans/consumer-needs-audit-2026-08.md:117 vs :97-102; :132 vs docs/plans/todo.md:161 | Audit's 'Queued, not now' still lists the broadphase it reports shipped, and says Q1..Q8 while Q9 exists | Remove the broadphase from 'Queued, not now' (leave DYN-3 through PT-10.1); change 'CW7-Q1..Q8' to point at the arc header without a range, or list Q9 explicitly. |
| contradiction | docs/plans/consumer-needs-audit-2026-08.md:1; docs/plans/portfolio-collapse-needs-2026-08.md:19; docs/plans/consumer-docs-sync-2026-08.md:17;… | 'CE-W7' names three different things across the four docs and the queue | portfolio:19 → 'closes the portfolio half of consumer-enablement W7 (todo row DYN-2)'; audit:1 → drop the 'CE-W7' prefix ('Consumer-needs audit (Arc CW7)'); docs-sync:17 → 'todo row CE-W7'. |
| stale claim | docs/plans/consumer-needs-audit-2026-08.md:13-17 | Audit's 'Version line' rationale (coverage-only gate, 'always minor' convention) predates check:bump | Replace the paragraph with 'Fixes land on 0.3.1 (patch) because both consumers resolve `^0.3.0`; bump-level rule: AGENTS.md / versioning-and-announcements.md' and delete the gate description. |
| contradiction | docs/plans/portfolio-collapse-needs-2026-08.md:36-40 vs docs/plans/pan-tvardowski-needs-2026-08.md:17-36 | Portfolio §1 'frame-loop tier back to zero external consumers' left standing against PT §1 | Append a dated one-line correction under portfolio §1 (same pattern as its §5 CORRECTION) pointing at PT §1, so the launch narrative's fact — 'render-web has no external consumer' — has one source. |
| stale claim | docs/plans/pan-tvardowski-needs-2026-08.md:69-72 (cited by docs/plans/external-review-2026-08.md:23, :76, :81) | PT §2.1's O(n) `Query._remove` premise is gone (ADR-0003), and external-review still routes to it | Append an ANSWERED note under §2.1: 'removal is O(1) since ADR-0003 (unreleased at 0.3.1); iteration order is now formally unspecified — grep PT for order dependence as with §3.1'. Let external-review:23 and XR-7 point at the ADR instead… |
| one-source violation | docs/plans/consumer-docs-sync-2026-08.md:31-36, :74-87, :108-109 vs docs/plans/todo.md:219-224 | todo CE-W8 mirrors the docs-sync plan's facts and has already drifted from it | Make CE-W8 a pointer-only row (title + link + gate state); delete docs-sync:108-109; the plan owns the fact list once corrected per the 0.3.1/benchmark issue above. |
| stale claim | docs/plans/web-target-2026-08.md:485-497 (§15 'The fix'), :49 (§1 table), :276 (link to game-view.tsx#L183) | web-target §15 describes a GameView web/native capture shape that no longer exists after XR-1 | Append a dated §18 note: 'XR-1 (2026-08-31..09-05) re-architected scene capture — web path = createSceneCapture via captureRef (game-view.tsx:243-255), native = captureSceneOnUI + shared value (ADR-0002); §12/§15 hook names are… |
| gap | docs/plans/web-target-2026-08.md:536-541 (§16) and :455-459 (§14); packages/react/src/game-view.tsx:137-139 | Known-false `safeArea` JSDoc ships in the public .d.ts with no owning row before the freeze | Add a small engine-builder row (patch changeset) to todo.md above the freeze line: correct the JSDoc at game-view.tsx:137-139 to state the provider is required (or make the prop actually fall back), and update web-target §16 to point at… |
| one-source violation | docs/plans/web-bench-2026-08-tasks.md:325, :342 vs docs/plans/todo.md:1531-1536 and docs/plans/benchmarking-completion-2026-08.md:149-150 | C6 parked status recorded in two other files, never in the file that says 'record the answer here' | Write the 2026-08-18 owner decision once under web-bench-tasks §C6 Step 1 (the place the plan designates), and make todo.md:1531-1536 and benchmarking-completion:149 a one-line pointer to it. |
| contradiction | docs/plans/benchmarking-completion-2026-08.md:146-150 + docs/plans/todo.md:284 + docs/plans/perf-measurement-2026-07.md:792 | PERF-7 spec still orders 'TestingBot verification FIRST' while the runbook says the Pixel 7 over adb unblocks it | Amend the PERF-7 row (todo.md:284) and §11.7 to name the adb-attached Pixel 7 as the device lane and demote TestingBot/B21 to 'only if a cloud matrix is later wanted'; drop the duplicate PERF-7 paragraph from the runbook or reduce it to a… |
| contradiction | docs/plans/benchmarking-completion-2026-08.md:169-170 vs docs/plans/todo.md:1535 | todo.md still says the local device is a Pixel 9; runbook says Pixel 7 and 'prose should match' | Edit todo.md:1535 to 'Pixel 7' and delete the 'prose should match' known-condition from the runbook once done. |
| one-source violation | docs/plans/benchmarking-completion-2026-08.md:25-29, :58-63, :171-177 + docs/plans/todo.md:270-282 (row) and :1402-1403 (Done PERF-14) | PERF-14b straddle narrative + 'BIOS update is scheduled' restated in four places, none updated since | Keep the straddle evidence only in the PERF-14b row; replace runbook :25-29/:58-63/:171-175 with 'see PERF-14b'. Record the BIOS status once (done/date, or still pending) in that row and nowhere else. |
| contradiction | docs/plans/web-target-2026-08.md:221-225 (§10 items 2-3) vs :162-164 (WEB-H4) and :178-179; docs/plans/roadmap.md:11;… | §10 corrections 2 and 3 never applied, and §6 WEB-H4 claims the same edits at a later, undated point | Decide one owner: either apply §10 items 2-3 now (qualify roadmap.md:11 'app-level for non-postfx games since WEB-5; postfx unbacked on web', and reword M1 to 'a create-flare-app blank/topdown scaffold run with bun run web') and delete… |
| gap | docs/plans/web-target-2026-08.md:604-605 (§17 Bug 1) and :686-688 | 'canvaskit-wasm pin must track RN-Skia exactly' rule has no guard, no test and no row | Add a cfa test that reads each template's package.json and asserts `canvaskit-wasm` equals the `canvaskit-wasm` dependency declared by the pinned RN-Skia version (or at least that all three templates agree and the pin is exact), and file a… |
| stale claim | docs/plans/engine-deep-audit-2026-07.md:49-63 | §2 flip-order list reads as live but items 5, 6, 8, 10 are already executed | Extend the header at engine-deep-audit:3-8 with: "§2 is wholly superseded — every item maps to a road-to-oss row and its status lives in todo.md; nothing in §2 is executable." Leave the list body as history. |
| contradiction | docs/plans/game-migration-audit-2026-07.md:95-97 + docs/plans/game-migration-audit-2026-07.md:112-128 | P3 calls the save-store swap an open owner-decision; SV2 in the same file records it done | Replace the P3 bullet at :95-97 with "`save/store.ts` → `createDocumentStore` — resolved by the save-subsystem redesign below (SV2)." and keep the detail only in the SV section. |
| stale claim | docs/plans/game-migration-audit-2026-07.md:7 (also :13, :25, :32) + AGENTS.md:46 | Engine version/package count pinned to 0.2.1 / 40 packages; repo is at 0.3.1 / 42 | Reword :7 to "Engine version at time of writing: 0.2.1 (superseded — current version is `packages/core/package.json`; release history in todo.md:339)". Do not write the new number here; fix AGENTS.md:46 in its own row. |
| structure | docs/plans/extraction-audit-2026-06.md:11 (and :247-261 "Recommended sequencing") + docs/plans/road-to-oss-2026-09.md:17 | Extraction audit still calls itself "the forward queue" though Arc XPACK closed 2026-07-01 | Add a header after :6: "Closed 2026-07-01 — every row landed as todo.md XP1–XP10; only §5 deferred slivers remain live (todo.md holds the pointer)." Change :11 "forward queue" → "was the forward queue". |
| stale claim | docs/plans/external-review-2026-08.md:730-731, :738-740, :805-806 | §11.4c/§11.4d describe the shipped fix as a `runOnUI` worklet; code now uses `scheduleOnUI` and XR-13 is closed, not 'filed' | In the §11.4e note (issue above) record: dispatch is `scheduleOnUI` from `react-native-worklets`; `runOnUI` removed for two reasons (deprecated in Reanimated 4; curried → per-frame closure allocation in `onPreRender`); XR-13 DONE… |
| contradiction | docs/plans/consumer-enablement-2026-08-tasks-a.md:35 and :1380 + AGENTS.md (Tooling, 'patch is the default … check:bump refuses any pending changeset… | Plan A's 'one minor changeset per row, never major' contradicts AGENTS.md's patch-default + `check:bump` ADR gate | In tasks-a.md:35 replace with the current rule: 'Changeset level: `patch` by default; `minor`/`major` only with an accepted ADR cited in the changeset (`check:bump`) — see AGENTS.md'. Same one-line fix for the exit criterion at :1380. (The… |
| one-source violation | docs/plans/external-review-2026-08.md:686-699 (result table + root cause) + docs/plans/todo.md:42-51 | todo.md XR-1b row mirrors the §11.4b A/B result table it points to as SoT | Trim todo.md:42-51 to the verdict + pointer ('Confirmed XR-1a native regression; evidence and root cause: external-review §11.4b') and drop the restated run table and the 'one-line fix' argument. For the docstring, keep the recommendation… |
| contradiction | docs/plans/external-review-2026-08.md:560-561 + docs/plans/engine-deep-audit-2026-07.md:114 | engine-deep-audit's 'no reanimated peer anywhere; keep it that way' policy still stands unqualified against §11.4 and the shipped manifest | Annotate engine-deep-audit-2026-07.md:114 in place: strike 'keep it that way' and add '(superseded 2026-09-05 — ADR-0002 declares the reanimated + worklets peers)'. No other text change. |
| contradiction | docs/plans/perf-measurement-2026-07.md:348 and :590 + docs/plans/road-to-oss-2026-09.md:1219 | This file cites road-to-oss §13 as 'web numbers scheduled post-flip' while declaring web delivered | Delete 'real web benchmark numbers' from road-to-oss §13 (or replace with 'GPU execution-time lane', which PERFORMANCE.md:86 says is still unmeasured); rewrite :348 and :590 to cite PERF-6/13 as delivered rather than §13 as the deferral. |
| unverifiable DONE | docs/plans/perf-measurement-2026-07.md:744-769 (§11.6); :387-459 (§11.1, §11.2, §11.3) | §11.6 PERF-6 (and §11.1-§11.3) carry no DONE marker or shipped/deviation record | Add a one-line 'DONE <date> — shipped per todo.md #<session>; deviations: ...' under each of §11.1, §11.2, §11.3 and §11.6, with §11.6 also pointing at web-bench-2026-08-tasks.md and stating C6 parked + the added GPU/Android lanes. |
| structure | docs/plans/perf-measurement-2026-07.md:9-10 and :377; docs/plans/todo.md:257-283 | 'Builders read the row's §11 spec' is false for the open rows PERF-14b and PERF-17 | Either add §11.12 (PERF-14b) and §11.13 (PERF-17) with an explicit exit criterion each (e.g. 'bench:promote / bench:web:android refuses a window that <condition>, mutation-verified') and shrink the todo rows to pointers, or amend :9-10 and… |
| contradiction | docs/plans/perf-measurement-2026-07.md:966 (also :380, :384-385) vs AGENTS.md:11-14; mirrored at docs/plans/todo.md:285 | PERF-9's 'one lockstep minor changeset' contradicts the patch-default / ADR rule for a post-freeze row | Change :966, :380 and :384-385 to 'patch changeset (surface unchanged); minor only if an accepted ADR says so', and the same at todo.md:285. |
| gap | docs/plans/perf-measurement-2026-07.md:543-545 (§11.5 deviation 1) and §12 (:995-1115); docs/plans/todo.md:466-470 | PERF-18's spawned freshness.instrument false-positive finding has no row and is absent from §11.5/§12 | File PERF-22 in todo.md Arc PERF (pre-freeze: narrow `freshness.instrument` to the capture path — harness/index/results/alloc/skia-stub/load/power/dev-flag — and list the publishers separately; exit = editing web-promote.ts leaves… |
| stale claim | docs/plans/consumer-enablement-2026-08.md:59, :107, :166-172, :186 | consumer-enablement carries no status and its 2026-08-14 'verified' facts are now false | Add "Status: W1–W6 DONE (0.3.0, 905d4d4, 2026-08-25); W7/W8 open" under the title; strike the four resolved §1/§2/§6 items with their shas; record the render-web ceiling reset (24195 → 40947) and its reason in §3; delete the "not swept"… |
| stale claim | docs/plans/simulation-adoption-2026-08.md:166-175, :243, :245, :267-270 | simulation-adoption §4.2/§7/§8 still describe a pre-E2, pre-0.3.0 engine | Mark the §4.2 table rows present at HEAD/0.3.0 and change :175 to "at 0.3.0 it regresses none"; §7: "dynamics shipped in 0.3.0; portfolio swap is DYN-2"; drop the version from :245 and name the consumer-needs-audit file; delete the E1… |
| contradiction | docs/plans/flip-runbook.md:48-49 vs docs/plans/manual-test-protocol.md:26-31 | Runbook calls the freeze-window registry override user-level; the protocol forbids exactly that | Runbook :44-49: state the override is a per-tree project `.npmrc` and that the `$HOME/.npmrc` + `npm config get registry` checks are a backstop against an accidental user-level set; keep "delete every scaffold tree" as the primary teardown. |
| contradiction | docs/plans/versioning-and-announcements.md:10 vs docs/plans/consumer-enablement-2026-08.md:3-4,9-10,36; docs/plans/roadmap.md:120;… | Versioning doc says the only consumers are PT and the portfolio | Rewrite :10 as "no public consumers: the four (Pan Tvardowski, Berek, flare-engine-page, the portfolio) are all owner-operated". |
| one-source violation | docs/plans/flip-runbook.md:36-41 + docs/plans/manual-test-protocol.md:29-36 (also flip-runbook.md:170-174, road-to-oss-2026-09.md:1176,1201-1205,… | XR-11 lockfile/cache rationale is restated in four planning files | Keep the rationale in the XR-11 row (or road-to-oss §2.5 rule 5) and reduce every other site to the checkbox plus "(XR-11)"; collapse road-to-oss H2 to a pointer at manual-test-protocol.md and delete the stale authoring date. |
| contradiction | docs/plans/road-to-oss-2026-09.md:3 and :18 vs docs/plans/todo.md:9-14,298 and docs/plans/external-review-2026-08.md:7-9 | 'Only execution queue / full row specs live HERE' is false for the remaining launch blockers (Arc XR) | Add a short §18 "Arc XR (2026-08-31 external review) — pre-freeze rows" that points at external-review-2026-08.md §11 as the spec home and lists XR-1b/1c/2/6 as freeze-line rows, and soften :3/:18 to "the OSS queue; Arc XR specs live in… |
| stale claim | docs/plans/road-to-oss-2026-09.md:814-820 vs docs/plans/todo.md:304-312 and .changeset/oss-m11-physics-detection.md | M11 spec still asks for the spatial-hash broadphase, MTV and raycast — all shipped; todo already flags the spec as stale | Strike the broadphase bullet with "DONE as CW7-8 in 0.3.1 — do not re-do", mark MTV + raycast "DONE 2026-09-03 (#312)", leave the boundary-semantics bullet as the row's whole scope, and file architecture.md:271 for the same correction. |
| gap | docs/plans/road-to-oss-2026-09.md:1145-1156 vs .perf-baseline.json:373-395 and scripts/check-perf-freshness.mjs:193-210 | Perf-gate 'single source' block omits the three web lanes that check:perf-freshness now gates | Add a hard item: "the three web lanes re-captured and folded at the same commit as the node capture (`bench:web`, `bench:web:gpu`, `bench:web:android` → `bench:web:promote`; phone required for the android lane) — `check:perf-freshness`… |
| stale claim | docs/plans/road-to-oss-2026-09.md:46-47, :1119, :1220-1223 vs docs/plans/dynamics-lift-2026-08.md:14-22 | §0.6/§10/§13 still frame planck as the rigid-body story and the dynamics lift as a post-flip option | §0.6: replace the planck adjudication with "rigid-body = `@flare-engine/dynamics` (shipped 0.3.0, dynamics-lift-2026-08.md §decision 3); planck is a documented if-ever option". §10 PF1: replace the sentence with "DYN-2 (portfolio swap)… |
| contradiction | docs/plans/todo.md:25 vs docs/plans/todo.md:59 | XR-1 is headed "P0 launch-blocker" while its own body concludes it is no longer one | Change the header to the current truth — e.g. "XR-1(b) — owner-owed npm-tarball negative check (P1, one command, unguarded shell)" — and delete the :33 sentence. Keep the one-command recipe; everything else in the row is history that… |
| one-source violation | docs/plans/todo.md:21-23 + docs/plans/todo.md:133 + docs/plans/versioning-and-announcements.md:51-54 | Arc XR's "patch while 0.3.x is the line" rule is contradicted by XR-13's landed minor and by the versioning SoT, and is restated in Arc CW7-Q | Replace both arc-header rules (todo.md:21-23 and :133) with a single pointer: "Changeset level: see versioning-and-announcements.md (patch by default; minor needs an accepted ADR and rides into 0.4.0)". |
| stale claim | docs/plans/todo.md:33 and docs/plans/todo.md:48-50 | XR-1 still says xr1-reanimated-peer.md is the only pending changeset and that XR-1a "must not ship as it stands" | Delete both sentences. If the row needs to say anything about release state, say "unreleased; rides into 0.4.0 with the other pending changesets" and point at `.changeset/`. |
| broken ref | docs/plans/todo.md:93, :491, :512, :530 vs SESSION_LOG.md:11921-11949 | Four rows cite SESSION_LOG #319 and the XR-7 retune cites session #319 — that block does not exist | Hand-write Session 319 (retune 87527aa, mutation-verified tests 5b2ef7c, gate result as it ran) and Session 321 (e7e169e 8-lane re-capture, freshness green) blocks into SESSION_LOG.md; optionally note the mis-subjected 942ba88 in the #319… |
| stale claim | docs/plans/todo.md:294 | Arc OSS's 2026-09-01 recompute still lists XR-1b/XR-1c/XR-2 as open and XR-1c as the binding constraint | Re-run the recompute as of 2026-09-06: remaining = XR-1(b) owner check, OSS-F4, OSS-H1 (+ posting obligation from ADR-0002). Drop the per-XR-row list and point at Arc XR for its state. |
| gap | docs/plans/todo.md:1293-1295 + packages/react/src/game-view.tsx:137-139 | WEB-4 left GameView's false 'falls back to zero insets' JSDoc open; still false at HEAD, no row owns it | Seed a patch row (Arc XR or CW7-Q, packages/react, one changeset): either correct the JSDoc to "throws without a `<SafeAreaProvider>` ancestor unless `safeArea` is passed" or implement the documented fallback… |
| contradiction | docs/plans/todo.md:194-202 + docs/plans/web-target-2026-08.md:153-165 | Arc WEB says 'neither remaining item is in this repo' — WEB-H3 and WEB-H4 are in-repo by their own spec, and none of WEB-H1..H4 is seeded | Rewrite the Arc WEB tail: §5 = PT repo; §6 WEB-H1/H2 = hosting; WEB-H3 and WEB-H4 = in-repo [MT] rows. Seed WEB-H3/H4 as rows with §6 pointers, sequenced after WEB-P5 per §7, and give WEB-H4 the postfx-on-web caveat plus an RN-Skia… |
| stale claim | docs/plans/todo.md:204-210 + docs/plans/consumer-enablement-2026-08.md:131-147 (§5 item 5, §8 item 1) + todo.md:1531-1536 | Arc CE 'W1-W6 have all landed' overstates W4: browser matrix parked/substituted, W4 absent from the Done row, SoT §5/§8 never amended | Amend consumer-enablement §5 item 5 and §8 item 1 in place: record the 2026-08-18 substitution (web-android CDP lane = the device matrix; TestingBot plan check retired). In the Arc CE header write "W1-W6 landed; W4 = PERF-6 with C6… |
| contradiction | docs/plans/todo.md:21-23 (Arc XR header) + todo.md:133 (Arc CW7-Q header) + todo.md:912-918 (OSS-M7 changeset-level rationale) vs… | 'Patch while 0.3.x is the line' still instructs rows, but XR-13's minor already closed that line | State once, in versioning-and-announcements.md (Reserved numbers) or the Arc XR header: '0.3.x closed 2026-09-05 with the XR-13 minor; the next cut is 0.4.0; consumers on ^0.3.0 receive XR-1c/XR-12 only after bumping to ^0.4.0'. Replace… |
| gap | docs/plans/todo.md:465-469 (PERF-18 'Spawned finding, not fixed here') vs Arc PERF rows todo.md:253-286; .perf-baseline.json:356 | PERF-18's spawned freshness.instrument false-positive row was never filed | File PERF-22 in Arc PERF (todo.md:253ff) and perf-measurement-2026-07.md §12: narrow `freshness.instrument` to the capture path (e.g. benchmarks/src minus web-promote*.ts / web-sections.ts / results-rendering) or add an `instrumentExclude`… |
| gap | docs/plans/todo.md:559-561 (XR-13 Done row 'Posting obligation open') vs todo.md:339 (owner-gated list) and… | ADR-0002 posting obligation is tracked only inside a closed Done row | Add to the owner-gated list at todo.md:339 (or an Active `XR-13-post` row): 'ADR-0002 posting obligation — flare-engine-page peer/platform pages + portfolio posts must state New Architecture required, Reanimated >=4 / worklets >=0.7; due… |
| one-source violation | docs/plans/todo.md:304-306 + docs/plans/road-to-oss-2026-09.md:809-827, docs/plans/road-to-oss-2026-09.md:75 | road-to-oss §6 M11 (the SoT) is stale and the todo row says so instead of fixing it | Amend §6 M11 in road-to-oss: strike the three shipped bullets with commit refs (b617e49, b5d0a97) and keep only boundary semantics + its perf re-capture precondition; amend §1's P2 bullet to "M10 + M11-boundary". Then cut the todo row back… |
| unverifiable DONE | docs/plans/todo.md:294 + docs/plans/todo.md:65, docs/plans/todo.md:579 | XR-2 is listed as remaining, has no row/spec/Done entry anywhere, and actually executed as session #302 | Add an XR-2 Done entry (session #302, 245b198 + 14ed248, deliverable = ADR-0001 + architecture.md + the README old-arch qualification) and remove XR-2 from the remaining list; add a one-paragraph XR-2 definition to external-review §11 (or… |
| stale claim | docs/plans/todo.md:334 | HYG5 still lists `AudioManager.factory` (dropped 2026-08-16) and a `_pinchActive` that never existed | Strike the AudioManager item (cite daa40f8). Replace `_pinchActive` with the real symbol the ledger meant (`_pinchTouches` used as a presence flag) or drop the item. |
| stale claim | docs/plans/todo.md:332 (HYG3) + docs/plans/todo.md:334 (HYG5) | HYG3/HYG5 file:line anchors drifted; the anchored facts are still true | Re-anchor HYG3 to the six `apply<Name>` function names (frame-renderer.ts:590-720) and HYG5 to api-specs.md:1032; prefer symbol names over line numbers on post-flip rows that will sit for months. |
| broken ref | docs/plans/todo.md:291 + docs/plans/todo.md:328 | todo.md links twice to a gitignored ledger — dead links the day the repo goes public | Replace both links with a backtick mention plus "(private, untracked)", matching road-to-oss:11; add "no markdown links into `_local/`" to F4's checklist so the freeze scan catches recurrences. |
| stale claim | docs/plans/todo.md:242-246 vs docs/plans/portfolio-collapse-needs-2026-08.md:267 ("Currently pinned: engine 8701b58, 7 packages (... dynamics ...)")… | DYN-2 lists work this repo's own consumer doc reports as already done | Rewrite DYN-2 as "retire the portfolio's vendored tarballs: token-based restricted install verified end-to-end on CI + Cloudflare Pages" (or close it and move that to owner-OOB), and drop the module-delete / repoint / parity wording.… |
| gap | benchmarks/src/load.ts:113-160 (SCENARIO_DEVIATION_OVERRIDES), benchmarks/src/affinity.ts, benchmarks/scripts/bench-pinned.mjs; commits 6b12524,… | 2026-08-20 bench work (P-core pinning guard + 35% per-row tolerance) has no row and no session block | Add a dated Done row (e.g. "PERF-14c — P-core pinning guard + integrate-only 35% tolerance, 2026-08-20") pointing at load.ts/affinity.ts and the eight commits; append one clause to PERF-11's Done text ("four integrate-only rows at 35%… |
| gap | docs/plans/todo.md:466-469; .perf-baseline.json:356 (`"instrument": ["benchmarks/src"]`); scripts/check-perf-freshness.mjs:146-147 | PERF-18's spawned freshness.instrument false-positive finding has no row | Add PERF-22 [MT]: split `freshness.instrument` into measuring paths (harness, scenarios, *.bench.ts, results/alloc/heap-probe/load/power/affinity) and exclude the publishers (web-promote*.ts, web-sections.ts, promote.ts's markdown path),… |
| contradiction | AGENTS.md:46 vs docs/plans/todo.md:244 (+ :194, :217, :339) | AGENTS.md publishes "0.2.1 on npm" while the DYN row and the tree say 0.3.1 | Change AGENTS.md:46 to point at the single version source (`docs/plans/versioning-and-announcements.md`) instead of restating a number, or update it to 0.3.1 and add the line to the release checklist. |
| gap | packages/engine/src/index.ts:9-16 vs packages/dynamics/src/index.ts:1-2; claim at docs/plans/todo.md:1514-1516 (DYN-1 Done) and the CW7-Q9 row at… | Umbrella barrel still re-exports six dynamics names after the 0.3.1 nine-name fix | Add `isStatic`, `type BodyOptions as DynamicsBodyOptions`, `type WorldOptions as DynamicsWorldOptions` to the engine block (patch, additive); extend CW7-Q9's scope to diff each explicit re-export block in `packages/engine/src/index.ts`… |
| contradiction | docs/plans/versioning-and-announcements.md:56 + docs/plans/flip-runbook.md:120-123 (also AGENTS.md:23,… | "1.0.0 is the public launch" contradicts the runbook: the October flip ships 0.4.x | In versioning-and-announcements.md:56 write "1.0.0 is reserved for the first post-flip stable cut, never the October flip (which ships 0.4.x per flip-runbook step 4-5)". Reword AGENTS.md:23 to "0.4.0 = freeze cut, 1.0.0 = post-flip stable"… |
| contradiction | .changeset/README.md:19,23-26 + .changeset/config.json:5-6,10 | .changeset/README.md describes a `linked` group and a first-publish gate that no longer exist | Rewrite .changeset/README.md:19 to "Lockstep is the `fixed` group in config.json (the source of truth); see its `ignore` list for never-published workspaces". Delete :21-26 (or replace with a one-line link to flip-runbook.md step 4). |
| contradiction | docs/plans/roadmap.md:14 + CHANGELOG.md:17 (also docs/plans/todo.md:194,217,339, docs/plans/consumer-needs-audit-2026-08.md:66,… | 0.3.1 release date drifted: 2026-08-27 in five plan docs, 2026-08-28 in CHANGELOG and git | Make CHANGELOG.md's index table the only owner of release dates. In roadmap.md:14, todo.md:194/217/339, consumer-needs-audit:66 and pan-tvardowski-needs:150 keep the sha and drop the date (or correct to 2026-08-28 in the same sweep). |
| stale claim | docs/plans/road-to-oss-2026-09.md:1050 + scripts/audit-tarballs.mjs:6,21,58 (vs docs/plans/flip-runbook.md:8, CHANGELOG.md:17-21) | F3 audit still lists the exposed published set as 0.1.0/0.2.0/0.2.1, omitting 0.3.0 and 0.3.1 | Derive the expected set from the git tag list (or the CHANGELOG index) instead of a literal; fix the :6/:21 comments. In road-to-oss:1050 write "every version in the CHANGELOG index" rather than enumerating. |
| one-source violation | docs/plans/versioning-and-announcements.md:49-57 (owner); AGENTS.md:11-15; .claude/hooks/verify.sh:85-86; docs/design/adr-0000-template.md:16-18;… | Reserved-number policy (0.4.0 = freeze cut, 1.0.0 = major) restated in 10 places | Keep the numbers in versioning-and-announcements.md §Reserved numbers and in check-bump-level.mjs's refusal message (enforcement). Reduce AGENTS.md:11-15, verify.sh:85-86, adr-0000-template.md:17-18 and CHANGELOG.md:85-86 to one sentence +… |
| one-source violation | docs/plans/road-to-oss-2026-09.md:64-67 (owner; also :8-9,1123,1196,1252-1254); docs/plans/roadmap.md:16 AND :51;… | Freeze/window/flip dates restated in 8 docs (roadmap twice in one file) | road-to-oss §1 table (:64-67) owns the dates. Delete roadmap.md:51 (duplicates :16 in the same file) and make :16 a link. Strip the dates from todo.md:297-298/339. flip-runbook and manual-test-protocol keep their window name in the title… |
| contradiction | README.md:57, README.md:78 vs packages/math/README.md:3, docs/design/architecture.md:97, docs/design/architecture.md:126 | Root README says 42 easings; code, math README and architecture.md say 35 | Set README.md:57 and :78 to 35 (or drop the number). Keep the count in one place — packages/math/README.md:3 — and have architecture.md:97/:126 and README say 'Penner easings' without a count, or add the count to the check:readme harness… |
| stale claim | docs/plans/road-to-oss-2026-09.md:937, :997, :998, :1011, :1021; scripts/audit-tarballs.mjs:21 | Launch SoT and freeze-time audit script still say 40 scoped packages; real count is 41 | Update road-to-oss-2026-09.md:937/:997/:998/:1011/:1021 to 41 scoped / 42 total, or better, to 'every non-private scoped package (derived at runtime by flip-access.mjs)'; change scripts/audit-tarballs.mjs:21 to 'every scoped… |
| one-source violation | docs/design/architecture.md:11 (owner) mirrored at AGENTS.md:12, docs/design/architecture.md:286, README.md:16, README.md:25,… | Package count '42 dirs = 41 scoped + create-flare-app' hand-restated in 18 places | Keep the count in exactly one prose location, docs/design/architecture.md:11. Rewrite AGENTS.md:12, CONTRIBUTING.md:54, adr-0000-template.md:17, check-bump-level.mjs:9 and verify.sh:85 to 'every package in the lockstep group' (the lockstep… |
| contradiction | docs/design/api-specs.md:137 vs docs/design/dependencies.md:72-75 vs docs/design/architecture.md:270 | api-specs still frames Tier-2 physics as a deferred planck.js integration; dependencies.md says dynamics replaced it and planck is not planned | Make dependencies.md:72-75 the single owner of the physics-library decision. Replace api-specs.md:137 with one line: 'Rigid-body response lives in `@flare-engine/dynamics` (§ below); no third-party physics engine — see dependencies.md.'… |
| contradiction | packages/engine/package.json:4 vs docs/design/api-specs.md:438-439, packages/engine/README.md:8-9, packages/engine/src/index.ts:1-2,… | Engine barrel composition stated in five places; package.json description omits dynamics | Fix packages/engine/package.json:4 to include dynamics (or make it non-enumerating: 'curated umbrella barrel; ./headless is the RN-free subset'). Make api-specs.md:438-439 the single owner of the barrel composition and alias table; cut… |
| stale claim | docs/plans/pre-flip-audit-2026-09.md:83 vs scripts/check-deps-tiers.mjs:37-84, README.md:27-47, docs/design/api-specs.md:9-816 | The one stated tier count ('8-tier architecture') matches none of the repo's tier maps | After issue 1 fixes the tier map, state the tier count once in docs/design/architecture.md next to the table ('seven tiers: 0, 1, 2, 2.5, 3, 3.5, 4; engine is the umbrella exception') and change pre-flip-audit-2026-09.md:83 to 'the tier… |
| one-source violation | AGENTS.md:29 / AGENTS.md:37-40 (owner) mirrored at CONTRIBUTING.md:102, CONTRIBUTING.md:104, docs/conventions/code.md:10,… | AGENTS.md code-style/perf rules mirrored verbatim in CONTRIBUTING, code.md and PR template; code.md layout is stale (tsup) | Keep AGENTS.md as the sole owner of the export-star and zero-alloc rules (CLAUDE.md imports it). Replace CONTRIBUTING.md:102-104 rows and PR template:20 with a link to AGENTS.md §Code style / §Performance; cut code.md:10 and :19-28 to… |
| contradiction | docs/design/architecture.md:301; vs AGENTS.md:44, docs/conventions/git.md:5, .claude/hooks/verify.sh:222, docs/plans/road-to-oss-2026-09.md:108-110 | architecture.md commit rules allow a BREAKING CHANGE body/`!`; the repo contract forbids a body | Delete the 'Breaking: …' clause from architecture.md:301 and replace the whole §'Commit rules' paragraph with a link to docs/conventions/git.md. If the owner wants `!` sanctioned, add it to git.md §Commit format as the single owner and… |
| stale claim | CONTRIBUTING.md:59-63; vs .github/workflows/ci.yml:27-65 (check:peers :30, check:bump :33, check:tarballs :62) | CONTRIBUTING's CI gate list omits check:peers, check:bump and check:tarballs | Replace CONTRIBUTING.md:59-63 with 'CI runs every `check:*` script in the root package.json on top of the gate — see .github/workflows/ci.yml for the list and order; `bash .claude/hooks/verify.sh` runs the same local subset.' Do not… |
| contradiction | CLAUDE.md:11; .claude/agents/engine-builder.md:20-22; docs/plans/road-to-oss-2026-09.md:89-92; docs/plans/todo.md:20-21; (enforcement:… | engine-builder's forbidden paths are stated four different ways; the 'scope guard' is prompt text only | engine-builder.md:20-22 becomes the single owner of owned/forbidden paths (add scripts/, .changeset/, root *.md and docs/design/architecture.md there if that is the intent, or remove them from road-to-oss). CLAUDE.md:11 → 'scope: see… |
| contradiction | docs/plans/road-to-oss-2026-09.md:94-95 (list); vs per-row tags… | [main-thread] row list in road-to-oss §2 disagrees with the per-row tags; two spellings of the tag | Delete the roll-up list at :94-95 — the tag in each row header is the source. Define the token once in §2 ('[MT] = main-thread; see routing') and use `[MT]` in every header (rename the 12 `[main-thread]` headers). Tag I1/I2 at :1198/:1201. |
| one-source violation | CLAUDE.md:23; docs/conventions/git.md:31-33; .claude/agents/engine-builder.md:47; .claude/agents/game-builder.md:50;… | 'Builders never run git add/commit/push' is restated verbatim in 12 places | docs/conventions/git.md §Workflow (:29-35) owns the rule and the enforcement pointer. CLAUDE.md:23 → 'Builders never run git — see docs/conventions/git.md'. engine-builder.md:47 / game-builder.md:50 / start/SKILL.md:76 keep a one-clause… |
| one-source violation | AGENTS.md:44 (declared owner per CLAUDE.md:24); docs/conventions/git.md:5,24; CONTRIBUTING.md:58,106,124; docs/design/architecture.md:299-301;… | Commit-message contract (≤72, no body, no emoji, no trailer) restated in 11 places; CONTRIBUTING already lost two clauses | docs/conventions/git.md §Commit format owns the full contract. AGENTS.md:44 → 'Conventional Commits per docs/conventions/git.md' (keep the example). CONTRIBUTING.md:58/:106/:124, architecture.md:299-301, PR template :2, README.md:141 →… |
| one-source violation | AGENTS.md:11-18; CONTRIBUTING.md:53-57; docs/design/adr-0000-template.md:9-18; docs/plans/versioning-and-announcements.md:18-21;… | check:bump/ADR rule and the '0.4.0 / 1.0.0 / one word moves 42 packages' sentence copied 6-7 times | adr-0000-template.md:12-18 owns the rule (the script already points there at :30). AGENTS.md:11-18 → two lines: 'patch is the default; above-patch needs an accepted ADR — check:bump enforces it (template link; posture:… |

### 3.3 Low severity

Mostly one-source mirrors and dead links. Sweep these in one pass rather than one row each.

| kind | where | issue | fix |
|---|---|---|---|
| contradiction | docs/plans/dynamics-lift-2026-08-tasks.md:1540, :1593-1594 (Task 10); :656-657, :900-901, :1086-1087, :1298-1299, :1366-1367, :1477-1478 (Tasks 4-9)… | Remaining commit steps still run git and use a scope the doc itself says commitlint rejects | Convert the Phase 1/2 commit steps to "emit the commit block", change Task 10's subject to `feat(web): ...`, and drop `git rm -r` for a plain `rm -r` + emitted block. |
| one-source violation | docs/plans/dynamics-lift-2026-08-tasks.md:348-349, :390, :1504, :1508-1516 and docs/plans/dynamics-lift-2026-08.md:237-244 (second:… | Phase 0 execution facts are restated across both files and three other docs, and one has already drifted (2.5 s vs 1.5 s) | Keep each execution fact once — in the spec's §4/§6/§7 — and have the tasks doc reference the section; remove the threshold value from both plan files (the test is the SoT) and keep the DYN-3 numbers only in the spec, with todo.md pointing… |
| broken ref | docs/plans/dynamics-lift-2026-08.md:47-51, :72, :89-90 (second: docs/plans/dynamics-lift-2026-08-tasks.md:1392) | Dated evidence and code refs in §1/§2 and Task 9: physics v0.2.1, perp/crossSV 'absent', tier-gate :214 | Date-stamp §1 as "as of 0.2.1" or refresh the bullets; change :214 to :220; reword §2 to "did not exist upstream (landed 6a10aa9)"; drop the line number in Task 9 Step 2. |
| stale claim | docs/plans/pan-tvardowski-needs-2026-08.md:446-447 | PT §10.1's 'six packages import react-native at module scope' is wrong for iap-revenuecat | Correct to 'four direct importers (devtools, react, ui, ui-shop) plus `engine` via its barrel; `iap-revenuecat` is already lazy' before CW7-Q8 is executed, and have Q8 use the lazy-import in provider.ts as its precedent. |
| broken ref | docs/plans/pan-tvardowski-needs-2026-08.md:177 and docs/plans/consumer-needs-audit-2026-08.md:105 (`api-specs.md:126`); pan-tvardowski-needs:361… | `api-specs.md:126` and the game-view.tsx line cites have drifted (three docs, three different lines) | Cite by symbol (`api-specs.md` `SpatialIndex<V>` row; `game-view.tsx` `onTouchStart/Move/End` handlers) rather than by line, or update the two api-specs cites to :131 and the game-view cites to :311-349. |
| stale claim | docs/plans/web-target-2026-08.md:158-161 (WEB-H3) and :140 (§5) | WEB-H3 asks for a check-perf-freshness entry the web lanes already have; §5 version drifts from todo | Trim WEB-H3 to 'bundle-size budget + a freshness rule for that budget if it lands outside web.json'; change §5 to 'the current 0.3.x line' rather than a number, per the 'no version numbers in prose' rule. |
| broken ref | docs/plans/benchmarking-completion-2026-08.md:119 (`ci.yml:52`), :165-167; docs/plans/web-target-2026-08.md:565 (`scripts/copy-canvaskit.mjs`),… | Drifted file:line refs and superseded advice in the runbook and web-target | Update ci.yml:52→:65, replace :165-167 with 'handled by capture.ts since PERF-19', qualify the copy-canvaskit path as template-relative, and either fix or drop the game-loop line number. |
| broken ref | docs/plans/extraction-audit-2026-06.md:91 (also :82-86, :89) | XP1 resolution links `skia-bridge.ts:822`; the file is 203 lines after the XP2 lift | Repoint :91 to `packages/render/src/frame-renderer.ts` (createFrameRenderer) without a line number, :89 to `sprite-batch.ts` `flush(drawAtlas)` without a line, and append "(fixed — OSS-B4)" to the :82-86 caveat. |
| broken ref | docs/plans/engine-deep-audit-2026-07.md:27 (api-specs.md:295); docs/plans/package-findings-2026-07.md:75 (api-specs.md:140), :113 (api-specs.md:797) | Three `api-specs.md:NNN` anchors now point at unrelated sections | Strip the three `api-specs.md:NNN` line anchors (keep the package name) and mark each "(claim removed)"; the superseded header from the ledger-status fix covers the rest. |
| stale claim | docs/plans/package-findings-2026-07.md:5 (and :51) + docs/plans/engine-deep-audit-2026-07.md:16 | "41 dirs / 41 src trees" — `packages/` has 42 since dynamics landed | Change :5 to "Maturity map (41 dirs at 2026-07-02; `dynamics` post-dates this ledger)" and :51 "create-flare-app dir at 0.0.0" → "(create-flare-app, then 0.0.0)". |
| one-source violation | docs/plans/engine-deep-audit-2026-07.md:47 + docs/plans/package-findings-2026-07.md:135; engine-deep-audit:127 + package-findings:146;… | Same facts restated in both audit ledgers (README-compile count, PT sha, RN-Skia drag) | Keep the detail in package-findings; reduce engine-deep-audit:47, :115 (page clause) and :127 (PT clause) to "see package-findings §Cross-cutting / §Consumer-repo signals" pointers. |
| stale claim | docs/plans/external-review-2026-08.md:589-596 (NEW-4) | NEW-4 rests on 'Query.entities is documented sorted', a premise since shown false and closed by ADR-0003 | Add one line under NEW-4: 'Premise false — `entities` was never sorted; resolved by ADR-0003 (order unspecified, swap-remove landed `0ef1aec`).' Do not restate the measurements; point at ADR-0003 and the XR-7 row. |
| stale claim | docs/plans/external-review-2026-08.md:147-149 (§3.1) and :446-456 (§9 disposition table) | §3 'no ADR convention exists' and §9 'Pre-flip? yes' rows are all closed with no closure pointer | Add one line above the §9 table: 'Outcome (2026-09-05): every pre-flip row landed — XR-2..XR-6, XR-4+9; E-R2 = XR-7 (open for re-capture); E-R8 redesign = XR-8. See todo.md Arc XR.' A pointer, not a mirror; leave the table and §3.1 as… |
| one-source violation | docs/plans/external-review-2026-08.md:349-351 (§8.2 table) + README.md:102 | Root README hardcodes the showcase game's component count (16 / 23 of 32) copied from §8.2 | In README.md:102 keep '32 types, process-global, 7 built-ins, throws on the 33rd' and drop the consumer's count (or phrase it as 'a mid-size shmup lands in the low twenties'), so the number has one source (the dated review). |
| broken ref | docs/plans/external-review-2026-08.md:27 (flip-runbook.md:46; road-to-oss §1), :519 (road-to-oss-2026-09.md:482), :662 ('filed as XR-10 below') | Four cross-references point at the wrong line or section | :27 → `flip-runbook.md:58` and 'road-to-oss §14'; :519 → `road-to-oss-2026-09.md:483`; :662 → 'filed as XR-10 in todo.md'. |
| stale claim | docs/plans/perf-measurement-2026-07.md:603 | §11.5 exit still names 'the 0.3.0 freeze checklist' — the freeze cut is 0.4.0 and 0.3.x already shipped | Replace '0.3.0 freeze checklist' with '0.4.0 freeze checklist (road-to-oss §11 / OSS-H1)'. |
| stale claim | docs/plans/perf-measurement-2026-07.md:116 (B8 CLOSED row, reads as current state) and :532, :547 | Byte-ceiling count '41' is stale — .perf-baseline.json now carries 42 | At :116 drop the counts and say 'populated (a row per alloc scenario, a ceiling per published package — see the file)'; leave :532/:547 as dated history or update to 42; fix verify.sh:101 in the same pass. |
| broken ref | docs/plans/perf-measurement-2026-07.md:1049 | §12 F4 attributes 'bench overwrites baseline' to B11; that finding is B12 | Change 'B11' to 'B12' at :1049. |
| contradiction | docs/plans/perf-measurement-2026-07.md:384-385 vs :380 and :893 | §11 preamble says only PERF-3 and PERF-9 touch packages/*/src, contradicting PERF-10 two lines up and §11.10 | Rewrite :384-385 as 'PERF-3 and PERF-10 shipped one lockstep minor each; PERF-9 (open) — see the changeset note in §11.9'. |
| stale claim | docs/plans/roadmap.md:12, :14, :22 | Roadmap State block counts and the 0.3.1 date disagree with the tree | "42 per-package LICENSE files + 42 manifests"; "0.3.1 (2026-08-28, 516d313)"; "42 package dirs (41 scoped + create-flare-app)" as architecture.md:11 already says. |
| one-source violation | docs/plans/roadmap.md:24-35 vs scripts/check-deps-tiers.mjs:37-84 and docs/design/architecture.md:15-60 | Roadmap layer table is a third copy of the layer map and disagrees with it | Replace the table with one line pointing at architecture.md §Layer Diagram and check-deps-tiers.mjs LAYER_MAP as the enforced map. |
| stale claim | docs/plans/flip-runbook.md:42-43 vs docs/plans/manual-test-protocol.md:54 | Runbook F2 box still tracks the react-pin bug as an open pre-freeze fix | "… — fixed by OSS-B32 (2026-07-24); re-proven by manual-test §1." |
| stale claim | docs/plans/road-to-oss-2026-09.md:1169-1171 | H2 row reads as pending ('author ~Sep 28'); the protocol was authored 2026-07-24 | Mark the row "authored 2026-07-24 (#258); owner executes Oct 5–18 per manual-test-protocol.md" and cut the inline seven-item checklist to a pointer. |
| one-source violation | docs/plans/road-to-oss-2026-09.md:69-83 vs docs/plans/todo.md:296 and :298 | §1 capacity figures duplicate todo.md with different numbers, and both are superseded by the 2026-09-01 recompute | Replace :69-83 with one line: "Capacity is tracked in todo.md Arc OSS ('Recomputed …'); the July estimate is history" and delete the slip-rule bullets (keep only 'never compress the manual window', which §15 already states). |
| stale claim | docs/plans/road-to-oss-2026-09.md:1545-1546 | Arc HYG described as HYG1–HYG8 'NOT before the flip'; HYG9–11 were filed and closed pre-flip | Amend to "HYG1–HYG8 remain post-flip; HYG9–HYG11 (guardrail/test-integrity findings) were filed and closed pre-flip, see todo.md ## Done". |
| gap | docs/plans/road-to-oss-2026-09.md:1454-1457 vs README.md:18 | §16 says the README disambiguation must name the identical repo; the shipped README names only flarerpg.org | Either add "(GitHub `flareteam/flare-engine`)" to README.md:18 as a docs-only pre-freeze fix and record it in the D4 done-when, or downgrade the amendment to 'optional'; fix roadmap.md:47 'dormant' → 'live'. |
| stale claim | packages/react/src/scene-texture.ts:122 (vs packages/react/src/game-view.tsx:258-261) | scene-texture.ts docstring says native capture is a `runOnUI` worklet — XR-13 replaced it with `scheduleOnUI` | File a one-line patch row: replace "a `runOnUI` worklet" with "a `scheduleOnUI` worklet (react-native-worklets, ADR-0002)" at scene-texture.ts:122; no changeset-level impact beyond patch. |
| structure | docs/plans/todo.md:25-83 | XR-1 is a 60-line chronological log whose header, middle and tail describe five different states | Collapse to one Active line (the owner-owed npm half (b) recipe + pointer to §11.4) and move the dated history to a single XR-1 entry in Done that names commits c5b8c01, a630580, 14ed248, 7b4f56f and defers to §11.4-§11.4d for evidence. |
| contradiction | docs/plans/todo.md:17-18 vs docs/plans/external-review-2026-08.md:517-531 | Arc XR header says two external claims were corrected in §11.2; §11.2 lists three | Change "Two" to "Three" — or drop the count and say "the corrections in §11.2 are not actioned", so the number lives in one place. |
| contradiction | docs/plans/todo.md:148-149 + docs/plans/pan-tvardowski-needs-2026-08.md:208-215 | CW7-Q4 misstates the defect: createBenchSession is exported from published @flare-engine/testing; PT's ask is runtime-package placement + sync latch | Rewrite CW7-Q4 to the SoT's actual ask: decide placement (core/debug runtime re-export with a sync latch) or document `testing` as a runtime-installable dependency for bench builds; drop 'unreachable' and 'discoverability'. |
| stale claim | docs/plans/todo.md:1300-1305 + docs/plans/web-target-2026-08.md:485-486 | WEB-6 row and web-target §15 name useWebSceneTexture/captureWebScene, both removed by XR-1 (c5b8c01); behaviour holds under new names | Append one line to the WEB-6 row and §15: "renamed at c5b8c01 (XR-1): now `createSceneCapture` + `captureRef.current.capture` inside `onPreRender`, game-view.tsx:244-254". |
| gap | docs/plans/web-target-2026-08.md:684-688 + docs/plans/todo.md:1296-1297 + packages/create-flare-app/templates/blank/package.json:18-28 | WEB-5's expo install --check flagged six stale template pins; decision deferred with no row, pins unchanged at HEAD | Seed a cfa [MT] row: decide the six Expo-57 template pins flagged in web-target §17 before the Oct 5 freeze (move to Expo's expectations or record why not), and re-run the scaffold boot afterwards. |
| stale claim | docs/plans/todo.md:1205-1208 (and todo.md:294) vs .changeset/oss-*.md + todo.md:755-950 | CE-W6 'every OSS-B/C/D/M row folded into 0.3.0' — seven OSS-B/M rows landed 2026-09-02..04 and sit unreleased as pending patch changesets | Qualify CE-W6 to "every OSS-B/C/D/M row landed by 2026-08-25" and add "B18/B23b/M7/M8/M9/M11 landed 2026-09-02..04 and ride OSS-H1 as patch changesets"; :294 should say 'P0/P1 launch rows'. |
| stale claim | docs/plans/todo.md:378 (S8 row: 'Deferred: 8 package READMEs still say apps/pan-tvardowski' and 'root scripts/perf/ + retired folios kept as archive… | S8 still defers a README sweep that landed and cites a scripts/perf archive that was deleted | Strike both sentences on todo.md:378: replace the README deferral with 'swept in 45ae878 / e6d2d42' and the archive sentence with 'scripts/perf/ later deleted by PERF-1 (21448a1)'. |
| stale claim | docs/plans/todo.md:405 ('Research-flagged (ws337exio) modernizations … apply opportunistically') | Harness-modernization list presents two landed items as still open | On todo.md:405 mark the skills migration (0c49191) and the folio-SoT fix (S8) as done and keep the remaining four as the opportunistic list; the header at todo.md:341 ('remain opportunistic, not closed') then stays true. |
| broken ref | docs/plans/todo.md:1651 (E6) and todo.md:1653 (E5) — links `../../apps/pan-tvardowski/scripts/run-smoke-cloud.sh`, `eas.json`,… | Five Done-row links point at apps/pan-tvardowski paths removed in S8 | Convert the five links to plain code spans, or point them at https://github.com/grzott/Pan-Tvardowski/blob/main/<path> (the row says PT history was preserved by filter-repo, so the paths exist there at the root). |
| structure | docs/plans/todo.md:391-403 (TH2 row, final two sentences at :403) | TH2 DONE row still carries its pre-close instruction sentences | Delete the trailing two sentences on todo.md:403 (from 'Same class TH1' to the end of the row). |
| stale claim | docs/plans/todo.md:425 (P1), todo.md:432 (Other tracks #2), todo.md:434 (Other tracks #4) | Future-tracks section points at rows that are already closed or superseded | P1: replace the S9(b) clause with 'parked on the S9 owner config (PT secrets + bench APK) and ≥7 nightlies'. #2: drop 'TPL1 row above +'. #4: replace with a pointer to road-to-oss-2026-09.md §13 (showcase assets) and §10 (docs site lane). |
| one-source violation | docs/plans/todo.md:1049 (XR-12 row) vs todo.md:716 (HYG9 row) | XR-12 says check:peers is not wired into verify.sh; HYG9 wired it three days later | Append '(wired into verify.sh + CI by HYG9, 2026-09-04)' to the sentence at todo.md:1049. |
| structure | docs/plans/todo.md:326-328 + docs/plans/road-to-oss-2026-09.md:1543-1546 | Arc HYG says "NOT before the flip" and lists HYG1-8, yet HYG9/10/11 ran pre-flip under the same prefix | Either add one line to the arc header ("HYG9-11 were pre-flip test/config hygiene filed under this prefix and are closed; HYG1-8 remain post-flip") or renumber them under Arc XR/OSS in the Done ledger; update §17's "HYG1–HYG8" sentence to… |
| contradiction | docs/plans/todo.md:340 + CHANGELOG.md:17 | 0.3.1 publish date stated as 2026-08-27; CHANGELOG and the release commit say 2026-08-28 | Change to 2026-08-28 on todo.md:340, or drop the dates there and point at CHANGELOG.md (one source). |
| stale claim | docs/plans/todo.md:318-323 | M11 "UNBLOCKED" note pins the physics baseline to e6a3919; the committed baseline is now fd8df76 | Replace the sha with "the committed node baseline (benchmarks/results/microbench.json, check:perf-freshness green)" so the row does not need re-stamping on every re-capture. |
| stale claim | turbo.json:18-26 vs apps/bench-dashboard/app/lib/data.ts:4-5; claims at docs/plans/todo.md:1104 (PERF-8 Done) and apps/bench-dashboard/README.md:140 | Dashboard turbo inputs omit web-gpu.json and web-android.json that the page reads | Add `$TURBO_ROOT$/benchmarks/results/web-gpu.json` and `web-android.json` to the `@flare-engine-apps/bench-dashboard#build` inputs (or use a `results/*.json` glob), keeping README:140 true. |
| stale claim | docs/plans/todo.md:255 | Arc PERF header paragraph describes a sequencing that is almost entirely done | Rewrite the header to name the five live rows with their pre-freeze / post-flip status and the PERF-3/9/10 routing note only where it still applies (PERF-9). |
| one-source violation | docs/plans/benchmarking-completion-2026-08.md:6-11 and :107-119; referenced from no plan (grep todo/road-to-oss/perf-measurement/roadmap: 0 hits) | benchmarking-completion-2026-08.md is an orphaned, stale mirror of Arc PERF state | Delete it, or stamp it SUPERSEDED at the top with a pointer to perf-measurement-2026-07.md §11-§12 and no live instructions. |
| structure | docs/plans/todo.md:257-268 (PERF-17) and :270-282 (PERF-14b) vs benchmarks/src/web-promote.ts:114-134 (TEMP_DRIFT_WARN_C, PERF-21) and… | PERF-17 and PERF-14b rows do not cite the work and measurements already landed against them | Add one sentence to each row: PERF-17 — "battery-drift warn shipped in the fold (PERF-21); what is left is enforcement in the capture (gap or trend) and whether warn becomes refuse"; PERF-14b — "see perf-measurement §12 measurement… |
| contradiction | docs/plans/dynamics-lift-2026-08.md:316-324 vs docs/plans/portfolio-collapse-needs-2026-08.md:272-275 | dynamics-lift §8 still says the .npmrc + NPM_TOKEN recipe was verified for the portfolio | Amend §8 to say the recipe was verified against flare-engine-page only and that the portfolio needs a read token at install time on CI and the Pages build; cross-link portfolio-collapse-needs §5 rather than restating. |
| one-source violation | docs/plans/road-to-oss-2026-09.md:37-45 (owner); docs/plans/todo.md:213-217,339; docs/plans/roadmap.md:14-15;… | The 0.3.0-vs-0.4.0 renumber decision is narrated in seven docs | Keep the decision in road-to-oss §0.5. Replace the narrative in todo.md:213-217, roadmap.md:14 (second sentence), consumer-needs-audit:13-17 and web-target:25-27 with "version decision: road-to-oss §0.5"; todo.md:339 keeps only the owner… |
| one-source violation | README.md:179 (owner); docs/plans/road-to-oss-2026-09.md:43-45,1064-1065,1418-1419; scripts/audit-tarballs.mjs:19,323 | MIT/Apache boundary (0.1.0-0.2.1 MIT, 0.3.0+ Apache) restated in README, plan and script | README.md:179 owns the consumer-facing statement. In audit-tarballs.mjs:19/:323 say "pre-Apache versions stay MIT (README §License)" without the range; mark road-to-oss:1418-1419 as shipped at README.md:179 instead of restating the fact. |
| one-source violation | docs/plans/versioning-and-announcements.md:51-52 + docs/design/adr-0002-worklets-migration-and-new-arch-floor.md:66-67 (also… | "64 references across 12 planning documents pin 0.4.0" duplicated in the SoT and ADR-0002 | Keep the count (or better, drop it and say "many") only in versioning-and-announcements.md:51; ADR-0002:66-67 -> "see versioning-and-announcements.md §Reserved numbers". Reconcile todo.md:214-215 and road-to-oss:41-42 to one sweep record. |
| one-source violation | .changeset/config.json:5 (machine owner); CHANGELOG.md:3-5 (prose owner, links config); AGENTS.md:10; README.md:16,49,142; CONTRIBUTING.md:53,108;… | Lockstep rule prose restated 15 times, three times in README alone | Public-facing prose owner = CHANGELOG.md:3-5. README keeps :16 only; :49 and :142 link to CHANGELOG/config. CONTRIBUTING.md:53 shortens to "lockstep (see CHANGELOG.md)"; architecture.md:318 and dependencies.md:151 link rather than restate.… |
| stale claim | docs/plans/road-to-oss-2026-09.md:405-407,423,1530 (vs packages/create-flare-app/package.json:3-4, .changeset/config.json:5) | Done-row specs in road-to-oss still carry pre-B13 version literals (0.2.1, 0.0.0) | Annotate :405-407, :423 and :1530 as shipped ("landed B13/C3; cfa now tracks the lockstep line") or replace the literals with "the current line"; never restate the cfa version - it is the same number as every other manifest. |
| stale claim | .claude/skills/flare-tier2-stubs/SKILL.md:3, :8, :10, :36, :81 + docs/design/architecture.md:252 vs README.md:92-95, docs/design/api-specs.md:818,… | Tier-2 packages still described as 'interface-only at 0.1.0, adapters at 0.2.0' in the skill and architecture heading | Make docs/design/api-specs.md:816-820 the single owner of the Tier-2 shipping status. Rewrite SKILL.md:3/:8/:10/:36/:81 to describe the interface pattern and link to api-specs for what ships; retitle architecture.md:252 to '### Tier-2… |
| one-source violation | CLAUDE.md:12; .claude/agents/game-builder.md:32-34 and :39; docs/plans/roadmap.md:70 | Engine-first rule restated in CLAUDE.md, game-builder.md and roadmap.md | game-builder.md:32-34 owns the rule. CLAUDE.md:12 → 'engine-first rule: see game-builder.md'. roadmap.md:70 → one line linking game-builder.md, dropping the PT-specific phrasing. |

### 3.4 What the critics said

**Completeness critic.** The sweep covered all 25 plan files but was shaped file-by-file, so it missed what sits between files and outside docs/plans. The five things most likely to hurt through the freeze: (1) public docs still link the private Pan-Tvardowski repo 21 times (README even git-clones it) against fixed decision §0.7, with D2-D4 marked DONE; (2) nobody recomputed capacity after W1 added 27 pre-flip code findings on top of ~150 corpus issues, with 4 weeks left and todo/road-to-oss referencing the findings file 0 times; (3) ADR-0002's breaking floor (Reanimated 4 / New Architecture) reaches no consumer doc, and Berek (last seen at 0.2.1) must jump two minors plus that floor inside the manual window; (4) two private strategy notes remain in git history (ba173cc/de9f4b6) with no recorded owner disposition before the one-way repo flip; (5) api-specs.md is declared canonical yet lacks 334 of 1099…

- *(high)* **Public docs link the private Pan-Tvardowski repo 21 times and the root README quickstart tells strangers to `git clone` it; fixed decision §0.7 says showcase links never point at the private repo and D2-D4 (all marked…** — Verified with git grep: README.md:17,117 (clone block), CONTRIBUTING.md:65,76, docs/README.md, docs/design/api-specs.md (2), docs/design/native-acceleration.md, docs/plans/roadmap.md (3), docs/recipes/save-migrations.md (3), docs/references/pan-tvardowski/README.md (3), .claude/** (4). road-to-oss-2026-09.md:50-51 is explicit. On flip day these are broken links in the first thing a visitor reads, and it shows the… → Seed a pre-freeze [MT] row: rewrite or remove every private-repo link per §0.7 (or the owner amends §0.7 to allow them and records why), and add the private-repo URL to the OSS-F4 grep set so it cannot recur.
- *(high)* **No capacity recompute exists after W1: 27 pre-flip code findings (1 high, 19 medium, 7 low) plus roughly 150 corpus issues plus OSS-F4/H1/M11-boundary now sit against four weeks to Oct 5, and the plan still says 6-7…** — docs/plans/pre-flip-audit-2026-09-findings.md §1 has 27 `#### F` headed pre-flip findings; todo.md and road-to-oss-2026-09.md reference that file 0 times; todo.md:294 (recompute of 2026-09-01) still lists XR-1b/1c/2/6 + F4 + H1 as the remainder. The sweep's shards could not see each other's load, so nobody owns the cut line. → Before seeding rows, recompute Arc OSS capacity with the W1 preFlip set and the corpus rows, publish an explicit cut line in road-to-oss §1 (one source), and tag every new row preFlip-must / preFlip-if-time / postFlip.
- *(high)* **ADR-0002's breaking change (react-native-reanimated >=4, react-native-worklets peer, New-Architecture only) is absent from every consumer document and from the freeze protocol and cross-repo lanes; Berek is last…** — Zero hits for reanimated/new-arch/ADR-0002 in pan-tvardowski-needs, portfolio-collapse-needs, consumer-docs-sync, consumer-enablement and manual-test-protocol.md. road-to-oss §10 PT2/BK1 say only 'bump to ^0.4.0'; BK1 cites Berek's 0.2.1 migration (2b1733f) and SESSION_LOG's last Berek work is the July B33 comment. ADR-0002 §Consumer impact names only PT and the portfolio as consumers. Manual-test-protocol §2/§3 and… → Add a prerequisite to PT2 and BK1: confirm each app is on New Architecture + Reanimated 4 before Oct 5 (owner, cross-repo), or drop §3 Berek from the exit criteria explicitly; amend ADR-0002's consumer list.
- *(high)* **Two private strategy notes remain recoverable from git history with no recorded owner disposition before the one-way repo flip** — docs/plans/monetization-strategy-2026-07.md (22 lines) and oss-launch-audit-2026-07.md (91 lines) were committed in ba173cc and de9f4b6 (2026-07-03) and deleted in 5478900 (OSS-A0); `git show ba173cc:docs/plans/monetization-strategy-2026-07.md` still works. OSS-F4 (road-to-oss:1072-1088) scans history for secrets and records a no-rewrite stance only for the author email; A0's done-when checks the tree only. Runbook… → Add an explicit owner decision to the OSS-F4 row: accept the exposure (record it) or run filter-repo before Oct 20 knowing it breaks every SHA and the PT split tags; either way the decision must be written down before step 1.
- *(high)* **api-specs.md is declared canonical ('divergence is a spec bug') but 334 of 1099 names exported from packages/*/src/index.ts do not appear in it, and nobody diffed it** — Scripted diff over the 42 barrels (export-statement scan, so approximate): missing include functions, not just types — animation createTweenManager/resetTween/clearTweens; assets parseAseprite/parseTexturePackerArray/parseTexturePackerHash/createSpriteSheet/createTexture/addAnimation/getFrame; tilemap decodeGidFlags/stripGidFlags/getTileAt/getTilesetForGid/createTilemapData; input… → Seed a pre-freeze row to re-derive api-specs from the barrels (or demote it from canonical and say what is), decide `_resetComponentIds` under D2, and pair it with CW7-Q9's declared-vs-exported gate so it cannot drift again.
- *(high)* **The CI publish path the runbook mandates for the flip has never executed, and the runbook's step-5 changelog instruction is stale** — All seven chore(release) commits (0.1.0 through 0.3.1, incl. 905d4d4 and 516d313) are authored locally by the owner; `vars.ENABLE_RELEASE` appears nowhere as set; release.yml (changesets/action@v1, NPM_TOKEN secret, id-token: write, `bun run release` incl. check:perf-freshness and check:perf-bytes on ubuntu) will run for the first time on the one-way public release. flip-runbook.md:33 and :137-139 say a local `bun… → Add a pre-freeze rehearsal row for the CI path (throwaway branch + verdaccio or a dry-run of the changesets action with provenance asserted) and correct runbook step 5 / the F2 box.
- *(high)* **Freeze-window FREEZE-FIX patches collide with the perf-freshness gate and the shared bench phone, and nobody costed it** — .perf-baseline.json:355-395 stales the node suites and all three web lanes on any commit under ecs/physics/particles/render/testing; `bun run release` chains check:perf-freshness; H1 forbids FLARE_PERF_ALLOW_STALE at freeze; manual-test-protocol.md exit criteria say 'that is a re-capture, not a waiver'; the android lane needs the owner's phone, which §2 also uses for device testing. PERF-14b (mode straddle, BIOS… → Decide in OSS-H1 (one source) whether freeze-window patches re-capture all 8 lanes or get a written freeze-only waiver rule; land PERF-14b/PERF-17's protocol decisions before Oct 5 and record whether the BIOS update invalidates the baseline.
- *(medium)* **21 Pan-Tvardowski concept-art PNG folios are tracked and will ship publicly under the root Apache-2.0 license with no row or decision** — git ls-files shows docs/references/pan-tvardowski/folios/ (21 files) whitelisted in .gitignore; §0.7 calls PT 'the private commercial game' and roadmap.md rejects the PT shape catalogue as PT-specific IP; road-to-oss:1313's folio grep covers shipping source only; OSS-F4 scans for secrets, not IP. LICENSE/NOTICE carry no exclusion. → Owner-decision row before F4: delete the folios (they live in PT history), move them to the PT repo, or add an explicit license carve-out.
- *(medium)* **Cross-repo lanes G1-G3, PT1-PT3, BK1 and PF1 have no status anywhere in this repo, and the two in-repo statements about the docs site contradict each other** — grep finds the lane ids only in road-to-oss §10 and the todo.md:339 owner paragraph; §10 says the page is 'deploy-ready but never deployed' while flip-runbook.md step 6 says 'G1/G2 pre-flip work already green'. Manual-test-protocol §4/§6 and runbook step 6 depend on those lanes; the freeze cut requires G2's ^0.4.0 bump. → Add one dated status line per lane in road-to-oss §10 (the single source) and an [MT] row that verifies them at freeze; resolve the never-deployed vs already-green contradiction.
- *(medium)* **W2's own deliverables are missing from the findings: the D3 public/internal docs split + manifest/frontmatter contract, and the docs/history archive set** — pre-flip-audit-2026-09.md §5 W2 and §6 list both; the 16-agent output contains neither. A header scan shows 13 of 25 plan files carry no status; fully executed task docs (consumer-enablement-2026-08-tasks-a, dynamics-lift-2026-08-tasks, web-bench-2026-08-tasks, benchmarking-completion-2026-08) and the superseded audits are obvious archive candidates but nobody proposed the set. → Run the D3 proposal as its own agent pass and seed one row per archive move; the manifest contract must land before flare-engine-page builds against it.
- *(medium)* **The harness drops SESSION_LOG blocks on a red gate and the log has duplicate session numbers, while todo.md:341 calls it the canonical history** — .claude/hooks/verify.sh:52-54 and .claude/skills/close/SKILL.md:50-51 document 'no session block appended' on failure; SESSION_LOG.md:11985 records #319 lost that way; `grep -o '^## Session N' | uniq -d` shows 122, 151-156, 161, 164, 165 duplicated. The sweep flagged the dangling #319 references but not the mechanism, which will recur on the next red /close. → Row: make /close write the block on red (marked red, no commit block) and annotate or renumber the duplicates; until then, cite dates not session numbers.
- *(medium)* **Arc CW7-Q was never triaged against fixed decision D2 (public-surface changes go pre-freeze)** — todo.md:151 CW7-Q6 (`SystemDef._worldFn` underscore member on a public interface) and :162-185 CW7-Q9 (parameter types consumers cannot name, plus the `Skia$1` leak) change the published .d.ts; both are labelled 'patch while 0.3.x' / non-blocking and the Sep 1 recompute parks all of CW7-Q as post-flip-acceptable. Post-flip these become breaking changes against real consumers. → Re-triage CW7-Q1..Q9 with the preFlip/postFlipHYG tag and pull Q6, Q9 and the ecs `_resetComponentIds` export into the pre-freeze order.
- *(medium)* **npm credential rotation has no completion record and no expiry fact; the flip depends on a token whose lifetime nobody wrote down** — road-to-oss §14 says 'NOW (this week): rotate' (context 2026-07-03) with no done marker; flip-runbook.md pre-flight 'credential rotation done' is unchecked; todo.md:339 defers to the private ledger. npm's 2025 token-policy changes cap granular publish tokens at 90 days; a token minted in July or August can expire inside the flip week, and release.yml uses NPM_TOKEN. Trusted Publishing is listed only as a post-flip… → Owner records rotation date and expiry in the private ledger and ticks the runbook box, or pulls Trusted Publishing/OIDC forward so the flip does not depend on a dated secret.
- *(medium)* **Manual-test-protocol exit criteria require hardware the repo never records the owner having (Safari, iOS Safari on a real device, iOS builds)** — manual-test-protocol.md:110-111 and :157 make the Chrome/Firefox/Safari + Android Chrome/iOS Safari matrix a hard exit criterion; :39 says 'iOS where a real device is available'; the repo records only a Windows capture box and one Android phone (Pixel 7 vs Pixel 9 disagreement already flagged); C6 browser matrix is parked (todo.md:1531-1536). An unsatisfiable exit criterion blocks OSS-I1 on paper. → Owner states available Apple hardware; amend §4 and the exit criteria to what can actually run, marking the rest declared-untested.
- *(low)* **Public-facing non-plan docs carry retired or undated planning claims nobody swept: TestingBot residue in apps/bench-web, stale 'Last updated' headers in docs/design** — apps/bench-web/README.md:46-61 documents the TestingBot probe and two scripts plus .env.testingbot.example ship, after the owner retired TestingBot for the adb-attached phone; docs/design/ecosystem.md and native-acceleration.md say 'Last updated: 2026-04-20' while containing 2026-07/08 edits, and ecosystem.md:54 still says planck.js has no integration. Low individually, but all go public at flip. → Fold into a post-D-pass docs row: drop or annotate the TestingBot surface, refresh the design-doc headers.

**Adversarial critic.** Most of the corpus findings survive verification — the dead-code refusals in benchmarks/src/promote.ts (problems pushed at :204/:227 after the :111 early return; last 5 history.ndjson rows carry affinityMask 0xffffffff on a 24-core/32-thread hybrid host, so the current baseline is an unpinned fold), the stale >=3.19.1/old-arch text in the XR-1 row, AGENTS.md:46 "0.2.1", the safeArea JSDoc (game-view.tsx:157 calls useSafeAreaInsets unconditionally), README:82 flow fields / :57 42 easings (code has 35), api-specs.md:63 per-World cap (component.ts:20 is module-global), the 0.3.1 date (516d313 and the tag are 2026-08-28), the missing session #319 block, and the SpatialIndex.update fix (b617e49 made it O(1) via _slots, so M11/PERF-9/HYG5 owe nothing there) are all CONFIRMED. What does not hold: (1) the P2-vs-launch confusion — the seven pending changesets are B18/B23b/M7/M8/M8b/M9/M11, every…

- *(low)* **OSS-HYG high: "'B/C/D/M launch rows all shipped in 0.3.0' is false: 7 M/B rows landed after 0.3.1, unreleased" (todo.md:294) — and CW7-CE-WEB low "CE-W6 'every OSS-B/C/D/M row folded into 0.3.0'" (todo.md:1205-1208)** — The seven pending changesets are oss-b18, oss-b23b, oss-m7, oss-m8, oss-m8b, oss-m9, oss-m11. Every corresponding spec is headed P2: road-to-oss-2026-09.md:513 (B18 "P2 — cuttable"), :749 (M7), :764 (M8), :783 (M9), :809 (M11), :1517 (B23b "P2"). road-to-oss §1:77-81 defines "the P2 rows (B18, M7–M11)" and states "The flip does not need P2"; todo.md Arc OSS lists them under "P2 cut-line". "Launch rows" = P0+P1, all… → drop this finding (both copies); if anything, add a one-line note to todo.md:294 that seven P2 changesets are pending for 0.4.0
- *(high)* **XR high + closed high: "XR-7 is fully landed and green in the tree but the Active row still says it is open" — contradicted by the sibling DYN-PERF high "The 2026-09-06 node re-capture (e7e169e) is off-protocol"** — Both cannot be right and the tree sides with the second. benchmarks/results/microbench.json is at fd8df76 with the 4 ecs.churn rows (baseline contract satisfied), but the 5 folded captures (history.ndjson tail) record affinityMask 0xffffffff / affinityCpus 32 of 32 logical on hostPhysicalCores 24 — an unpinned window on a hybrid host, which benchmarks/src/affinity.ts:95-103 refuses and which promote.ts never… → merge the three into ONE high row: fix the promote.ts dead refusal, decide accept-or-recapture-pinned for the fd8df76 fold, then close XR-7 and write the missing session block
- *(high)* **Triplicate: road-to-oss high "H1 spec tells the freezer to hand-author the 0.4.0 minor; already pending and ADR-gated", flip-mechanics high "check:bump will refuse the OSS-H1 freeze minor", OSS-HYG high "OSS-H1's 'one…** — One defect reported three times. .changeset/xr13-worklets-scheduleonui.md is minor and cites ADR-0002 (Accepted); under `fixed` lockstep (.changeset/config.json:5) it alone moves all 42 to 0.4.0. package.json:50 runs check:bump inside `bun run version`, so a second hand-authored minor without an ADR citation is refused (check-bump-level.mjs:140-190), and one WITH a citation is merely redundant. Same fix for all… → merge into one high row
- *(high)* **Triplicate: external-review high, DYN-PERF medium, versions-dates high — "AGENTS.md:46 still says 0.2.1 on npm"** — Same single line, same fix (0.3.1 per CHANGELOG.md:17 and packages/*/package.json). Confirmed stale, but three rows for one edit inflates the queue. → merge into one high row
- *(medium)* **Triplicate: perf medium, DYN-PERF medium, closed medium — "PERF-18's spawned freshness.instrument false-positive finding has no row"** — Confirmed (todo.md:465-469 says "Worth its own row before the freeze"; .perf-baseline.json freshness.instrument = ['benchmarks/src']; no Arc PERF row exists). One gap, one row. → merge into one medium row
- *(medium)* **Quadruplicate: road-to-oss low "§1 capacity figures... superseded by the 2026-09-01 recompute", XR medium "recompute still lists XR-1b/XR-1c/XR-2 as open", OSS-HYG high "Same paragraph names XR-1b/XR-1c/XR-6 as…** — All four target the single paragraph at todo.md:294, which is explicitly headed "Recomputed 2026-09-01" — a dated snapshot, not a live claim. The XR-1b/1c/2/6 half is stale (XR-1c closed #300, residue #317; XR-2 ran as session #302; XR-6 closed), the launch-rows half is not (see the P2 gap). High is over-stated for a dated paragraph whose fix is one re-recompute. → merge into one medium row: re-recompute the paragraph
- *(medium)* **Duplicate: XR medium + closed medium — "'Patch while 0.3.x is the line' (todo.md:21-23, :133) contradicted by XR-13's landed minor and the versioning SoT"** — Confirmed (versioning-and-announcements.md:51-54 says pre-freeze minors ride into 0.4.0; xr13 minor is pending), but it is one header rule stated in two arcs; one row fixes both. → merge into one medium row
- *(medium)* **Duplicate: web-bench medium + CW7-CE-WEB medium — "safeArea JSDoc 'falls back to zero insets' is false and ships in the .d.ts, no owning row"** — Confirmed: packages/react/src/game-view.tsx:137-139 JSDoc vs :157 `const insets = useSafeAreaInsets();` (unconditional; safe-area-context 5.x throws without a provider). Two rows for one 3-line JSDoc + patch changeset. → merge into one medium row
- *(medium)* **perf high "§11.7 PERF-7 still specs a TestingBot revival the owner retired" + web-bench medium "PERF-7 spec still orders 'TestingBot verification FIRST'"** — Duplicate, and "the owner retired" is stronger than the record: todo.md:1535 says the adb phone "likely retires the TestingBot spend entirely" and benchmarking-completion-2026-08.md:149 says C6 is "Parked" — no recorded retirement decision. PERF-7 is P3 and todo.md:255 says it "slides post-flip if the calendar tightens"; nothing pre-freeze reads item 4. Real, but not high. → merge into one medium row: re-sequence PERF-7 §11.7 item 4 around the adb Pixel 7, recording the TestingBot decision
- *(medium)* **road-to-oss high "F3 audits only 0.1.0–0.2.1; 0.3.0 and 0.3.1 are now published and no re-run is scheduled before the flip" (+ versions-dates medium duplicate)** — A re-run IS scheduled: flip-runbook.md pre-flight carries an unchecked "[ ] F3 done: tarball audit clean (or every old-version hit has an owner disposition, §14)", and todo.md:1548 records F3 as the detector landing (2026-07-24) with the freeze-time run owner-executed. The real defect is narrower: scripts/audit-tarballs.mjs:58 `PUBLISHED_VERSIONS_EXPECTED = ['0.1.0','0.2.0','0.2.1']` (plus road-to-oss:1050) would… → downgrade to medium and merge with the versions-dates copy: extend the version list in the script and the §F3 sentence
- *(low)* **audits high "§2 item 4 tells the flip executor to treat the @flare-engine/benchmarks changeset ignore as a bug" (engine-deep-audit-2026-07.md:56) and audits medium "§2 flip-order list reads as live"** — engine-deep-audit-2026-07.md:3-8 opens with a banner: "Superseded 2026-07-03 as a queue... evidence ledger only... do NOT execute... the road-to-oss doc wins." road-to-oss-2026-09.md:149 (the SoT the executor reads) says verbatim "Do NOT 'fix' .changeset/config.json's ignore of @flare-engine/benchmarks — that package exists at benchmarks/ ... the ignore is correct." The contradiction is already adjudicated in the… → drop the item-4 finding; downgrade the flip-order finding to low (strike-through only)
- *(low)* **audits high "Both bug ledgers carry 20+ fixed defects with no status and package-findings has no superseded header"** — road-to-oss-2026-09.md:14-16 designates both files "evidence ledgers, NOT queues — one source per fact"; per-bug status lives in todo.md Done rows and adding a fixed/open column to the ledgers would create exactly the mirror rows the repo rule forbids (AGENTS.md:45). engine-deep-audit already has the superseded banner (:3-8). The only actionable residue is a banner on package-findings-2026-07.md:1-3. → downgrade to low: add the superseded banner to package-findings only
- *(low)* **audits high "E1 row still says createWebFrameRenderer is not exported" — cites game-migration-audit-2026-07.md:105-108 + todo.md:350** — The todo half of the citation is wrong: the XP2 row at that location already reads "Correction (2026-07-05 audit P13, resolved 2026-07-09): createWebFrameRenderer was NOT shipped by XP2 — OSS-C1 implemented + exported it ... so the row's export claim now holds." Only game-migration-audit E1 (a dated PT-consumption record) lacks a marker. → downgrade to low and drop todo.md:350 from the 'where'
- *(medium)* **DYN-2 trio: dynamics high "DYN-2 recorded as done elsewhere, but spec §7 and Task 10 still call it the next row", consumers high "DYN-2 is 'closed' in the portfolio doc but open in todo.md", DYN-PERF medium "DYN-2 lists…** — Not a contradiction: todo.md:242-246 already redefines the residual — "@flare-engine/dynamics@0.3.1 is on the registry ... the portfolio's committed npm pack tarballs in vendor/flare-engine/ are the thing this row retires (edb8517 correction)" — which matches portfolio-collapse-needs-2026-08.md:6-8/:19-20/:267 (swap done by vendoring at 8701b58; migration off vendoring "written and ready"). What is stale is the… → merge into one medium row
- *(low)* **dynamics high "§8 '.npmrc + NPM_TOKEN ... Verified 2026-08-14' is contradicted by two sibling docs that ask for its correction" (+ DYN-PERF low duplicate)** — The two sibling docs disagree with each other, and the evidence sides with §8's mechanism: pan-tvardowski-needs-2026-08.md:8-10 records PT installing 34 packages from registry.npmjs.org at access:restricted "via a committed .npmrc + ${NPM_TOKEN} — no vendoring", and :37-40 says explicitly ".npmrc + ${NPM_TOKEN} does work — for PT, today, against 0.3.0 ... it is not a general failure of the mechanism." The… → downgrade to low: one attribution clause in dynamics-lift §8
- *(medium)* **consumers high "Portfolio §5 still says the .npmrc recipe fails because dynamics is unpublished, right under its own CORRECTION"** — Real internal inconsistency at portfolio-collapse-needs-2026-08.md:272-275, but it is a consumer-authored requirements doc ("written by the portfolio repo, for the engine repo") whose CORRECTION block (:243-256) and the PT doc's §1 (:37-40) already state the truth; no engine plan routes off :272-275. → downgrade to medium
- *(low)* **consumers medium "Portfolio §1 'frame-loop tier back to zero external consumers' left standing against PT §1"** — pan-tvardowski-needs-2026-08.md:16-36 is literally titled "Scope correction — the frame-loop tier is NOT at zero consumers" and tabulates PT's use of render/react/postfx/ecs/physics/scene/shapes. The corpus already carries the correction; the only gap is a back-pointer from portfolio §1. → downgrade to low
- *(low)* **consumers high "PT doc §10 and §6 still present the broadphase as the open top ask after §3.1 was ANSWERED as shipped"** — The same file's §3.1 (:150-188) carries the engine-side "ANSWERED 2026-08-27 — shipped in 0.3.1" block with the 27x measurement; consumer-needs-audit:97-102 records it under "Shipped after this doc was written"; todo.md:308 strikes it in M11. §10.1/§6 are the consumer's dated priority list (2026-08-26). A reader who reaches §10 has passed §3.1. → downgrade to low: strike-through + pointer in §6/§10
- *(low)* **consumers medium "'CE-W7' names three different things across the four docs and the queue"** — consumer-enablement-2026-08.md §10 defines W7 as one step, "consumers", with a portfolio bullet and a page bullet. todo.md:225-229 keeps the page half as CE-W7 and states "The portfolio half of W7 is DYN-2 below, not restated here"; portfolio-collapse-needs:19 closes its half ("CE-W7 / DYN-2"); consumer-needs-audit:1 is the W7 consumer audit; consumer-docs-sync:17 points the page swap at §10 W7. One umbrella name… → downgrade to low
- *(medium)* **consumers high "docs-sync plan sends the portfolio ledger to 0.3.0 and to retired Power-Saver microbench numbers"** — Half is already corrected at the queue pointer: todo.md:219-222 (CE-W8) says "note the current line is 0.3.1, so sync to that, not to 0.3.0." The numbers half stands — consumer-docs-sync-2026-08.md:82-84 calls the 55.6→56.3 µs move "growth/noise, not a correction", which PERF-14 (todo.md:1392-1403, ~2.5x) later reversed. → downgrade to medium, scoped to the numbers paragraph
- *(medium)* **flip-mechanics high "Consumer-enablement's pre-flip bake objective is now silently post-flip in todo"** — The bake is substantively happening: portfolio-collapse-needs-2026-08.md:6-8 records the portfolio as "a real consumer as of 2026-08-25" running engine dynamics/errors/storage/share (vendored at 8701b58); consumer-enablement-2026-08.md:36 records the page's simulation swap done (803ac9a, 2af931a); PT is on ^0.3.0 (pan-tvardowski-needs:7-10). What todo.md:294 calls post-flip-acceptable is only the registry-install… → downgrade to medium
- *(medium)* **external-review high "§11.4 XR-1 design SoT still says peer >=3.19.1, Reanimated 3 viable, old-arch claim 'stays true'"** — §11.4 is a dated design ("owner-approved 2026-08-31") and the same document's §11.4d (:805-806) records XR-13 filed against exactly this; the floor's SoT is ADR-0002 + the XR-13 Done row (todo.md:532-561) + packages/react/package.json (>=4.0.0) + both READMEs (react README:11/:18, engine README:44), all already updated. One pointer line, not a rewrite. → downgrade to medium
- *(low)* **external-review medium "engine-deep-audit's 'no reanimated peer anywhere; keep it that way' policy still stands unqualified"** — external-review-2026-08.md:558-561 already records the contradiction verbatim ("engine-deep-audit-2026-07.md:114 states the policy... The code has violated that policy since usePictureAsTexture was adopted"), and the ledger is banner-superseded (:3-8). → downgrade to low
- *(low)* **one-source class: "Lockstep rule restated 15 times", "'Builders never run git' restated 12 places", "Engine-first rule restated in 3", "Reserved-number policy restated 10 places", "Freeze/window/flip dates restated in 8…** — AGENTS.md:45 states the rule as "One source per fact (no mirror rows, no duplicate changelogs)" — it targets plan rows and changelogs. README.md, CONTRIBUTING.md, SECURITY.md, the PR template, verify.sh:85-89 and check-bump-level.mjs:172-191 must each state the rule to their own audience (a contributor or a refused gate cannot be sent to AGENTS.md). Only copies that DISAGREE are defects, and those are already filed… → drop the counts with no reported drift (lockstep 15x, builders-git 12x, engine-first 3x, reserved numbers 10x, freeze dates 8x); downgrade the rest to low scoped to the drifted copy
- *(low)* **web-bench medium "§10 corrections 2 and 3 never applied, and §6 WEB-H4 claims the same edits at a later, undated point"** — web-target-2026-08.md:221-222 (item 2) itself says roadmap.md:11 "becomes backed at WEB-H4, not before" — agreement with WEB-H4 (:162-164), not contradiction; roadmap.md:11 is unchanged by design. Only item 3 (manual-test-protocol.md:122 M1 still says "a scaffolded/topdown web build (or a page demo)") is unapplied, and WEB-H4 owns that row too. → downgrade to low
- *(low)* **web-bench medium "todo.md still says the local device is a Pixel 9; runbook says Pixel 7"** — todo.md:1448 already records the correction ("is a Pixel 7 (panther, Tensor GS201, Mali-G710), not the Pixel 9 it was expected"); the cited todo.md:1535 is a dated Done row written before the device was identified. XR-1b/1c rows and every capture say Pixel 7. → downgrade to low
- *(low)* **web-bench medium "web-target §15 describes a GameView capture shape that no longer exists after XR-1" + CW7-CE-WEB low "WEB-6 row and §15 name useWebSceneTexture/captureWebScene"** — Duplicate; §15 is a dated findings record of WEB-6 (2026-08-24). XR-1a (c5b8c01) and XR-13 (7b4f56f, scheduleOnUI at game-view.tsx:261) replaced the path and the CW7 auditor already notes behaviour holds. A pointer, not a rewrite. → merge into one low row
- *(low)* **OSS-HYG low "M11 'UNBLOCKED' note pins the physics baseline to e6a3919; the committed baseline is now fd8df76"** — todo.md:318-323 states when the capture happened ("re-captured ... at e6a3919"), a dated fact; the precondition it satisfies (a current physics.step baseline exists) is satisfied even better by the fd8df76 fold. Nothing becomes false. → drop this finding
- *(low)* **closed medium "ADR-0002 posting obligation is tracked only inside a closed Done row"** — versioning-and-announcements.md:44-46 instructs "Record the obligation on the row in todo.md when the ADR is accepted" — done at todo.md:559-561. A live home also exists: the owner-gated list at todo.md:339 already carries "portfolio copy alignment", and CE-W8 (Active, :219-224) is the cross-repo fact sync that would carry the New-Architecture statement. → downgrade to low: add an ADR-0002 pointer to CE-W8
- *(low)* **road-to-oss low "Arc HYG described as HYG1–HYG8 'NOT before the flip'; HYG9–11 were filed and closed pre-flip" + OSS-HYG low structure duplicate** — Arc HYG's post-flip status is a known deliberate exception, and the statement about HYG1–HYG8 (road-to-oss:1545-1546, todo.md:326-334) remains accurate. HYG9 (todo.md:691, verify.sh wiring), HYG10 (:514, tests that could not fail) and HYG11 (:493, unwired config) are harness/test-hygiene rows that borrowed the prefix; none is an engine SOLID/DRY row. A prefix-reuse note at most. → drop both
- *(low)* **XR low "Arc XR header says two external claims were corrected in §11.2; §11.2 lists three"** — external-review-2026-08.md:519-531 numbers three items, but items 1 and 2 are two claims within the same external row (E-R1) and item 3 is E-R4; todo.md:17-18 counts rows. Semantics, not drift. → drop this finding
- *(low)* **dynamics medium "Both files mandate a 'minor' changeset; check:bump now refuses above-patch" + external-review medium "Plan A's 'one minor changeset per row, never major' contradicts AGENTS.md"** — Both instructions were executed and consumed into 0.3.0 (dynamics d5286bc minor; 905d4d4 folded 51 changesets on 2026-08-25) before check:bump existed (51de0e2, 2026-09-05). No pending action results from either sentence; the docs are completed execution plans. → downgrade both to low
- *(low)* **dynamics medium "'post-flip' framing survives in four places of the tasks doc"** — The spec (dynamics-lift-2026-08.md:14-20) carries the strike-through "~~Post-flip.~~ SUPERSEDED 2026-08-14 — this lands PRE-freeze"; tasks:1601 "Written 2026-08-13 for post-flip execution" is a true historical statement, and Phase 1 (tasks:533) is DONE. Only road-to-oss:1119 is a live stale sentence, already covered by the separate §0.6/§10/§13 planck finding. → downgrade to low
- *(low)* **dynamics medium "Spec §2 freezes a six-name public surface; the shipped barrel is nine names and the six-name version was a 0.3.0 defect"** — dynamics-lift-2026-08.md:78-80 quotes "the portfolio's ratified contract, verbatim" — the six names the consumer uses, which is still true. The package's own surface is specified at tasks:1107-1109 with all nine names, which packages/dynamics/CHANGELOG.md (0.3.1) cites as "the package's own row spec". Only §8:330-331 ("keep the v1 surface at exactly §2") needs a pointer. → downgrade to low
- *(low)* **consumers medium "PT §2.1's O(n) Query._remove premise is gone (ADR-0003), and external-review still routes to it"** — pan-tvardowski-needs:69-72 is a dated consumer ask (2026-08-26) and external-review:23 a dated do-not-refile table (2026-08-31); the live row, XR-7 (todo.md:84-88), records the O(1) swap-remove landing (0ef1aec) and the false-sorted premise. Neither dated record misroutes anyone today. → downgrade to low
- *(low)* **audits medium "P3 calls the save-store swap an open owner-decision; SV2 in the same file records it done"** — game-migration-audit-2026-07.md:110 heads the next section "Save-subsystem redesign — DONE 2026-07-01 (owner ruling: drop back-compat, wipe is fine)" — the decision P3 (:95-97) asks for, resolved the same day in the same file. Ordering, not contradiction. → downgrade to low
- *(low)* **audits medium "Engine version/package count pinned to 0.2.1 / 40 packages" (game-migration-audit-2026-07.md:7)** — The file is dated in its title ("2026-07-01") and its header states "Engine version: 0.2.1" as the migration target of that date; it is a consumption record, not a live claim, and road-to-oss:14-16 lists it among the evidence ledgers. → downgrade to low
- *(low)* **road-to-oss low "H2 row reads as pending ('author ~Sep 28'); the protocol was authored 2026-07-24"** — Claim stands (road-to-oss:1169 still says "author ~Sep 28"), but the date in the 'where' is off: docs/plans/manual-test-protocol.md was added in a3e4a64 on 2026-07-27 ("docs(plans): freeze-window manual-test protocol (OSS-H2)"). → keep at low; correct the authored date to 2026-07-27 / a3e4a64

### 3.5 The public/internal docs split (D3)

Owner decision D3 asked for consumer-facing docs separated from internal ones, plus a versioned
manifest + frontmatter contract that `flare-engine-page` consumes mechanically. 2
agents designed it. **The flip makes every internal doc world-readable**, which is what gives this
urgency it would not otherwise have.

---

# Docs public/internal split + manifest contract (D3) — design

Scope: plans only. Every step below is a row; nothing here was executed. Verified against HEAD `0b613e4` on 2026-09-07, read-only.

#### 0. Facts the design is built on

1. **`docs/design/*` paths are frozen forever.** 39 package READMEs link `https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#…`, `packages/engine/README.md:44` + `packages/react/README.md:17` link `docs/design/adr-0002-…md`, `packages/render-web/README.md:138` links `docs/design/architecture.md`. Those READMEs are inside the published 0.1.0–0.3.1 tarballs; npm does not take a publish back. `docs/design/` is therefore the immovable public root. `scripts/check-readme-snippets.mjs:139` also hardcodes `docs/design/api-specs.md`.
2. **`docs/plans/` has 58 inbound references from 38 files outside itself** (excluding SESSION_LOG.md): `.claude/hooks/session-start.sh:18-19`, `.claude/hooks/verify.sh:178`, both agents, 3 skills, `.github/ISSUE_TEMPLATE/feature_request.yml:11` (absolute URL), `.perf-baseline.json:6`, `benchmarks/results/device.json:4`, `benchmarks/src/{dev-flag.ts:29,index.ts}`, `scripts/{check-perf,check-perf-freshness,flip-access,audit-tarballs}.mjs`, `scripts/lib/perf-gate.mjs`, `apps/bench-web/scripts/testingbot-{probe,session-smoke}.mjs`, and shipped source `packages/react/src/scene-texture.ts:60,140`. `road-to-oss-2026-09.md:7-9` already records the owner's stance on high-inbound renames ("Do not rename"). Renaming the directory buys labelling only — the content is world-readable either way.
3. **The docs site already has a sync pipeline with no engine-side contract.** `consumer-docs-sync-2026-08.md §1`: `flare-engine-page` runs `scripts/sync-engine-docs.ts` (reads package export surfaces), keeps its own `docs-sync/layer-map.json`, and renders an unmapped package as "Unclassified". The layer map exists in **four** places today: `scripts/check-deps-tiers.mjs:37 LAYER_MAP`, `README.md:29-47`, `docs/design/architecture.md` layer diagram, `docs/plans/roadmap.md:23-35`, plus the page's own copy. One source per fact says: one machine-readable source, everything else derived or checked.
4. **No `docs/**` or root markdown carries frontmatter today** (only `.changeset/*` and `.claude/*` do). GitHub and npmjs render YAML frontmatter as a visible table, so frontmatter is viable only for `docs/**` files, never for `README.md`, root governance files or `packages/*/README.md`.
5. Freeze rule (`manual-test-protocol.md`, "How to use"): **no docs restructuring Oct 5–18.** Every move lands before Oct 5 or after Oct 23.

#### 1. Decision: keep the directories, make the boundary mechanical

| Audience | Root(s) | Rule |
|---|---|---|
| **public** (consumer + contributor) | root governance files, `docs/design/`, `docs/references/`, `docs/recipes/`, `docs/conventions/`, `docs/roadmap.md` (new), `packages/*/README.md`, `packages/*/CHANGELOG.md`, `apps/*/README.md`, `.github/*.md` | Every `docs/**` public file carries the §3 frontmatter and is listed in the manifest. Public docs must not link into internal roots (ADRs may cite internal evidence — warning, not error). |
| **internal** | `docs/plans/` (unchanged name), `docs/plans/_local/` (gitignored), `SESSION_LOG.md`, `CLAUDE.md`, `.claude/**` | Never in the manifest, never consumed by the docs site. `docs/README.md` labels `plans/` as internal. Frontmatter optional. |
| **archive** | `docs/history/` | Finished plans/audits/ledgers. Frontmatter required (`audience: archive`, `supersededBy`). In the manifest under `archive` so the site can link provenance without rendering it. |

`docs/plans/` is NOT renamed. If the owner wants the self-describing label anyway, the exact alternative is one `git mv docs/plans docs/internal` plus a sed over the 38 files in fact 2 (`docs/plans/`→`docs/internal/`, `../plans/`→`../internal/`, `(plans/`→`(internal/`); intra-directory relative links survive unchanged. It must land before Oct 5 and is not recommended.

#### 2. Target layout

```
docs/
  README.md                         public index — GENERATED from the manifest (public + archive sections) + a fixed "Internal" paragraph
  docs.manifest.json                NEW — the contract (§3); committed; regenerated + diffed by check:docs
  roadmap.md                        NEW — public half of plans/roadmap.md (§5.2)
  design/                           public, paths frozen (fact 1)
    api-specs.md · architecture.md · dependencies.md · ecosystem.md · lighting-2-5d.md · native-acceleration.md
    adr-0000-template.md · adr-0001 · adr-0002 · adr-0003 · adr-0004-web-scene-capture.md (NEW, lifts web-target §12 so shipped src stops linking a plan)
  references/                       public
    benchmarks.md (generated) · canvaskit-parity.md · cli-image-tooling.md
    (pan-tvardowski/ REMOVED — §5.4)
  recipes/                          public
    save-migrations.md
  conventions/                      public (contributor)
    code.md · git.md · versioning.md (moved from plans/versioning-and-announcements.md)
  plans/                            internal (name kept)
    todo.md · roadmap-state pointer removed (§5.2) · road-to-oss-2026-09.md · flip-runbook.md · manual-test-protocol.md
    pre-flip-audit-2026-09.md · pre-flip-audit-2026-09-findings.md (commit it — currently untracked)
    external-review-2026-08.md · perf-measurement-2026-07.md · web-target-2026-08.md · dynamics-lift-2026-08.md
    consumer-docs-sync-2026-08.md · pan-tvardowski-needs-2026-08.md · portfolio-collapse-needs-2026-08.md
    _local/                         gitignored (unchanged)
  history/                          archive
    build-plan-archive.md (existing)
    + the 11 files in §5.1
    + pt-extraction-history.md (split out of roadmap.md)
    + todo-done-2026.md (post-H1 only, §5.5)
SESSION_LOG.md                      internal, stays at root (harness-coupled: verify.sh:41, session-start.sh:23, settings.json:41)
```

#### 3. The manifest contract — `docs/docs.manifest.json`

Generated by a new `scripts/build-docs-manifest.mjs` (Bun, no deps); `bun run check:docs` = regenerate to a temp path + byte-diff against the committed file + run the link rules. Output is **deterministic**: no timestamps, no commit sha (the page's own sync is already deterministic by design — `consumer-docs-sync-2026-08.md §1 step 4`). Published at every tag; `flare-engine-page` reads it from the engine ref it installs and stops carrying `docs-sync/layer-map.json`.

```json
{
  "schemaVersion": 1,
  "docs": [
    {
      "id": "api-specs",
      "path": "docs/design/api-specs.md",
      "audience": "public",
      "kind": "reference",
      "status": "current",
      "title": "Module API Specifications",
      "packages": ["*"],
      "frontmatter": true
    },
    {
      "id": "readme",
      "path": "README.md",
      "audience": "public",
      "kind": "governance",
      "status": "current",
      "title": "Flare Engine",
      "frontmatter": false
    }
  ],
  "packages": [
    {
      "name": "@flare-engine/math",
      "dir": "packages/math",
      "layer": "0",
      "tier": "Foundation",
      "readme": "packages/math/README.md",
      "changelog": "packages/math/CHANGELOG.md",
      "status": "shipping"
    }
  ],
  "internalRoots": ["docs/plans/", "SESSION_LOG.md", "CLAUDE.md", ".claude/"],
  "archiveRoot": "docs/history/"
}
```

Sources (one per fact):
- `docs[]` — walked from `docs/design`, `docs/references`, `docs/recipes`, `docs/conventions`, `docs/roadmap.md`, `docs/history`; metadata read from each file's frontmatter. Root files without frontmatter are declared in a small static list inside the generator (`README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `TRADEMARK.md`, `CHANGELOG.md`, `PERFORMANCE.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `apps/bench-dashboard/README.md`, `apps/bench-web/README.md`) — `kind: governance | tooling`, `frontmatter: false`.
- `packages[]` — `name`/`dir`/`status` from `packages/*/package.json` (`private`, `publishConfig`); `layer`/`tier` from **`LAYER_MAP` extracted out of `scripts/check-deps-tiers.mjs:37` into `scripts/lib/layer-map.mjs`** so the tier gate and the manifest import one object. `README.md:29-47`, `architecture.md` layer diagram and `docs/roadmap.md` table then carry a `<!-- layer table: derived from docs/docs.manifest.json -->` marker and `check:docs` verifies each package appears under the right layer heading in those three files (fail on drift). Package READMEs get **no** frontmatter (npm rendering); their metadata lives here.

Rules enforced by `check:docs` (errors unless noted):
1. Every file under a public root has frontmatter with the required keys; every `audience: public` doc is under a public root; nothing under `docs/plans/` or `SESSION_LOG.md` is `audience: public`.
2. A public doc may not link (relative or absolute `github.com/grzott/flare-engine/blob/main/…`) into an `internalRoots` path or `_local/`. `kind: adr` docs get a **warning** for evidence citations (ADR-0001 cites `external-review-2026-08.md` ×4 and `todo.md` ×1 — legitimate records).
3. A public doc may not link `github.com/grzott/Pan-Tvardowski` (road-to-oss §0.7: showcase links go to flareengine.dev). Current violations: `api-specs.md:320,776`, `recipes/save-migrations.md:41,64,72`.
4. `status: superseded` requires `supersededBy`; every `docs/history/**` file is `audience: archive`.
5. The committed manifest equals the regenerated one; `docs/README.md` equals its regenerated form.
6. Frontmatter on `docs/references/benchmarks.md` is emitted by `benchmarks/src/index.ts` (the generator) — `check:docs` must accept the `<!-- flare-capture: … -->` stamp on the line after the frontmatter block, and `scripts/check-perf-freshness.mjs:167-189` must keep finding it (verify its regex is not line-1 anchored before landing).

Wire `check:docs` into `ci.yml` next to `check:readme`; CONTRIBUTING step 8 lists it.

#### 4. Frontmatter contract (public + archive `docs/**` files only)

```yaml
---
title: Save migrations                 # required
audience: public                       # required: public | archive   (internal docs carry none or `internal`)
kind: recipe                           # required: reference | design | adr | recipe | convention | guide | index | generated | ledger
status: current                        # required: current | proposal | snapshot | generated | superseded
packages: ["@flare-engine/storage"]    # optional; "*" = engine-wide
since: 0.3.0                           # optional; first engine version the doc applies to
supersededBy: docs/plans/road-to-oss-2026-09.md   # required iff status: superseded
---
```

Initial values worth stating: `lighting-2-5d.md` → `status: proposal`; `ecosystem.md`, `canvaskit-parity.md`, `cli-image-tooling.md` → `status: snapshot` (dated research, not living); `benchmarks.md` → `status: generated`; all ADRs → `kind: adr`; `build-plan-archive.md` and every §5.1 file → `audience: archive, status: superseded`.

#### 5. Exact move list (sequenced)

All `git mv`, all [main-thread]; commit as `docs(plans): …` blocks. Run the link sweep in §6 in the same session as the moves — never leave a move without its sweep.

##### 5.1 Archive → `docs/history/` (finished; each gains a 3-line "superseded / kept as evidence" header + frontmatter)
| From `docs/plans/` | Why finished |
|---|---|
| `extraction-audit-2026-06.md` | road-to-oss:17 "closed; deferred slivers only"; Arc XPACK closed (todo:343) |
| `game-migration-audit-2026-07.md` | 0.2.x migration record; both games on `^0.3.x` since 2026-08-25 |
| `engine-deep-audit-2026-07.md` | superseded as queue 2026-07-03 (its own header); evidence ledger only |
| `package-findings-2026-07.md` | ledger behind the row above |
| `consumer-enablement-2026-08.md` | release N = 0.3.0 shipped 2026-08-25 (`905d4d4`); open CE-W7/W8 are cross-repo rows already in todo |
| `consumer-enablement-2026-08-tasks-a.md` | executed in 0.3.0; **50 checkboxes still `[ ]`** — header must say "executed; checkbox state was never maintained" |
| `dynamics-lift-2026-08-tasks.md` | DYN-1 shipped in 0.3.0; **63 checkboxes still `[ ]`**, same header |
| `web-bench-2026-08-tasks.md` | PERF-6 delivered (`apps/bench-web`, 3 folded lanes); 25 stale `[ ]` |
| `simulation-adoption-2026-08.md` | page swap done (`803ac9a`, `2af931a`); E2 done 2026-08-14; XP7 boundary recorded at api-specs:1064 |
| `benchmarking-completion-2026-08.md` | §1/§2 done 2026-08-19, §3 = PERF-18 fold guard 2026-09-06, §4 = `e7e169e` re-capture; carry any open "OWNER scope decisions" (§"Not blockers") into todo first |
| `consumer-needs-audit-2026-08.md` | CW7 → 0.3.1 shipped 2026-08-28; the queue is todo Arc CW7-Q |

Stay in `docs/plans/` (still load-bearing): `dynamics-lift-2026-08.md` (Arc DYN active, DYN-3), `web-target-2026-08.md` (WEB-H1..H4 open; §12 cited from shipped src), `perf-measurement-2026-07.md` (Arc PERF active; `.perf-baseline.json:6` cites it), `external-review-2026-08.md` (Arc XR active), the two `*-needs-2026-08.md` (CW7-Q asks SoT), `consumer-docs-sync-2026-08.md` (CE-W8 pending).

##### 5.2 Split `docs/plans/roadmap.md` (24 inbound refs; README:19,158, CONTRIBUTING:26, AGENTS:5, CLAUDE:5, docs/README:29, feature_request.yml:11, adr-0000-template:47, cli-image-tooling:131, build-plan-archive:5, both agents:10, start/SKILL:32, flare-tier2-stubs/SKILL:81, flip-runbook step 7)
- **→ `docs/roadmap.md` (public):** "Engine phases — status" table, the OSS-launch line, "Future tracks" minus item 1, the conventions pointers. The layer table is replaced by a manifest-derived table (rule §3). W3's planned `roadmap-post-flip.md` deliverable becomes a **section of this file**, not a second roadmap.
- **→ `docs/history/pt-extraction-history.md` (archive):** "Engine extraction history" table + "Rejected (genre-specific)" list — provenance of what was lifted, engine-side.
- **Deleted from the engine repo:** the "Pan Tvardowski" section body (zone/boss/weapon counts, "Free zones 1–3, paid zones 4–8", PolyForm line, folio note), "When ready to ship", Future-tracks item 1 ("Ship PT — ~$124 + weekend"). The PT repo owns these (the section itself says so). One pointer line to the PT repo remains in `docs/roadmap.md`.
- **Absorbed, not moved:** the "State (2026-07-03…)" block restates version/publish facts owned by `CHANGELOG.md` + road-to-oss §0/§1 → replaced by two pointer lines.
- Every inbound link above → `docs/roadmap.md`; the issue-template absolute URL → `https://github.com/grzott/flare-engine/blob/main/docs/roadmap.md`.

##### 5.3 `docs/plans/versioning-and-announcements.md` → `docs/conventions/versioning.md` (public/contributor policy; AGENTS.md:24 points at it as the posture SoT). Inbound: AGENTS.md:24, todo/road-to-oss (3 refs). Keep the posting-obligation list; it names public sites only.

##### 5.4 `docs/references/pan-tvardowski/` (README + 21 PNG folios, 23 MB) → **removed from the engine tree** (`git rm -r`), handed to the PT repo or `docs/plans/_local/`. It is the private commercial game's design deck (palette hexes, weapon spec tables, boss ships, frame budgets) labelled "retired" by its own README. Also delete the `.gitignore` whitelist block (lines 10–15), `docs/README.md` references row, and the roadmap folio sentence (goes with §5.2). History retention is an F4 owner decision (§8 risk 3).

##### 5.5 `docs/plans/todo.md` `## Done` (lines 436–1685, 409 KB of 487 KB) → `docs/history/todo-done-2026.md` — **only after OSS-H1** has assembled the 0.4.0 changelog from the Done rows (road-to-oss §2.4 depends on them being in place). Post-flip row.

##### 5.6 New public design doc: `docs/design/adr-0004-web-scene-capture.md` — lifts `web-target-2026-08.md §12` (the measured finding that `packages/react/src/scene-texture.ts:60,140` and `tests/scene-texture.test.ts:11` cite). Then those three comments point at the ADR, `api-specs.md:363` points at the ADR, and the plan keeps a one-line pointer. Shipped source stops advertising an internal plan.

##### 5.7 Commit `docs/plans/pre-flip-audit-2026-09-findings.md` (currently **untracked-not-ignored**, 178 KB) before any move session — it is the findings SoT and a `git mv` sweep on a dirty tree is how files get lost.

#### 6. Link sweep (exact sites the moves break or that violate rule 2/3)

Archive moves — relative links that must gain `../history/`: `road-to-oss-2026-09.md:14-17` (Sources line: engine-deep-audit, package-findings, game-migration, extraction), `road-to-oss` §3/§16/§17 mentions of the same, `todo.md` rows citing `consumer-needs-audit-2026-08.md`/`extraction-audit`/`consumer-enablement`, `docs/references/canvaskit-parity.md:158` (`../plans/extraction-audit-2026-06.md`), `apps/bench-web/scripts/testingbot-session-smoke.mjs:3` (comment), `pre-flip-audit-2026-09.md §3` table. Verify with `git grep -n -E 'plans/(extraction-audit|game-migration|engine-deep-audit|package-findings|consumer-enablement|dynamics-lift-2026-08-tasks|web-bench|simulation-adoption|benchmarking-completion|consumer-needs-audit)'` → must return only `docs/history/` or `../history/` hits.

Public→internal links to repoint (rule 2): `docs/design/architecture.md:216` (`../plans/roadmap.md` → `../roadmap.md`), `docs/design/native-acceleration.md:145` (`../plans/perf-measurement-2026-07.md` → `../../PERFORMANCE.md`), `docs/design/adr-0000-template.md:47`, `docs/references/cli-image-tooling.md:131`, `docs/history/build-plan-archive.md:5,207`, `docs/design/api-specs.md:363` (→ ADR-0004), `CHANGELOG.md:13` (road-to-oss link → `docs/roadmap.md`; the whole "Availability" note is deleted at I2 anyway).

Private-repo links to repoint (rule 3): `api-specs.md:320,776`, `recipes/save-migrations.md:41,64,72` (replace the PT `migrate.ts` reference with `packages/storage/tests/` as the in-repo example).

#### 7. Leak scrub before flip (found by this audit; each is a one-line row)

1. **A0 regression** — `flip-runbook.md:55` "granular publish token (Bypass-2FA)" and `todo.md:1598` "granular/Bypass-2FA/E403/E402" reintroduce the credential privilege-class vocabulary A0's done-when forbids in committed `docs/plans`. Rewrite as "publish credential configured (owner, tracked privately)". Add `Bypass-2FA|granular` to the F4 grep.
2. **Local machine paths** — `todo.md:364,368,1611` cite `~/.claude/plans/<slug>.md`; `consumer-docs-sync-2026-08.md:25,65` and `external-review-2026-08.md:4` cite `C:\_PROG\…` (the latter also names a private review document by path). Genericize.
3. **Subscription candor** — `pre-flip-audit-2026-09.md:27-32` states Claude weekly-bucket usage percentages. Move §1 to `_local/`; keep "fan-out runs on `model: 'fable'`" only.
4. **Stale status restatement** — `AGENTS.md:46` says "0.2.1 on npm (restricted)" while `CHANGELOG.md`/roadmap say 0.3.1: drop the number, keep the pointer (one source). `docs/conventions/code.md` package layout still lists `tsup.config.ts` (tsdown since OSS-C4).
5. **SESSION_LOG.md header (lines 3-5)** references two deleted files (`.github/instructions/session-close.instructions.md`, `docs/plans/sessions.md`) and a defunct `/session-close` — rewrite to "appended by `.claude/hooks/verify.sh` at `/close`".
6. **`.claude/` truth pass if it goes public (owner F4):** `flare-tier2-stubs/SKILL.md:8-14,36,81` still says interface-only at 0.1.0 / adapters at 0.2.0 and links a nonexistent `../flare-iap-revenuecat/SKILL.md` (M5 shipped memory/storage providers); `flare-game-dev/SKILL.md:63,111` same era; `retro/SKILL.md:21-23` reveals the sibling-repo and memory-index layout.

#### 8. Sequencing and rows

| Row | When | Session | Scope |
|---|---|---|---|
| DOC-1 leak scrub (§7.1–7.5) + commit the findings file (§5.7) | now, pre-freeze | 1 [MT] | docs/plans, AGENTS.md, SESSION_LOG.md header |
| DOC-2 manifest generator + `check:docs` + frontmatter on all `docs/**` public files + benchmarks generator emits frontmatter + LAYER_MAP extraction | pre-freeze (before Oct 5) or post-flip | 1–2 [MT] | `scripts/`, `benchmarks/src/index.ts`, `docs/**`, `ci.yml`, CONTRIBUTING |
| DOC-3 moves §5.1–5.4, 5.6 + link sweep §6 + regenerate `docs/README.md` | same window as DOC-2, never Oct 5–18 | 1 [MT] | docs/**, README/CONTRIBUTING/CLAUDE/AGENTS/.github/.claude/apps comments, `packages/react/src/scene-texture.ts` comments (engine-builder for that file) |
| DOC-4 page adopts the manifest (drop `docs-sync/layer-map.json`, read `packages[].layer` + `docs[]`) | G-lane, page repo | 1 | flare-engine-page only |
| DOC-5 `todo.md` Done → history (§5.5) | post-H1 | 1 [MT] | docs/plans, docs/history |
| Owner F4 | Oct 2–5 | — | ratify: `.claude/` + `SESSION_LOG.md` public; PT folio history; author email |

Verification for DOC-3: `bun run check:docs` green; `git grep -n -E 'docs/plans/|\.\./plans/' -- docs/design docs/references docs/recipes docs/conventions docs/roadmap.md README.md CONTRIBUTING.md CHANGELOG.md PERFORMANCE.md` returns only ADR evidence citations; `git grep -n 'Pan-Tvardowski' -- docs/design docs/recipes docs/roadmap.md` returns zero; `git status` clean after the commit blocks.

**Risks.** Frozen paths: docs/design/api-specs.md, docs/design/adr-0002-…md and docs/design/architecture.md are linked by absolute URL from READMEs inside published tarballs 0.1.0–0.3.1; any future move of docs/design breaks npm-rendered docs permanently. The design pins docs/design as the public root for… · History is not the tree: docs/plans/monetization-strategy-2026-07.md + oss-launch-audit-2026-07.md live in commits ba173cc/de9f4b6/5478900 and the 23 MB PT folio set lives in history since April; the split cannot fix that. F4 (Oct 2–5) is the owner's decision point — filter-repo breaks every SHA… · A0 regression already happened once (flip-runbook.md:55, todo.md:1598 reintroduced 'granular/Bypass-2FA'); without adding those tokens to the F4 grep and to check:docs (as a banned-vocabulary list for docs/plans), it will happen again in the next runbook edit. · Freeze window: manual-test-protocol forbids docs restructuring Oct 5–18, Arc XR + Arc OSS P0 rows still compete for the ~4 pre-freeze weeks, and DOC-2/DOC-3 are 2–3 [MT] sessions. If they slip, they run Oct 24+ — meaning the docs site launches against a heuristic sync and the archive moves happen… · todo.md Done rows feed the OSS-H1 0.4.0 changelog assembly (road-to-oss §2.4); splitting Done into docs/history before H1 breaks that workflow. DOC-5 is sequenced post-H1 for this reason and must not be pulled forward. · Two layer-map sources persist until flare-engine-page adopts the manifest (DOC-4 is page-repo work in the G-lane): until then the page's docs-sync/layer-map.json can still render a package as 'Unclassified' on flip day. The engine-side generator alone does not close that gap. · benchmarks.md is generated with a capture stamp on line 2 that scripts/check-perf-freshness.mjs:167-189 parses; emitting frontmatter above it changes line positions. Verify the stamp regex is not line-anchored before DOC-2 lands, or the freshness canary goes red for a non-perf reason during the… · pre-flip-audit-2026-09-findings.md is untracked-not-ignored at HEAD; a git mv session on that tree either commits it accidentally under a move commit or leaves it behind. Commit it first (§5.7). · The .claude/ and SESSION_LOG.md 'public' default is an owner decision at F4, not a settled fact; this inventory classifies them internal-but-published. If the owner reverses, they must be git rm'd from the tree AND accepted in history, and verify.sh/session-start.sh/settings.json need a new log… · Shipped source comments (packages/react/src/scene-texture.ts:60,140) link an internal plan; fixing them is an engine-builder edit inside packages/** and needs its own row (D1 forbids doing it inside this audit). Until ADR-0004 exists, the link target must not be archived.

---

# D3 — public/internal docs split, manifest and frontmatter contract

Plans-only. Every "do" below is a row for a later session; nothing here edits the tree.

#### 0. Ground truth this design is built on (verified 2026-09-07, HEAD `0b613e4`)

- 65 tracked files under `docs/` (44 markdown, 21 PNG folios). Only `.changeset/*.md` and `.claude/**` carry frontmatter today; no `docs/**` file does. `scripts/check-bump-level.mjs` already parses frontmatter by regex (`parseLevels`) and reads an ADR's decision status from its body (`isAccepted`) — both are reusable.
- Gate pattern in `scripts/`: bun-runnable plain ESM, `REPO_ROOT` from `scripts/lib/pack.mjs`, `--selftest` that refuses to judge from an unproven gate, exit `0 = ok / 1 = violation / 2 = harness error`, PASS/FAIL table plus a "fixer worklist". `check:docs` copies that shape exactly.
- Generated-doc precedent: `docs/references/benchmarks.md` is written by `benchmarks/src/index.ts` (`bench:md`) with a first-line `<!-- Generated by … -->` marker and a `<!-- flare-capture: sha -->` stamp that `check-perf-freshness.mjs:176` reads. **Any edit under `benchmarks/src` stales every perf lane**, so this design never requires one pre-flip.
- `benchmarks/src/index.ts:521` writes a relative link to `../design/native-acceleration.md` into the generated page — that pins `native-acceleration.md` to its current path.
- `check-bump-level.mjs` hardcodes `docs/design/` for `adr-NNNN-*` files; `check-readme-snippets.mjs` hardcodes `docs/design/api-specs.md`; 35 of 42 package READMEs link `https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#…` (absolute, shipped on npm). `docs/design/` therefore stays where it is.
- The harness pins `docs/plans/todo.md` / `roadmap.md` (`.claude/hooks/session-start.sh:18`, `verify.sh:178`, `start` skill, both agents, `CLAUDE.md`, `AGENTS.md`), `road-to-oss-2026-09.md` forbids its own rename (≈30 inbound refs), and `docs/plans/_local/` is a gitignored private folder. `docs/plans/` therefore stays where it is.
- Package READMEs ship in every tarball (`files: ["dist","README.md","LICENSE","NOTICE"]`) and root `README.md` is GitHub-rendered — a YAML frontmatter block would render as a literal table/garbage on npmjs.com and on the repo landing page. **Those files carry no frontmatter; the manifest carries their fields from `package.json` and a fixed table.**
- Bun 1.3.11 (pinned in CI and `packageManager`) exposes `Bun.YAML.parse` and `Bun.semver.satisfies` — checked on this machine: `satisfies('0.3.1', '>=0.3.0 <1.0.0') === true`, `satisfies('0.3.1', '>=0.4.0') === false`. No new dependency is needed for either parsing or range checks.
- Today's consumer (per `docs/plans/consumer-docs-sync-2026-08.md` §1 — the sibling repo was not read): `sync-engine-docs.ts --check` derives a catalog from `package.json` export surfaces plus a hand-kept `docs-sync/layer-map.json`, and an unmapped package renders as **"Unclassified"** instead of failing. That silent fallback is the heuristic D3 retires.
- Date stamps already lie: `api-specs.md:5` says "Last refreshed 2026-08-14" while `feat(physics)`/`feat(math)`/`feat(particles)` edited it on 2026-09-03/04; `architecture.md:3` says 2026-07-12, last commits 08-16, 08-19, 09-01. Freshness must be reachability-based (as `check-perf-freshness` already is), never a hand-typed date — see row DOCS-6.

#### 1. The split — declared roots, not folder guessing

| Root | Audience | Rule |
|---|---|---|
| `docs/design/`, `docs/recipes/`, `docs/references/`, `docs/conventions/` | **public** | every `.md` must carry frontmatter (§2) or be a registered generated doc (§3.3); every one appears in the manifest |
| `docs/plans/`, `docs/history/` | **internal** | never read by the generator; a public page may not link into them with a relative link (rule R7) |
| `docs/README.md` | public index | exempt from frontmatter; holds the generated index block (§3.6) |
| anything else under `docs/` | **unclassified → CI fails** | a new folder (`docs/guides/` one day) must be added to `roots.public` or `roots.internal` in `scripts/lib/docs-manifest.mjs` — a deliberate one-line decision, never an inference |

Physical moves — exactly four, all `git mv`, all in row DOCS-2:

1. `docs/design/ecosystem.md` → `docs/history/ecosystem-landscape-2026-04.md` (a 2026-04 market snapshot listing the `.claude/` harness as a differentiator; not consumer documentation).
2. `docs/design/lighting-2-5d.md` → `docs/plans/lighting-2-5d.md` (self-described "proposal — not approved, not scheduled"; update `roadmap.md:121`, `road-to-oss-2026-09.md:1234`, `api-specs.md:1064`, `docs/README.md:25`).
3. `docs/references/cli-image-tooling.md` → `docs/history/cli-image-tooling-2026-04.md` (2026-04 library research; the decision already shipped in `@flare-engine/cli`).
4. `docs/references/pan-tvardowski/` (README + 21 PNGs) → `docs/history/pan-tvardowski-folios/` (self-described retired; PT is the private commercial game). `.gitignore:12-15` gets the four whitelist lines duplicated for the new path; **the old `docs/references/pan-tvardowski/*` ignore line stays** — the untracked HTML deck lives there and `git mv` leaves untracked files behind.

Everything else stays (reasons in the inventory). `native-acceleration.md` stays public in `docs/design/` because the benchmarks generator links it; it reads as a legitimate "will it ever go native" design page once its private-repo link is fixed.

Rejected alternative: a wholesale `docs/public/` + `docs/internal/` reshuffle. It costs a harness sweep (`session-start.sh`, `verify.sh`, three skills, two agents, `CLAUDE.md`, `AGENTS.md`), a `check-bump-level`/`check-readme` edit, 35 shipped README URLs, a `benchmarks/src` edit (all lanes stale) and a `_local/` gitignore landmine — for no mechanical gain, because the site consumes the manifest, not the tree.

#### 2. Frontmatter contract v1 (inline, `kind: page` only)

Flat YAML between `---` fences, first bytes of the file, parsed with `Bun.YAML.parse`. Unknown keys fail (a typo like `sidebar_order` must not silently drop a page). Nested keys are not used so the block stays grep-able.

| Key | Required | Type / rule |
|---|---|---|
| `id` | yes | `^[a-z0-9-]+(/[a-z0-9-]+)*$`, unique across the manifest, **stable for the life of the page** — rename the file, keep the id; the site keys permalinks on it (`/docs/<id>/`). Convention: `design/architecture`, `design/api-specs`, `adr/0003`, `recipes/save-migrations`, `reference/canvaskit-parity`, `contributing/code-conventions`. |
| `title` | yes | ≤ 80 chars, no trailing period. The body keeps its `# H1` for GitHub readers; the consumer strips the first H1 line of every `kind: page` body (fixed rule, not a match heuristic). |
| `description` | yes | one sentence, ≤ 200 chars — the sidebar/OG blurb. |
| `sidebarGroup` | yes | enum `design \| adr \| reference \| recipes \| contributing \| packages`. `getting-started`/`guides` are reserved for pages the site authors itself and are invalid here. |
| `sidebarOrder` | yes | integer ≥ 0; `(sidebarGroup, sidebarOrder)` unique so ordering is deterministic; ties impossible. |
| `status` | yes, **except group `adr`** | enum `draft \| current \| superseded \| archived`. `draft` = excluded from the site and from R5; `archived` = rendered under an "archived" banner, R5 skipped. For `adr` it is **derived from the body's `Status` line** (`Proposed`→`draft`, `Accepted`→`current`, `Superseded by ADR-NNNN`→`superseded` + `supersededBy: adr/NNNN`) using the exported `isAccepted` logic; declaring it in an ADR's frontmatter fails — one source for the decision status. |
| `appliesTo` | yes for `current`/`superseded` pages; **forbidden for `adr`** | semver range (`>=0.3.0 <1.0.0`). Meaning: "the lockstep line this page is maintained for; the current version must be inside it". R5 checks `Bun.semver.satisfies(engineVersion, appliesTo)`. A page may describe unreleased HEAD (the tag pins content to version); what R5 catches is a floor bumped ahead of the cut (`>=0.4.0` at 0.3.1) or a ceiling forgotten after a cut (`<0.4.0` once 0.4.0 is versioned). ADRs are decisions, not version claims; their changeset citation is the version linkage. |
| `canonical` | yes | `self`, or one `Bun.Glob` pattern naming the code this page mirrors — `packages/*/src/index.ts` (api-specs), `packages/*/package.json` (dependencies), `scripts/lib/tiers.mjs` (architecture's layer table), `packages/render-web/src/*.ts` (canvaskit-parity), `biome.json` (code conventions). R4 requires ≥ 1 match; DOCS-6 turns it into a freshness canary. |
| `supersededBy` | iff `status: superseded` | an existing manifest `id`. |
| `generatedBy`, `generatedFrom` | **forbidden inline** | generated docs are sidecar-registered (§3.3) — the generator would overwrite the block anyway. |

No `version`, `date`, `lastUpdated`, `author` keys: nothing mechanical may read a hand-typed date.

Forbidden locations (rule R8 fails if a `---` block is present): `packages/*/README.md`, `packages/*/CHANGELOG.md`, every root `*.md`.

Examples the executing session copies:

```yaml
---
id: design/architecture
title: Architecture
description: Layer diagram, dependency direction, game-loop order and the rendering pipeline for the 42-package scope.
sidebarGroup: design
sidebarOrder: 10
status: current
appliesTo: ">=0.3.0 <1.0.0"
canonical: scripts/lib/tiers.mjs
---
```

```yaml
---
id: adr/0003
title: Query removal is O(1) swap-remove; iteration order is unspecified
description: Why Query._remove switched to swap-remove and what a consumer may no longer assume about iteration order.
sidebarGroup: adr
sidebarOrder: 3
canonical: packages/ecs/src/query.ts
---
```

Initial orders: design — architecture 10, dependencies 20, api-specs 30, native-acceleration 40; adr — template 0, then the ADR number; reference — benchmarks 10, canvaskit-parity 20, PERFORMANCE 30, CHANGELOG 40; recipes — save-migrations 10; contributing — CONTRIBUTING 10, code 20, git 30, CODE_OF_CONDUCT 40, SECURITY 50, TRADEMARK 60; packages — derived (layer rank, then name).

The ADR template keeps `id: adr/0000`. Copying it verbatim into a new ADR produces a duplicate id, so R9 fails until the author sets the real id — the same "copy, do not edit in place" rule the template already states, now enforced.

#### 3. The manifest

##### 3.1 Files

| Path | Nature |
|---|---|
| `docs/public-docs.manifest.json` | **generated, committed, never hand-edited** (first key `"$comment": "generated by bun run docs:manifest — do not edit"`) |
| `docs/public-docs.schema.json` | hand-written JSON Schema 2020-12, `$id: https://github.com/grzott/flare-engine/blob/main/docs/public-docs.schema.json`, carries `"x-schemaVersion": 1` |
| `scripts/lib/tiers.mjs` | `LAYER_MAP` + tier labels **moved out of** `scripts/check-deps-tiers.mjs`, which imports it back. One source for a package's layer; the page deletes `docs-sync/layer-map.json`. |
| `scripts/lib/docs-manifest.mjs` | pure logic: walk public roots, parse frontmatter, derive ADR status, build package/changelog/root/generated entries, validate, `selftest()`; no I/O outside `REPO_ROOT` |
| `scripts/build-docs-manifest.mjs` | `bun run docs:manifest` — writes the manifest and the `docs/README.md` index block |
| `scripts/check-docs-manifest.mjs` | `bun run check:docs` — §4 |

The manifest is not in any package's `files`, so it never ships to npm. Consumers read it from the repo at a tag (`@flare-engine/engine@<version>` tags already exist per publish) — pre-flip from the local checkout the page already uses, post-flip from `https://raw.githubusercontent.com/grzott/flare-engine/<tag>/docs/public-docs.manifest.json`. `engineVersion` is read from `packages/engine/package.json` (lockstep — any package would do; `engine` is the umbrella whose tag the consumer pins).

##### 3.2 Shape

```json
{
  "$comment": "generated by bun run docs:manifest — do not edit",
  "$schema": "./public-docs.schema.json",
  "schemaVersion": 1,
  "engineVersion": "0.3.1",
  "roots": {
    "public": ["docs/design", "docs/recipes", "docs/references", "docs/conventions"],
    "internal": ["docs/plans", "docs/history"]
  },
  "groups": [
    { "id": "design", "title": "Design", "order": 10 },
    { "id": "adr", "title": "Decisions (ADR)", "order": 20 },
    { "id": "reference", "title": "Reference", "order": 30 },
    { "id": "recipes", "title": "Recipes", "order": 40 },
    { "id": "packages", "title": "Packages", "order": 50 },
    { "id": "contributing", "title": "Contributing", "order": 60 }
  ],
  "docs": [
    {
      "id": "design/api-specs", "kind": "page", "path": "docs/design/api-specs.md",
      "title": "API specifications", "description": "…",
      "sidebarGroup": "design", "sidebarOrder": 30,
      "status": "current", "appliesTo": ">=0.3.0 <1.0.0",
      "canonical": "packages/*/src/index.ts"
    },
    {
      "id": "reference/benchmarks", "kind": "generated", "path": "docs/references/benchmarks.md",
      "title": "Benchmarks", "description": "…",
      "sidebarGroup": "reference", "sidebarOrder": 10, "status": "current",
      "appliesTo": ">=0.3.0 <1.0.0", "canonical": "benchmarks/src/index.ts",
      "generatedBy": "bun run bench:md",
      "generatedFrom": ["benchmarks/results/microbench.json", "benchmarks/results/web.json",
                        "benchmarks/results/web-gpu.json", "benchmarks/results/web-android.json",
                        "benchmarks/results/device.json"]
    },
    {
      "id": "pkg/math", "kind": "package", "path": "packages/math/README.md",
      "title": "@flare-engine/math", "description": "Vec2, Rect, Transform, Color, easings, intersection tests",
      "sidebarGroup": "packages", "sidebarOrder": 0, "status": "current", "canonical": "packages/math/src/index.ts",
      "package": { "name": "@flare-engine/math", "version": "0.3.1", "layer": 0, "tier": "Foundation",
                   "private": false, "status": "stable", "entryPoints": ["."], "changelog": "packages/math/CHANGELOG.md" }
    },
    {
      "id": "root/contributing", "kind": "root", "path": "CONTRIBUTING.md",
      "title": "Contributing", "description": "…", "sidebarGroup": "contributing", "sidebarOrder": 10,
      "status": "current", "appliesTo": ">=0.3.0 <1.0.0", "canonical": "self"
    }
  ]
}
```

Entries are sorted by `(group.order, sidebarOrder, id)`; `sidebarOrder` for `kind: package` is `layerRank * 100 + alphabetical index` so the layer table renders without a lookup. **No timestamps, no commit sha** — the page's sync is deterministic today and stays so; the tag is the provenance. `additionalProperties: false` on every object.

##### 3.3 Where each kind's fields come from (one source per field)

| `kind` | Files | Source of fields |
|---|---|---|
| `page` | `.md` under public roots | inline frontmatter (§2) |
| `generated` | `GENERATED_DOCS` table in `docs-manifest.mjs` — today exactly `docs/references/benchmarks.md` | the table (path, title, description, group, order, appliesTo, canonical, generatedBy, generatedFrom, first-line marker regex `^<!-- Generated by benchmarks/src/index\.ts`) |
| `package` | `packages/*/README.md` (42) | `package.json`: `name`→title, `description`, `version`, `private`, `exports` keys→`entryPoints`; `scripts/lib/tiers.mjs`→`layer`/`tier`; `package.status` = `unpublished` if `private`, else `package.json` `flare.docs.status` (`stable \| beta`, optional, DOCS-5) else `stable` |
| `changelog` | `packages/*/CHANGELOG.md` (42) | attached to the package entry as `package.changelog`; `generatedBy: "changeset version"` (not a sidebar page) |
| `root` | `ROOT_DOCS` table: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `TRADEMARK.md` (group contributing), `PERFORMANCE.md`, `CHANGELOG.md` (group reference) | the table. `README.md` is deliberately absent — the site's landing page is site-owned. |

##### 3.4 Versioning the contract, and how a consumer detects a break

- `schemaVersion` is an integer, the first field after `$schema`, mirrored by `x-schemaVersion` in the schema file.
- **No bump:** new doc, moved `path`, content edit, new *optional* field on an entry, new `roots.public` folder.
- **Bump `schemaVersion` (+1):** removing or renaming a field; changing a field's semantics; **adding or removing an enum value** of `kind`, `status`, `sidebarGroup` (consumers switch on them); changing the sort contract; changing the H1-strip rule. On a bump the previous schema is copied to `docs/history/public-docs.schema.v<N>.json` so old tags stay validatable.
- Consumer rules the page's sync commits to (recorded as PAGE-M1, §5): read `schemaVersion` **before anything else** and hard-fail if it is above the supported value; validate against the schema; ignore unknown optional fields; treat an unknown enum value as a hard failure (it can only appear after a bump); assert `engineVersion` equals the installed `@flare-engine/engine` version — a mismatch is *drift* (opens their existing weekly drift PR), not a break.

##### 3.5 What `bun run docs:manifest` writes

1. `docs/public-docs.manifest.json` (canonical JSON, 2-space, trailing newline — byte-stable so `--check` can compare bytes).
2. The block between `<!-- public-docs-index:start -->` and `<!-- public-docs-index:end -->` in `docs/README.md`: one bullet per public entry (`[title](relative path) — description`, grouped by `groups`), replacing today's hand-kept `## Files` lists. The `## Layout` table and `## See also` stay prose.

It walks the filesystem of the declared public roots only (no `git ls-files`), so an untracked new page is seen immediately in `verify.sh` and `docs/plans/_local/` is never opened.

#### 4. `bun run check:docs` — how the manifest stays honest

`scripts/check-docs-manifest.mjs`: runs `selftest()` first (in-memory fixtures: valid page; missing key; unknown key; bad range; floor ahead of version; relative link into `docs/plans`; generated file without marker; duplicate id; frontmatter inside a package README; ADR declaring `status`) and refuses to judge the repo if any fixture misbehaves — the HYG9/`check-bump-level` rule. Then, in order:

| # | Rule | Fails when |
|---|---|---|
| R1 | frontmatter | a `.md` under a public root (not `docs/README.md`, not a `GENERATED_DOCS` path) has no block, a required key is missing, an unknown key is present, an enum/regex/length rule is violated, `appliesTo` is not a range `Bun.semver.satisfies` accepts |
| R2 | classification | a directory directly under `docs/` is in neither `roots.public` nor `roots.internal` |
| R3 | staleness | the manifest regenerated in memory is not byte-identical to the committed file, or the `docs/README.md` index block differs — message: `run bun run docs:manifest`, with the differing paths. This is the rule that catches a listed file that no longer exists, a new page not yet listed, and any frontmatter edit not re-rendered |
| R4 | targets | a `path` is missing on disk; a `canonical` glob matches nothing; a `generatedFrom` path is missing |
| R5 | version | `engineVersion` ≠ `packages/engine/package.json` version, or any non-private `packages/*/package.json` version differs (free lockstep tripwire); any `status: current` entry whose `appliesTo` is not satisfied by `engineVersion` — "`docs/x.md` claims `>=0.4.0`; the repo is at 0.3.1" |
| R6 | generated | a `kind: generated` file's first line does not match its marker (hand-edited, or a stale file the generator did not write) |
| R7 | links | in a `kind: page` body, a relative markdown link that does not resolve on disk, or that resolves under an internal root, `.claude/`, `SESSION_LOG.md` or `docs/plans/_local/`. `kind: root` and `kind: package` bodies only need their relative links to resolve (they are GitHub/npm-rendered and legitimately point at the roadmap). Absolute URLs are not fetched; anchors are not checked |
| R8 | forbidden frontmatter | a `---` block in `packages/*/README.md`, `packages/*/CHANGELOG.md` or a root `*.md` |
| R9 | uniqueness/derivation | duplicate `id`; duplicate `(sidebarGroup, sidebarOrder)`; `supersededBy` not an existing id; `status`/`appliesTo` declared on an `adr` page |

Informational (never fails): the list of `draft` pages, so a forgotten draft is visible on every run rather than silently absent from the site. Exit `0 / 1 / 2`; output is the same PASS/FAIL table + fixer worklist as `check:readme`. Cost: pure fs, under a second, no build.

Wiring (row DOCS-3): root `package.json` scripts `"docs:manifest": "bun scripts/build-docs-manifest.mjs"`, `"check:docs": "bun scripts/check-docs-manifest.mjs"`; `.github/workflows/ci.yml` — a `bun run check:docs` step directly after `check:readme`; `.claude/hooks/verify.sh` — `run_gate "docs" bun run check:docs` after the `bump` gate, all scopes (needs no build); `CONTRIBUTING.md` step 8 list and `.github/PULL_REQUEST_TEMPLATE.md` gate checklist gain the command; `AGENTS.md` gains one line: "Public docs carry frontmatter and are listed in `docs/public-docs.manifest.json` — edit, then `bun run docs:manifest`; `check:docs` gates it." `release.yml` is untouched (docs do not ship). Optional in the same row: a root `lint-staged` entry `"docs/**/*.md": ["bun run docs:manifest", "git add docs/public-docs.manifest.json docs/README.md"]` so a docs-only commit can never leave the manifest stale — decide on the row; the CI rule stands either way.

Deliberately out of scope for the gate: prose version mentions (`0.4.0` in sentences — the Arc D grep owns those; `appliesTo` is the mechanical claim), external link liveness, and the api-specs-vs-typedoc duplication (§6).

#### 5. Migration order

All rows are `[MT]` (docs/, scripts/, root files, `.github/`, `.claude/hooks/`) except DOCS-5, and slot into Arc OSS ahead of **OSS-F4 (Oct 2–5)** — F4 ratifies the publish set, and the manifest changes what "public docs" means. DOCS-1…3 ≈ 2.5 sessions against the ~24 recorded as available on 2026-09-01.

**DOCS-1 — contract, generator, gate (1 session).** Create `docs/public-docs.schema.json`, `scripts/lib/tiers.mjs` (move `LAYER_MAP`; `check-deps-tiers.mjs` imports it), `scripts/lib/docs-manifest.mjs`, `scripts/build-docs-manifest.mjs`, `scripts/check-docs-manifest.mjs`, the two root scripts. Not yet wired into CI (it would be red). Done when: `bun run check:docs --selftest` passes; `bun run check:docs` prints the expected red inventory (12 pages without frontmatter, nothing unclassified); `bun run check:deps` is unchanged green after the `LAYER_MAP` extraction; root `tsc`/biome clean on the new scripts.

**DOCS-2 — classify, relocate, frontmatter (1 session).** The four `git mv` of §1 with the `.gitignore` edit in the same commit (`git status` afterwards shows no `docs/references/pan-tvardowski` remnant tracked and the HTML deck still ignored). Frontmatter on the 12 pages: `architecture`, `api-specs`, `dependencies`, `native-acceleration`, `adr-0000…0003`, `save-migrations`, `canvaskit-parity`, `code`, `git`. Normalize `adr-0001`'s header to the template's four lines (it has `Deciders`/`Supersedes` and lacks `Consumer impact`/`Release level`). Rewrite cross-boundary relative links to absolute GitHub URLs: `adr-0001` ×5 (`../plans/external-review-2026-08.md`, `../plans/todo.md`), `architecture.md:216`, `native-acceleration.md:145`, `canvaskit-parity.md:158`. Fix the private-repo links R7 cannot see, per road-to-oss §0.7: `save-migrations.md:41,64,72`, `api-specs.md:320,776`, `native-acceleration.md:9` (inline the snippet or point at the flareengine.dev showcase). Rewrite `docs/README.md` around the index markers. Run `docs:manifest`. Done when: `bun run check:docs` is green and the manifest lists 12 pages + 1 generated + 42 packages + 42 changelogs + 6 root entries.

**DOCS-3 — wire the gate (0.5 session).** The §4 wiring. Done when: CI is green with the step present, and a throwaway `docs/design/scratch.md` without frontmatter turns both CI and `verify.sh` red (proves detection — the HYG9 lesson), then is removed.

**PAGE-M1 — consumer handshake (page repo; recorded in road-to-oss §10 G-lane as an obligation, executed in that repo's harness).** `sync-engine-docs` reads the manifest at the pinned engine tag, applies §3.4's consumer rules, copies `docs[].path` bodies with the first H1 stripped, deletes `docs-sync/layer-map.json`, keeps typedoc for the API reference. Must land **before the Oct 5–18 §6 docs-site check** in `manual-test-protocol.md`, so the site the owner tests is the manifest-driven one, and folds into the "at freeze" `^0.4.0` dep bump already listed under G2.

**DOCS-4 — flip-day touch (inside OSS-I1/I2, no extra row).** After the flip commit, the raw-URL consumption path (§3.1) is live; I2's "docs-site links resolve" checkbox covers it.

Post-flip:

**DOCS-5 — package status field + regenerated README table (engine-builder, `packages/**` manifest-only, no `src`, so no changeset per `check-changeset`'s src-only rule).** Add `"flare": { "docs": { "status": "beta" } }` to `packages/pathfinding/package.json` (the one non-stable package today); regenerate the root `README.md` "Packages" table from the manifest between `<!-- packages-table:start/end -->` markers (R3 extends to it) so the Status/Layer/Description columns stop being a third hand-kept copy of `package.json` + `LAYER_MAP`.

**DOCS-6 — freshness canary (`check:docs --freshness`, 1 session).** For every entry whose `canonical` is a path/glob: commits touching the matches since the doc's last commit → listed as STALE, warn-only for one cycle, then promoted to fail in `verify.sh` for engine/mixed scopes — the `check-perf-freshness` reachability algorithm, reusing `scripts/lib/git.mjs`. Retire the hand-typed "Last updated / Last refreshed" lines from `api-specs.md:5`, `architecture.md:3`, `dependencies.md:3`, `canvaskit-parity.md:3` in the same row (they are already wrong).

**DOCS-7 — native frontmatter from `bench:md` (bundled with the next benchmark re-capture, never alone).** `benchmarks/src/index.ts` emits the §2 block itself; delete the `GENERATED_DOCS` entry; `kind: generated` keeps its marker rule. Bundled because any `benchmarks/src` edit stales every perf lane.

#### 6. Non-goals stated so nobody re-opens them

- `docs/plans/`, `docs/history/`, `SESSION_LOG.md`, `.claude/` are internal but go public with the repo; OSS-A0 swept and OSS-F4 re-scans them. This design separates them for the *site*, not from the *repo*.
- `api-specs.md` (hand-maintained API tables) and starlight-typedoc (generated from the same `src/index.ts`) are two sources for one fact. Not relitigated here; the manifest makes it visible (`canonical: packages/*/src/index.ts`, `kind: page`) and a post-flip ADR decides whether api-specs becomes `status: superseded` with a stub left at its npm-linked path.
- No `packages/**` edit pre-flip (D1). DOCS-5 is the only package touch and it is post-flip.

**Risks.** Folio relocation landmine: docs/references/pan-tvardowski/ holds an untracked, gitignored HTML deck beside the tracked PNGs; `git mv` leaves the deck behind, and if the old ignore line is dropped a later `git add -A` commits the private deck. DOCS-2 must keep the old ignore line and verify `git… · Manifest churn on docs-only commits: every frontmatter edit needs `bun run docs:manifest` or CI goes red — an outside contributor's first docs PR will hit R3. Mitigations: the error message names the command, CONTRIBUTING step 8 lists it, and the optional lint-staged entry in DOCS-3 removes the… · Two notions of 'status' (doc lifecycle vs ADR decision) — mitigated by deriving the ADR doc status from the body with the same `isAccepted` logic check-bump-level uses; if the derivation is reimplemented instead of imported, a 'Superseded by' ADR could read as accepted in one gate and superseded in… · api-specs.md and starlight-typedoc are two sources for the API surface; the manifest exposes this (canonical: packages/*/src/index.ts) but does not resolve it. Moving or demoting api-specs.md later breaks 35 shipped README URLs on npm forever — leave a stub at the path if that ADR ever lands. · `appliesTo` semantics can be misread as 'every sentence exists in this version'; the contract defines it as a maintained-for range checked against the last cut, with the tag as provenance. Reviewers must not bump floors to `>=0.4.0` before `changeset version` runs or R5 blocks every close until the… · The page's weekly engine-docs-sync keeps working on the pre-manifest heuristic until PAGE-M1 lands; if PAGE-M1 slips past Oct 5 the manual-test §6 docs-site check exercises the old 'Unclassified'-fallback pipeline, not the mechanical one. · Private-repo links survive in public pages (save-migrations ×3, api-specs ×2, native-acceleration ×1) because R7 never fetches absolute URLs; they are enumerated for DOCS-2 but nothing mechanical will catch a new one — a follow-up grep in the Arc D 'Done when' (`Pan-Tvardowski` across public roots)… · A `status: draft` page is invisible on the site by design; a forgotten draft is a missing page, not an error. The gate prints the draft list on every run so it cannot rot silently, but nothing fails. · GitHub renders YAML frontmatter as a table at the top of each public docs/ page in the repo view — cosmetic, and identical to every Starlight-fed repo, but the owner should expect it. · Gate scripts rely on Bun-only APIs (Bun.YAML, Bun.semver, Bun.Glob); CI pins bun 1.3.11 and every check:* already runs under bun, but the scripts will not run under plain Node — consistent with check-perf-freshness, worth stating in the file header. · DOCS-7 (frontmatter emitted natively by bench:md) touches benchmarks/src and therefore stales all lanes including the phone-attached android lane; if it is ever run unbundled it creates the override debt the perf memory warns about.


---

## 4. Flip-checklist reconciliation (W4)

Four readers extracted every step from the four sources that describe the flip — 
[flip-runbook.md](flip-runbook.md), road-to-oss §9/§11/§12/§14, [manual-test-protocol.md](manual-test-protocol.md),
and Arc XR — plus this audit's own findings. **176 steps, reconciled into one ordered list of 61**,
then reviewed by a completeness critic that diffed the result back against the source files.

**The 61-step list is deliberately not reproduced here.** Its steps already live in the runbook and the
road-to-oss sections; copying them would create exactly the mirror-row drift this audit spent §3 documenting.
What is recorded below is only what the reconciliation *produced*: the disagreements between those sources,
the steps that exist in none of them, and the capacity arithmetic. The agent-executable rows are filed in
[todo.md](todo.md) as Arc PFA; the owner-only ones are §4.4.

**Citation convention in this section: `todo.md` is cited by row id, never by line.** The queue file is
appended to every session, so a line citation is stale by the time the row it points at is picked up — DOC-1
re-anchored the six that had already rotted. Every other file in this document is still cited `path:line`
against `a62e7ce`.

### 4.1 Contradictions between the four sources, and which one wins

Every row is a disagreement a person following the plan would hit. The resolution names the winner **and the
evidence** — the tree, a gate, a commit, or an owner decision — never a compromise between two documents.

| # | The disagreement | Resolution |
|---|---|---|
| 1 | Scoped package count: '40 scoped' / '40x publishConfig' / 'exactly the 40' vs '41 scoped' / 'all 42'. | The tree wins: 41 scoped + create-flare-app = 42. @flare-engine/dynamics landed 2026-08-16 after the text was written; f016c2e fixed three runbook lines and missed two. Edit every '40' in the cited lines to '41' ('all 42' where the total is meant), and change road-to-oss:1011's F1 done-when to 'exactly 41'. scripts/flip-access.mjs derives the set at runtime and already prints 41. |
| 2 | A local bun run version 'must set GITHUB_TOKEN or transiently set changelog: false or changeset version dies' (@changesets/changelog-github). | config.json wins: the built-in generator makes no GitHub calls. Delete the parenthetical at flip-runbook.md:137-140 and the clause at :33; post-flip, drop the unused @changesets/changelog-github devDependency at package.json:59. |
| 3 | Which version the step-5 tarball verification fetches: npm pack ... @flare-engine/<pkg>@0.4.0. | The fresh patch version wins - 0.4.0 is the restricted freeze cut with no provenance, so packing it verifies the wrong artefact. Edit :149 to '@<version read from packages/engine/package.json after bun run version>' (or @latest). |
| 4 | Status of the create-flare-app template react pin bug found by F2. | The tree wins: fixed. Edit :42-43 to '- fixed 2026-07-24 (OSS-B32)'. |
| 5 | Whether the flip's publish path has been rehearsed ('this is execution, not discovery'). | Git history wins: the CI path (changesets/action + secrets.NPM_TOKEN + provenance + the release job's own twelve gates) has never executed and its first run is the one-way public release. Edit :1198 to 'the local publish and verdaccio mechanics were rehearsed (F2); release.yml has never run - its first execution is the flip publish', and add pre-flight boxes for the NPM_TOKEN secret and the ENABLE_RELEASE variable… |
| 6 | Where the NPM_CONFIG_PROVENANCE env line goes: 'the release job env'. | release.yml wins. Edit :81-82 to 'the env: block of the changesets/action step, beside GITHUB_TOKEN/NPM_TOKEN'. |
| 7 | Which already-published versions the F3 audit and the access flip expose: '0.1.0, 0.2.0, 0.2.1'. | Tags win: five versions, six after H1. Edit the prose to '0.1.0, 0.2.0, 0.2.1, 0.3.0, 0.3.1 (and 0.4.x after H1)' and extend PUBLISHED_VERSIONS_EXPECTED at audit-tarballs.mjs:58; the discovery path (:250, npm view versions) is already right. |
| 8 | What bun run version actually runs ('changeset version and concretize-workspace-deps', cited at package.json:46). | package.json wins. Edit both to the four-stage chain and the line ref; the omitted stages matter (check:bump refuses an ADR-less minor; bun install rewrites bun.lock, which must be committed). |
| 9 | OSS-H1 says 'author ONE changeset (minor, lockstep, summary assembled from the Arc B/C/M notes)' and section 2 rule 5 says 'No changesets per row; one minor changeset lands in OSS-H1'; check:bump refuses any above-patch changeset without an Accepted ADR citation, CI gates per-row changesets, 14… | The gates win (the check:bump rule is the owner's own 2026-09-05 decision with no override). Edit :111 to 'per-row changesets, gated by check:changeset'; edit H1 (:1127-1128) and the todo.md OSS-H1 row to 'verify the pending set carries the ADR-backed minor (xr13 -> ADR-0002); author no omnibus changeset; bun run version'. The 0.4.0 changelog is the pending per-row set. |
| 10 | Pending changesets tell opposite stories for the same 0.4.0 cut: xr1-old-arch-claim-qualified.md (>=3.19.1, old-arch 'intended but not verified') vs xr13-worklets-scheduleonui.md (>=4.0.0 + worklets, old-arch dropped). | xr13 + the tree win. Delete xr1-old-arch-claim-qualified.md (fold any surviving fact into xr13), confirm check:changeset still covers engine + react, append 'Superseded 2026-09-05 by XR-13' at the todo.md Active XR-1 row and the XR-1 (residue) Done row. Must land before any changeset version (CR-2). |
| 11 | 'No publishes mid-arc' vs 0.3.0 (2026-08-25) and 0.3.1 (2026-08-27) published mid-arc. | todo.md wins (explicit owner decision). Edit section 2.5 to record the 2026-08-18 decision to cut 0.3.x mid-arc as the consumer-enablement release. |
| 12 | .changeset/README.md says lockstep is via the linked group and publishable packages still need private: true -> false. | config.json wins. Rewrite README:19 to 'fixed group [["@flare-engine/*", "create-flare-app"]]' and :26 to 'only create-flare-app flips private at the flip commit'. |
| 13 | AGENTS.md says 'Status: 0.2.1 on npm (restricted)'. | The tree wins. Drop the literal and point at CHANGELOG.md (one source); AGENTS.md ships to every reader via CLAUDE.md. |
| 14 | '1.0.0 is the public launch' vs the runbook's 0.4.x public re-cut. | The runbook wins: the flip is a version-bump-only lockstep patch re-cut as 0.4.x. Edit versioning section Reserved numbers to 'flip = 0.4.x public re-cut; 1.0.0 reserved, unscheduled' and AGENTS.md:23 to '1.0.0 = reserved'. |
| 15 | XR-7 Active row says the close sequence (retune uncommitted, baseline.test.ts red, re-capture) is still to do; every step is in HEAD - but that fold was unpinned and should have been refused. | The tree wins: XR-7 closes as Done (0ef1aec/942ba88/87527aa/e7e169e). Move the row to Done with the note 'fold was unpinned at 12.2% foreign load; superseded by the PF-9 pinned freeze capture'. The owed re-capture is PF-9, not XR-7 residue. |
| 16 | XR-1 Active row and external-review section 11.4 say the reanimated peer is >=3.19.1, Reanimated 3 viable, old-arch claim 'stays true'; the tree and ADR-0002 say >=4.0.0 + worklets, New Architecture required. | ADR-0002 + the tree win. Rewrite the XR-1 Active row to the >=4.0.0 + worklets >=0.7.0 floor with only half (b) open; stamp external-review section 11.4 item 1 'Superseded by ADR-0002'. |
| 17 | XR-1 row says xr1-reanimated-peer.md is 'the only pending changeset in the repo'; the 2026-09-01 recompute says XR-1b/XR-1c/XR-2/XR-6 remain and 'B/C/D/M all shipped in 0.3.0'. | The tree wins: all four are closed; 14 changesets pending (13 after CR-2); M7/M8/M8b/M9/B18/B23b/M11-additive are landed but unreleased. Delete :33's sentence; rewrite :294 to 'remaining = XR-1(b) owner probe, OSS-F4, OSS-H1, PF-9 capture, cross-repo bumps'. (Readers reported 14/15/16 pending; verified count is 14.) |
| 18 | XR-2 has no Done row although the work landed (ADR-0001). | The tree wins. Add the XR-2 Done row (245b198, docs/design/adr-0001-renderer-and-threading.md Accepted) in CR-3. |
| 19 | flip-runbook pre-flight shows '[ ] F3 done' while todo.md records OSS-F3 as Done (session #256). | Both, read carefully: the HEAD-tarball half is done; the todo.md OSS-F3 Done row itself says the owner re-runs the authenticated published-version half before freeze, and that July run predates 0.3.0/0.3.1. Keep the runbook box open; append 'published-version half OPEN: owner re-run over 0.1.0-0.3.1 + 0.4.0' to the todo row. |
| 20 | Protocol section 1 Metro box frames a template README saying 'press a/i into Expo Go' as a possible finding, as if unresolved. | The tree wins. Edit :60-64 to 'templates say bun run android first (XR-10); any regression to Expo Go wording is the finding'. |
| 21 | F2 is ticked done but its done-when was amended by XR-11 after the tick (fresh lockfile-free tree, throwaway version) and the rehearsal only proved --skip-install. | The amended done-when is unmet and is exercised by protocol section 1 inside the window (MW-1). Keep the box ticked for its 2026-07-15 scope and add one sentence: 'the XR-11 cold-install proof runs as manual-test-protocol section 1'. The owner may pull it forward pre-freeze; not scheduled here. |
| 22 | F049 Collider/add: one verifier says not a defect / post-flip; two say the 7-positional add is API-shape debt and the change is pre-flip. | The second verifier's split wins: additive addCollider(entity, collider, x, y) + README.md:25 colliderA.isTrigger pre-freeze (non-breaking); removing the positional add is post-flip HYG. Only removal is a semver break. |
| 23 | F002 definePrefab: one says by-reference sharing is the designed contract (docs-only, HYG2); two say it is a published-contract decision for the freeze. | All three agree { ...data } is wrong. The minimum (docs at api-specs.md:67 + prefab.ts JSDoc + a second-spawn identity test) rides PF-2; narrowing PrefabEntry.data to () => T is the owner's call in OWN-DECIDE. |
| 24 | F032 shapes: the finder files the closed glow enum as a pre-flip open/closed violation; the verifier says the enum is the documented contract and PT-vocabulary generalization was already disposed post-flip. | The verifier wins: PF-4 removes only the dead _Skia parameter; the ring is reproducible data-only via ShapeSpec[] composition. |
| 25 | F018 createWebSurface: the finding claims it is materially different from HYG8's item; the verifier shows it is deep-audit row C12 verbatim, already routed to HYG8. | The verifier wins on routing, the defect stands: pull the one item pre-freeze (PF-5) and edit HYG8 to drop it (CR-3). The export cannot present or dispose today. |
| 26 | F078 says every ?? Date.now() fallback fires on the real RevenueCat SDK; F085's three-refuter panel says only the entitlement paths are broken. | The three-refuter panel wins (hybrid-common 18.1.0 mappers emit purchaseDateMillis on StoreTransaction). PF-8 fixes entitlements via latestPurchaseDateMillis and declares purchaseDate with purchaseDateMillis ?? Date.parse(purchaseDate). |
| 27 | DYN-2: 'closes CE-W7 / DYN-2 - swap is done and merged' vs todo.md keeping DYN-2 open re-scoped to retiring vendored tarballs vs dynamics-lift Task 10 calling the swap 'the next row' against @^0.4.0. | The swap is done (edb8517, engine 8701b58, parity 6.8e-13; packages/dynamics/CHANGELOG 0.3.1). The registry-install residue is a different row the owner names (CR-6a); Task 10's ^0.4.0 -> ^0.3.1 on any reading; consumer-docs-sync:3-4 -> 'the portfolio vendors, only the page installs'. |
| 28 | Consumer-enablement decision 1 says W7 (page swap + portfolio dynamics swap) is pre-freeze so both consumers bake before the flip; todo.md classes CE-W7/W8 and DYN-2/3 as post-flip-acceptable. | Owner decision (CR-6b); capacity says post-flip and this checklist assumes it. Record the call in a status header on consumer-enablement-2026-08.md and correct the todo.md Arc OSS 'Recomputed 2026-09-01' paragraph; consequence: render-web and dynamics reach the flip with no consumer bake. |
| 29 | Downward-only rule: 'layer N may only import from layer < N' vs the gate's equal-or-lower. | The gate wins. State the rule once at AGENTS.md:3 as equal-or-lower; correct the three files to link it; README's 'none point sideways' is literally false. |
| 30 | api-specs (canonical) says the 32-component cap is per World; code and both READMEs say module-global. | Code wins (nextComponentId is module scope). Edit api-specs.md:63 to '32 components per process (module-global)' and shorten README.md:102 + ecs README to links (CR-4). |
| 31 | Five tier maps disagree on 11 packages (haptics, cli, devtools, ui-shop, iap-revenuecat, the Tier-2 four, localization/deep-links/share/a11y); only LAYER_MAP is enforced. | LAYER_MAP wins (runs in ci.yml and release.yml, hard-errors on an unmapped scoped package). architecture.md reproduces it; the other four link to architecture.md (CR-4). |
| 32 | F079: api-specs calls react-native-safe-area-context an 'optional peer dep' with a zero-inset fallback; the manifest declares it required with a static import and the hook throws without a provider. | The manifest and shipped behaviour win. PF-7 either implements the fallback via SafeAreaInsetsContext or deletes the claim; the 'optional' wording goes either way. |
| 33 | F039: api-specs and the jps.ts header promise an A*-equivalent fallback when costs vary; the package README says uniform-cost only and the code never reads costs. | Code and README win (f4b0cd5 rewrote api-specs:290 but kept the clause). PF-6 implements the fallback / typed error or deletes the claim per OWN-DECIDE. |
| 34 | /close skill and CLAUDE.md say verify.sh runs four gates; the script runs twelve, restated in 13 more places in four orders, none matching ci.yml. | verify.sh wins. Every restatement becomes 'see .claude/hooks/verify.sh' (CR-4). |
| 35 | git.md lists 7 commit types where commitlint enforces 9. | The enforcer wins. git.md:11 and architecture.md:301 link commitlint's type-enum instead of listing types. |
| 36 | Runbook tag example v0.4.x-public matches no convention. | Keep a marker tag but say so: edit :125 to 'tag a marker (e.g. flip-2026-10-20); changesets/action adds the per-package release tags on publish'. |
| 37 | The freeze-window rule to pause any commit-back perf cron. | The tree wins: no cron exists. Edit :1164-1167 to 'no scheduled workflow exists; do not merge dependabot PRs Oct 5-18'. |
| 38 | F2/H2 describe the split version chain as changeset version && concretize && bun install at package.json:46. | package.json wins. Edit to 'check:bump -> changeset version -> rewrite 0.4.99 -> concretize -> bun install (package.json:52)'; intent unchanged, check:bump passes for a patch changeset. |

### 4.2 Steps that exist in no source

The critic diffed the reconciled list against the runbook, the protocol and the owner ledger, and checked
every tool the list names actually exists. Its verdict on coverage:

> Coverage is essentially complete: every runbook box (pre-flight through step 7), every manual-test-protocol section (§1–§7 + exit criteria), every §11/§12 item and every §14 owner-ledger row maps to a checklist id; the four irreversible actions (FW-1 repo public, FW-5 access flip, H1-c and FW-9 publishes) are owner-only; the F3-PUB→VERDACCIO and F3-040→VERDACCIO orderings hold; and every tool the list names exists (scripts/flip-access.mjs, scripts/audit-tarballs.mjs with dynamic `npm view versions` at :250, root bench:pinned/promote/md, benchmarks bench:web:promote with --lane, `bun run version` = check:bump→changeset version→concretize→bun install, `bun run release` chain, ADR-0002 Accepted so xr13 is the sole minor and passes check:bump). One high-severity omission survives: the VERDACCIO step (seq 30) and MW-8's re-publishes apply `private:false` to create-flare-app, whose package.json carries `publishConfig.registry: https://registry.npmjs.org/` (since 31dc323, 2026-04-20) — `changeset publish` honours it, so the throwaway 0.4.99 scaffolder would publish to the REAL registry…

What it found missing — these are **not** in any current plan document:

- **(high)** VERDACCIO (seq 30) and every MW-8 re-publish will push create-flare-app@0.4.99 to the REAL npm registry, not verdaccio. The step applies the flip-commit edits (create-flare-app private→false) and runs `bun run release` with a project-scoped .npmrc, but create-flare-app's manifest pins `publishConfig.registry: https://registry.npmjs.org/` (plus access public), which npm/changesets honour over any .npmrc. With the rotated token in ~/.npmrc the unscoped scaffolder publishes publicly at a throwaway version before the flip (72h unpublish window, then permanent). The July F2 rehearsal avoided this with a 'rehearsal-only publishConfig.registry→verdaccio redirect' that is recorded only in the F2…
  - *Evidence* — packages/create-flare-app/package.json publishConfig = {access:'public', registry:'https://registry.npmjs.org/'} (git log -S shows it since 31dc323, 2026-04-20); docs/plans/todo.md OSS-F2 Done row: '+ create-flare-app private:false + a rehearsal-only publishConfig.registry→verdaccio redirect'; docs/plans/flip-runbook.md:30-43 (F2 box) and docs/plans/manual-test-protocol.md:13-36 never mention the pin; checklist seq 30 and MW-8 text omit it.
  - *Action* — Add to seq 30 and MW-8: on the throwaway branch also rewrite (or delete) packages/create-flare-app/package.json publishConfig.registry to http://localhost:4873/ before `bun run release`; after each rehearsal assert `npm view create-flare-app --registry https://registry.npmjs.org/` still 404s. Fold the same line into the runbook F2 pre-flight box and the protocol preamble so the fact has one tracked source. Keep the real pin untouched in the FW-6 flip commit.
- **(medium)** FW-10 is assigned to 'agent' but cannot be executed by one: `npm pack --registry …` ×41 is denied to agents by the project settings deny list and the pre-bash guard's FORBIDDEN_PM (npm/npx), and F3-EXTEND explicitly refuses to add a --registry flag to the bun audit script (todo.md HEAD:826-828), so there is no agent-runnable, registry-pinned path. The same deny applies to any agent attempt at `npm view` in FW-10's provenance check.
  - *Evidence* — .claude/settings.json deny: 'Bash(npm:*)', 'Bash(npx:*)'; .claude/hooks/pre-bash-guard.sh FORBIDDEN_PM = {npm, npx, yarn, pnpm} (unwraps bash -c/eval/bun -e wrappers); scripts/lib/pack.mjs:23 `npm(...)` inherits ambient config with no registry argument; checklist F3-EXTEND: 'Do NOT add a --registry flag'.
  - *Action* — Reassign FW-10 to owner-only (or owner-paired with the owner typing the npm commands), or give the agent a bun script it may run (e.g. a `--registry`-pinned mode in audit-tarballs.mjs — which reverses the F3-EXTEND decision and must be stated as such).
- **(medium)** FW-2 says 're-apply branch protection / push rulesets on main immediately after the visibility change', but none exist today: the repo is private on a free plan and both the rulesets and branch-protection APIs return 403 'Upgrade to GitHub Pro or make this repository public'. FW-2 is therefore a first-time application, and a ruleset requiring PRs or blocking direct pushes would break FW-9 (owner pushes main directly), FW-13/FW-15 (direct commits) and changesets/action's tag + release creation via GITHUB_TOKEN. The runbook's 'push rulesets are disabled on visibility change' side effect is moot.
  - *Evidence* — gh api repos/grzott/flare-engine/rulesets → 403 'Upgrade to GitHub Pro or make this repository public to enable this feature'; gh api .../branches/main/protection → same 403; gh repo view → visibility PRIVATE; docs/plans/flip-runbook.md:67-72; .github/workflows/release.yml permissions contents: write (tags/releases pushed by the action).
  - *Action* — Reword FW-2 as 'apply for the first time' with the constraint that the ruleset must allow the owner's direct push to main and GITHUB_TOKEN tag/release creation — or move FW-2 after FW-9/FW-13 so nothing on the critical path can be blocked by an untested ruleset.
- **(medium)** NPM-ROTATE names no token expiry and FW-0 only checks that the Actions secret 'holds the rotated token', not that it is still valid. npm removed legacy tokens in Nov 2025; granular tokens carry an expiry chosen at creation, so a token rotated 'now' with a short expiry dies before Oct 20 and the failure surfaces at FW-9 — after FW-5's point of no return, on the path the checklist says has never executed. npm's docs also state that from August 2026 Bypass-2FA tokens can no longer perform account-governance actions (publishing still allowed) — relevant to what the rotated token can and cannot do on flip day.
  - *Evidence* — https://docs.npmjs.com/about-access-tokens (fetched 2026-09-07): 'As of November 2025, only Granular access tokens are supported. Legacy access tokens have been removed'; expiry 'at least one day in the future' set at creation; 'Starting August 2026, tokens with Bypass 2FA enabled can no longer be used to perform account-identity or account-governance actions'; gh secret list: NPM_TOKEN last set 2026-06-08T17:57:37Z; no 'expir' mention in flip-runbook.md / road-to-oss §14 / todo.md for the credential.
  - *Action* — NPM-ROTATE: create the granular token with an explicit expiry past the buffer (≥ Oct 31, 2026), Bypass-2FA on for the publish path, and record the expiry date in the private ledger. FW-0: add `npm whoami` (local) and a token-expiry check against the recorded date; if the token would lapse, rotate again BEFORE FW-5, not after.
- **(medium)** The first-ever execution of release.yml (changesets/action → `bun run release` under NPM_TOKEN + OIDC) is scheduled after the irreversible FW-5, while the manual window offers a free rehearsal the checklist forbids: MW-8 routes every 0.4.x restricted patch through a LOCAL `bun run release`. Pushing one such patch with ENABLE_RELEASE=true would exercise the action, the NPM_TOKEN secret, the ubuntu npm version (FW-3), and the twelve-gate chain on a restricted release where provenance is not asserted (private repo). Also unexercised in any real cut: `bun run version` gained a `check:bump` prefix after 0.3.1 (51de0e2).
  - *Evidence* — gh run list --workflow=release.yml: every run 'completed skipped' (2026-08-31, 09-01, 09-04); gh variable list: no ENABLE_RELEASE variable; checklist FW-9 'This path has NEVER executed'; checklist MW-8 'owner local bun run release'; git log @flare-engine/engine@0.3.1..HEAD -- package.json → 51de0e2 'build: require an accepted ADR for above-patch bumps'; .github/workflows/release.yml if: vars.ENABLE_RELEASE == 'true'.
  - *Action* — Owner decision: allow ONE window 0.4.x restricted patch (or an empty-changeset re-cut) to publish via CI with ENABLE_RELEASE temporarily 'true', then set it back; record the run id on the runbook pre-flight so FW-9 becomes a rehearsed path. If refused, keep FW-9's fix-forward rule but say explicitly that FW-3's npm-version check is the only pre-verification.
- **(medium)** F4-SCAN ('re-run the full-history secret scan … including the new Bypass-2FA|granular tokens') and DOC-1 ('add Bypass-2FA|granular to the F4 grep') assume a scan procedure and pattern list that exist nowhere in the repo. The June '847-file' pass is recorded only as a result sentence; no tool (gitleaks/trufflehog/git log -p grep) or pattern list is named in any tracked or _local doc, and the only pattern list that does exist (audit-tarballs.mjs PATTERNS) scans tarball bytes, not git history. The Oct 2–5 delta scan therefore cannot be reproduced against the June baseline.
  - *Evidence* — grep -rn 'gitleaks|trufflehog|secret scan' docs/plans SESSION_LOG.md → only road-to-oss-2026-09.md:1076 and engine-deep-audit-2026-07.md:54 ('Secret scan PASSED (full 847-file history…)'); docs/plans/_local/ holds no scan report or pattern file; scripts/audit-tarballs.mjs:60-110 PATTERNS is tarball-scoped.
  - *Action* — Before Oct 2, F4-SCAN (or DOC-1) names the tool and commits the pattern list it will grep with (tokens, keys, emails, local paths, Bypass-2FA|granular, TESTINGBOT_*, u.expo.dev…) to docs/plans/_local/ so the delta scan and F4-RATIFY read the same artifact; state the June baseline commit it diffs from.
- **(medium)** Owner ledger file does not exist. road-to-oss §14 says 'Credential specifics, per-hit audit dispositions, and anything business-candid live in docs/plans/_local/owner-ledger.md', and NPM-ROTATE ('specifics tracked privately'), F3-DISP ('record an owner disposition … in the _local/ ledger') and DOC-1's rewrite ('publish credential configured (owner, tracked privately)') all point at it — but _local/ holds only deep-audit, f3-tarball-audit, monetization-strategy and oss-launch-audit. There is no place where the rotated credential's expiry or the F3 dispositions are meant to land.
  - *Evidence* — docs/plans/road-to-oss-2026-09.md:1241-1242; ls -la docs/plans/_local/ → deep-audit-2026-07-05.md, f3-tarball-audit.md, monetization-strategy-2026-07.md, oss-launch-audit-2026-07.md (no owner-ledger.md); .gitignore:58 ignores docs/plans/_local/.
  - *Action* — Owner creates docs/plans/_local/owner-ledger.md at NPM-ROTATE (token creation date + expiry + scope) and F3-DISP writes dispositions there (or into f3-tarball-audit.md, in which case §14:1241 is corrected to name that file).
- **(low)** create-flare-app is unclaimed on the public registry today, but nothing re-checks the name before the point of no return. FW-9 is that package's FIRST publish; if the unscoped name is taken between now and Oct 20, the failure appears after FW-5 with the whole first-run funnel (npm create flare-app) dead.
  - *Evidence* — https://registry.npmjs.org/create-flare-app → HTTP 404 (fetched 2026-09-07); checklist FW-9 'create-flare-app's FIRST publish'; packages/create-flare-app/package.json version 0.3.1, private true.
  - *Action* — Add to FW-0: `npm view create-flare-app --registry https://registry.npmjs.org/` must still 404 (owner). Optionally decide now whether to hold the name with an early placeholder publish — an owner publish decision, not an agent one.
- **(low)** H1-a's emptiness check is broader than the gate it stands in for: it inspects `git log <capture>..HEAD -- packages benchmarks/src`, but check-perf-freshness only watches `packages/<dir>/src` (transitive closure) plus benchmarks/src. Any package README/CHANGELOG/package.json commit after PF-9 (CR-4-adjacent edits, a stray docs fix) would trigger a needless ~35-minute phone-attached re-capture on freeze day.
  - *Evidence* — scripts/check-perf-freshness.mjs: `const paths = closure.dirs.map((d) => `packages/${d}/src`)` and `freshness.instrument` = ['benchmarks/src'] (.perf-baseline.json); checklist H1-a text.
  - *Action* — Change H1-a's command to `git log <sha>..HEAD -- 'packages/*/src' benchmarks/src` (or simply run `bun run check:perf-freshness`, which is the gate itself).
- **(low)** Several citations are stale or off, which matters because DOC-1/CR-2/CR-3 tell an agent to edit by line: (a) all todo.md line refs are HEAD-relative while the working tree carries +75 uncommitted lines above them (e.g. 'granular' is HEAD:1598 = working-tree:1673; the `~/.` path is HEAD:368), so every later todo.md citation shifts once DOC-1 commits; (b) README 'not on npm yet' is at :127 (not :125-126) and the PT clone is :117-118 (not :118-119); (c) FW-7 says all 199 tags are per-package — 198 are, `perf-baseline-pre-A` is not; (d) FW-6 says the changesets/action step has 'the only env block in the file' — release.yml has two (check:perf's FLARE_PERF_BASE_REF and the action's); (e) CR-4's…
  - *Evidence* — git show HEAD:docs/plans/todo.md | sed -n '1598p;368p' vs working-tree :1673/:443; git status: ' M docs/plans/todo.md'; README.md:117-118, :127; git tag | grep -v '^@flare-engine/' → perf-baseline-pre-A; .github/workflows/release.yml env blocks at the check:perf step and the changesets/action step; docs/conventions/git.md:11; commitlint.config type-enum = 9 values.
  - *Action* — Have DOC-1 re-anchor every todo.md line citation after its commit (or cite by row id); correct the README/FW-7/FW-6/CR-4 wording in the same pass.

### 4.3 Does it fit in the four weeks left

No. The reconciler was asked to do honest arithmetic rather than compress estimates, and this is its answer:

Arithmetic: Mon Sep 7 to Fri Oct 2 is 4 weeks x ~5 = 20 agent sessions, plus the Oct 5 H1 session itself. Demand from the audit alone: PF-1..PF-10 = 12 (2 tilemap/cli, 2 tier-1, 1 each physics / render-web / shapes / input / react-scene-storage / ui-iap, 1 promote fix, 1 phone re-capture); CR-1+2 (1), CR-3 (1), CR-4 (1), CR-5 (1), F3-EXTEND (0.5); DOC-1 (1); F4-SCAN (1) = 18.5. Already queued outside the audit: OSS-M10 (2), OSS-M11 boundary bullet (1), DOC-2 + DOC-3 (2-3), CE-W7/DYN-2 registry install (1-2 if pre-freeze) = 6-8. Total 24.5-26.5 against 20. It does not fit. Cut to post-flip (all are additive or internal, none changes the published API): OSS-M10 (ships as a free additive minor later); DOC-2/DOC-3/DOC-5 (the D3 design itself says never Oct 5-18, so they run Oct 24+ and the docs site launches against the heuristic sync); CE-W7/DYN-2 registry install (consequence: render-web and dynamics reach the flip with no consumer bake - CR-6b records the owner accepting that); CR-5 plan stamping (DOC-3's archive headers absorb it); the M11 boundary bullet unless it rides PF-6's session and PF-9's re-capture, otherwise it ships as a later patch with its own re-capture. Move CR-4 into the manual window (doc fixes are allowed there, restructuring is not). After the cuts: 18.5 - CR-5 (1) - CR-4 (1) = 16.5 of 20, i.e. 3.5 sessions of slack, which is what re-checking the 16 single-refuter findings before opening each row and FREEZE-FIX prep will consume. The hard sequencing constraint, not the total, is the risk: PF-9 must sit in Sep 28 - Oct 2 (the <=7-day rule) AFTER every row that touches the measured closure, so DOC-1, PF-10, CR-1+2, PF-2 (2), PF-6, PF-5, PF-4, PF-3, PF-7 = 10 sessions must all land by Fri Sep 25; PF-1 (2), PF-8 (1) and F3-EXTEND fill the rest of week 3 and week 4 beside PF-9, CR-3 and F4-SCAN because they are outside the closure. Every /close between PF-2 and PF-9 is red on perf-freshness by design; override debt must be zero before Oct 5. If a week is lost, slip in this order: the additive sub-items inside PF rows drop to Arc HYG at no consumer cost (F007 entities getter, F071 getTileSourceRectInto, F072 parseTiled guard, F083 List, F033 triggerTimed, F049 addCollider); then PF-8's non-break items. Never slip the breaks - F076/F064 (published tilemap format + type), the renames (F011, F051), the export/field removals (F050, F056, F034, F070, F090, F073, F087), the contract changes (F059, F069, F079, F086, F005, F018) - each is a semver break against real consumers after Oct 20. The owner-only calendar (token rotation, F3 run, XR-1(b) probe, page/PT sibling rows, the phone for PF-9, F4 ratification) does not compete for the 20 sessions, but F3-PUB must precede any verdaccio use and NPM-ROTATE must precede Oct 5.

### 4.4 The owner-only sequence

Nothing in this list can be done by an agent — it needs credentials, money, a GitHub setting, a physical
device, or an irreversible publish. It is the critical path, so it is worth putting in a calendar.

1. Decision sitting at the first /start halt: F076, F064, F002, F005, F043, F049, F039, F059, F069, F086, F087; CR-6a (DYN-2 name), CR-6b (W7 post-flip), CR-6c (lost ledger); ratify plan defaults. 2. Rotate the npm publish token: ~/.npmrc AND the GitHub secret NPM_TOKEN (last set 2026-06-08); confirm org paid plan and the token covers all 41 names; 2FA device ready. [blocking] 3. Run the authenticated tarball audit over 0.1.0-0.3.1 on a machine with no verdaccio and no registry override, BEFORE the manual window; record a disposition per hit; tick the runbook F3 box. [blocking] 4. XR-1 half (b): npm install a HEAD-packed engine tarball in an empty dir; confirm react-native-reanimated + react-native-worklets install. 5. Sibling repos: page G1 preview deploy + Lighthouse, G2 typedoc/strings/getting-started + ADR-0002 New-Arch statement; PT1 dep cleanup; portfolio copy (PF1). 6. Sep 28 - Oct 2: provide the quiet machine (power plan checked) and the Pixel 7 on adb for the PF-9 freeze capture; owner half of the pinned fold. [blocking] 7. By Oct 5: read the F4 report and record .claude/ public, SESSION_LOG public, author email, history retention, flip date; tick the F4 + ratified boxes. Any 'no' means a git rm before H1. [blocking] 8. Oct 5: commit the version bump, run the local bun run release for 0.4.0 restricted, push main + tags; fixes-only from here; do not merge dependabot. [blocking] 9. Re-run the tarball audit over 0.4.0 before verdaccio comes up. 10. Bump PT / Berek / page to ^0.4.0 from the restricted registry; build PT with native audio. 11. Window Oct 5-18: verdaccio at 0.4.99 (with the agent), walk protocol sections 1-6 (section 1 with the artefact proof is the blocking one), log section 7, create FREEZE-FIX rows, publish each 0.4.x patch, re-green perf by re-capture (phone), tear down the registry override, sign off. [section 1, perf re-green, teardown, sign-off blocking] 12. Flip week pre-flight: every runbook box; confirm the NPM_TOKEN secret is the rotated token; create ENABLE_RELEASE but do not set it true yet. [blocking] 13. Repo -> Public; re-apply branch protection. [public = blocking] 14. Confirm the runner's npm version (with the agent). 15. After the agent's dry-run shows 41 names: flip-access --execute --otp. POINT OF NO RETURN. [blocking] 16. Commit + tag the ONE flip commit the agent prepared; do not push. [blocking] 17. Review the bun run version output incl. bun.lock and commit. [blocking] 18. Set ENABLE_RELEASE=true, push main, watch release.yml publish; on failure fix forward as 0.4.x, never a local release. [blocking] 19. Bind flareengine.dev and deploy the page; prove the registry and run the tokenless cold scaffold x3; commit the badge/README wording; Community Standards + Discussions. 20. Post-flip: decide ENABLE_RELEASE's steady state; Trusted Publishing or token re-rotation calendar; announce when ready with the ADR-0002 statement; portfolio posting obligation.

