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

---

## 9. Addendum 2026-08-26 — two blockers found in an owner playtest

An owner zone-1 playtest surfaced eight defects. Six are PT's own. **Two are engine-side and PT
cannot fix them from the consumer.** Both are player-facing.

### 9.1 `VirtualButton` + `VirtualJoystick` cannot be used simultaneously *(blocker)*

**Symptom on device:** while a finger holds the movement joystick, pressing the bomb button does
nothing. The controls do not work together.

**Traced cause.** `virtual-button.tsx:51-54`, `virtual-joystick.tsx:85-90` and `game-view.tsx:277-281`
all build on React Native's **legacy single-responder Gesture Responder System**
(`onStartShouldSetResponder` / `onResponderGrant` / `onResponderTerminate`), and none implements
`onResponderTerminationRequest`.

Verified against `react-native@0.83.6`'s negotiation code
(`ReactNativeRenderer-dev.js:16910-16944`): when a second finger touches a button while the joystick
holds the responder, RN grants the button **and force-terminates the joystick** — the termination
request is default-permitted precisely *because* the handler is unimplemented. The joystick snaps to
zero via `releaseJoystick`, and the still-down finger becomes an orphaned touch that will not resume
driving movement until it is lifted and re-pressed.

**This also breaks a second feature.** PT's dash multiplies the *current* joystick vector by
`DASH_SPEED_MUL`. Because the joystick has just been zeroed by the termination, the dash multiplies
zero — the player spends stamina and does not move. One engine defect, two broken mechanics.

**Ask:** per-control pointer tracking, so each control owns its own touch id. Either
- implement `onResponderTerminationRequest` returning `false` on both controls (smallest change), or
- move to `react-native-gesture-handler` with `Gesture.Simultaneous` (PT already has RNGH installed
  as a dependency; **it is currently used nowhere** — zero `GestureDetector`/`Simultaneous`/`Race`
  hits in PT `src/` or in any engine package).

**Not related to the 0.3.0 pointer-delta change.** `packages/input/src/pointer.ts` touches
`InputManager.pointer` (single primary pointer, id 0); `VirtualJoystick`/`VirtualButton` never route
through `InputManager` at all. This is longstanding, not a regression.

**If declined:** PT has no workaround at the consumer layer — the responder negotiation happens
inside the engine components. A twin-stick or button-while-moving game cannot ship on these controls.

### 9.2 `Label` cannot truncate — blocks overflow control in every scaffolded overlay

**Symptom on device:** HUD panel text overflows its container; no ellipsis.

`@flare-engine/ui`'s `Label` accepts `{ children, variant, tone, mono, style }` and never forwards
`numberOfLines` or `ellipsizeMode` to the underlying RN `Text`. A consumer therefore **cannot**
truncate a label without abandoning `Label` and hand-rolling a `Text`, which loses the variant/tone
theming that is the component's whole purpose.

This bites hardest in localized builds: PT ships EN + PL, and Polish runs 15–100% longer
(`"Stats"` → `"Statystyki"`). Ten PT overlays route through a shared scaffold built on `Label`.

**Ask:** forward `numberOfLines` and `ellipsizeMode` (and ideally `adjustsFontSizeToFit`) from
`Label` to `Text`. Additive, non-breaking.

**If declined:** document that `Label` is for text of known length, so consumers know to drop to raw
`Text` for anything user- or locale-variable.

### 9.3 For calibration — what the other six were

Recorded so the engine can see the consumer-side/engine-side split honestly. **None of these are
engine asks:** procedural-vs-Kenney bullet routing in PT's own spawn path; an unconditional 42 px
HUD band reserved for a boss bar that is usually absent; PT edge bars not applying safe-area insets;
first-run shop/loadout screens that are correctly all-locked but say nothing about why; and a
zone-pacing gap (~62 s of dead air in zone 1, up to ~161 s in zones 6 and 8) caused by PT's own
fixed boss timer never being re-derived after PT replaced hand-authored waves with a value-budget
composer.

The engine came out of this playtest well. Two defects, both in the touch/UI layer, both additive
to fix.


---

## 10. Addendum 2026-08-27 — a testability blocker, an API-shape trap, and one thing to take

Seven PT sessions (93-99) since the last addendum. **Thirteen rows closed, none of which needed an
engine change** — that split is recorded honestly in 10.5. What follows is the residue PT genuinely
cannot fix from the consumer side, ordered by value to this consumer.

Nothing here supersedes §3. **§3.1 (grid/hash broadphase for `SpatialIndex`) remains PT's single
highest-value gameplay ask** and is unchanged: a brute-force linear scan measured at 11.8-13.2 ms
per 1000 colliders binds a bullet-hell harder than anything below.

### 10.1 `@flare-engine/ui` and `@flare-engine/ui-shop` cannot be imported under `bun test` *(highest test-value ask)*

**Reproduced 2026-08-27**, both packages, identically and immediately:

```
import typeof * as ReactNativePublicAPI from './index.js.flow';
       ^
error: Unexpected typeof
    at node_modules/react-native/index.js:27:8
```

`react-native`'s entry point is Flow-typed. Bun's transpiler rejects that syntax, so **any engine
package importing `react-native` at module scope is unimportable in a Bun test runner.** Six
packages currently do: `devtools`, `engine`, `iap-revenuecat`, `react`, `ui`, `ui-shop`.

**What it costs this consumer.** No engine-UI component can be RENDER-tested. PT's HUD guards are
therefore source-shape checks — regex over file text — and `tests/hud/framed-panel.test.ts` says so
in its own docstring: *"This is a source-shape check rather than a render, because the panels cannot
be mounted under `bun test` (`@flare-engine/ui-shop` fails to load)."* Three PT test files are
written this way for no reason other than this.

That weakness is not theoretical. It is exactly what let a vacuous guard ship: a test asserting
`expect(src).toContain('pointerEvents="none"')` passed because the literal also appeared in the
component's own doc comment, so deleting the prop left the suite green. A render test could not have
been fooled — it would assert the rendered tree, not the file's text. PT has since fixed that guard,
but it can only ever be a better regex.

**The ask, deliberately narrow.** PT is not asking for React Native to be dropped. It asks that the
UI packages be importable **without executing RN's entry module** — for example a `./testing` subpath
export that omits the RN-touching surface, or making the RN import lazy so module-scope evaluation
never reaches `react-native/index.js`. Any shape works if `await import('@flare-engine/ui')` succeeds
under `bun test`.

**Precedent that this is achievable:** `src/audio/init.ts` is the only PT module that reaches
react-native, and it does so behind a dynamic import. That single choice is why PT's entire gameplay
layer *is* testable headlessly (see 10.4). The same move on the UI packages would unlock the rest.

Same family as §3.4 (`createBenchSession` unreachable from app code): engine code a consumer cannot
reach from its test runner.

### 10.2 `PanelProps.style` is `ViewStyle`, not `StyleProp<ViewStyle>`

Verified in `@flare-engine/ui/dist/index.d.ts:274-284`. `Panel` composes its style as
`[{ backgroundColor: theme.surface, padding, borderRadius }, style]` — caller LAST, so a caller's
`backgroundColor` overrides the theme surface. That precedence is fine and probably intended.

The trap is the TYPE. Because `style` is a single `ViewStyle` rather than RN's usual
`StyleProp<ViewStyle>`, a wrapper component cannot pass a style ARRAY through; it must spread into a
new object. PT wrote a `FramedPanel` wrapper, forwarded the caller's `style` to its own outer `View`
— the obvious thing — and handed `Panel` only its own width/height. Eight overlay panels silently
repainted from PT's `UI_COLORS.panelBg` to the engine's `darkTheme.colors.surface`, with `panelBg`
surviving as four square corners behind a 16 px rounded panel.

**This was PT's bug, not the engine's**, and it is fixed. It is reported because the API shape made
the wrong thing the easy thing, and because the token test pinning `panelBg` stayed green throughout
— it asserted the literal sat in a style object, never that the panel wore it.

**Ask:** widen `style` to `StyleProp<ViewStyle>` on `Panel` and its siblings so wrappers can compose
without spreading. Additive and non-breaking — every current call site still type-checks.

### 10.3 The `Camera2D` surface the FX layer calls is not discoverable *(minor)*

Building a headless harness, PT had to discover `camera.shake` and `camera.shakePerlin` by running
into them: each missing method threw at the first damage or boss-phase event rather than at
construction, several minutes apart. Small, but it makes stubbing the context a guessing game.

**Ask (small, and 10.4 is the better version of it):** either document the camera surface the FX
layer depends on, or export a no-op/headless camera for tests.

### 10.4 Offered, not asked — PT built a headless loop harness the engine may want

PT now drives its **real** per-frame update loop with no device and no React Native:
`tests/_helpers/play-loop.ts`. Measured on this machine: the static graph imports under `bun test`
in ~45 ms, and the harness runs **9000 real frames in ~113 ms**, bit-identical across runs. It builds
state through the real `startZone` rather than a parallel setup path, so it cannot drift from the
game.

Before it existed, `playOnUpdate` — 693 lines wiring ~15 subsystems — had **zero** test coverage, and
the standing reason was that the loop was too entangled to drive headlessly. That was false.

What it has to stub is the interesting part for the engine:

- the engine context down to `world`, `camera`, `loop`, `scenes` — **`ctx.loop.clock.rawDt` is not
  optional**; a missing clock throws on frame one;
- a camera with `shake` / `shakePerlin` (10.3);
- an atlas whose `frameMap.get()` always resolves, so no sprite lookup can throw;
- a save store.

**If `@flare-engine/testing` shipped a `createHeadlessContext()` covering the first three, every
consumer would get this instead of hand-rolling it.** PT would adopt it on the next bump and delete
its own stub. The harness paid for itself immediately on its first real use: a refactor read a field
from a half-built state object and every zone threw `Cannot access 'state' before initialization` —
caught in seconds by 12 red tests, where nothing else imports that entry point and it would otherwise
have reached a device.

### 10.5 Calibration — what PT fixed on its own side

Recorded so the consumer-side/engine-side split stays honest. **None of these were engine asks:**

- `src/scenes/play/update.ts` taken from 784 to 512 lines by hoisting eight per-frame dependency bags
  out of the loop — applying the engine's own hoisting rule, which PT had been following half-way.
- **Three separate cases of a guard measuring spec fields nothing drew.** A zone-background colour
  that stopped being rendered when PT swapped terrain shaders for starfields; per-phase boss bullet
  and accent colours that never had a runtime reader at all; and a QA report feeding those fabricated
  numbers to an LLM critic panel as ground truth. All three guards looked rigorous — one even had a
  discriminator test proving its metric was sound. The metric was sound; the inputs were dead. The
  question that generalises, and PT now asks it first of any spec-derived assertion: *does anything
  actually read this?*
- A `try { require } catch {}` trapdoor over five IAP/paywall suites that failed OPEN: renaming an
  engine export took a suite from 12 assertions to 8 and it still reported "4 pass, 0 fail". Removing
  it deleted all 38 `noExplicitAny` suppressions in PT's tree, which existed only to serve it.
  **Worth the engine's attention only as a warning**: a consumer defending itself against engine
  churn with a permissive guard ends up worse off than one that fails loudly.
- An 800-line file cap, previously an unwritten convention, now enforced in PT's gate with a
  documented-exception list.

One fact for the engine's own bookkeeping: **`@flare-engine/particles` is declared in PT's
`package.json` but never imported** (`check:deps` reports it every run). Not a defect — PT will
likely drop the dependency. Flagged so the engine does not read PT as a particles consumer when
weighing that package's priorities.

### 10.6 Priority from this consumer

1. **§3.1 grid/hash broadphase** — unchanged, still the top gameplay ask.
2. **10.1 UI packages importable under a test runner** — top *testing* ask; it is the reason a whole
   class of PT guards are weaker than they should be.
3. **10.2 `StyleProp<ViewStyle>`** — small, additive, removes a trap that already cost PT a session.
4. **10.4 `createHeadlessContext()`** — PT has the working shape and is happy to hand it over.
5. **10.3 camera surface docs** — subsumed by 10.4 if that happens.
