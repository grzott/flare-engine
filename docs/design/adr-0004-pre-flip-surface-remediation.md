# ADR-0004: The pre-flip audit's published-surface changes ship as one decision, under one ADR

- **Status**: Accepted
- **Date**: 2026-09-07
- **Consumer impact**: breaking
- **Release level**: patch <!-- 0.3.x is the line; the 0.4.0 minor is xr13 -> ADR-0002 -->

## Context

The 2026-09-07 pre-flip audit produced 90 verified code findings and 183 corpus findings
([pre-flip-audit-2026-09-findings.md](../plans/pre-flip-audit-2026-09-findings.md)). Its **D2 rule**
sorted them: a finding is remediated **before** the October 5 freeze if and only if **the fix changes
the published API surface**. Everything else went post-flip to Arc HYG. The rule is about the *fix*,
not the bug — six high-severity user-visible defects sit in Arc HYG precisely because fixing them
changes no exported name.

That rule is what makes this arc urgent rather than merely desirable. All 41 scoped packages are
published `restricted` today with no public consumers, so a break costs a migration we control. After
the **October 20** public flip each of these becomes a semver break against real consumers, and
`.changeset/config.json` versions all 42 packages in **lockstep** — so a break means a `major`, which
means `1.0.0`, which npm does not take back. The window is now.

`AGENTS.md` requires an ADR for **any consumer-observable change, even at `patch`**, because
`check:bump` cannot detect one. Read literally against this arc, that is one ADR per row: PF-2a drops
a parameter and makes a constructor argument required; PF-6 removes two exports, retypes a third and
changes JPS's behaviour on weighted grids; PF-3 renames members on three types; PF-5 and PF-8 remove
exports; PF-1 changes a published file format. Six or more documents, written during four weeks the
audit's own capacity arithmetic (§4.3) already calls oversubscribed — 16.5 sessions of demand against
20 available, with the 3.5 of slack already allocated to re-checking single-refuter findings.

## Decision

**The arc is one decision and takes one ADR.** Every Arc PFA changeset cites `ADR-0004`, and the
observable-change table below is the single place a consumer or a future maintainer can see what
moved in `0.4.0` and why. Per-row ADRs are not written.

Scope: this ADR authorises the changes in the table. It does **not** authorise a `minor` or `major`.
The sole above-`patch` changeset for the `0.4.0` cut remains `xr13-worklets-scheduleonui.md`, backed
by [ADR-0002](adr-0002-worklets-migration-and-new-arch-floor.md).

**On the header's `breaking` / `patch` pair, which looks wrong and is not.** Semver describes a
promise to consumers. `0.3.x` is `restricted` with no public consumers, so there is no promise yet to
break — these changes are breaking in *shape* and free in *fact*, and that is the entire reason the
arc is being run now instead of in November. Every row therefore ships `patch`, on the `0.3.x` line,
and the accumulated set is what `0.4.0` publishes at the freeze. **After October 20 the same edits
would each be a `major`**, which under lockstep means `1.0.0` across all 42 packages — a number
reserved and unscheduled. That asymmetry is the deadline.

## The five one-way calls (owner, 2026-09-07)

Recorded here because each was a decision, not an implementation detail, and the reasoning is not
recoverable from the diff.

| Finding | Call | What was rejected, and why |
| --- | --- | --- |
| **F076** | `flare tiled-to-flare` emits **Tiled-shaped JSON** — a pass-through of the original layer/tileset objects, external tilesets inlined — so `parseTiled` accepts its output. `FlareMap`/`FlareTileLayer`/`FlareObjectLayer` are deleted from the cli barrel. | Shipping a second importer (`parseFlareMap`) in `tilemap`. It would have meant two published map formats to maintain forever, and would not have fixed the dropped tileset `tiles[]` — so every `solid` flag, and therefore every collision grid, would still have come out empty. |
| **F064** | `TileLayer.tiles` becomes `Uint32Array`. | Keeping `number[]` and freezing it. Verifiers had downgraded the runtime case (no tilemap benchmark exists, and the SMI-to-double transition is V8-only while Hermes is the primary target) — so this was taken as a **type** decision: the repo's own rule is typed arrays for bulk numeric data, and `Uint32Array` is the only form that holds Tiled's flip-bit GIDs. |
| **F002** | `definePrefab` **documents** that plain-object data is stored by reference and shared by every spawn; pass `() => T` for per-entity state. Pinned by a second-spawn `toBe` test. | Narrowing `PrefabEntry.data` to `() => T`, and shallow-cloning. Two of three verifiers called by-reference the designed contract — it mirrors `world.add(entity, def, data)`, and the existing test is titled "supports factory functions for unique data per spawn". All three verifiers also showed the naive `{ ...data }` clone is wrong for the general `T`: it turns a primitive into `{}`, a typed array into an index-keyed object, and still aliases one level down. |
| **F039** | `findPathJPS` scans `grid.data` for any cost `> 1` and delegates to `findPath` with `diagonal: true`, making the shipped api-specs claim true. One byte scan per call, never per node. | Deleting the claim, and throwing a typed error. Deleting would have left the silent wrong-answer intact and merely admitted to it; throwing would have broken anyone living with the wrong answer today. |
| **F059** | `DocumentStore.load()` **never persists over a document it could not read**. On a migration throw it returns defaults for the session and does not write. `load()` keeps its never-throws contract. | Propagating the error (would make `load()` may-throw, so a consumer who never wrote a catch starts crashing at boot on a store rollback), and adding a reason channel to the published surface (correct, but more design than the row held — deferred, not rejected on merit). |

## Consumer impact

**Who breaks.** Nobody today. All 41 scoped packages are published `restricted`, and the only
consumers are Pan Tvardowski, Berek and the portfolio — each in its own repository, each installing
`^0.3.x` from the restricted registry, each moving when its owner chooses. No consumer lives in this
repo, so nothing here breaks on merge; the migrations below are owed at whatever moment each
consumer bumps.

This table therefore exists for two readers who do not exist yet: the consumer who arrives **after**
the October 20 flip and finds `0.4.0` different from `0.3.1`, and the maintainer who has to explain
why. Every row is written for them rather than for us.

**The observable-change table.** One line per row, with the changeset that carries it.

| Row | Change | What a consumer sees | Migration |
| --- | --- | --- | --- |
| PF-2a | `Prefab.spawn(overrides)` parameter dropped | Compile error if it was passed | Drop the argument. Nothing read it. |
| PF-2a | `QueryBuilder`'s constructor argument is now required | `new QueryBuilder()` stops compiling | Use `world.queryBuilder()`, which was always the only correct entry point. A bare `new QueryBuilder()` returned a query the World never populated. |
| PF-2a | `Query.entities` added (`readonly number[]`) | Additive | None. `for...of` still works; it is now documented as the convenience form, and the indexed walk as the hot-path form. |
| PF-6 | `NavMeshPolygon.neighbors` removed | Compile error on mesh literals that set it | Delete the key. It duplicated `portals[].neighborId` and nothing read it. |
| PF-6 | `SpatialEntry<T>` removed from the `physics` barrel | Compile error on an import of the type | None available in practice — no public signature could produce or accept one. |
| PF-6 | `SolidGrid.solid` is `Uint8Array`, not `Set<number>` | Compile error on `.has()` / `.add()` / `.size` | Index it: `solid[row * width + col]`. `buildSolidGrid`'s input shape is unchanged. |
| PF-6 | `CollisionWorld.addCollider(entity, collider, x, y)` added | Additive; the 7-positional `add` is unchanged | None. Fields are **copied** at add time — re-add to change them. |
| PF-6 | `findPathJPS` delegates to A\* on any weighted grid | Different path and `cost` where costs vary; a uniformly weighted grid (`defaultCost: 2`) now delegates on every call, losing the JPS speed-up | None. The new answer is the correct one; the old one silently ignored costs. Note weighted results follow A\*'s corner-cutting rule, not JPS's. |
| PF-2b | `Vec2.normalizeOut` renamed `Vec2.scaleToLengthInto`; `turnVelocityToward` renamed `turnVelocityTowardInto` | Compile error on the old names | Rename the call. **The bodies did not change** — a 1,217,288-input bit-level sweep across denormals, the `1e-6` guard boundary and overflow magnitudes found zero mismatches, so `atan2` consumers see identical angles. The old name was the repo's only `…Out` against nineteen `…Into` siblings, and it scaled to `length` rather than normalising. |
| PF-2b | `CoroutineHandle` gains `failed`, `error` and `cancelled` | Additive | None. The handle now reports **three** end states rather than one. Previously a rejected `yield Promise` flipped `done` and dropped the reason, so a failure was indistinguishable from success — and a cancelled coroutine was indistinguishable from a finished one, since both read `{ done: true }`. `cancelled` is set by `cancel()` **and** by `clear()`, because a scene teardown is a cancel from the coroutine's point of view, and by the deferred-close path taken when a coroutine cancels itself from inside its own body. Three states shipped together because the shape freezes on Oct 20 and completing it later would cost a coordinated `minor` across all 42 packages. |
| PF-2b | `cancel()` / `clear()` now close the generator | A coroutine's `finally` blocks run on cancel and on scene teardown, where before they never did | None, and this is the point: `try { sprite.show(); yield 2; } finally { sprite.dispose(); }` used to leak `sprite`. A cancel issued from inside the running body is applied once the body next suspends, so the pinned "clear() from inside a coroutine does not throw" behaviour is preserved. |
| PF-2b | A rejected `yield Promise` is thrown into the generator | A generator that catches it keeps running, with the next yield dispatched normally; one that does not ends with `failed` set | None. Failures are never re-raised as unhandled rejections — the handle is the channel. |
| PF-5 | `createWebSurface` returns a `WebSurface` handle (`{ canvas, ckCanvas, flush(), dispose() }`) instead of a bare `CanvasLike` | Compile error on any use of the return value as a `CanvasLike` (e.g. `.save()`) directly | Read/draw through `.canvas`; call `.flush()` to present and `.dispose()` to free the GPU surface. |
| PF-5 | `PostFxSurface.composite(globalIntensity?)` — argument is now optional | Additive; omitting it now holds the chain's own `globalIntensity` instead of overwriting it every frame | Drop the argument once nothing needs to write a new global intensity — the old per-frame `composite(1)` undid an a11y `setMotionScale`. |
| PF-5 | Composite clouds branch (`weatherKind: 4`) now honours `weatherDirection`, matching `WEATHER_CLOUDS_SKSL` | Rendering changes for anyone on the composite clouds path with a non-zero `weatherDirection` | None. The corrected output is the intended one; the old branch silently ignored a value the standalone shader already respected. |
| PF-5 | `PostFxController.triggerTimed` is required on the interface | Compile error only for a caller that guarded it with `pfx.triggerTimed?.(...)` | Call it directly — every implementation always provided it. |
| PF-5 | `render` no longer exports `ColorLike` | Compile error on an import of the type | None available in practice — nothing in the repo referenced it. |
| PF-4 | `drawShip`'s engine routes through `drawShape` instead of `drawRect` | Rendering changes for any `ShipSpec.engine` with `ox`/`oy`/`rot` or `glow` set — the block now paints at the offset and shows its glow ring instead of painting on the hull centre with no ring | None. The corrected position and ring are the intended ones; both were silently dropped before. |
| PF-4 | `shapeBoundsRadius` adds a stroke-width margin (only where a stroke is actually painted) and a glow-ring margin (+5.5 friendly, +2.25 hazard) on top of the existing `+2` | Larger returned radius for any spec with a painted stroke or a `glow` tag; unchanged for a plain fill | None. A tile sized from the old value could clip a painted stroke or the glow ring `drawShape` paints; the new value contains both. |
| PF-4 | `applyFriendlyGlow` / `applyHazardGlow` drop the unused leading `Skia` parameter | Compile error for a direct caller passing a `Skia` handle first | Drop the first argument. `drawShape`'s own calls are already updated. |

| PF-7 | `DocumentStore.load()` no longer writes defaults over a document it could not read | A failed migration — a stored version newer than the app's, or a throwing migration in your chain — now leaves the stored bytes **untouched** and returns defaults for that session only | None, and this is the point: previously a store rollback, side-loaded APK or staged-rollout revert destroyed the user's settings and progress on first launch, unrecoverably. `load()` still never throws. Note `createStorage.loadSlot` *does* throw in the same situation — the two stores diverge deliberately. |
| PF-7 | `SceneFactory` receives `(world, camera)` | Additive to the signature; existing zero-argument factories stay assignable | None required. But a factory that used to return its own `world`/`camera` was having them **silently discarded** — entities spawned there never existed in the scene. Populate the passed-in world instead, and drop the `null!` the old shape forced. |
| PF-7 | `GameView` falls back to zero insets with no `<SafeAreaProvider>` | Additive; it used to throw `No safe area value available` on first render | None. The JSDoc and api-specs already promised this fallback — the shipped `.d.ts` was lying, and a consumer passing explicit `safeArea` still got a blank app and a stack trace. |

| PF-3 | `InputManager.pointer` tracks only the primary touch | A second finger no longer teleports `pointer` or raises a spurious release mid-gesture. **The primary role does not transfer**: when the primary finger lifts, `pointer` stays unset until every touch is up | None. The old behaviour was the bug: any second touch moved `pointer` on `down` and reported a release on `up` while the first finger was still on screen. Other touches remain visible through `touches`. **Who this actually affected** — not the joystick-plus-fire-button layout, which never reaches `InputManager.pointer` at all (`react/src/virtual-joystick.tsx` runs its own RN responder straight into `updateJoystick`), but a game reading `input.pointer` directly for canvas drag or aim while an incidental second touch — a resting thumb, an unrelated gesture — lands on the same surface. Non-transfer is deliberate for that case: handing the role to whatever position the second finger happens to occupy would be a smaller copy of the bug being fixed. |
| PF-3 | `GamepadButtonState.pressedThisFrame` / `releasedThisFrame` renamed `justPressed` / `justReleased` | Compile error on the old names | Rename. This aligns gamepad with `Pointer` and `VirtualButtonState`, which already used `justPressed`. The keyed accessors (`KeyboardState.wasPressed(code)`, gamepad's `wasButtonPressed`) keep their own vocabulary **deliberately** — a field and a keyed predicate are different shapes and forcing one name on both makes a field read as a predicate. |
| PF-3 | `resetKeyboardFrame` removed | Compile error on the import | Call `keyboard.reset()`. The free function existed only to paper over the shape split the rename above closed. |
| PF-3 | `GestureDetector.pointerUp`'s `elapsedSinceDown` is optional | Additive; existing callers unaffected | None. The detector now times one press with one clock instead of accepting a second, independently-measured elapsed time from the caller. A fired long press also now suppresses tap and swipe for the same press, which it did not before. |

| PF-1 | `convertTiled` / `flare tiled-to-flare` emits Tiled-shaped JSON (`type: 'tilelayer'\|'objectgroup'`, array `properties`, tileset `tiles[]`), not the old `{kind:'tile'\|'object'}` shape | The old shape never worked with `parseTiled` at all, so this is the fix rather than a break against a working consumer. Anyone reading the old `Flare*` shape directly, bypassing `parseTiled`, sees different field names | Feed the output straight to `parseTiled`, now the only supported consumption path. This is the row that makes the documented Tiled authoring story work end to end for the first time. |
| PF-1 | `FlareMap`/`FlareTileLayer`/`FlareObjectLayer`/`FlareObject`/`FlareTileset`/`FlareLayer` removed from the `cli` barrel; `TiledMap`/`TiledLayer`/`TiledTileLayer`/`TiledObjectLayer`/`TiledTileset`/`TiledObject`/`TiledTile`/`TiledProperty` added | Compile error on any import of the old names | Use the new `Tiled*` names — the shapes are Tiled's own, not a re-projection through ours. |
| PF-1 | `TileLayer.tiles` is `Uint32Array`, not `number[]` | Compile error on `.map` / `.slice` / `toEqual` against a plain array | `Array.from(layer.tiles)` for array methods; index access is unchanged. Taken as a **type** decision — `Uint32Array` is the only form that holds Tiled's flip-bit GIDs — not as a measured speedup, since no tilemap benchmark exists. |
| PF-1 | `TileData` removed from the `tilemap` barrel | Compile error on an import of the type | None available in practice — nothing constructed or read one. |
| PF-1 | `getTileSourceRectInto(tileset, gid, out)` added | Additive | None. `getTileSourceRect` is unchanged in behaviour and now delegates to the `…Into` form. |
| PF-1 | `parseTiled` throws `TilemapParseError` instead of `TypeError` on non-map input | A `try/catch` narrowed to `TilemapParseError` now also catches garbage input | None required; it broadens what the documented error type covers, matching `parseLDtk`. |

| PF-8 | `iap-revenuecat`: entitlements read `latestPurchaseDateMillis`; `RevenueCatNonSubscriptionTransaction` gains `purchaseDate?: string` | `Transaction.purchasedAt` from **entitlement** paths is now the store's date instead of the time of the call | None. The local structural type declared `purchaseDateMillis` on entitlements, which the SDK does not send there, so every entitlement `purchasedAt` fell through to `Date.now()`. Store-transaction paths were **not** broken — hybrid-common does emit `purchaseDateMillis` there — and were only hardened. |
| PF-8 | `ui-shop`: `PaywallModalProps` drops `entitlementKey`; `PaywallModal` calls `grantProduct(productId)` | Compile error if the prop was passed | Drop the prop. It made a multi-grant product — a season pass — grant only one key when bought through the paywall, so the same purchase yielded different entitlements depending on which component performed it. |
| PF-8 | `ui`: `ShopPanel` / `ShopItem` / `ShopPanelProps` removed | Compile error on an import | Use `ui-shop`'s `ShopScreen`. Two overlapping public shop lists with divergent ownership models existed; this settles the duplication OSS-B20 renamed around and `package-findings-2026-07` deferred with "decide and document". |
| PF-8 | `ui`: `List` uses `Children.toArray` | Behaviour change — a nested child array is no longer treated as one item, so mapped children now get gaps | None. The old manual `Array.isArray` split silently collapsed mapped children into a single gapless item. |
| PF-8 | `leaderboards`: `MemoryLeaderboards` removed | Compile error on an import of the type | Use `LeaderboardsProvider`, which it aliased with zero added content. |
| PF-8 | `devtools`: `DevtoolsContextValue` drops `pause` / `step` / `resume` | Compile error if read off the context | Use the `scrubber` + time-control hook route, which was always one of the three ways the same controls were exposed. HYG7 still owns the internal HUD/Panel button de-duplication. |

**Two behaviour fixes pulled forward after this ADR was accepted (owner, 2026-09-07).** Neither
changes an exported name — they were parked in Arc HYG for exactly that reason — so they do not
belong in the table above, whose framing is "what stops compiling". They are recorded here because
they are consumer-observable, which is the other half of what this ADR is for. Both are pieces of
still-open HYG rows: **HYG13** also covers F040/F041/F053/F055 and **HYG16** also covers F065, and
those remain post-flip.

| Row | Change | What a consumer sees | Migration |
| --- | --- | --- | --- |
| HYG13-PRE | `CollisionWorld.raycast` rejects a non-finite `maxDist` and returns `null`; `SpatialIndex` clamps its cell walk to the packed key's supported ±2,097,152 range | A ray cast with `Number.POSITIVE_INFINITY` — or any non-finite `maxDist` — returns `null` immediately instead of **hanging the JS thread**. An entity added or moved at an infinite coordinate no longer hangs or leaks | None. A caller relying on an "unbounded ray" must pass a large finite `maxDist` instead, such as the map's diagonal. There was no working unbounded behaviour to lose — only a hang. |
| HYG16-PRE | `parseLDtk` selects an AutoLayer's tiles by `__type` rather than `gridTiles ?? autoLayerTiles` | An LDtk project using AutoLayer — auto-tiled terrain — now renders its tiles. Previously that layer parsed as **empty, with no error** | None. The corrected output is the intended one: AutoLayer support was advertised in `api-specs.md` and never worked. |

**Two more pulled forward (owner, 2026-10-09)**, both named in the pre-flip queue as "free now, a
semver break after the flip". OSS-M11's boundary bullet is a behaviour change; HYG24 is a one-modifier
type change, recorded here rather than in the main table because it came from Arc HYG, not Arc PFA.

| Row | Change | What a consumer sees | Migration |
| --- | --- | --- | --- |
| M11-BOUNDARY | `shapeOverlap`'s box-vs-circle test is strict (`<`), like box-vs-box and circle-vs-circle; `overlapInto` returns `null` for a zero-radius circle exactly on a box edge | A circle **exactly touching** a box face or corner no longer collides — no `onEnter`, no trigger — where before it did, in either argument order. Touching box-vs-box and circle-vs-circle never collided, so mixed pairs now match them, and `shapeOverlap` now agrees with `overlapInto(...) !== null` on every input | None for real gameplay: exact float contact is a measure-zero event. A test fixture that placed a circle precisely on a box edge and expected a hit must move it inside by any positive amount. |
| HYG24 | `TileLayer.tiles` is `readonly`, matching `SolidGrid.solid` | Assigning a new array to `layer.tiles` stops compiling. Writing cells (`layer.tiles[i] = gid`) is unchanged | Write cells in place instead of swapping the array. Nothing in the repo or the scaffolder templates reassigned it. |

<!-- Arc PFA's own rows are complete as of PF-8. Later pulled-forward behaviour fixes append to the
     addendum above, not to the main table, so "what stops compiling" stays a clean list. -->

**Why now.** October 20 is the last day any of these is free. See
[roadmap.md](../plans/roadmap.md) and the freeze sequence in
[road-to-oss-2026-09.md](../plans/road-to-oss-2026-09.md).

## Alternatives considered

**One ADR per breaking row.** The literal reading of `AGENTS.md`, and the format ADRs are actually
designed for — each decision standing alone with its own context and consequences. Rejected on cost
against a calendar the audit already calls oversubscribed, and because six documents would largely
restate the findings SoT they all cite. The rule's *intent* — that a consumer can find one document
explaining what moved and why — is better served by one complete table than by six partial ones.

**No ADR; let the changesets carry it.** Defensible while the scope is `restricted` and nothing
observable has been observed by anyone. Rejected because after October 20 the changelog is all a
consumer gets, and fourteen changesets with no single place explaining the shape of the change is
exactly the condition this rule exists to prevent.

## What would reverse this

- **A row turns out to need a `minor`.** Then it needs its own ADR with its own consumer-impact
  section, because `check:bump` will demand a citation and this one authorises `patch`.
- **The table stops being complete.** If a row lands a consumer-observable change that is not in the
  table above, the arc no longer has one source and this ADR should be split.
- **The flip slips past 2026-10-20.** The urgency here is entirely the freeze date; a later flip
  would make several of these affordable as separate, better-argued decisions. *Observed
  2026-10-09: the freeze moved to Oct 12 and the flip to Oct 26–28 (owner). A one-week slip leaves
  the decision as it stands; a slip of months would reopen it.*

<!-- symbols-ok: parseFlareMap -->
<!-- reason: the REJECTED alternative in the F076 row above — a second tilemap importer that was
     considered and deliberately not built. It correctly does not resolve, and that is the point:
     recording what was turned down is half of what an ADR is for. -->
