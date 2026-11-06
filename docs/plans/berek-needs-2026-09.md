# What `Berek` needs from the engine (2026-09-08)

Consumer-side requirements doc, written **for the engine repo** from Berek's design corpus. It states
what Berek's gameplay loop demands of the engine, what the engine already covers, what Berek will hit
on its first real build session, and what is simply absent. **It specifies no Berek work.**

**Source discipline.** Everything below derives from `docs/design-refs/001-world-first-shape.md`
**§17–29** in the Berek repo — a read-only Polish design reference; the loop sections: big loop and main menu (§17), base (§18), day (§19), night (§20),
activity choice (§21), expeditions (§22), expedition rewards (§23), expeditions as story (§24),
unlocking new expeditions (§25), the small loop (§26), return to base (§27), the full loop structure
(§28), loop philosophy (§29). §1–16 is world and lore; it is not an engine input and is out of scope
here. Every engine-side claim was re-verified against **engine HEAD on 2026-09-08**, with file and
line where the claim is specific.

**Naming.** The game is **Berek** in every language — it is both the title and the dog's name. It is
never written "Tag".

**Status of the consumer.** Berek is the owner's flagship title *in design* and a two-file proof *in
code* (`src/App.tsx` + `src/map.ts`, 205 lines at HEAD), consuming **7 engine packages at `^0.2.1`**:
`assets`, `ecs`, `input`, `physics`, `react`, `render`, `tilemap`. Platform floor verified in the
owner session: Expo `~55.0.15`, RN `0.83.4`, `react-native-reanimated 4.3.0`,
`react-native-worklets 0.8.1`, `newArchEnabled: true` (`app.json:8`) — **ADR-0002 satisfied, no
migration work falls in the manual window.** Under `BK1` it bumps to `^0.4.0` at the freeze, and since
`PT1` removes `tilemap` from Pan-Tvardowski as a dead dep, **Berek is the flip's only manual coverage
of `tilemap` and the physics solid-grid path.** **Superseded 2026-10-19:** BK1 and
`manual-test-protocol.md` §3 are deferred post-flip (owner); see road-to-oss §10 BK1. **Done
2026-11-05:** Berek is on `^0.4.0`, resolving `0.4.7`, and §3 passed on an Android emulator.

**Berek's own game development is deferred until after the October flip** (owner decision 2026-09-08).
Nothing in this file is scheduled, nothing here happens before the flip, and nothing here renumbers,
reschedules or supersedes [road-to-oss-2026-09.md](road-to-oss-2026-09.md). The gap this doc closes is
that Berek's requirements were previously on file only as a top-down proof, so
[roadmap-post-flip.md](roadmap-post-flip.md) ranked two of its tracks as "second wave — wait for
demand". The demand exists; it is written down here.

**Revised 2026-11-05 against Berek's settled design.** Berek closed its design sessions S1–S9
(2026-10-31 to 11-04) and its asset-tool audit (`V2-03`..`V2-10`, 2026-11-05). This revision cites
those decisions by id from Berek's `docs/design/decisions.md`, and its canon, save model and
architecture by section. Nothing here comes from Berek's private `_local/` notes.

- **Retired.** §4.2 and the streaming half of §4.5 are retired.
- **Reworded.** §4.1, §4.3 and §5.1 are reworded, and §3.1–§3.6 gain status lines.
- **Added.** §4.7 is new, §2 gains determinism, and §9 gains a question about timed input.
- **Re-ranked.** §7 is re-ranked, and names the one issue each live item has.
- **Not here.** Berek's lighting needs are deliberately absent: its `V2-08` holds them until its
  look-target screen has measured numbers. The notes it sent now are review notes in
  [lighting-2-5d.md](../design/lighting-2-5d.md).

**Revised 2026-11-06 from Berek's H1 answers (`M-05`, `H1-05`).** §9 Q4 and Q5 are answered, and §4.1
and §7 no longer wait on `M-05`. §1, §3.1–§3.3, §7 and §8 record the `0.4.8` release.

---

## 1. The loop, in engine terms

| § | Loop stage | What it demands of the engine | Engine status |
|---|---|---|---|
| 17.1 | Main menu, profile/slot select | N save slots, list them, load one | **covered** — `createStorage` `saveSlot`/`loadSlot`/`listSlots` |
| 17.1 | Continue = last autosave | versioned envelope + forward migrations | **covered** — `runMigrations`, `defineMigrationChain`, `san.*` |
| 17.1 | Autosave, never manual | save on background / scene change | **partial** — `AppLifecycle.onBackground` exists; no autosave coalescing (§4.3) |
| 18 | Base = hub with sub-screens | scene stack, modal screens over a live scene | **partial** — stack exists, only the top scene draws (§3.4, §3.5). Berek settled its overlays, fights included, as React UI over `GameView` (architecture §6), §3.4's if-declined path |
| 18 | Upgrade Berek's body, spend resources | upgrade curve, price, buy | **covered** — `createUpgradeTrack`, `resolveStats` |
| 18 | Tech / unlock progression | prerequisite DAG, frontier | **covered** — `createUnlockDag` |
| 19–20 | Day ⇄ night cycle | a persisted game clock: a rate per segment of the day, steps in a fight, jumps on a sleep (`S3-05`, `S9-06`) | **absent** (§4.1) |
| 19–20 | Night looks different | global ambient grade over tiles *and* sprites | **fixed in `0.4.8`**: §3.1 (#54) and §3.3 (#53); #53 still awaits the owner's device check |
| 19–20 | Night is harder / richer | spawn rate, enemy tier, drop weighting by phase | **covered as primitives** — `resolveTier`, `DropTable.rollInto` with pity |
| 21 | Activity choice, no forced path | scene routing | **covered** — `SceneManager.go/push/pop` |
| 21 | Zelda-like open world | one finite map per realm with a second-world layer, explicit transitions between realms (`S3-01`) | **covered** — the single-map path, with `extractColliders(map, layerName)` giving each layer its own grid (§4.5) |
| 21 | Fast travel between marked trees | load a realm's map, place the dog at a mark, an hour on the clock (`S3-06`) | **covered** — `SceneManager.go` + object layers; the hour is §4.1's |
| 22 | Expedition = closed map + objective | objective evaluation, completion condition | **consumer-owned** (§6) |
| 22 | Expedition variety incl. timed / survival | frame clock, timers | **covered** — `Clock`, `createTimedModifier` (in-session only) |
| 23 | Post-expedition bonus, one game day | a deadline in game hours on the persisted clock (canon §2.2) | **consumer-owned** — a comparison against §4.1's absolute time (§4.2, retired) |
| 24 | Story-gated expeditions | flags + condition resolution | **covered** — `UnlockDag` + `dialogue` `ConditionResolver` |
| 25 | New expedition types unlock over time | DAG frontier | **covered** — `UnlockDag.frontier` |
| 26 | Small loop: explore → risk → return | tile movement, wall slide, encounters | **covered** — `buildSolidGrid`, `moveAndSlideInto`, `isBlockedAABB` |
| 26 | 2.5D: billboarded actors over a tilemap | y-sorted single-flush draw | **covered, with a caveat** — `sortByDrawOrder` + `drawInto`; rotated tiles draw unrotated (§3.2, §5.1) |
| `S2-10` | Fights: taps and swipes timed at touch-down, calibrated per device | a press stamped when the finger lands, the gesture recognised afterwards | **partial** — `GestureRecognizer` recognises after release and stamps no touch-down time; Berek builds it first, then it moves into `input` (`M-05`, §9 Q5) |
| `S9-03` | A hit's sound ahead of the hit, earlier still for wireless headphones | a sound started at a scheduled time | **absent** (§4.7) |
| `S9-10` | Simulators and a determinism test | seeded randomness, injectable rolls, a fixed step | **covered** (§2) |
| 27 | Return to base, convert resources | none — pure game state | **consumer-owned** |
| 28–29 | Player-directed structure | nothing engine-shaped | — |

---

## 2. Already covered — Berek must not re-file these

The post-flip panel's own retrospective (`roadmap-post-flip.md` §4.1) says proposers ignore recorded
demand. The mirror failure is a consumer re-filing what already shipped. Verified present at HEAD:

- **Save slots and migrations.** `createStorage({ adapter, schema, version, migrations })` gives
  `saveSlot` / `loadSlot` / `deleteSlot` / `listSlots` under `slot:<name>` with a `{ version, data }`
  envelope, plus `runMigrations`, `defineMigrationChain`, and the lenient `san.*` sanitizers for real
  persisted data. §17.1's profile/slot/continue flow needs no new engine surface.
- **Tile movement against a solid grid.** `buildSolidGrid(w, h, tileSize, tiles)` accepts
  `extractColliders(map)` structurally with no tilemap import, `isBlockedAABB` does half-open edge
  tests, and `moveAndSlideInto` is an axis-separated slide that drops the blocked axis so diagonal
  input slides along walls — zero-alloc into an `out: Vec2`. This is exactly §26's movement.
- **Meta-progression primitives.** `createUpgradeTrack` (geometric price, `canBuy`, pure `buy`,
  `resolveStats`) for §18; `createUnlockDag` (`isUnlocked`, `frontier`, `allUnlocked`) for §24/§25;
  `resolveTier` / `resolveTierIndex` and pity-aware `DropTable.rollInto` for §20's "night pays more"
  and §23's reward tables.
- **Camera for an open world.** `Camera2D` has `follow(target, options)`, `bounds`, `setViewport`,
  `worldToScreenInto` / `screenToWorldInto`, `getBoundsInto`, plus `shake` / `shakePerlin`.
- **Music transitions.** `Music.crossfadeTo(name, duration, loop)` covers the day/night and
  base/surface music swap in §19–20.
- **Per-sprite shaders are already open.** Unlike `postfx`, the sprite effect path accepts consumer
  SkSL: `CustomShaderEffect { type: 'custom', shader, uniforms }` is dispatched at
  `render/src/frame-renderer.ts:752`, and `fillCustomUniforms` binds named uniforms by reflecting over
  `getUniformName`. Berek's prop shaders (water, foliage, cave mouth) are **not** blocked. The engine
  additionally ships `water`, `fog`, `fire`, `drop-shadow`, `outline`, `forest-canopy`, `river-wave`,
  `cave-interior` and `mountain-hills` sprite effects.
- **Four asks Pan-Tvardowski filed have since shipped**, and Berek would otherwise re-file all four:
  `Label` now forwards `numberOfLines` / `ellipsizeMode` / `adjustsFontSizeToFit` / `minimumFontScale`
  (`ui/src/label.tsx:8-18`) — load-bearing for a Polish-first JRPG menu; `CollisionWorld` has
  `getColliderBoundsInto` / `getColliderBounds`; `SpatialIndex` is a uniform spatial hash; and the
  multi-touch blocker is closed — at HEAD `VirtualButton` uses `onTouchStart` / `onTouchEnd` /
  `onTouchCancel` instead of competing for the responder, and `virtual-joystick.tsx:91` sets
  `onResponderTerminationRequest={returnFalse}`. Move-and-attack is Berek's whole control scheme, so
  this one matters most; it is closed in code but **not yet device-verified against Berek's scheme**,
  which `manual-test-protocol.md` §3 is the natural place to cover.
- **Determinism for simulators and a determinism test** (`S9-10`; checked 2026-11-05).
  - **Seeded randomness.** `SeededRNG` (mulberry32) and `hashU32` live in `math/src/random.ts`.
  - **Injected rolls.** `DropTable.rollInto` takes its uniform rolls as arguments
    (`progression/src/drop-roll.ts:48`) instead of drawing them.
  - **Fixed step.** `GameLoop` runs fixed updates on an accumulator (`core/src/game-loop.ts`).
  - **The trap.** The unseeded helpers in the same `random.ts` call `Math.random`: `randomFloat`,
    `randomInt`, `randomVec2InRect`, `randomPointInCircle`, `shuffle` and `choose`. Deterministic
    code must draw from a `SeededRNG` instead.

---

## 3. Verified defects Berek hits on its first real build session

Each was reproduced by reading HEAD. None is speculative, and none blocks anything today, because
Berek is not being built today.

### 3.1 `TilemapRenderer` can draw neither layer opacity nor a tint *(highest value)*

`_drawTileLayer` ends at `tilemap/src/tilemap-renderer.ts:100` with

```ts
batch.drawRaw(image, src.x, src.y, src.width, src.height, dstX, dstY, tw, th);
```

`SpriteBatch.drawRaw` takes `effect`, `anchorX`, `anchorY`, `alpha`, `rotation` and `stretch` after
those nine arguments. The tilemap passes none of them. Two consequences, one small and one structural:

- **`layer.opacity` is parsed and then ignored.** `TileLayer.opacity` is populated by both parsers
  (`tiled-parser.ts:225`, `ldtk-parser.ts:314`) and read nowhere. A layer authored at 40 % in Tiled
  renders fully opaque. `layer.visible` *is* honoured (`tilemap-renderer.ts:50`), which makes the
  omission read as an oversight rather than a decision.
- **Tiles cannot take a sprite effect, so an ambient tint cannot cover the ground.** Actors can:
  `tint(color, amount)` returns a `TintEffect`, and because the batch run key is
  `(image, effect, alpha, stretch)` compared by *reference*, one shared tint instance across every
  actor costs no extra draw call. Tiles have no such route. A day/night ambient pass applied on the
  sprite path therefore darkens the dog and leaves the ground bright.

**Ask:** widen `drawInto(camera, batch)` to `drawInto(camera, batch, opts?)` where `opts` carries an
optional `effect` and an `alphaScale`, and pass `layer.opacity` through as `alpha` by default. A
bounded addition to exactly one package; the existing two-argument call keeps working.

**Status 2026-11-05:** fixed on `main` by #54 (PR #199). Released in `0.4.8` (2026-11-05).

### 3.2 GID flip flags are decoded and then undrawable

`decodeGidFlags` and `TileFlipFlags` are exported from `tilemap` and have **zero internal callers** —
`grep decodeGidFlags packages/*/src` returns only the definition and the barrel re-export. The
renderer says so in a comment (`tilemap-renderer.ts:64-66`): flip transforms are "a deferred
limitation — render-flip support is post-flip M10", and `getTileSourceRectInto` strips the bits.
Colliders and tileset resolution are correct for flipped GIDs (that was `OSS-B8`); only drawing is not.

For a shmup this is invisible. For a hand-authored Zelda-like world it is not: flipping is how a tile
artist gets a mirrored cliff edge, doorway or path corner without drawing a second tile, and it is on
by default in Tiled. Berek's maps will contain flipped GIDs the day someone draws with them, and they
will render mirror-wrong with no error.

**Ask:** none new — this is the `flipX`/`flipY` bullet already inside `OSS-M10`. See §5.1 for the two
things Berek changes about that row.

**Status 2026-11-05:** fixed on `main` by #55 (PR #200), with one exception. Released in `0.4.8`.
Two of the eight flip-bit combinations, the diagonal bit alone and all three bits, need both a flip
and a quarter turn. `render`'s flip draw path ignores `rotation`, so those tiles draw mirrored but
unrotated. Tiled sets the diagonal bit whenever an artist rotates a tile. Filed as #207.

### 3.3 The only global colour grade loses its LUT on device

`createColorGradingLut(id, { lut, intensity })` is the single built-in postfx effect that declares an
extra sampler child: `runtime.ts:158-159` sets `children = [effect.uniforms.lut]` for
`'color-grading-lut'` and the frozen `EMPTY_CHILDREN` sentinel for every other kind. The React Native
path drops it — `react/src/skia-bridge.ts:52` declares `readonly children: readonly SkImage[]` on
`PostFxPassDescriptor`, `game-view.tsx:431` compares children for memoisation, and then the element
itself is built as

```tsx
passes.map((p) => <RuntimeShader key={p.id} source={p.source} uniforms={p.uniforms} />)
```

with no `children` prop. Web binds it (`render-web/src/postfx-surface.ts` routes `children` into
`makeShaderWithChildren`); native does not. **So the one effect that could express §19–20's day/night
colour shift in a single fullscreen pass silently produces an ungraded frame on the platform Berek
ships on.** No exception, no warning — the LUT is simply not sampled.

`roadmap-post-flip.md` T3 already carries this as "a one-line cross-package fix" for *custom* effects.
Worth recording that it also breaks a **shipped** effect, today, for a named consumer — so the fix is
not gated on T3's larger enum work.

**Ask:** bind `pass.children` on the native `RuntimeShader`. One line, and it should not wait for T3.

**Status 2026-11-05:** fixed on `main` by #53 (`971029bf`). The cause was RN-Skia's single-child
`<RuntimeShader>` filter, not a missing prop, so the fix is a nested `<Shader>` chain rather than one
line. Released in `0.4.8`. The owner's device check, that a LUT chain grades on Android, is still
open.

### 3.4 The scene stack cannot draw the scene beneath it

`SceneManager.update(dt)` drives `this.current` only (`scene-manager.ts:144-155`): one `onUpdate`, one
`onDraw`. `push(name)` calls `onExit` on the scene below and makes the pushed scene current. There is
no transparent/overlay flag and no draw-the-stack mode.

Every menu in §18's base, every §21 activity chooser, and any pause screen over the §26 surface run is
therefore either a pushed scene that hides the world entirely, or is not a scene at all and lives as
React UI over the canvas with the world scene still current. The second is what Berek will end up
doing, which means the base's screens sit outside the scene lifecycle the engine provides.

**Ask:** an overlay push — `push(name, data, { overlay: true })`, where an overlay scene updates and
draws after the scene below rather than instead of it, and the scene below receives no `onExit`.
Bounded addition to one package.

**If declined:** document that `Scene` is for full-screen exclusive states and that modal UI belongs in
React over `GameView`, so consumers stop reaching for `push`.

**Status 2026-11-05:** filed as #56. Berek has since settled the if-declined path for itself: its
overlays are React UI over `GameView`, and a fight draws over the `world` or `expedition` scene rather
than as a scene of its own (architecture §6). The overlay push now serves other consumers first.

### 3.5 `pop()` destroys and de-registers the scene it pops

```ts
const top = this._stack.pop()!;
top.onExit?.(); top.onDestroy?.();
this._scenes.delete(top.name);
this._initialized.delete(top.name);
```

(`scene-manager.ts:131-141`.) The factory registration survives, but the instance and its
initialised-flag do not, so the next `push` of the same name re-runs `onPreload` → `onInit` → `onEnter`
from scratch. For a JRPG whose inventory, crafting bench and map screen are opened dozens of times per
session, that is a full asset preload per open. `pop()` is also synchronous while `go` / `push` are
async, so a pop cannot await a preload it has just invalidated.

Related, and worth deciding together: `pop()` calls `this.current?.onEnter()` with **no `data`**, so a
revealed scene cannot be told why it was returned to — §27's "return to base carrying N resources" is
exactly that case.

**Ask:** keep popped scenes in `_scenes` / `_initialized` unless the caller asks for destruction
(`pop({ destroy: true })`), and forward a `data` argument to the revealed scene's `onEnter`.

**Status 2026-11-05:** filed as #57 (an opt-in `pop({ keep, data })`) and #179 (flipping the default,
`0.5.0`). With Berek's overlays in React (§3.4), its scenes switch with `go`, so it rarely pops.

### 3.6 The solid grid treats everything outside the map as solid

`isBlockedAABB` (`physics/src/solid-grid.ts:64-67`) returns `true` when the box leaves the grid:

```ts
if (minCol < 0 || minRow < 0 || maxCol >= grid.width || maxRow >= grid.height) return true;
```

That is the right default for a single closed map, and it is what §22's expeditions want — a closed
map with a boundary. It is the wrong default for §21's open world: the map edge becomes an
unconditional wall, so two adjacent region maps cannot be walked between without the consumer
bypassing the grid at the seam. Combined with §4.5 (no multi-map path at all), the open-world half of
Berek's design has no supported route through the physics layer.

**Ask:** an option on `buildSolidGrid` (or a sibling predicate) selecting whether out-of-bounds is
solid or passable, so a seam can be handed to the world loader instead of to a wall.

**Status 2026-11-05:** filed as #58. Berek's realms are now joined by explicit transitions, not walked
seams (§4.5). A transition can trigger inside the edge, so this is no longer a prerequisite for Berek.

---

## 4. Absent primitives the loop needs

Ordered by how much of §17–29 stops working without them.

### 4.1 A day/night clock — the loop's primary unit of time (§19, §20; `S3-05`, `S9-06`)

`grep -riE "timeofday|day.?night|ambient"` across `packages/*/src` returns **one** hit, and it is an
unrelated comment in `ui-shop`. §19 opens by naming the cycle *day → night → next day* as the basic
unit of time in play, and §20 makes it a design axis rather than a lighting filter: enemies are
stronger, more frequent and in larger groups at night, some threats are night-only, and resources are
richer.

**Berek's settled clock, in engine terms (`S3-05`, `S9-06`).**

- **Rates.** A game day lasts about 40 real minutes. Day, 06:00–20:00, runs at 86 real seconds a
  game hour. Night runs at 120 s, and the dusk band (20:00–21:00) and dawn band (05:00–06:00) sit
  inside the night at the night's rate. So the clock has a rate for each segment of the day, not one
  rate.
- **When it runs.** Only while the dog is on the map. It stops in the base, menus, the map screen,
  dialogue and pause.
- **In a fight.** It moves in steps, five game minutes a round, and a phase boundary reached
  mid-fight waits for the fight's end.
- **Jumps.** It jumps to the next dusk or dawn on a sleep or a defeat, and advances an hour on fast
  travel.
- **Deadlines.** Timed effects persist as deadlines in absolute game hours compared against the
  clock (Berek save-model §4). That is why §4.2 folded into this item: the clock's absolute time must
  only grow for the life of a save.

The engine piece is still small and shared:

- **Time.** A per-segment rate table over 24 game hours, and readouts for day, hour, minute,
  segment, phase, and an absolute game time that only grows.
- **Control.** Pause, discrete advance by game minutes, a jump to the next start of a named segment,
  and a hold that stops time at the next phase boundary until it is released.
- **Notification.** A phase and segment change notification.
- **State.** Serialisable, so `Continue` restores the same minute.

What must **not** come with it is any of Berek's content. Rates, band lengths, the round's cost, spawn
tables, enemy tiers, difficulty curves and night-only gating are all game design (§6).

**Where Berek stands (`M-05`, settled 2026-11-05).** The clock is built in Berek first, and moves
into `progression` once it is proven.

**Ask:** consider a `createGameClock(config)`, filed as #202. #202 stays open as the target of that
move; it no longer waits for an engine-first call. **If declined:** say so, because
every consumer with a cycle will otherwise write the same sixty lines, and each will disagree about
what the clock does while the app is backgrounded.

### 4.2 A wall-clock effect that survives the app closing (§23) — retired 2026-11-05

**Retired.** Berek removed the real-world clock from the game (canon §2.2).

- **The bonus.** It now lasts one game day, 24 game hours, instead of 24 real hours.
- **Every timed effect.** The bonus, a dish, a brew and Rested all persist as absolute game-hour
  deadlines read off the persisted clock (save-model §4). An effect is active while the clock's
  absolute game hour is below its deadline.
- **What goes away.** That comparison is the game's own. No wall clock is involved, a device clock
  offers nothing to tamper with, and nothing advances while the app is closed.

The ask this section made, an expiring-effects registry on wall-clock deadlines in `progression`, is
withdrawn. Its line in #182 is closed with this reason. What remains of the need is §4.1's absolute
game time.

### 4.3 Save-slot headers for the profile menu (§17.1)

`listSlots()` returns `string[]`. A menu showing three slots as "Day 12 · 04:31 · Kaszuby · 6 h played"
must therefore `loadSlot` each one, which runs migrations and the full schema parse per slot just to
draw a list — and `loadSlot` **throws** on a malformed envelope or a failed migration, so the menu has
to try/catch per slot or a single corrupt save takes out the whole screen.

Berek's save model (§2.1) confirms the need and lives with the workaround. Until the engine offers
headers, it keeps a separate index document via `createDocumentStore`, written in the same operation
as each slot and treated as a cache, not truth: if the index and a slot disagree, the slot wins and
the index is rebuilt. So the cost is no longer a slow menu. It is a second store the consumer keeps
in step with the first.

**Ask:** a small header stored alongside the payload — `saveSlot(name, data, header?)` and
`listSlotHeaders(): { name, header, version }[]` reading only the envelope. Filed as #203. **If
declined:** document that slot listing is name-only and that consumers should keep their own index
document via `createDocumentStore`.

### 4.4 Animated tiles (§21, §26)

`grep -riE "animation|frames" packages/tilemap/src` returns nothing. Tiled's per-tile animation is how
water, torches, banners and machinery move in a hand-authored world, and Berek's surface is
hand-authored. Today every animated element must be lifted out of the tile layer and re-created as an
ECS entity with a `SpriteAnimator`, which means the map author cannot place it.

**Ask:** parse Tiled's `animation` frame lists onto `TilesetRef`, and advance the GID at draw time in
`TilemapRenderer`. Filed as #204. **If declined:** say so in the tilemap README — the omission is
currently invisible, because an animated tile parses cleanly and simply never moves.

### 4.5 A multi-map open world (§21) — streaming retired 2026-11-05

**Revised 2026-11-05: Berek's settled world is not a streamed one.**

- **One grid per realm.** Each realm is one grid (`S3-01`). Its second world is a second layer of
  the same map, on the same coordinates, not a second map.
- **Explicit transitions.** Realms are regions joined by explicit transitions, not a seamless world
  (architecture §6).
- **Fast travel.** It moves the dog from any den or marked tree to any mark, at an hour's cost on
  the clock (`S3-06`).
- **Size.** About 30 screens a realm (`S3-01`'s scale), so a realm fits one finite Tiled map.

In engine terms that is the single-map path, already covered:

- `parseTiled` loads the map, and `TilemapRenderer` draws it with camera culling.
- `setTilesetImage` binds each tileset's image, and object layers hold the spawn points and marks.
- `extractColliders(map, layerName)` (`tilemap/src/tilemap-collider.ts:29`) already builds one
  collider set per layer, so the surface and the second world each get their own solid grid.
- A transition or a fast-travel jump is a scene `go` that loads the next realm's map.

So this section **no longer asks** T7 for `.world` files or neighbour load and unload, and T7
(`createLevelManifest`, `bindTilesetImages`, a spawn registry) keeps only its original, unnamed
demand. Nothing is filed for this section. The 2026-09-08 text below stays as the record of what was
asked.

There is no `.world` support in either `tilemap` or `cli` (`grep -riE "\.world|worldfile"` → zero
hits), `parseTiled` throws on infinite maps, `parseLDtk` throws on `externalLevels: true`, and
`TilesetRef.image` is documented as "may need resolving" (`tilemap-data.ts:114`) with nothing in the
engine that resolves it — `TilemapRenderer` looks images up by tileset *name* from a map the consumer
populates through `setTilesetImage`.

So the supported unit is one finite embedded-tileset map with caller-resolved images. §22's expeditions
fit that exactly. §21's open world does not: it is many maps in a shared coordinate space, with
neighbours loaded and dropped as the dog walks.

This is [`roadmap-post-flip.md`](roadmap-post-flip.md) **T7 (TM-LEVEL)** — `createLevelManifest`,
`bindTilesetImages`, and a spawn registry unifying `MapObject` and `LDtkEntity`. T7 is ranked "second
wave — wait for demand". **This is the demand**, and Berek needs two things T7's spec does not name
today: Tiled `.world` files as the authoring source of a multi-map world, and neighbour load/unload as
the active map set changes. T7's own guard still holds — it must stay data plus draw, and image
resolution must stay injected so `tilemap` never learns `fetch`.

### 4.6 Nothing else — and that is worth saying

The remaining §17–29 machinery is game logic, not an engine gap. See §6.

### 4.7 A sound effect started at a scheduled time (`S2-10`, `S9-03`) — added 2026-11-05

Berek's fight cues are scheduled ahead.

- **The cue.** A hit's sound plays 350 ms before the hit.
- **The offset.** A per-device calibration plays it up to 300 ms earlier still, for wireless
  headphones. The timing window itself never moves for audio.
- **The windows.** They are as narrow as 120 ms (the snap's, `S9-03`).

The engine starts a sound only at once:

- `SFXPool.play(name, opts)` calls `source.start()` (`audio/src/sfx-pool.ts:122`).
- `PlaySFXOptions` carries `volume`, `rate` and `loop`, but no start time.
- The injected `AudioBufferSourceNodeLike.start(when?)` (`audio/src/audio-manager.ts:39`) and
  `AudioManager.currentTime` already take one.

So a cue started from the frame loop lands on a frame boundary, up to one frame late: 17 ms at 60 fps,
33 ms at 30.

**Ask:** an optional `delay` on `play`, passed as `start(currentTime + delay)`, so a cue scheduled
ahead starts on the audio clock rather than the frame clock. Additive, one package. Filed as #205.

---

## 5. What this should change in the post-flip ranking

Proposals for [roadmap-post-flip.md](roadmap-post-flip.md). Nothing here is scheduled.

### 5.1 `flipX` is specified in two places, and Berek changes its design

The mirror is specified twice: as a bullet inside `OSS-M10 · render table-stakes` (P2, cuttable, likely
post-flip) and again as track **T4 · RENDER-FLIP** in the post-flip roadmap, which notes only that it
is "related to the M10 render table-stakes row". One fact, two rows — worth collapsing to one under the
one-source rule before either is scheduled.

More useful than the duplication: `OSS-M10`'s design says a single RSXform cannot express a one-axis
mirror, so flipped sprites route through the `stretch` / `drawImageRect` path, with the perf trade
documented as "per-sprite draw call when flipped". **For a shmup that is a rare case. For Berek it is
the common case** — a four- or eight-direction cast is authored facing one way and mirrored for the
other, so roughly half the actors on screen would each cost their own draw call, and `stretch` also
forbids rotation. Two consequences the row should absorb:

- Berek's character mirroring probably wants **baked** frames, not a runtime flip — which is what T5
  (CLI-BANK) and T8 (SHAPES-ATLAS) produce. The runtime flip stays the right answer for the *tilemap*,
  where §3.2's flipped GIDs are already sitting in the parsed data.
- If the mirror ships as stretch-only, the perf note must read *per flipped sprite per frame*, not
  just "when flipped", or a consumer will read it as cheap.

**Revised 2026-11-05.**

- **The mirror shipped stretch-only.** `SpriteBatch.draw` / `drawRaw` take `flipX` / `flipY`, and
  the frame renderer draws each flipped sprite as its own `drawImageRect` under a mirror, with no
  rotation (`render/src/sprite-batch.ts:67-79`, `render/src/frame-renderer.ts:839-866`). The
  docstring states the per-sprite draw call, so the duplicate row is moot.
- **Berek bakes its characters' mirrors.** It settled the character case as the first bullet
  guessed: mirrored frames are baked, each with its normal map transformed with it (`V2-05`).
- **The runtime flip now serves the tilemap.** #55 draws flipped GIDs, so every flipped tile is its
  own draw call. A map that mirrors many tiles pays that cost per tile per frame.
- **Rotated tiles.** The diagonal bit, which Tiled sets for a rotated tile, is queued correctly but
  drawn without its turn: #207 (§3.2).

### 5.2 T3's one-line fix has a shipped-effect consumer, not only a custom-effect one

§3.3: binding `pass.children` on native is what makes `createColorGradingLut` work at all on device.
That is independent of opening the effect enum and should not inherit T3's 2–3 session cost.

Worth recording against T3's framing as well: the **sprite** effect path is already open
(`CustomShaderEffect`, §2), so the closed-enum problem is `postfx`-specific. Two paths in the same tier
disagree about whether a consumer may bring its own shader.

### 5.3 T7 and T8 have a named consumer with specifics

T7: §4.5 above, plus `.world` and neighbour streaming. (Retired 2026-11-05: Berek loads one map
per realm, §4.5, so T7 no longer has Berek as its consumer.) T8 (`createShapeAtlas`): Berek's design calls
for billboarded characters, collectibles, enemies and props over a tilemap, and its current build has
no art pipeline at all — the procedural-atlas docstring at `assets/src/procedural-atlas.ts:88-96`
already advertises exactly the placeholder-atlas pattern Berek needs in order to start before art
exists.

### 5.4 What Berek does *not* justify

Recorded so this doc cannot be read as a mandate for everything. Berek gives no new weight to **T1** or
**T2** (its component count is nowhere near 32), to **T6** (no CLI plugin need), or to the rejected
`RENDER-INST` and columnar-archetype proposals. It is a tilemap / scene / storage consumer, not an
ECS-scale one.

---

## 6. Explicit non-goals — do not absorb these from Berek

Named so nobody generalises game design into engine surface:

- **The quest and objective system.** §22's completion conditions — kill all, fetch, secure, boss,
  reach, timed, survive, skill sequence, constrained resources — are a `{ isComplete(state) }`
  predicate over game state. The engine would add nothing but a vocabulary, and a wrong one.
- **Inventory, crafting, base building, the module and upgrade catalogue.** §18 and §27 are content.
  `createUpgradeTrack` and `createUnlockDag` are the engine's whole contribution, and they are enough.
- **The expedition node map and the base map table.** UI over `UnlockDag.frontier()`.
- **Day/night balance.** Enemy tiers, spawn rates, group sizes, night-only gating, resource weights —
  §19–20's actual design. The engine ships the clock and the dice, never the tables.
- **Story flags, dialogue content, the Translator's voice.** `dialogue`'s `ConditionResolver` and
  `ActionHandler` are caller-supplied by design; that boundary is correct and should hold.
- **Polish-first content and its localization tables.**
- **A DOM/web renderer.** Berek is a native Skia consumer; `render-web` is outside its scope.

---

## 7. Priority from this consumer

Re-ranked 2026-11-05 against Berek's settled design. Each live item has exactly one issue, except
§3.5, whose breaking half is split out for `0.5.0`.

| # | Item | Value here | Value to other consumers | Effort | Issue |
|---|---|---|---|---|---|
| 1 | **Day/night clock** (§4.1) | high — the loop's unit of time; built in Berek first, moving into `progression` once proven (`M-05`) | medium | S–M | #202 |
| 2 | **Scheduled SFX start** (§4.7) | medium — every fight cue | medium — any timing-driven game | XS | #205 |
| 3 | **Flip with rotation** (§3.2's remainder) | medium — rotated tiles draw unrotated, silently | medium | S | #207 |
| 4 | **Animated tiles** (§4.4) | medium — a hand-authored world expects them | medium | M | #204 |
| 5 | **Save-slot headers** (§4.3) | low — Berek keeps an index document meanwhile | medium | S | #203 |
| 6 | **Overlay scene push** (§3.4) | low — Berek's overlays are React UI | high — any game with modal UI | S | #56 |
| 7 | **`pop()` keeps the instance; `onEnter(data)`** (§3.5) | low — Berek's scenes switch with `go` | medium | S | #57, #179 |
| 8 | **Out-of-bounds option on `SolidGrid`** (§3.6) | low — explicit transitions need no open edge | low | XS | #58 |

**Released in `0.4.8` (2026-11-05):** §3.3 (#53), §3.1 (#54) and §3.2 (#55, except #207).
**Retired:** §4.2 (wall-clock effects) and §4.5's T7 streaming and `.world`
ask.

**Nothing here blocks Berek today.** Its design is settled and its build has not started. It has been
on `^0.4.0` since 2026-11-05 (road-to-oss §10 `BK1`), so its next install resolves `0.4.8`.

---

## 8. What Berek verifies for the engine in return

Recorded because it is why Berek stays in the exit criteria even while its own development is deferred.
(**Superseded 2026-10-19:** §3 left the exit criteria and runs post-flip; the list below is its
post-flip scope.)
With `PT1` removing `tilemap` from Pan-Tvardowski, `manual-test-protocol.md` §3 is the flip's **only**
manual exercise of:

- `parseTiled` on a real embedded-tileset map, through `TilemapRenderer` culling, to a drawn frame;
- `extractColliders` → `buildSolidGrid` → `moveAndSlideInto` — the whole solid-grid path, which no
  other consumer touches;
- `@flare-engine/react`'s `GameView` mount and frame callback on a second app, on a different Expo and
  RN patch line than Pan-Tvardowski;
- the joystick/button pair on a move-and-attack scheme rather than a shmup's (§2).

Anything in §3 that lands should be re-checked there. §3.1 and §3.2 in particular are invisible to
every automated gate the engine has — they are silent wrong pixels, not exceptions. Both have now
landed (#54, #55), so they are due for exactly that check.

**Run 2026-11-05 (BK1), on `0.4.7` and an Android emulator.**

- **Passed.** The first three bullets above: the map draws, walls and water stop the player,
  movement slides along them, and `GameView` runs on a second app with no JS errors.
- **Not reported.** Whether the joystick and button pair was exercised on a move-and-attack scheme.
- **Still owed.** `0.4.7` predates #54 and #55. `0.4.8` carries them, so §3.1 and §3.2's check is
  due on it. A run on the reference phone is still to come.

---

## 9. Open questions this doc cannot answer

1. **Where does the day/night clock live?** `core` is the honest home for a clock, but a phase model
   with signals and serialisation is closer to a feature than to `GameLoop`. This needs the owner's
   package call before anyone writes it, per the one-package constraint. *(2026-11-05: #202
   recommends `progression`. That package holds the primitives that read a clock, depends only on
   `math`, and sits outside every bench lane, while a `core` edit stales them all. The owner confirms
   when approving. 2026-11-06: Berek's `M-05` names `progression` as where the clock moves, §4.1.)*
2. **Is `.world` in scope for T7, or a row of its own?** It is an authoring-format question as much as
   a loader question, and Tiled 1.12.x is already fixed as the primary format. *(Moot 2026-11-05:
   §4.5.)*
3. **Does the 24 h bonus survive a device clock change?** A design answer, not an engine one — but the
   shape of the engine primitive depends on it (§4.2). *(Moot 2026-11-05: canon §2.2 removed the
   real-world clock.)*
4. **Scaffolder drift, noticed while verifying the floor.** Berek and Pan-Tvardowski both run Expo ~55
   / RN 0.83.x, while ADR-0002 §Consumer impact records the `create-flare-app` templates at Expo 57 /
   RN 0.86. Not a floor violation — both apps set New Arch explicitly — but the drift between what the
   scaffolder pins and what both real consumers run is unrecorded anywhere. *(Answered 2026-11-06
   by Berek's `H1-05`: record and hold. Berek follows the ADR-0002 peer floor, not the scaffolder
   templates, and holds at Expo 55 with Pan-Tvardowski. It moves to the templates' stack in the first
   build row its plan session files. No engine change.)*
5. **Is Berek's timed input engine or game work?** *(Added 2026-11-05. A question, not a
   commitment, so nothing is filed.)*
   - **What Berek needs.** `S2-10` stamps a press when the finger lands and recognises the gesture
     afterwards, so a swipe is never late. It applies a per-device delay from a calibration run, in
     fights, minigames and chases.
   - **What the engine has.** `GestureRecognizer` (`input/src/gestures.ts`) recognises tap and swipe
     at release from an elapsed time. `pointerDown(x, y)` (`:78`) takes no timestamp, and the tap and
     swipe it emits (`:117`, `:123`) carry no touch-down time. A consumer today stamps the press
     itself from the native touch event.
   - **Answered 2026-11-06 by Berek's `M-05`.** Berek builds it first, on the engine's exports, as its
     own module, and moves it into `@flare-engine/input` after its timing lab.
