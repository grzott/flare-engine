# What `Pan-Tvardowski` needs from the engine (2026-08-26)

Consumer-side requirements doc, written **by the PT repo, for the engine repo**. It states what the
shmup still hand-rolls that is engine-shaped, what 0.3.0 broke on the way in, and which engine
defects PT is currently working around. It specifies no PT work.

**Status of the consumer:** PT migrated `0.2.1 → ^0.3.0` on 2026-08-25/26 and is live on it. **34
packages declared, 33 imported** (`particles` is declared-but-unimported, held for a planned
adoption). Installed from **registry.npmjs.org at `access: restricted`** via a committed `.npmrc`
+ `${NPM_TOKEN}` — no vendoring, no tarballs.

Gate after migration: typecheck, lint (607 files), **2392 tests / 0 fail**, locale parity 509/509,
balance-freeze clean, dependency check clean.

---

## 1. Scope correction — the frame-loop tier is NOT at zero consumers

[`portfolio-collapse-needs-2026-08.md`](portfolio-collapse-needs-2026-08.md) §1 records that
`render-web`, `render`, `postfx` "and the whole frame-loop tier are **back to zero external
consumers**" after the portfolio removed its demo route.

That is true for **`render-web` only**. PT is a live, shipping consumer of the rest of that tier:

| Package | Where in PT | Load-bearing? |
|---|---|---|
| `render` | `SpriteBatch`, `Camera2D`, the whole draw path | yes — every frame |
| `react` | `GameView`, the frame callback, virtual joystick/buttons | yes — the app mounts through it |
| `postfx` | 20 files incl. `postfx-coordinator.ts`, `boss-telegraph.ts`, `settle-clear.ts` | yes — boss readability depends on it |
| `ecs` | `World`/`Query` + 4 adopted systems | yes — every frame |
| `physics` | `CollisionWorld`, `SpatialIndex` | yes — all combat |
| `scene` | `SceneManager`, transitions | yes |
| `shapes` | procedural hulls, `shapeBoundsRadius` | yes — feeds the collider |

The OSS-launch narrative should say **`render-web` has no consumer**, not the frame-loop tier. PT
has been that tier's consumer continuously since the standalone split.

Also worth correcting in [`dynamics-lift-2026-08.md`](dynamics-lift-2026-08.md):
`.npmrc` + `${NPM_TOKEN}` **does** work — for PT, today, against 0.3.0. The portfolio's §5 note is
right that it fails for *unpublished* packages; it is not a general failure of the mechanism.

---

## 2. Engine defects PT is working around right now

These are filed in PT's [`docs/engine-notes.md`](https://github.com/grzott/Pan-Tvardowski) under
"Open engine-side defects", each with a removal trigger.

### 2.1 E11 — cull systems build their own `Query` internally *(highest value)*

`createBoundsCullSystem(world, bounds, onCull)` and `createLifetimeSystem(world, onExpire)` each call
`world.query(...)` internally instead of accepting a caller-supplied `Query`. Two consequences
measured in PT:

**Scan widening.** `createBoundsCullSystem` has no component filter, so it walks every `Position`
entity. PT's old loop walked bullets only. PT therefore gates the destroy inside `onCull`:

```ts
createBoundsCullSystem(world, bulletCullBounds, (id, w) => {
  if (w.has(id, Bullet)) destroyEntity(w, coll, id);
});
```

That gate is **load-bearing, not defensive**: `createZoneImageBg` scrolls two background tiles so one
is always outside the padded bounds. Without the gate, image-bg zones delete their own background on
the first cleanup frame.

**Duplicate-query cost.** Because the systems mint their own queries, PT now holds two of the same
mask (`lifetimeQuery` vs `lifetimeSystem.query`, `posQuery` vs `bulletCullSystem.query`). `World.destroy`
walks *every* registered query and `Query._remove` does `entities.indexOf(id)` — **O(n) linear** — so
every bullet/particle destroy pays two extra ~2,500-element scans. At hundreds of destroys per frame
this dominates the widened read scan.

**Ask:** let both systems accept a caller-supplied `Query`, or an optional component filter:

```ts
function createBoundsCullSystem(
  world: World, bounds: CullBounds,
  onCull: (id: number, w: World) => void,
  query?: Query,          // ← caller supplies; system does not mint one
): SystemDef
```

One change removes the widened scan **and** the duplicate-query cost.

**If declined:** PT keeps the `Bullet` gate and the duplicate queries. Then please document in the
package README that these systems mint a permanent query per call and scan all `Position` holders —
a consumer calling either per-zone will otherwise accumulate queries without noticing.

### 2.2 E9 — `postfx` and `render` declare contradictory signatures for the same call

- `postfx/dist/index.d.ts:17` — `makeShaderWithChildren(uniforms: Float32Array, ...)`
- `render/dist/index.d.ts:657` — `makeShaderWithChildren(uniforms: number[], ...)`

Neither direction is structurally assignable, and `@flare-engine/react`'s `PostFxRuntimeLike` is a
bare alias of `FrameRendererPostFxRuntime`, so there is no alternate exported type to route through.
PT therefore ships a documented `as unknown as` type bridge (`src/fx/postfx.ts`,
`toFrameRendererPostFxRuntime`) in a codebase whose own rules forbid `any` and `@ts-ignore`.

**Runtime is fine** — we traced the compiled JS: `makeShaderWithChildren` is never actually invoked
in `postfx`/`render`/`react` `dist`; `buildPostFxPasses` decomposes the `Float32Array` into a plain
named record before it reaches `<RuntimeShader>`. So this is a pure declaration mismatch.

**Ask:** align the two `.d.ts`. **Removal trigger recorded in PT:** delete the adapter the moment
they agree.

### 2.3 E10 — scene activation can stall

`_updateTransition`'s post-`'out'` activation branch bails when `_preloadResolved` is still false, and
nothing re-drives it until another `update()` arrives. If a transition's duration elapses on the same
tick as a pause or a backgrounding, the scene never reaches `'in'`.

Safe rather than corrupting — the outgoing scene stays alive — and invisible under continuous rAF, so
PT has not hit it in play. Filed because it is real and cheap to fix at the source.

**Ask:** re-drive activation when the preload settles, rather than only on the next `update()`.

### 2.4 `SystemDef._worldFn` is an underscore member on a public interface

`SystemDef` exposes `readonly _worldFn`, and the JSDoc example encourages using it
(`world.addSystem(moveSys._worldFn)`). PT drives systems manually (no `addSystem`), and initially
called `_worldFn(world, dt)` directly before switching to the equivalent public
`fn(query, dt, world)`.

Cosmetic, but the engine goes public in October and this reads as a leaked internal.
**Ask:** rename, or document why the underscore is part of the contract.

---

## 3. Engine gaps PT has asked about before, still open

Carried from PT's `todo.md` **Engine-Collision-Gaps** row, restated here so they live in one place.

### 3.1 Grid/hash broadphase for `SpatialIndex` *(highest gameplay value)*

`SpatialIndex` is a brute-force linear scan: `setPosition` is O(n), `step()` is O(n²), **measured
11.8–13.2 ms at 1,000 colliders**. For a bullet-hell that is the single most binding engine limit —
far more than shape fidelity. Its own source comment invites the upgrade.

PT's homing system (`systems/homing.ts`) still runs a brute-force nearest-enemy scan
(O(bullets × enemies) per frame) **specifically because adopting `SpatialIndex` would not be an
improvement** — it is brute-force too. This is the one place PT declined an engine adoption on
performance grounds.

**Ask:** grid or spatial-hash broadphase. **If declined:** say so in the README so consumers stop
treating `SpatialIndex` as a broadphase.

### 3.2 Collider readback on `CollisionWorld`

There is no way to read back a collider's actual AABB. **Every collider assertion in PT is a
`Sprite`/frame proxy** — the tests assert what we *think* was registered, not what the physics world
holds. During the 0.3.0 migration we had to override `CollisionWorld.add` in a test to capture the
real box.

**Ask:** `getCollider(id): { x, y, w, h } | null`, or equivalent. This would have made the OSS-B26
fallout (§4) directly measurable instead of inferred.

### 3.3 `shapeBoundsBox` — per-axis bounds beside `shapeBoundsRadius`

A radius cannot describe an asymmetric hull, so an asymmetric ship gets a square frame with dead
space on two sides. PT's hitbox rule is *the frame IS the hitbox*, so dead frame is phantom hitbox.

Lower priority than it was — PT's bosses now draw Kenney sprites — but it still binds any procedural
hull.

### 3.4 `createBenchSession` is unreachable from app code

It lives in `@flare-engine/testing`, a devDependency. PT's `check:deps` hard-fails a `src/` import of
a devDependency, and the module in question ships in the app bundle. Its Promise done-latch is also
the wrong shape for the synchronous `isBenchDone()` a render loop polls.

**Ask:** re-export a synchronous bench-session primitive from a runtime package (`core` or `debug`),
or state that bench harnesses are consumer-owned. PT wrote its own; it works; we just want to know
which side of the line this belongs on.

### 3.5 A procedural SFX synthesizer

PT ships a 258-line synthesizer (`src/audio/synth.ts`) generating its SFX procedurally. This is a
**genuine engine gap, not PT sloppiness** — `@flare-engine/audio` has playback and channels but no
synthesis, so any consumer without sourced audio has to write one.

**Ask:** consider absorbing it into `audio`. PT will donate the implementation.
**If declined:** fine — but the README should say audio assets are consumer-supplied.

---

## 4. What 0.3.0 cost this consumer, recorded for calibration

Not complaints — the migration succeeded and the gate is green. Recorded because the engine should
know what its changes cost downstream.

**`OSS-B26` (ship bounds now include weapons + engine square) was the expensive one.** PT derives its
atlas frame side from `shapeBoundsRadius`, and its rule is that the frame *is* the hitbox. The change
therefore inflated **every enemy collider**, measured per-ship:

| Tier | Side delta | Collider area |
|---|---|---|
| enemies | +28…+48 px | 1.58×–2.22× |
| mini-bosses | +55…+90 px | 1.53×–3.28× |
| bosses | +109…+144 px | up to **4.86×** (`wodnik-wislanny`) |

Player hulls were immune, so it would have landed as **pure enemy-hitbox inflation with nothing
compensating** in a bullet-hell. PT's own guard reported it as a **1 px** breach on two hull presets,
because the harness passed `weapons: []` — that is PT's test bug, and it is fixed.

**The lesson for the engine:** a bounds-semantics change is a *gameplay* change for any consumer that
derives collision from bounds. `OSS-B26`'s changeset described it as a bounds correctness fix. A line
saying "consumers deriving colliders from these bounds must re-measure" would have saved a session.

Two further silent breaks worth the same note, both correct fixes that changed observable behaviour:

- **`deep-links` `parseUrl`** — PT's router had encoded the *old parsing bug* as its design. Fixing
  the parser broke every deep link until the router was re-keyed onto path segments. Correct fix,
  but a consumer whose routes depended on the bug had no warning.
- **`share` `FORMAT_CODES`** — `'png'` previously mapped to Skia's JPEG code. PT had been writing
  JPEG bytes into `.png` files for its four store-submission screenshots and never knew.

---

## 5. Something PT built that the engine may want

A **zero-allocation source-construct assertion** for hot-path functions, in
`tests/_helpers/zero-alloc.ts`.

The engine exposes `Pool.created`, `ParticlePool.created` and `SpriteBatch.allocCount`, which are
excellent — but they are cumulative counters over *engine* primitives. They cannot see a consumer's
own per-frame function allocating a temporary, and `ecs`'s `World`/`Query` expose no counter at all.
Heap-diffing does not substitute: we probed `process.memoryUsage()` and `Bun.generateHeapSnapshot()`
and both report a **known-allocating** loop as zero-delta once JIT escape analysis kicks in.

What works is a static assertion over the function body:

```ts
assertBodyHasNoAllocatingConstruct(body, label)
// rejects: new X(), object/array literals in assignment, argument or return
//          position, arrow closures, .map(, .filter(, spread
extractFunctionBody(source, 'functionName')
extractArrowCallbackBody(factoryBody)   // isolates a per-frame callback
                                        // from its one-time factory wrapper
```

It is GC- and JIT-independent, runs in 13 s with the rest of the suite, and it demonstrably fires —
we prove each pattern by inserting the construct, watching it go red, and reverting.

**Ask:** consider a `@flare-engine/testing` export. Every consumer with a hot path wants this, and
the engine's own zero-alloc rule is currently enforced by convention and review rather than by a
gate. PT will donate the implementation.

---

## 6. Priority, from this consumer's perspective

| # | Item | Value here | Value to other consumers | Effort |
|---|---|---|---|---|
| 1 | **E11 — caller-supplied Query on cull systems** (§2.1) | high — removes a widened scan + O(n) per destroy | high — any ECS consumer | S–M |
| 2 | **Grid/hash broadphase** (§3.1) | high — the binding limit for a bullet-hell | high | L |
| 3 | **E9 — align the two `.d.ts`** (§2.2) | medium — deletes a cast from a no-`any` codebase | medium | S |
| 4 | **Collider readback** (§3.2) | medium — every PT collider assertion is a proxy | high — testability | S |
| 5 | **Zero-alloc test helper** (§5) | low here (we have it) | high — donate | S |
| 6 | **E10 — activation stall** (§2.3) | low — not hit in play | medium — correctness | S |
| 7 | `shapeBoundsBox` (§3.3) | low now — bosses use Kenney art | medium | M |
| 8 | Bench-session primitive (§3.4) | low — ours works | low | S |
| 9 | SFX synthesis (§3.5) | low — ours works | medium | M |

**Nothing here blocks PT.** It ships today on `^0.3.0` with a green gate.

---

## 7. Explicit non-goals — do not absorb these from PT

Named so nobody generalises game code that should stay game code:

- **`src/visual-spec/`** — PT's typed presentation schema (palette, ship anatomy, zones, HUD slots).
  Game-specific by construction.
- **The value-budget economy** — `config/balance.ts`, enemy values, zone capacities, drop/pity
  tables, TTK-derived boss HP. This is game design, not engine.
- **The Kenney asset pipeline** — import/recolor/pack scripts. Consumer tooling.
- **The boss `PatternStep[]` timeline.** PT deliberately does **not** use `CoroutineManager`
  (hot-path allocation + non-serializable resume) and does not want it fixed. The zero-alloc,
  component-stored stepper is the right shape for this game.
- **Polish localization and the folklore naming system.** Ratified in a separate lore repo.
- **A DOM/web renderer for anything.** PT renders through Skia.

---

## 8. Verification PT already provides

If any §2/§3 item lands, these are the gates that will catch a regression. All run on every commit:

- **Collision fairness:** `tests/visual-spec/hull-presets.test.ts` pins a per-preset phantom-reach
  budget that **may only ever be lowered**, plus a per-ship expected collider side derived from
  hull-only bounds. This is what caught (and, before it was fixed, understated) `OSS-B26`.
- **Zero-alloc:** source-construct assertions over four engine per-frame callbacks and four
  PT-owned hot-path functions (§5).
- **Entity-lifecycle:** N-entities-resolving-on-one-frame tests across cleanup, score-pop and
  revenge — these exist because `Query` iterates its live backing array and `World.destroy` splices
  it, so an inline destroy skips exactly half. Any change to `Query` iteration or `World.destroy`
  ordering will fail these loudly.
- **Deep-link routing:** real `parseUrl`, all five route families, plus a scheme-less fall-through
  case that pins the `host === ''` distinction.
- **Bench determinism:** a MINSTD known-answer test (seed 1 → state `1043618065` after 10,000 draws)
  plus formula-consistency at 50k draws.
- **Locale parity:** 509 keys, EN/PL, scripted.

2,392 tests, 0 failing, on `@flare-engine/*@^0.3.0` as of 2026-08-26.
