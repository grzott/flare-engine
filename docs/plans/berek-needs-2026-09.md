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
of `tilemap` and the physics solid-grid path.**

**Berek's own game development is deferred until after the October flip** (owner decision 2026-09-08).
Nothing in this file is scheduled, nothing here happens before the flip, and nothing here renumbers,
reschedules or supersedes [road-to-oss-2026-09.md](road-to-oss-2026-09.md). The gap this doc closes is
that Berek's requirements were previously on file only as a top-down proof, so
[roadmap-post-flip.md](roadmap-post-flip.md) ranked two of its tracks as "second wave — wait for
demand". The demand exists; it is written down here.

---

## 1. The loop, in engine terms

| § | Loop stage | What it demands of the engine | Engine status |
|---|---|---|---|
| 17.1 | Main menu, profile/slot select | N save slots, list them, load one | **covered** — `createStorage` `saveSlot`/`loadSlot`/`listSlots` |
| 17.1 | Continue = last autosave | versioned envelope + forward migrations | **covered** — `runMigrations`, `defineMigrationChain`, `san.*` |
| 17.1 | Autosave, never manual | save on background / scene change | **partial** — `AppLifecycle.onBackground` exists; no autosave coalescing (§4.3) |
| 18 | Base = hub with sub-screens | scene stack, modal screens over a live scene | **partial** — stack exists, only the top scene draws (§3.4, §3.5) |
| 18 | Upgrade Berek's body, spend resources | upgrade curve, price, buy | **covered** — `createUpgradeTrack`, `resolveStats` |
| 18 | Tech / unlock progression | prerequisite DAG, frontier | **covered** — `createUnlockDag` |
| 19–20 | Day ⇄ night cycle | a persisted game clock with a schedule | **absent** (§4.1) |
| 19–20 | Night looks different | global ambient grade over tiles *and* sprites | **partial, and broken on device** (§3.1, §3.3) |
| 19–20 | Night is harder / richer | spawn rate, enemy tier, drop weighting by phase | **covered as primitives** — `resolveTier`, `DropTable.rollInto` with pity |
| 21 | Activity choice, no forced path | scene routing | **covered** — `SceneManager.go/push/pop` |
| 21 | Zelda-like open world | multi-map world, streaming between regions | **absent** (§4.5); the single-map path is covered |
| 22 | Expedition = closed map + objective | objective evaluation, completion condition | **consumer-owned** (§6) |
| 22 | Expedition variety incl. timed / survival | frame clock, timers | **covered** — `Clock`, `createTimedModifier` (in-session only) |
| 23 | 24 h post-expedition bonus | a wall-clock effect surviving app close | **absent** (§4.2) |
| 24 | Story-gated expeditions | flags + condition resolution | **covered** — `UnlockDag` + `dialogue` `ConditionResolver` |
| 25 | New expedition types unlock over time | DAG frontier | **covered** — `UnlockDag.frontier` |
| 26 | Small loop: explore → risk → return | tile movement, wall slide, encounters | **covered** — `buildSolidGrid`, `moveAndSlideInto`, `isBlockedAABB` |
| 26 | 2.5D: billboarded actors over a tilemap | y-sorted single-flush draw | **covered, with a caveat** — `sortByDrawOrder` + `drawInto` (§3.2, §5.1) |
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

---

## 4. Absent primitives the loop needs

Ordered by how much of §17–29 stops working without them.

### 4.1 A day/night clock — the loop's primary unit of time (§19, §20)

`grep -riE "timeofday|day.?night|ambient"` across `packages/*/src` returns **one** hit, and it is an
unrelated comment in `ui-shop`. §19 opens by naming the cycle *day → night → next day* as the basic
unit of time in play, and §20 makes it a design axis rather than a lighting filter: enemies are
stronger, more frequent and in larger groups at night, some threats are night-only, and resources are
richer.

The engine piece is small and genuinely shared: a game-time driver with a configurable
real-seconds-per-game-hour rate, a phase readout, phase-change signals, pause (base and menus must not
advance the clock), and serialisable state so `Continue` restores the same hour. What must **not**
come with it is any of Berek's content: spawn tables, enemy tiers, difficulty curves and night-only
gating are game design (§6).

**Ask:** consider a `createTimeOfDay(config)` — a bounded addition to `core` (it is a clock) or a small
package of its own. **If declined:** say so, because every consumer with a cycle will otherwise write
the same sixty lines, and each will disagree about what the clock does while the app is backgrounded.

### 4.2 A wall-clock effect that survives the app closing (§23)

§23 gives every completed expedition a bonus that runs for **24 hours** — more EXP, more resources, a
better chance at an extra material. The player is expected to plan around it: finish an expedition,
then spend the bonus in the open world.

The engine's nearest primitive is `createTimedModifier(value, duration, combine)` in `animation`, with
`tickModifier(mod, dt)` / `isModifierActive` / `applyModifier`. It is frame-`dt` driven, it holds only
`remaining`, it has no id and no stacking rule, and it lives in a tier-3 animation package. A 24-hour
bonus advances while the app is closed and must survive a cold start, so `dt` accumulation cannot
express it, and nothing else in the engine stamps or compares wall-clock deadlines except
`achievements`' `unlockedAt` and `iap`'s entitlements.

The interesting content is exactly the part a consumer gets wrong alone: monotonic versus wall clock, a
device clock moved backwards or forwards, timezone and DST, an app closed for a month, and whether two
of the same bonus stack or refresh.

**Ask:** consider an expiring-effects registry keyed on wall-clock deadlines and serialisable through
`storage`, as a bounded addition to `progression` (it is a meta-economy primitive, and `progression`
depends only on `math`). Value to Pan-Tvardowski: none — this is a Berek-only ask and should be ranked
as one.

### 4.3 Save-slot headers for the profile menu (§17.1)

`listSlots()` returns `string[]`. A menu showing three slots as "Day 12 · 04:31 · Kaszuby · 6 h played"
must therefore `loadSlot` each one, which runs migrations and the full schema parse per slot just to
draw a list — and `loadSlot` **throws** on a malformed envelope or a failed migration, so the menu has
to try/catch per slot or a single corrupt save takes out the whole screen.

**Ask:** a small header stored alongside the payload — `saveSlot(name, data, header?)` and
`listSlotHeaders(): { name, header, version }[]` reading only the envelope. **If declined:** document
that slot listing is name-only and that consumers should keep their own index document via
`createDocumentStore`.

### 4.4 Animated tiles (§21, §26)

`grep -riE "animation|frames" packages/tilemap/src` returns nothing. Tiled's per-tile animation is how
water, torches, banners and machinery move in a hand-authored world, and Berek's surface is
hand-authored. Today every animated element must be lifted out of the tile layer and re-created as an
ECS entity with a `SpriteAnimator`, which means the map author cannot place it.

**Ask:** parse Tiled's `animation` frame lists onto `TilesetRef`, and advance the GID at draw time in
`TilemapRenderer`. **If declined:** say so in the tilemap README — the omission is currently invisible,
because an animated tile parses cleanly and simply never moves.

### 4.5 A multi-map open world (§21)

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

### 5.2 T3's one-line fix has a shipped-effect consumer, not only a custom-effect one

§3.3: binding `pass.children` on native is what makes `createColorGradingLut` work at all on device.
That is independent of opening the effect enum and should not inherit T3's 2–3 session cost.

Worth recording against T3's framing as well: the **sprite** effect path is already open
(`CustomShaderEffect`, §2), so the closed-enum problem is `postfx`-specific. Two paths in the same tier
disagree about whether a consumer may bring its own shader.

### 5.3 T7 and T8 have a named consumer with specifics

T7: §4.5 above, plus `.world` and neighbour streaming. T8 (`createShapeAtlas`): Berek's design calls
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

| # | Item | Value here | Value to other consumers | Effort |
|---|---|---|---|---|
| 1 | **Bind `pass.children` on native** (§3.3) | high — the only global grade, dead on device | high — unblocks the whole extra-sampler class | XS |
| 2 | **Tilemap draw options: opacity + effect** (§3.1) | high — day/night cannot reach the ground without it | medium | S |
| 3 | **Day/night clock** (§4.1) | high — §19–20 is a design axis, not a filter | medium | S–M |
| 4 | **T7 + `.world` + neighbour streaming** (§4.5) | high — §21's open world has no route | medium | L |
| 5 | **Overlay scene push** (§3.4) | medium — every base screen | high — any game with modal UI | S |
| 6 | **`pop()` keeps the instance; `onEnter(data)`** (§3.5) | medium — a preload per menu open | medium | S |
| 7 | **Wall-clock expiring effects** (§4.2) | medium — §23 is unimplementable without it | low — Berek-only today | M |
| 8 | **Tile flip drawing** (§3.2, inside `OSS-M10`) | medium — silently wrong maps | medium | M |
| 9 | **Animated tiles** (§4.4) | medium — a hand-authored world expects them | medium | M |
| 10 | **Out-of-bounds option on `SolidGrid`** (§3.6) | low alone, a prerequisite for #4 | low | XS |
| 11 | **Save-slot headers** (§4.3) | low — the menu is merely slow | medium | S |

**Nothing here blocks anything.** Berek's build is deferred until after the flip by owner decision, and
`BK1` — the dep bump to `^0.4.0` plus a README line — is unaffected by every row above.

---

## 8. What Berek verifies for the engine in return

Recorded because it is why Berek stays in the exit criteria even while its own development is deferred.
With `PT1` removing `tilemap` from Pan-Tvardowski, `manual-test-protocol.md` §3 is the flip's **only**
manual exercise of:

- `parseTiled` on a real embedded-tileset map, through `TilemapRenderer` culling, to a drawn frame;
- `extractColliders` → `buildSolidGrid` → `moveAndSlideInto` — the whole solid-grid path, which no
  other consumer touches;
- `@flare-engine/react`'s `GameView` mount and frame callback on a second app, on a different Expo and
  RN patch line than Pan-Tvardowski;
- the joystick/button pair on a move-and-attack scheme rather than a shmup's (§2).

Anything in §3 that lands should be re-checked there. §3.1 and §3.2 in particular are invisible to
every automated gate the engine has — they are silent wrong pixels, not exceptions.

---

## 9. Open questions this doc cannot answer

1. **Where does the day/night clock live?** `core` is the honest home for a clock, but a phase model
   with signals and serialisation is closer to a feature than to `GameLoop`. This needs the owner's
   package call before anyone writes it, per the one-package constraint.
2. **Is `.world` in scope for T7, or a row of its own?** It is an authoring-format question as much as
   a loader question, and Tiled 1.12.x is already fixed as the primary format.
3. **Does the 24 h bonus survive a device clock change?** A design answer, not an engine one — but the
   shape of the engine primitive depends on it (§4.2).
4. **Scaffolder drift, noticed while verifying the floor.** Berek and Pan-Tvardowski both run Expo ~55
   / RN 0.83.x, while ADR-0002 §Consumer impact records the `create-flare-app` templates at Expo 57 /
   RN 0.86. Not a floor violation — both apps set New Arch explicitly — but the drift between what the
   scaffolder pins and what both real consumers run is unrecorded anywhere.
