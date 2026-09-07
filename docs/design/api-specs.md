# Flare Engine — Module API Specifications

> Living document. Update alongside code changes — divergence is a spec bug.
>
> Last refreshed against `packages/*/src/index.ts`: **2026-08-14**.

---

## Layer 0: Foundation

### `@flare-engine/math` (< 5KB gzip)

| API                                                           | Description                                                                                                                                          |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Vec2`                                                        | `{x,y}` object. Static methods: `add`, `sub`, `scale`, `normalize`, `scaleToLengthInto(dx, dy, length, out)`, `dot`, `cross`, `perp(v, out?)`, `crossSV(s, v, out?)`, `length`, `distance`, `lerp`, `rotate`, `angle`, `clampLength`, `turnVelocityTowardInto(vx, vy, dx, dy, maxStep, out)`. `vec2(x,y)` factory. Zero-alloc forms take an `out` param; the mandatory-`out` forms carry the `…Into` suffix. `scaleToLengthInto` is the direction of `(dx, dy)` scaled to `length` (zeros when `(dx, dy)` is shorter than 1e-6) and takes scalar components (not a Vec2) so callers avoid a temporary in hot paths. `perp` returns the (-y, x) perpendicular (90° clockwise in this engine's y-down screen space); `crossSV` is the scalar × vector cross product `s × v = (-s·y, s·x)`. `turnVelocityTowardInto` is zero-alloc homing steer (mandatory `out`): rotates velocity toward direction by at most `maxStep` radians, preserving speed. |
| `Rect`                                                        | AABB. `contains(point)`, `intersects(rect)`, `intersection`, `union`, `expand`, `center`, `fromPoints`                                               |
| `Circle`                                                      | Position + radius. `contains`, `overlaps` with Rect/Circle                                                                                           |
| `Transform2D`                                                 | Position (Vec2) + rotation (radians) + scale (Vec2). `localToWorld()`, `worldToLocal()`                                                              |
| `Mat3`                                                        | 3x3 on Float32Array. `multiply`, `translate`, `rotate`, `scale`, `invert`, `identity`                                                                |
| `Color`                                                       | RGBA. `lerp`, `toHex`, `fromHex`, `toSkColor`, `multiply`, `create`. OKLab/OKLCH: `toOklab`, `fromOklab`, `toOklch`, `fromOklch` (operates in linear sRGB; `fromOklab`/`fromOklch` clamp out-of-gamut results — round-trip exact only in-gamut). WCAG: `relativeLuminance`, `contrastRatio`. Distance: `deltaEOk`, `deltaEOkLab`. Types: `Oklab`, `Oklch`. |
| `clamp`, `lerp`, `inverseLerp`, `map`, `degToRad`, `radToDeg`, `approxEquals`, `wrap`, `pingPong`, `smoothStep`, `sign`, `angleDelta(a, b)`, `rotateTowards(cur, target, maxStep)` | Scalar utils. `angleDelta` returns shortest signed delta `a - b` wrapped to `[-π, π]` (branch form — exact ±π pass through unwrapped). `rotateTowards` rotates angle `cur` toward `target` by at most `maxStep` radians. Both are byte-identical to hand-rolled homing math. |
| `easings`                                                     | 35 functions (quad/cubic/quart/quint/sine/expo/circ/back/elastic/bounce In/Out/InOut + linear, step, springIn/Out/InOut). Tree-shakeable named exports. |
| Random                                                        | `SeededRNG` class. Top-level `randomFloat(min, max)`, `randomInt(min, max)`, `randomVec2InRect(rect)`, `randomPointInCircle(cx, cy, r)`, `shuffle`, `choose`. Weighted: `weightedIndex(weights, roll01)` — cumulative-walk index from weight array; `weightedIndexBy<T>(items, weight, roll01)` — cumulative-walk index via accessor; `weightedPick<T>(items, weight, roll01)` — returns the item (allocating wrapper). Hash/seeded: `hashU32(seed)` — lowbias32 avalanche finalizer (decorrelates adjacent seeds); `seededIndex(seed, count)` — stateless deterministic index in `[0, count)`. All `roll01` inputs expected in `[0, 1)`. `SeededRNG.getState(): number` / `setState(state)` expose the generator's entire state as one int32 — JSON-safe, so a save file or replay can resume the exact sequence. `setState` coerces to int32 exactly as the constructor coerces a seed. |
| Reward                                                        | Timed-window + capped-bonus scoring math. `cappedBonus(pay, frac, capFrac)` — `floor(pay × min(frac, capFrac))`, 0 for non-positive pay. `advanceWindowedStreak(prev, elapsed, lastT, windowSec)` — increments streak if within window, resets to 1 on gap (`lastT < 0` = no prior event). `windowExpired(elapsed, lastT, windowSec)` — true when window was open and has since lapsed. `remainingInWindow(awarded, capPerWindow)` — non-negative slots remaining in a rate-cap window. All pure, zero-alloc. |
| Intersection                                                  | `pointInRect`, `pointInCircle`, `rectVsRect`, `rectVsCircle`, `circleVsCircle`, `lineVsRect`, `lineVsCircle`, `rayVsRect`                            |
| Segment intersection | `segmentsIntersect(x1,y1,x2,y2,x3,y3,x4,y4): boolean` — includes collinear overlap. `segmentIntersection(...): Vec2 \| null` and `segmentIntersectionInto(..., out)` return **where** they cross, or `null` when there is no single point (missing, parallel, or collinear). `out` is left untouched on `null`. A zero-length segment lying on the other is a real hit and reports that point. |
| Curves | `bezier2` / `bezier3` / `catmullRom` (+ `…Into(…, out)` twins) sample a point at `t`, clamped to `[0, 1]`. `bezier2Length` / `bezier3Length` / `catmullRomLength(…, segments = 16)` approximate arc length by chord summation — always a slight **underestimate**. Control points are loose numbers, not `Vec2`, so `Float32Array`-held coordinates sample without temporaries. Catmull-Rom passes **through** `p1`/`p2`; `p0`/`p3` only set the tangents. |

**Implementation notes:**

- Vec2 as `{x, y}` objects — not class instances (avoids GC).
- `Rect` and `Circle` are type + static namespace objects, not classes.
- Float32Array for Mat3 (compatible with Skia matrix format).

### `@flare-engine/events` (< 1KB gzip)

| API                      | Description                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `EventEmitter<EventMap>` | `on`, `once`, `off`, `emit`, `removeAll`. Returns `Unsubscribe` function.               |
| `Signal<T>`              | Single-event emitter. `add`, `remove`, `emit`, `once`. Zero-alloc `emit()` via deferred-remove pattern. |

---

## Layer 1: Core Runtime

### `@flare-engine/core` (< 3KB gzip)

| API                | Description                                                                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GameLoop`         | `start()`, `stop()`, `pause()`, `resume()`. Signals: `onUpdate(dt)`, `onFixedUpdate(fixedDt)`, `onLateUpdate(dt)`, `onPreRender()`, `onPostRender()`. `get alpha(): number` — post-step residual fraction in `[0, 1)` for physics interpolation; 0 when no fixed step configured. |
| `Clock`            | `elapsed`, `dt`, `fixedDt`, `fps`, `timescale`, `frame`. `schedule(delay, cb)`, `repeat(interval, cb)`                                               |
| `AppLifecycle`     | `onBackground`, `onForeground`, `onMemoryWarning` signals. `background()` / `foreground()` / `memoryWarning()` methods for the host to invoke. Dt capping on resume is owned by `GameLoop.resume()`. |
| `ScreenManager`    | Design resolution, scale modes: `FIT` (letterbox), `FILL` (crop), `STRETCH`. `resize(w, h, pixelRatio?)`, `setSafeAreaInsets(t, r, b, l)`. Exposes `safeArea: Rect`. |
| `CoroutineManager` | Generator-based. `start(gen) → CoroutineHandle { done, cancelled, failed, error, cancel() }`, `update(dt)`, `clear()`, `count`. `yield number` = wait seconds (scaled time), `yield undefined` = wait 1 frame, `yield Promise` = wait async. A coroutine ends exactly one of three ways — completed, `cancelled`, or `failed` — all imply `done`, and `cancelled`/`failed` are mutually exclusive. `cancel()` and `clear()` both set `cancelled = true` and close the generator, so its `finally` blocks run (a cancel issued from inside the running body is applied — and reports the same way — once the body next suspends; `clear()` is a cancel from every coroutine's point of view, e.g. on scene teardown). A rejected `yield Promise` is thrown into the generator: catch it to keep running (the next yield is dispatched as usual), or let it propagate and the coroutine ends with `failed = true` and `error` = what the generator threw (the rejection reason unless a `catch`/`finally` block threw something else). Failures are never re-raised as unhandled rejections — the handle is the only channel. Test `failed`, not `error`: a bare `reject()` rejects with `undefined`. |
| `Pool<T>`          | `acquire()`, `release(obj)`, `prewarm(count)`. Generic object pool. Optional `capacity` ctor option (via `PoolOptions`) — enforced ONLY by `tryAcquire(): T \| null` (returns null at cap, zero allocation); `acquire()` is always uncapped. Dev-mode double-release guard (throws when `__DEV__` is truthy). `release()` reads **`globalThis.__DEV__` as a property**, not the bare identifier — the identifier form costs ~270 ns per evaluation under JSC wherever the global is undeclared, and this runs once per released object (PERF-10/B28). A bundler `define` that substitutes a bare `__DEV__` will therefore not reach it; set `globalThis.__DEV__` instead. Most non-RN runtimes declare nothing at all — that undeclared state is exactly the configuration PERF-10 made cheap — so this is a thing the host has to do, not something it gets for free. The constructor keeps the identifier form on purpose (once per pool, and it is the site dead-code elimination can fold). `live` getter = currently out-of-pool count. `created` getter = cumulative factory calls from `acquire()`/`tryAcquire()` only; `prewarm()` is excluded. Intended use: snapshot before and after a frame — a non-zero delta in steady state means unexpected allocation. |

**Physics interpolation.** Read `loop.alpha` in an `onPreRender` callback to lerp between the previous and current physics positions for smooth visuals at any display refresh rate. `alpha` is 0 when the loop was not constructed with a `fixedDt` option.

### `@flare-engine/ecs` (< 8KB gzip)

| API                                   | Description                                                                                                                              |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `World`                               | `spawn() → entityId`, `destroy(entityId)`, `add<T>(entityId, def, data?)`, `remove(entityId, def)`, `get<T>(entityId, def)`, `query(...defs) → Query`, `queryBuilder() → QueryBuilder`, `removeQuery(q)`, `addSystem(fn, priority?)`, `step(dt)`. Max 32 component types per world. |
| `Query`                               | `entities: readonly number[]` — the live array of matching ids; walk it by index on hot paths (zero-alloc). `count`, `has(id)`. Also iterable: `for...of` is the convenience form — it allocates an iterator and, on Hermes, a result object per entity, so keep it off the frame path. `onEntityAdded`, `onEntityRemoved` signals. Archetype bitmask caching. |
| `QueryBuilder`                        | `with(...defs)`, `without(...defs)`, `build() → Query`. Obtained from `world.queryBuilder()` only — the constructor takes the world's registration hook, so `build()` returns a query the world keeps populated and a bare `new QueryBuilder()` does not compile. |
| `defineComponent<T>(name, defaults?)` | Type-safe component factory. Returns `ComponentDef<T>` used by `world.add/get/remove`.                                                  |
| `defineSystem(query, fn)`             | Helper that binds a query to a per-frame update fn. Register with `world.addSystem(sys._worldFn)`.                                       |
| `definePrefab(name, ...[def, data?])` | Prefab factory; `prefab.spawn(world) → entityId`. Plain-object data is stored by reference and shared by every spawn; pass `() => T` for per-entity mutable state. |
| `FSM`                                 | Lightweight state machine. `onEnter`, `onExit`, `onUpdate`, transitions.                                                                 |
| `createMovementSystem(world)` | Integrates `Position` by `Velocity * dt`. Zero-alloc — indexed walk over `query.entities`, no iterator. |
| `createLifetimeSystem(world, onExpire, query?)` | Decrements `Lifetime.remaining`; calls `onExpire(id, world)` (deferred, after read loop) when `remaining <= 0`. Destroy/pool policy is caller-owned. Zero-alloc steady state — indexed walk over `query.entities`, grow-only scratch. Optional `query` (a `Query` registered via `world.query(...)`) limits which entities are scanned; defaults to `world.query(Lifetime)` when omitted. Query is resolved at construction time — zero per-frame overhead. |
| `createBoundsCullSystem(world, bounds, onCull, query?)` | Culls entities whose `Position` falls outside `CullBounds`. Reads `bounds` live each frame (mutate to follow camera). Calls `onCull(id, world)` deferred. `CullBounds = { minX, minY, maxX, maxY }`. Optional `query` limits which entities are scanned; defaults to `world.query(Position)` (all Position holders) when omitted. Supplying a narrower caller-owned query avoids scanning unrelated entities (e.g. scrolling backgrounds) and eliminates duplicate query registration cost. Query is resolved at construction time. |
| `createFollowerSystem(world)` | Pins `Position` of each `Follower` entity to `target.Position + (offsetX, offsetY)`. Silently skips if target is gone or has no `Position`. |
| `createOrphanCullSystem(world, onOrphan)` | Fires `onOrphan(id, world)` for each `Follower` whose target entity no longer exists. Deferred. Opt-in — separate from follower pin logic. |
| `CullBounds` (type) | `{ readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number }`. Plain numbers; no physics dep. |

**Recommended system priority order:** `createMovementSystem` (0) → `createFollowerSystem` (1) → `createBoundsCullSystem` / `createOrphanCullSystem` (2+). Priority and registration are caller-owned via `world.addSystem(sys._worldFn, priority)`.

**Built-in components:** Position, Velocity, Rotation, Scale, Parent (from math types), Lifetime (countdown seconds), Follower (target + offsetX/offsetY).

**Performance:** Object-per-component storage in a Map per ComponentDef. Archetype bitmask on each entity for O(1) query membership. SoA Float32Array storage is **deferred** — add only if benchmarks show it matters.

---

## Layer 2: System Modules

### `@flare-engine/render` (< 10KB gzip)

| API             | Description                                                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Renderer`      | Manages Skia canvas. `setCanvas(canvas)`, `begin(clearColor?)`, `end()`, `applyCamera(...)`. `canvas` getter throws outside `begin/end`. `stats.drawCalls` = number of SpriteBatch flush runs this frame (one per maximal consecutive same-key run), NOT the number of raw canvas calls — one flush run can become 9 canvas `drawAtlas` calls (outline, frame-renderer.ts:700-710), n `drawImageRect` calls (stretch, where outline is dropped to alpha-only), or n `drawRect` calls (zone-bg effects). Equal to `stats.batchCount` whenever `SpriteBatch.flush` is the only writer (both are incremented together at its two call sites); `recordDrawCall()`/`recordBatch()` are independent public methods and can diverge them if a custom batching system drives them directly. |
| `SpriteBatch`   | Wraps Skia `<Atlas>`. `draw(image, frame, x, y, w?, h?, effect?, anchorX?, anchorY?, alpha?, rotation?, stretch?)` queues a sprite; `drawRaw(image, sx, sy, sw, sh, dx, dy, dw, dh, effect?, anchorX?, anchorY?, alpha?, rotation?, stretch?)` for raw source rects; `flush(drawAtlas, renderer?)` groups maximal **consecutive runs** by `(image, effect, alpha, stretch)` key and invokes `drawAtlas` once per run — **z-order is preserved** (no global merge across interleaved keys). Consecutive sprites sharing all four key fields merge into a single draw call; interleaved keys produce separate calls in insertion order. `stretch` is part of the key so stretched sprites never merge with regular sprites. `alpha` defaults to `1`; values in `[0, 1]`. `rotation` (radians, CW, default `0`) rotates the sprite about its anchor point via the RSXform similarity transform — uniform scale only; non-uniform scale combined with rotation, one-axis mirrors (negative-determinant transforms such as flipX without flipY), and any combination of these are not expressible via a single RSXform. `stretch` (default `false`) — opt-in non-uniform scale via `drawImageRect`; see `SpriteData.stretch` for semantics and caveat on rotation. `allocCount` getter = cumulative number of `SpriteDrawCommand` objects allocated because the internal command pool was empty (pool-miss path only); should be 0 in steady state after warm-up. |
| `Camera2D`      | `position`, `zoom`, `rotation`, `viewport`, `bounds`, `shake(intensity, duration)`, `shakePerlin(intensity, duration)` — Perlin/FBM-noise shake, overwrites any in-flight shakePerlin. Both `shake` and `shakePerlin` offsets are summed in `effectiveX`/`effectiveY` and respect `motionScale`. Allocating: `worldToScreen`, `screenToWorld`, `getBounds`. Zero-alloc: `worldToScreenInto(x, y, out)`, `screenToWorldInto(x, y, out)`, `getBoundsInto(out)`. `follow(target, opts?)` replaces any previous follow target; use `unfollow()` to stop. |
| `sortByDrawOrder` | In-place insertion sort by `.z`. Optional `length` param to sort only the first N entries (useful for pooled arrays). Mutates input; nearly-sorted frame-to-frame input makes it O(n). |
| BMFont text     | Functional cluster for bitmap text: `parseBMFontJSON(json)` → `BitmapFont`, `measureText(font, str)` → pixel width, `drawText(batch, font, str, x, y, opts?)` queues glyphs through `SpriteBatch`. `getKerning(font, prev, curr)`. Batches with sprites. |
| `RenderSystem`  | `createRenderSystem(world, query, positionDef, spriteDef, batch)` returns a per-frame fn. Queries entities with Position+Sprite, sorts by z, queues into `batch`. **Does not call `batch.flush()`** — the frame owner flushes once per frame across all draw sources. |
| `SpriteEffects` | `tint(color, amount)`, `flash(color, sec)`, `grayscale(amount)`, `outline(color, width)`, `custom(shader, uniforms)`, `water(color, foamColor, waveSpeed, waveAmplitude)`, `fog(color, density?, speed?, scale?)`, `fire({ color, tipColor, speed?, intensity? })`, `dropShadow({ color, offsetX?, offsetY?, blur? })`. Effects are **immutable**; `updateEffect(effect, dt)` returns a new effect (or same reference if time-invariant) or `null` on expiry. `WaterEffect` carries `{ type:'water', color, foamColor, waveSpeed, waveAmplitude }` — time-invariant; time is passed via `beginFrame(w, h, time)`. SkSL source exported as `WATER_SKSL`. `FogEffect` carries `{ type:'fog', color, density, speed, scale }` — time-invariant; 4-octave FBM noise animates each frame. SkSL source exported as `FOG_SKSL`. `FireEffect` carries `{ type:'fire', color, tipColor, speed=1.0, intensity=0.8 }` — time-invariant; value-noise FBM flame rises upward each frame. SkSL source exported as `FIRE_SKSL`. `DropShadowEffect` carries `{ type:'drop-shadow', offsetX, offsetY, blur, color }` — time-invariant (`color.a` is the shadow opacity); applied via Skia `ImageFilter.MakeDropShadow` on a reused paint so the sprite and its offset/blurred/tinted shadow draw in one pass; requires `Skia.ImageFilter` (falls back to the unfiltered sprite when absent — CPU/test surfaces). Added to `AnySpriteEffect`. All time-varying effects are compiled lazily and cached by `@flare-engine/react` skia-bridge. |
| Zone BG Effects | Six procedural-silhouette sprite effects for zone backgrounds. All are time-invariant (callers update `scrollOffsetY` each frame from Skia-bridge time); `updateEffect` returns the same reference. Factories: `roofsCity({ skyColor, roofColor, scrollOffsetY?, density?=6 })` — AABB hash-field rooftop skyline, SkSL `ROOFS_CITY_SKSL`; `forestCanopy({ skyColor, leafColor, scrollOffsetY?, density?=5 })` — value-noise tree line, SkSL `FOREST_CANOPY_SKSL`; `riverWave({ waterColor, foamColor, scrollOffsetY?, waveScale?=2 })` — 1D height-field wave with foam crests, SkSL `RIVER_WAVE_SKSL`; `moonCrater({ moonColor, craterColor, scrollOffsetY?, craterCount?=4 })` — polar-SDF craters, SkSL `MOON_CRATER_SKSL`; `caveInterior({ caveColor, glowColor, scrollOffsetY?, stalactiteCount?=8 })` — stalactite silhouettes hanging from top edge, SkSL `CAVE_INTERIOR_SKSL`; `mountainHills({ skyColor, hillColor, scrollOffsetY?, ridgeScale?=1.5 })` — FBM height-field ridge, SkSL `MOUNTAIN_HILLS_SKSL`. Types: `RoofsCityEffect`, `ForestCanopyEffect`, `RiverWaveEffect`, `MoonCraterEffect`, `CaveInteriorEffect`, `MountainHillsEffect`. All six added to `AnySpriteEffect` union. Bridge wiring (`applyZoneBg`) is the caller's responsibility via `custom(compiledShader, uniforms)` or a dedicated `@flare-engine/react` extension. |
| `SpriteData`    | ECS component type: `{ image, frame, z, width?, height?, effect?, anchor?, alpha?, rotation?, stretch? }`. `alpha` is a mutable per-instance multiplier in `[0, 1]`, default `1`. Write directly: `sprite.alpha = 0.5`. `rotation` is in radians, CW (Skia Y-down convention), default `0`; rotation is applied about the sprite's anchor point. `stretch` (default `false`) — when `true`, the sprite is drawn via `canvas.drawImageRect(image, srcRect, dstRect, paint)` so `width` and `height` are honored **independently** (non-uniform scale): a 256×256 source fills an arbitrary W×H destination rect. Stretched sprites are NOT batched with regular sprites (each is an independent `drawImageRect` call). `alpha` and `anchor` are fully honored in stretch mode; **rotation is unsupported in stretch mode** (combine only with `rotation = 0` or omitted). The render system threads `stretch` to `SpriteBatch.draw()` — no allocation. `Sprite` is a pre-registered `ComponentDef<SpriteData>` for drop-in use. |
| `resetXformCounters()` / `getXformCounters()` | `__DEV__`-gated diagnostic counters for the `fillXforms` transform path inside `createFrameRenderer`. The gate reads **`globalThis.__DEV__` as a property** rather than the bare identifier (PERF-10/B28 — ~270 ns per evaluation under JSC when the global is undeclared, once per sprite per transform pass); toggling `globalThis.__DEV__` at runtime works exactly as before, but a bundler `define` of a bare `__DEV__` does not reach it. `getXformCounters(): { rotated: number; unrotated: number }` returns cumulative counts of the two branches taken since last reset (allocates one object per call — not hot-path). `resetXformCounters(): void` zeros both counters unconditionally (no `__DEV__` guard — safe to call in production). When `__DEV__` is falsy or absent both counters remain 0. Use pattern: `resetXformCounters()` before a frame, `getXformCounters()` after to assert the rotated/unrotated split, and `rotated + unrotated` to assert transform work is linear in sprite count. These count transform **writes, not sprites** — `drawOutlined` passes each run through `fillXforms` 9 times (8 offset passes + 1 main pass), so an outlined run contributes 9 hits per command, matching the work the renderer actually performs. Scope: counters are **process-global** — shared by every `createFrameRenderer` instance; with more than one FrameRenderer live the readings are summed across all instances. |

**Rendering modes:** Retained (Atlas) for game entities, Immediate (Picture) for particles/effects. Compose in the same Canvas.

### `@flare-engine/input` (< 6KB gzip)

| API               | Description                                                                       |
| ----------------- | --------------------------------------------------------------------------------- |
| `InputManager`    | `pointer` (primary touch — the finger that started the current gesture; does not transfer to a remaining finger when it lifts, stays unset until every touch is up), `touches[]` (every active touch), `keyboard` (buffered key edges), `update()` per frame. |
| `Pointer`         | `position: Vec2`, `isDown`, `justPressed`, `justReleased`, `delta: Vec2`          |
| `GestureDetector` | Signals: `onTap`, `onSwipe`, `onPinch`, `onLongPress`. `pointerUp(x, y, elapsedSinceDown?)` — `elapsedSinceDown` is optional; omit it to use the elapsed time `update(dt, ...)` already accumulated. One clock per press: a long press already fired for the current press suppresses tap/swipe. |
| `VirtualJoystick` | Data functions only: `createJoystickState`, `updateJoystick`, `releaseJoystick`. `deadZone`, `maxRadius`, `direction: Vec2`, `magnitude`. RN component lives in `@flare-engine/react`. |
| `VirtualButton`   | Data functions only: `createButtonState`, `pressButton`, `releaseButton`. `isPressed`, `justPressed`, `justReleased`. RN component lives in `@flare-engine/react`. |

Polling model + signals. Screen-space coords; use `camera.screenToWorldInto()` for world coords. Virtual controls render as RN Views overlaid on the Skia canvas. Per-frame edge flags use two deliberate shapes: per-thing boolean fields (`Pointer`/`VirtualButtonState`/`GamepadButtonState` all `justPressed`/`justReleased`) for state already held by reference, and keyed query functions (`KeyboardState.wasPressed`/`wasReleased(code)`, `wasButtonPressed`/`wasButtonReleased(state, button)`) for state addressed by an id.

### `@flare-engine/physics` (< 4KB AABB)

**Tier 1 — Built-in AABB (implemented):**

| API                                         | Description                                                                                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `CollisionWorld`                            | `add(entity, shape, x, y, isTrigger?, layer?, mask?)`, `addCollider(entity, collider, x, y)` (copies the `Collider`'s `shape` / `isTrigger` / `layer` / `mask` at add time — re-add to change them), `setPosition(entity, x, y)`, `remove(entity)`, `step()`, `clear()`. `getColliderBoundsInto(entity, out): Rect \| null` (zero-alloc); `getColliderBounds(entity): Rect \| null` (allocating convenience). Both return `null` when the entity is absent. |
| `Shape`                                     | `AABB(w, h)`, `CircleShape(r)`. `shapeBounds(shape, x, y)` (allocating) and `shapeBoundsInto(shape, x, y, out)` (zero-alloc).                |
| `overlapInto(a, ax, ay, b, bx, by, out)`    | Minimum translation vector — the shortest push separating two overlapping shapes. `Overlap { x, y, depth }`: unit axis pointing from `a` toward `b`, plus penetration depth. `null` when apart, leaving `out` untouched. `overlap(...)` is the allocating twin, `createOverlap()` makes a buffer. AABB/AABB resolves along the least-penetrated axis; a circle centred inside a box exits through its nearest face; concentric circles return `(1, 0)` rather than `NaN`. Fills the gap between `shapeOverlap`'s boolean and actually resolving the collision. |
| `CollisionWorld.raycast(ox, oy, dx, dy, maxDist, mask?)` | Nearest hit against the world's colliders, walking only the broadphase cells the ray's AABB touches, filtered by each collider's `layer` bits (`mask` defaults to all). Returns a `RaycastHit` **reused between calls** — copy what you need before casting again — or `null`. The ray AABB is padded so an axis-aligned ray is not a degenerate zero-extent query. Contrast the standalone `raycast(..., targets)`, which scans a caller-supplied list and allocates a hit per candidate. |
| `rayVsShapeInto(ox, oy, dx, dy, maxDist, entity, shape, x, y, out)` | Zero-alloc ray-vs-shape test writing into `out`; `null` leaves it untouched. The primitive `CollisionWorld.raycast` is built on. |
| `createCollider`                            | Helper that returns a `Collider` data object: `{ shape, isTrigger, layer, mask }`. Pass it to `CollisionWorld.addCollider`.                                                           |
| Signals                                     | `onCollisionStart`, `onCollisionEnd`, `onTriggerEnter`, `onTriggerExit`. Enter/exit events allocate a fresh `CollisionPair` so listeners may retain the reference safely. |
| `raycast(ox, oy, dx, dy, maxDist, targets)` | Closest hit against `RaycastTarget[]`. Returns `RaycastHit \| null`. Scalar inputs; caller pre-filters the candidate list — no internal broadphase. |
| `RaycastTarget`                             | `{ entity, shape, x, y }`                                                                                                                    |
| `RaycastHit`                                | `{ entity, distance, point: Vec2, normal: Vec2 }`                                                                                            |
| `SpatialIndex<V>`                           | Uniform spatial-hash broadphase. `insert`, `remove`, `update`, `query(bounds, outBuf?)`. `query` result order is **unspecified** — do not rely on insertion order. |
| `SolidGrid` / `SolidTile`                   | `SolidTile` is a structural `{ row, col }` input — `TileCollider[]` from `@flare-engine/tilemap` is assignable with no tilemap import. `SolidGrid` carries `{ width, height, tileSize, solid: Uint8Array }` — `solid` has `width * height` cells indexed `row * width + col`, non-zero = solid. |
| `buildSolidGrid(width, height, tileSize, tiles)` | Builds a `SolidGrid` from a `readonly SolidTile[]`. Call once per map load; reuse across frames. |
| `isBlockedAABB(grid, x, y, halfW, halfH)`   | Returns `true` when the AABB centered at `(x, y)` with half-extents `(halfW, halfH)` overlaps a solid tile or leaves the map. Half-open EDGE = 1e-4: a box whose max edge lands exactly on a tile boundary does NOT count as overlapping that tile. |
| `moveAndSlideInto(grid, x, y, dx, dy, halfW, halfH, out)` | Axis-separated slide: attempts `dx` then `dy` independently; a blocked axis is dropped so diagonal input slides along walls. The dy-check uses the already-updated x. Zero-alloc — writes result into `out: Vec2` and returns it. |

**Tier 2 — planck.js integration: deferred.** `PhysicsWorld`, `RigidBody`, `applyForce`, `applyImpulse` are not implemented. Revisit after Phase 8 benchmarks — only bring it in if AABB proves insufficient.

### `@flare-engine/dynamics` (< 8KB gzip)

2D rigid bodies over oriented boxes (OBBs). `@flare-engine/physics` answers *did these overlap*;
`@flare-engine/dynamics` answers *where do they end up* — the two packages do not depend on each
other. Full rationale, the zero-alloc pooling design, and the resting-velocity limitation are in the
package [README](https://github.com/grzott/flare-engine/tree/main/packages/dynamics#readme); one
source per fact, so this section states the surface, not the reasoning.

| API                        | Description                                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| `createWorld(opts?)`        | `opts: { gravity?: Vec2; iterations?: number }`. Returns a `World { bodies, gravity, iterations }`. |
| `addBody(world, body)`      | Pushes a `Body` onto `world.bodies`. Returns the same `body`.                                       |
| `createBody(opts)`          | `opts: { position, half, density?, velocity?, angle?, angularVelocity?, restitution?, friction?, static? }`. Derives mass/inertia from `half` × `density`; `static: true` yields `invMass = invInertia = 0`. |
| `step(world, dt)`           | Advances the world by `dt` seconds: integrate velocities → broadphase (AABB) + narrowphase (SAT + face clip) → sequential-impulse solve (Coulomb friction, restitution, Baumgarte bias) → integrate positions. No-op for `dt <= 0`. Zero-alloc in steady state — all per-step scratch is pooled per `World`. |
| `Body`                      | `{ position: Vec2; velocity: Vec2; angle: number; angularVelocity: number; half: Vec2; invMass: number; invInertia: number; restitution: number; friction: number }`. `position` / `velocity` are mutable plain objects written in place every `step()`, not getters. `angle` accumulates `ω·dt` and is **never** wrapped to `[-π, π]`, so a consumer may lerp between recorded angles across multi-turn spins. |
| `isStatic(body)`            | `true` when `invMass === 0`. The supported way to test staticness — `static` is a `createBody` input, not a `Body` field.                            |
| `BodyOptions`               | The `createBody` input type, exported so consumers can name it.                                     |
| `WorldOptions`              | The `createWorld` input type, exported so consumers can name it.                                    |

```ts
import { addBody, createBody, createWorld, step } from '@flare-engine/dynamics';

const world = createWorld({ gravity: { x: 0, y: 1800 } });
const box = addBody(world, createBody({ position: { x: 0, y: 0 }, half: { x: 10, y: 10 } }));
step(world, 1 / 60);
```

**Out of scope in v1:** joints, sleeping, CCD (continuous collision detection), circle/polygon
shapes, ECS coupling, and any broadphase beyond the brute-force all-pairs AABB pass.

### `@flare-engine/audio` (< 4KB gzip)

| API            | Description                                                                                |
| -------------- | ------------------------------------------------------------------------------------------ |
| `AudioManager` | `init()`, `suspend()`, `resume()`. Manages AudioContext.                                   |
| `SFXPool`      | Pre-decoded buffers. `play(name, { volume?, rate?, loop? })`. `rate` applies only when the injected node exposes a `playbackRate` param. Polyphony management (max N, oldest killed).     |
| `Music`        | `play`, `stop`, `crossfadeTo`. One track at a time, loops by default.                      |
| `createChannels(ctx)` | Factory returning a `Channel` map keyed by `ChannelName` (`master`, `sfx`, `music`). Gains 0.0–1.0. In-memory only — MMKV persistence is deferred. |

Lifecycle is manual — the package wires no automatic listener. Call `AudioManager.suspend()`/`resume()` from your own `AppState` (native) or `visibilitychange` (web) handler.

### `@flare-engine/assets` (< 6KB gzip)

| API            | Description                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------- |
| `AssetManager` | `load(manifest)` → Promise (fail-fast — one failure rejects). `loadManifestSettled(manifest)` → `{ loaded: string[]; failed: { key, error }[] }` (caches successes, never rejects). `get(key)`. `progress` (0-1), `onProgress` signal. |
| `AssetLoader`  | Function type `(entry) => Promise<unknown>`. Injected by the host. Two defaults ship (below); or supply your own. |
| `createFetchAssetLoader({ decodeImage, fetch? })` | Web `AssetLoader` over `fetch` (defaults to global). Per `entry.type`: `texture` → `Texture` (via `decodeImage`), `binary` → `Uint8Array`, `json`/`spritesheet` → parsed JSON. `decodeImage: (bytes) => SkImageLike \| null` — wire to `kit.MakeImageFromEncoded`. `fetch` is the structural `FetchLike`, not DOM-typed. |
| `createFileAssetLoader({ readFile, decodeImage })` | Native `AssetLoader` over an injected `readFile: (path) => Promise<Uint8Array>` (e.g. expo-file-system) — no RN import. Same per-`type` mapping; JSON is parsed from UTF-8 bytes. |
| `Texture`      | Wraps Skia SkImage                                                                           |
| `SpriteSheet`  | Parsed from TexturePacker JSON (hash + array) / Aseprite JSON. **Rotated frames are unsupported** — TexturePacker `rotated: true` frames render sideways; the parser emits a dev-mode `console.warn` naming the frame. Re-export with rotation disabled. Full support is post-launch. |
| `SpriteFrame`  | `{ name, x, y, w, h }` — one frame in an atlas.                                              |
| `createProceduralAtlas(Skia, frames, opts?)` | Builds an `SkImage` + `SpriteSheet` from `{ name, w, h, color }[]`. Row-packs by `maxWidth`, honors `padding`. Narrow `SkiaAtlasModuleLike` is injected by the caller so `@flare-engine/assets` stays runtime-agnostic. |
| `SkImageLike`                               | Structural interface: `width(): number; height(): number; readPixels(): Float32Array \| Uint8Array \| null`. `readPixels` enables pixel read-back for CPU-side logic (e.g. collision maps, lighting lookups). |
| `decodeImage(Skia, bytes)` | Decodes a `Uint8Array` of raw image bytes into an `SkImageLike` via `Skia.Data.fromBytes` + `Skia.Image.MakeImageFromEncoded`. Returns `null` on failure, never throws. Narrow `SkiaImageDecodeModuleLike` is injected so the package stays runtime-agnostic. |

Audio buffer types are defined in `@flare-engine/audio` (`AudioBufferLike`), not here.

---

## Layer 3: Feature Modules

### `@flare-engine/scene` (< 4KB gzip)

| API             | Description                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `SceneManager`  | `register(name, factory: SceneFactory)`, `go(name, data?)`, `push(name)`, `pop()`                                                             |
| `SceneFactory`  | `(world: World, camera: Camera2D) => Scene`. `SceneManager` calls it with the `World`/`Camera2D` it created for this scene instance, so a factory can pre-populate the world before returning it as part of `Scene`. A zero-argument `() => Scene` factory (ignoring both parameters) is still assignable. |
| `Scene`         | Interface, not a class. `world: World` and `camera: Camera2D` are required — return the ones the factory received (or your own). Optional hooks: `onPreload`, `onInit`, `onEnter`, `onUpdate`, `onDraw`, `onExit`, `onDestroy`                         |
| Transitions     | Factory functions: `noneTransition()`, `fadeTransition(duration?, easing?)`, `slideTransition(duration?, direction?, easing?)`. Each returns a `Transition` with a `kind: 'none' \| 'fade' \| 'slide'` discriminator so renderers apply the right visual effect (alpha vs. translate). The optional `easing?: EasingFn` parameter (imported from `@flare-engine/math`) maps raw linear progress to an eased value; defaults to identity (linear). `state.progress` always holds the eased value. |

### `@flare-engine/animation` (< 5KB gzip)

| API                                    | Description                                                                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `createSpriteAnimator(sheet)`          | Returns animator state. `playAnimation(state, name)`, `updateAnimator(state, dt)` → `SpriteFrame \| null`, `pauseAnimation(state)` / `resumeAnimation(state)` / `stopAnimation(state)`, `getCurrentFrame(state)` → `SpriteFrame \| null`. Tick-based. |
| `tween(from, to, duration, easing?)`   | Returns `Tween` state object. `updateTween(tween, dt)` → value. Chain via `chainTween`.         |
| `spring(value, target, config?)`       | `config` is `Partial<SpringConfig>` — `{stiffness (100), damping (10), mass (1)}` (no `target` in config; it is the positional arg). Returns `Spring { value, velocity, target, config, atRest }`. `updateSpring(s, dt)` → value. `setSpringTarget(s, target)` wakes it; `resetSpring(s, value)` zeroes velocity. |
| `TweenManager`                         | `addTween(mgr, tween)`, `updateTweens(mgr, dt)`. Auto-removes completed.                        |
| `periodicTween(from, to, period, easing?)` | Oscillating driver that ping-pongs between `from` and `to` indefinitely. Default easing: `easeInOutSine`. Returns `PeriodicTween` state. `updatePeriodicTween(tw, dt)` → current value (wraps elapsed modulo period). `resetPeriodicTween(tw)` zeroes elapsed and restores `value = from`. Period must be > 0. |
| `createStepSequence(steps)` | Returns `StepSequence { steps, current, elapsed }`. `steps` is `StepSequenceStep[] = { duration: number }[]`; throws if empty or any `duration <= 0`. `current=0, elapsed=0`. |
| `tickStepSequence(seq, dt)` | Advances `seq.elapsed` by `dt`; drains across steps cyclically with a `while` loop (handles large dt spanning multiple steps); mutates in place (zero-alloc). Returns the new `current` index. Exactly-equal boundary (`elapsed == duration`) advances to the next step. |
| `resetStepSequence(seq)` | Sets `seq.current = 0` and `seq.elapsed = 0`. |
| `createTimedModifier<T>(value, duration, combine)` | Returns `TimedModifier<T> { value, combine, remaining }`. Throws if `duration <= 0`. |
| `tickModifier<T>(mod, dt)` | `mod.remaining -= dt`, clamped to 0. Zero-alloc. |
| `isModifierActive<T>(mod)` | `mod.remaining > 0`. |
| `applyModifier<T>(base, mod)` | Returns `combine(base, mod.value)` when active; `base` when expired (identity). Zero-alloc when `T` is `number` and `combine` is pure arithmetic. |

Animation APIs are functional (state object + free functions), not class-based — consistent with ECS/render style and tree-shakeable.

### `@flare-engine/particles` (< 4KB gzip)

| API               | Description                                                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ParticleEmitter` | `new ParticleEmitter(config, opts?)` — `EmitterOptions`: `maxParticles?` (hard cap, overrides `config.maxParticles`; default 256), `seed?` (LCG seed; default 1). Config: rate, lifetime, speed, direction, spread, gravity, start/end color/size/alpha. `reseed(seed)` restarts the deterministic random sequence. `maxParticles` is the enforced pool cap — `burst()` and `update()` stop spawning at cap, zero allocation past cap. |
| `ParticlePool`    | Pre-allocated. No GC during gameplay. `acquire()`, `tryAcquire(): Particle \| null` (returns null at cap), `update(dt, gx, gy)`, `getSize(p)`, `getAlpha(p)`, `getColor(p)` (shared buffer), `getColorInto(p, out)` (caller buffer). `created` getter = cumulative factory calls from the internal pool's `acquire()`/`tryAcquire()` only; `prewarm()` is excluded. Snapshot before and after a frame — a non-zero delta in steady state means unexpected allocation. |

| `EmitterShape` | Tagged union for `config.shape` — `{ kind: 'point' }` (default) · `{ kind: 'circle', radius, radial? }` · `{ kind: 'ring', radius, thickness?, radial? }` · `{ kind: 'rect', width, height }` · `{ kind: 'cone', radius, angle, radial? }`. Samples spawn **position** only; `direction`/`spread` continue to govern velocity. `radial: true` hands velocity to the shape's outward normal instead (`rect` has none). |
| `sampleEmitterShape(shape, rand, out, direction?)` | Writes a spawn offset + outward normal into a caller-owned `ShapeSample` (`createShapeSample()`); allocates nothing, safe per-particle. `rand` returns `[0, 1)`. `direction` orients `cone` and is ignored otherwise. `hasRadialNormal(shape)` reports whether the normal is usable. |
| `drawParticles(pool, batch, image, frame, options?)` | Queues every live particle into a caller-owned batch via `drawRaw` — zero-alloc, skipping particles whose interpolated size or alpha reached 0. `ParticleBatchLike` and `ParticleFrameLike` are **structural**, so this package takes no dependency on `render` or `assets`; a real `SpriteBatch` satisfies the former, a `SpriteFrame` the latter. `options`: `effect?` (constant for the whole call), `anchorX?`/`anchorY?` (default 0.5 — centred). Size, alpha and rotation come from the pool's interpolators. |

Uses immediate mode (PictureRecorder) at the draw layer — this package owns particle data and lifecycle, not rendering. Target: 200-500 particles at 60fps.

**Implementation notes:**

- `circle` and `cone` are uniform **by area** (`sqrt`-weighted radius); without that particles bunch toward the centre. `ring` is uniform across its band instead, because area-weighting a thin band buys nothing.
- Every shape draws a **fixed** number of values from `rand` (`point` 0, all others 2), and shape sampling runs before the velocity draws. That ordering is what makes a seeded emitter replay exactly — a draw count that varied with output would shift the velocity sequence. `point` drawing zero is also why an emitter with no `shape` reproduces the pre-shape sequence bit for bit.
- Degenerate and negative extents are clamped to 0, so a mis-sized shape collapses to the origin rather than emitting `NaN` positions.
- `drawParticles` applies **alpha but not colour** per particle. A batch retains the effect *reference* until flush, so one reusable effect object would give every particle the last one's colour, and a per-particle object is precisely the allocation this package avoids. Per-particle colour needs either that allocation (write the loop yourself over `pool.particles`) or a `SpriteBatch` that copies effect values rather than holding the reference.

### `@flare-engine/tilemap` (< 8KB gzip)

| API               | Description                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `parseTiled(json)`     | → `TilemapData`. Orthogonal maps, tile/object layers, properties, collision shapes.                   |
| `parseLDtk(json)`      | → `TilemapData`. Levels, tile/entity layers, enums.                                                   |
| `parseLDtkEntities(map)` | → `LDtkEntity[]`. Flattens all object layers into spawn-ready `{ id, x, y, width, height, fields }` — `id` is the LDtk entity identifier (its type). Feed each to `world.spawn`. |
| `TilemapRenderer`      | Owns its own `SpriteBatch`. `draw(camera, flush)` culls, queues tiles into `this.batch`, then calls `flush(this.batch)` — delegates to `drawInto`. `drawInto(camera, batch)` queues visible tiles into the caller-owned `batch` without flushing — zero-alloc, enables single-flush z-ordering (tiles under sprites). |
| `extractColliders(data)` | → `TileCollider[]`. Extracts solid tiles → collision shapes for physics.                             |

#### Authoring pipeline

**Tiled (primary).** Export with Tile Layer Format = **CSV** (base64, compressed, and chunked formats throw `TilemapParseError`). Tilesets must be **embedded** (Tiled ▸ Map ▸ "Embed tilesets") OR left external and run through `flare tiled-to-flare`, which emits Tiled-shaped JSON `parseTiled` accepts directly (embeds by default; `--no-embed-tilesets` keeps the `source` ref instead, which `parseTiled` still rejects — that mode is for pipelines that resolve tilesets themselves). Only **orthogonal** orientation; only **tilelayer** + **objectgroup** layers (flatten groups, remove image layers). Each unsupported input throws `TilemapParseError` with an actionable message — thrown cases: infinite maps, non-orthogonal orientation, external tilesets, base64/compressed/chunked layer data, unsupported layer types.

**LDtk (secondary) — support matrix:**

| LDtk layer type | Output |
| --- | --- |
| `Tiles` / `AutoLayer` | Tile layer — resolved through each layer's tileset, deterministic firstGids (sorted by uid ascending). |
| `IntGrid` | Tile layer with a synthetic collision tileset — `solidTiles` populated via the `intGridSolid` predicate (default `v > 0`); non-empty layers produce colliders via `extractColliders`. |
| `Entities` | Object layer — extracted as spawn-ready `LDtkEntity[]` via `parseLDtkEntities`. |

`externalLevels: true` ("Save levels to separate files") throws `TilemapParseError`.

**Entity → ECS spawn wiring** (illustrative fragment — `world`, `Position`, `PlayerTag` are the consumer's own; tagged `no-check`):

```ts no-check
for (const e of parseLDtkEntities(map)) {
  const entity = world.spawn();
  world.add(entity, Position, { x: e.x, y: e.y });
  if (e.id === 'Player') world.add(entity, PlayerTag);
}
```

### `@flare-engine/pathfinding` (< 8KB gzip)

Grid pathfinding (A\*), Jump-Point Search optimization for uniform-cost grids, and a navmesh fallback for non-grid maps. No external deps beyond `@flare-engine/math`.

| API | Description |
| --- | --- |
| `Grid` / `GridConfig` / `createGrid(config)` | Walkability + cost grid. `inBounds(grid, x, y)`, `isWalkable(grid, x, y)`, `getCost(grid, x, y)`, `setWalkable(grid, x, y, v)`, `setCost(grid, x, y, n)`. |
| `findPath(grid, startX, startY, endX, endY, options?)` | A\* over `Grid`. Returns `PathResult { path, cost, explored }` or `null` when no route exists. `PathOptions` selects `manhattanDistance` / `octileDistance` / `chebyshevDistance` / `euclideanDistance` heuristics + diagonal toggle. |
| `findPathJPS(grid, startX, startY, endX, endY, options?)` | Jump-Point Search variant — typically 5–10× faster than A\* on uniform open grids; when any tile costs more than 1 (one linear scan of `grid.data` per call) it delegates to `findPath` with `diagonal: true`, forwarding `maxIterations`/`heuristic`, so a weighted grid gets a cost-correct A\* result (with A\*'s corner-cutting rule) instead of a JPS path that ignored costs. Returns `PathResult \| null`. `JpsOptions`. |
| `NavMesh` / `NavMeshPolygon` / `Portal` / `createNavMesh(polygons)` | Convex-polygon navmesh; each `NavMeshPolygon` carries its own `portals` (shared-edge list), so `createNavMesh` takes only the polygon array. `findPolygonAt(mesh, x, y)`, `findNavMeshPath(mesh, start, end) → NavMeshPathResult \| null`. Used for non-grid bosses, large open zones. |

**Implementation notes:**

- Pure-data API: grids and navmeshes are plain objects, no classes. Heuristics are exported as named functions for tree-shake.
- `findPath`/`findPathJPS` return `PathResult.path` as an array of `{ x, y }` grid-coordinate points from start to end inclusive — not a flat packed array. `findNavMeshPath` returns `NavMeshPathResult.path` as an array of smoothed `Vec2` world-space waypoints, plus `corridor: number[]`, the polygon ids traversed.
- **`findPath` and `findPathJPS` are not interchangeable — they disagree on corner cutting.** `findPath` refuses a diagonal step whose two shared cardinal neighbours are both blocked; `findPathJPS` permits it. On the 3×3 grid with `(0,1)` and `(1,0)` blocked, `findPath(grid, 0, 0, 1, 1)` returns `null` while `findPathJPS` returns `[{x:0,y:0},{x:1,y:1}]`. Swapping one for the other to gain speed changes movement semantics, and on maps with tight diagonal gaps it changes which routes exist. Pinned by tests in `packages/pathfinding/tests/jps.test.ts`.
- The open-set heap grows on demand (doubling). It was previously fixed at `min(width*height, 4096)` with unchecked pushes; because a typed-array out-of-range write is silently dropped, exceeding the cap corrupted the open set and returned a **valid-looking but non-optimal** path — no error, no NaN. Fixed in OSS-B18, regression-covered by `tests/heap-growth.test.ts`.
- **Status: beta — no production consumer yet.** Correct and tested, but unlike the rest of the scope it is not exercised by a shipping game.
- Not used by Pan Tvardowski (shmup) — verified by integration tests in `packages/pathfinding/tests/`.

---

### `@flare-engine/dialogue` (< 5KB gzip)

Branching dialogue graphs with conditions, actions, variable interpolation, and a typewriter text-reveal helper. No rendering — pair with `@flare-engine/ui` (`DialoguePanel`) on the view side.

| API | Description |
| --- | --- |
| `DialogueGraph` / `DialogueNode` (union) | A graph is a `Map<NodeId, DialogueNode>` plus a `start: NodeId`. Node kinds: `LineNode` (speaker + text), `ChoiceNode` (player picks an `ChoiceOption`), `BranchNode` (predicate-driven `BranchArm[]`), `ActionNode` (fires a side effect via `ActionHandler`), `EndNode`. |
| `createDialogueGraph(start, nodes)` / `getNode(graph, id)` | Builders + lookup. |
| `DialogueRunner` / `createDialogueRunner(options?)` | Stateful runner. `DialogueRunnerOptions`: `{ conditions?: ConditionResolver, actions?: ActionHandler, onError?(err: DialogueError) }`. The graph + variables are passed to `runner.start(graph, variables?)`, **not** the factory. Events are **Signals** on the runner: `onLine: Signal<DialogueLineEvent>`, `onChoice: Signal<DialogueChoiceEvent>`, `onAction: Signal<string>`, `onEnd: Signal<string>`. Drive with `advance()` / `selectChoice(index)` / `stop()`; read `state` / `currentNodeId` / `graphId`. `DialogueRunnerState` is a status union: `'idle' \| 'running' \| 'waiting-choice' \| 'ended'`. |
| `interpolate(text, variables)` | Interpolates `{var}` tokens against a `VariableBag` (`Record<string, string \| number>`); an unknown token passes through unchanged. |
| `createTextReveal(text)` / `updateTextReveal(state, dt, options?)` / `completeTextReveal(state)` / `resetTextReveal(state)` | Typewriter state machine — `createTextReveal` takes no options. `TextRevealState` exposes `visibleText: string` and `complete: boolean`. Per-frame options live on `updateTextReveal`: `TextRevealOptions` = `{ speed? (chars/sec, default 30), punctuationDelay? (extra seconds after `.!?:;`, default 0.15) }`. |

**Implementation notes:**

- Single hard dep: `@flare-engine/events` (`Signal`).
- `ConditionResolver` and `ActionHandler` are caller-supplied — the package owns no game state.
- Used by [Pan Tvardowski](https://github.com/grzott/Pan-Tvardowski) for the inter-zone dialogue card stack and boss banter.

---

### `@flare-engine/debug` (< 3KB gzip, tree-shaken in prod)

- Collision bounds, entity origins, velocity vectors overlay
- FPS, entity count, draw calls, atlas usage stats
- `createFpsWidget(opts?)` — formatter that consumes a `DebugStats` snapshot and exposes a compact one-line summary (`"60 FPS | 16.7ms | e:42 d:8"`) plus a multi-line breakdown. Rendering-agnostic: hosts draw the strings via Skia `canvas.drawText`, an RN `<Text>` overlay, or anything else.
- `createFrameBudget(opts)` — fps-ring watchdog + per-counter budget tracker. `opts`: `{ limits: FrameBudgetLimits; fpsThreshold?: number (default 55); ringSize?: number (default 180); onWatchdog?: () => void; debug?: boolean (default false) }`. Returns `FrameBudgetHandle`: `recordFrame(dtSec)` (writes into pre-allocated `Float32Array` ring, fires `onWatchdog` once when avg fps drops below threshold), `recordCounters(snapshot)` (copies values into a pre-allocated snapshot object in-place; warns on limit breach when `debug=true`), `getSnapshot()` (returns the same mutable object reference — zero-alloc), `getAvgFps()` (returns 0 until ring is full), `resetFpsRing()` (clears ring and re-arms watchdog). `FrameBudgetLimits` and `FrameBudgetSnapshot` are both `Record<string, number>`. Consumer's `onWatchdog` is opaque — no postfx dependency.
- `createBootTrace(label?)` — closure-local boot milestone recorder. Default `label` is `'boot-trace'`. Returns `BootTraceHandle`: `mark(name)` (records a named milestone; first call sets t=0 and starts the clock using `performance.now()` with `Date.now()` fallback), `dump()` (returns a log line `[<label>] total=<N>ms <a>-><b>=<N>ms …` matching the format consumed by the Pan Tvardowski repo's `scripts/parse-boot-trace.ts`, or `null` if no marks have been recorded), `reset()` (clears all state so the trace can be restarted), `getEntries()` (returns a snapshot copy of `BootEntry[]` — `{ name, t }` — safe to mutate without affecting internal state). `PerfSample` is out of scope. Designed to be engine-only promoted source; PT-side strip ships separately.
- `createPerfRecorder(opts?)` — scenario-level performance recorder for the benchmark harness. `opts`: `{ label?: string (default 'perf'); ringSize?: number (default 1800, = 30s @ 60fps) }`. Returns `PerfRecorderHandle`: `beginSection(name)` / `endSection(name)` bracket a named timing section — elapsed time is written into a pre-allocated `Float32Array` ring per section (zero-alloc after first call to a new section name); `recordFrame(counters?)` increments `frameCount` and accumulates optional per-frame counter values (min/max/sum, zero-alloc — no allocation per call after the counter key is first seen); `flush() → PerfReport` copies and sorts each section's ring to compute `{ count, min, max, mean, p50, p95, p99 }` (copy-sort on flush, not per frame), returns `PerfReport`; `reset()` clears all rings, counters, and `frameCount` without deallocating. `PerfSectionStats`: `{ name, count, min, max, mean, p50, p95, p99 }`. `PerfCounterStats`: `{ name, count, min, max, sum, mean }`. `PerfReport`: `{ label, durationMs, frameCount, sections: readonly PerfSectionStats[], counters: readonly PerfCounterStats[] }`.
- `emitPerfReport(report)` — writes a single-line tagged JSON entry `[perf-bench] {...}` to `console.log` for logcat / iOS unified-log capture. The sentinel tag `PERF_BENCH_TAG = '[perf-bench]'` is a named export for grep/parse stability.
- Pause, step-frame, slow-motion via `timeScale`
- Entity-inspector (tap to log components) — deferred

---

## Layer 4: Integration

### `@flare-engine/react` (< 10KB gzip)

**Web target.** The package runs on web unchanged — same import, same `<GameView>`, no `/web`
subpath and no platform-specific build output (the package ships a single bundled entry, so
`.web.tsx` file resolution is not available to it). `react-native-web >=0.20.0` and
`canvaskit-wasm >=0.40.0` are **optional** peer deps. A web host must `await LoadSkiaWeb(...)`
before mounting `<GameView>` and serve `canvaskit-wasm/bin/full/canvaskit.wasm` (the `full` build —
`LoadSkiaWeb` imports the `full` glue, so the base build is an ABI mismatch).

Scene capture is platform-branched internally: native uses RN-Skia's `usePictureAsTexture`
unchanged, while web captures into **one reused offscreen surface** and detaches the snapshot with
`makeNonTextureImage()`. This is a correctness requirement on web, not a tuning choice — RN-Skia's
web `MakeOffscreen` allocates an unreleased WebGL context per call, and a per-frame allocation trips
Chrome's 16-live-context cap and evicts the on-screen canvas. Both hooks still run on both platforms
so hook order never varies, but the web hook is now **imperative**: `GameView`'s `onPreRender` frame
callback calls its `capture(picture, width, height)` method directly instead of pushing the picture
through React state, and it is inert on native because nothing calls it there. The old reactive form
(a passive effect keyed on the picture value) caused a setState-in-a-passive-effect cascade that
tripped React's `NESTED_PASSIVE_UPDATE_LIMIT` and logged `Maximum update depth exceeded` on every
web load. The web capture path holds a FIFO retention ring of 3 images rather than a single slot:
RN-Skia's web `<Canvas>` paints on its own rAF, which fires after the capture, so releasing the
image on the next capture frees an object the canvas is still reading (BindingError + blank canvas).
Measured minimum safe depth is 3 (hold=1 and hold=2 both blank; hold=3 stable at 1378 frames).
Background: `docs/plans/web-target-2026-08.md` §12.

**PostFx on web.** The postfx chain is **unavailable on web** in this release and is silently
skipped. `Skia.RuntimeShaderBuilder` (used inside `buildPostFxPasses`) and
`ImageFilter.MakeRuntimeShaderWithChildren` (used to compose the `<RuntimeShader>` children) both
throw `Not implemented on React Native Web`. `GameView` detects `Platform.OS === 'web'` and skips
`buildPostFxPasses` and the `setPasses` state update entirely, keeping the scene rendering
unfiltered. A one-time `console.warn` per `<GameView>` instance is emitted naming both throwing call
sites, but only when a postfx binding actually exists (`bridge.hasPostFxBinding()` is true) — a
`<GameView>` with no chain loads silently. `onRenderPostFx` still fires on web (the hook receives
the bridge), but any `setPostFxBinding` call has no visible effect. Native postfx is unchanged.

| API                     | Description                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `<GameView>`            | Root component. Skia Canvas + game loop + input. Props: `config`, `onReady`, `style`, `children`, `safeArea?`. If `safeArea` is omitted, insets are read via `useContext` from `react-native-safe-area-context` (a required peer dep — a project without it fails to resolve at runtime) and fall back to `{ top: 0, right: 0, bottom: 0, left: 0 }` when no `<SafeAreaProvider>` ancestor is mounted. Unlike `useSafeAreaInsets()`, this never throws. `GameConfig.onRenderPostFx` is typed as `PostFxRenderHook` (receives `bridge` as 3rd arg). **Multi-touch:** GameView holds the RN responder for its container and routes all concurrent touches to `InputManager` via `nativeEvent.changedTouches`, each with its real `identifier` as the pointer id. Overlay controls (`<VirtualJoystick>`, `<VirtualButton>`) operate independently of this routing and do not conflict with it. |
| `<VirtualJoystick>`     | Overlay RN component. Props: `config?` (`VirtualJoystickConfig`), `onStateChange?`, `style?`. Skin slots: `base?: React.ReactNode` — replaces the default base-circle View (the outer View retains all touch responders; when absent, the translucent background is applied as well); `thumb?: React.ReactNode` — replaces the default knob View and inherits the drag-offset transform wrapper. Both slots default to the built-in appearance when absent (backward-compatible). The outer container always applies `alignItems:'center'` / `justifyContent:'center'` regardless of whether `base` is set — this is what anchors the `thumb` wrapper at the pad centre. Only the translucent background (`rgba(255,255,255,0.2)`) is suppressed when `base` is provided. Consumer contract: a passed-in skin node must carry its own explicit width/height — the transform wrapper around `thumb` is zero-size. `pointerEvents="none"` is applied by the engine to both slots; the consumer must not set it on the passed-in node. |
| `<VirtualButton>`       | Overlay RN component. Uses raw `onTouchStart`/`onTouchEnd`/`onTouchCancel` (not the RN responder system), so press and release fire regardless of which ancestor holds the responder. Enables simultaneous use with `<VirtualJoystick>`. Props: `onStateChange?`, `style?`, `children?`. |
| `<LoadingScreen>`       | Full-screen asset-preload overlay. Props: `progress` (0–1, clamped), `message?`, `barColor?`, `trackColor?`, `textColor?`, `style?`. Pure RN View + Text so it works before `<GameView>` mounts its Skia canvas. |
| `useGame()`             | Returns the full `GameContextValue`: `{ world, camera, input, audio, assets, scenes, loop, renderer, batch }`      |
| `useEntity(query)`      | Subscribe to ECS query changes (returns a snapshot array; React re-renders on add/remove)                          |
| `useGameLoop(callback)` | Register a per-frame function on `loop.onUpdate`                                                                  |
| `useSafeArea()`         | Returns the `SafeArea` insets `{ top, right, bottom, left }` from the nearest `<GameView>`. Throws `'useSafeArea must be used inside a <GameView>'` if called outside one. |
| `SafeArea`              | Type: `{ top: number; right: number; bottom: number; left: number }`. Device safe-area insets in logical pixels. |
| `SafeAreaContext`       | `React.Context<SafeArea \| null>`. Provided by `<GameView>`; `null` outside it. Prefer `useSafeArea()` for direct consumption. |
| `PostFxRenderHook`      | `(ctx: GameContextValue, canvas: unknown, bridge: SkiaFrameRenderer \| null) => void`. Callback type for `GameConfig.onRenderPostFx`. The `bridge` arg exposes `setPostFxBinding(runtime, chain)` so the hook can register the runtime and chain for the current frame. `bridge` is `null` only on future non-Skia render paths. |
| `RenderHook`            | `(ctx: GameContextValue, canvas: unknown) => void`. Callback type for `GameConfig.onRenderBackground`. |
| `SkiaFrameRenderer`     | Interface returned by `createSkiaFrameRenderer`. Methods: `beginFrame(w, h, time?)`, `drawAtlas(image, commands)`, `setPostFxBinding(runtime, chain)`, `hasPostFxBinding(): boolean`, `buildPostFxPasses(runtime, chain, w, h): readonly PostFxPassDescriptor[]`, `endFrame(): SkPicture \| null`. `hasPostFxBinding` returns true only when the bound runtime is non-null, supported, has a `buildPass` method, and a chain is bound — it never calls `runtime.buildPass`, so it is safe on web. `buildPostFxPasses` maps each `CompiledPassLike` from `runtime.buildPass` to a `PostFxPassDescriptor` keyed by SkSL uniform name for use with JSX `<RuntimeShader>`. Returns an empty array when the runtime is null, unsupported, has no `buildPass`, or the chain has no enabled effects. |
| `SkOffscreenCanvasLike` | Structural canvas interface. `drawPicture(p)`, `drawImageRect(img, src, dst, paint)`, `drawRect(rect, paint)`, `clear(color)`. Returned by `SkSurfaceLike.getCanvas()`. |
| `SkSurfaceLike`         | Structural interface for offscreen Skia surfaces. `getCanvas(): SkOffscreenCanvasLike; makeImageSnapshot(): SkImageLike`. Used by `renderShapesToImage`. |
| `ShapeRect`             | `{ x, y, w, h, color: number }` — axis-aligned rect with ARGB-packed color (`0xAARRGGBB`). Input to `renderShapesToImage`. |
| `RenderShapesOpts`      | `{ width, height, clearColor: number, shapes: ReadonlyArray<ShapeRect> }` — options for `renderShapesToImage`. `clearColor` is ARGB-packed. |
| `renderShapesToImage`   | `(skia: SkiaModuleLike, opts: RenderShapesOpts) => SkImageLike \| null` — renders solid rectangles onto a fresh `MakeSurface` FBO and returns the snapshot. Returns `null` if `MakeSurface` is absent or fails. Surface is not cached. |
| `PostFxRuntimeLike`     | Structural runtime interface. `supported: boolean` gates activation. Optional `buildPass(chain, w, h): readonly CompiledPassLike[]` — when present, `buildPostFxPasses` maps the results into `PostFxPassDescriptor[]` for the JSX `<Image><RuntimeShader/></Image>` chain in GameView. |
| `useOverlayFade(visible, durationMs?)` | `visible: boolean`, `durationMs = 300`. Returns opacity `[0,1]` animating toward `visible ? 1 : 0` via rAF. In non-DOM environments (`typeof requestAnimationFrame === 'undefined'`, e.g. Bun tests) snaps instantly to the target — no `setInterval` fallback. Does NOT use `useGame()`/`useGameLoop()`; overlays live outside `<GameView>`. |
| `useCountUp(target, durationMs?)` | `target: number`, `durationMs = 600`. Animates from the previous `target` to the new `target` using `easeOutCubic` from `@flare-engine/math`. Same rAF + no-rAF-snap pattern as `useOverlayFade`. |
| `useSignalState<T>(signal, initial)` | `signal: Signal<T>` (from `@flare-engine/events`), `initial: T`. Subscribes via `signal.add(setter)` on mount and unsubscribes on cleanup using the returned disposer. Returns latest emitted value. |

### `@flare-engine/render-web` (< 12KB gzip)

Web-integration bridge — the web analog of `@flare-engine/react`: it composes `render`'s neutral frame-renderer backend with the `postfx` runtime via CanvasKit-WASM. Peer-dep `canvaskit-wasm >=0.40.0` (optional — tree-shaken when unused). No `@shopify/react-native-skia` import. `loadCanvasKit` / `createWebSurface` / `createWebSkiaModule` are the **pure CanvasKit backend** for `@flare-engine/render`; `createPostFxSurface` is the **bridge piece** that additionally composes the `@flare-engine/postfx` runtime (its `render → postfx` edge is a legal downward Layer-4 dependency).

| API | Description |
| --- | --- |
| `loadCanvasKit(wasmUrl, onProgress?, options?)` | Singleton loader. Reads wasm binary from `wasmUrl` (absolute URL or filesystem path). Falls back to `node:fs/promises` when `fetch` is absent (Node/Bun test environments). Calls `onProgress(1)` immediately if already loading/complete. `options: LoadCanvasKitOptions` tunes the load's failure bounds. `deadlineMs` (default 45000) is the hard ceiling on the whole load. `stallMs` (default 15000) aborts the *streaming fetch* if no bytes arrive for that long — on abort, `init()` falls back to CanvasKit's own (unbounded) loader for that one retry, so `stallMs` alone does not bound the total load; only `deadlineMs` does. A successful load is cached for the module's lifetime; a **failed** load is not cached, so a later call retries instead of being stranded on the earlier rejection. Returns `Promise<CanvasKit>`. |
| `LoadCanvasKitOptions` | `{ stallMs?: number; deadlineMs?: number }`. |
| `createWebSkiaModule(kit)` | Returns a `FrameRendererModule` backed by CanvasKit. Adapter differences handled internally: `drawAtlas` flattens `RectLike[]`/`RSXformLike[]` to grow-only `Float32Array` scratch buffers (zero-alloc steady state); `rotate` takes degrees (the `CanvasLike`/`DrawSurfaceLike` contract) and forwards verbatim to CanvasKit — `render`'s camera seam converts radians → degrees once; `ColorFilter.MakeBlend` maps numeric mode literals to CK `BlendMode` enum entries; `RSXform` objects carry `scos/ssin/tx/ty` readable fields. Pass to `createFrameRenderer` from `@flare-engine/render`. |
| `createWebFrameRenderer(kit)` | `createWebFrameRenderer(kit: CanvasKit): FrameRenderer`. The web/CanvasKit analog of `@flare-engine/react`'s `createSkiaFrameRenderer` — a thin composition `createFrameRenderer(createWebSkiaModule(kit))` (from `@flare-engine/render`), so the frame-renderer body stays backend-neutral and shared with native. Presentation (replaying `endFrame()` onto a CK surface + flushing) is the consumer's job — pair with `createWebSurface` or `createPostFxSurface`. |
| `createWebSurface(kit, canvas)` | Returns `WebSurface \| null` — `{ canvas: CanvasLike, ckCanvas: Canvas, flush(), dispose() }`. Creates a WebGL-backed CanvasKit surface for the given `<canvas>` element. `canvas` wraps the on-screen canvas as `CanvasLike` (unpacks packed-ARGB `clear(color: number)` to Float32Array for CK) — pass to `Renderer.setCanvas()`; `ckCanvas` is the same canvas as CanvasKit's `Canvas`, for presenting an `endFrame()` picture via `drawPicture`. Nothing appears until `flush()`; `dispose()` deletes the GPU surface. Returns `null` when WebGL is unavailable. |
| `PostFxSurface` | Interface: `width`, `height`, `sceneCanvas(): Canvas \| null`, `onscreenCanvas(): Canvas \| null`, `clear(bgRgb)`, `fadeTrail(bgRgb, alpha)`, `composite(globalIntensity?)` (runs the chain at `chain.globalIntensity`; the optional argument writes a new value into the chain — omit it so an a11y `setMotionScale` holds), `flush()`, `resize(w, h)`, `isLost(): boolean`, `dispose()`. `sceneCanvas()`/`onscreenCanvas()` return `null` while the WebGL context is lost. The surface owns its WebGL context explicitly (`GetWebGLContext`/`MakeWebGLContext`/`MakeOnScreenGLSurface`) and self-heals: `webglcontextlost` marks it lost and no-ops `clear`/`fadeTrail`/`composite`/`flush`; `webglcontextrestored` rebuilds the context and surfaces on the same canvas and re-clears to the last background. `isLost()` reports the current state for a host-side fallback. `dispose()` frees the `GrDirectContext` and the context handle along with the surfaces. The composite blit uses `Src` blend mode so a pass cannot composite stale ping-pong content. |
| `createPostFxSurface(kit, canvas, chain)` | **Bridge piece.** Returns `PostFxSurface \| null`. Creates a pair of offscreen surfaces (scene + ping-pong) plus a WebGL onscreen surface, and runs the caller-supplied `@flare-engine/postfx` `EffectChain` at composite time. Pass a new empty `EffectChain()` for a passthrough surface. |

**Typical web setup:**
```ts
import { createFrameRenderer } from '@flare-engine/render';
import { createWebSkiaModule, loadCanvasKit } from '@flare-engine/render-web';

declare const width: number;
declare const height: number;
declare const time: number;

const kit = await loadCanvasKit('/assets/canvaskit.wasm');
const mod = createWebSkiaModule(kit);
const renderer = createFrameRenderer(mod); // backend-neutral body from @flare-engine/render
renderer.beginFrame(width, height, time);
// … draw sprites via renderer.drawAtlas(image, commands) …
const pic = renderer.endFrame();
// replay `pic` onto a CanvasKit surface via drawPicture
```

### `@flare-engine/engine` (< 2KB gzip)

`createGame(config) → GameInstance` — pure factory. Constructs `World`, `Camera2D`, `Renderer`, `SpriteBatch`, `InputManager`, `AudioManager`, `AssetManager`, `SceneManager`, `GameLoop` and returns them with `start()` / `stop()`. Does **not** own the render loop or Skia canvas lifecycle — those belong to `@flare-engine/react`.

Two entry points:

- **`.` (default barrel)** — curated re-exports of the 14 headless packages + `@flare-engine/dynamics` + `@flare-engine/postfx` + a curated subset of `@flare-engine/react`. Pulls React Native into scope; intended for RN + Web full-stack consumers. Barrel collisions resolved by aliasing: `CompiledShader` from postfx → `PostFxCompiledShader`; `SkImageLike` from postfx → `PostFxSkImageLike`; `GameConfig` from react → `GameViewConfig` (engine's own `createGame` `GameConfig` keeps the name); `World` from dynamics → `DynamicsWorld` and `Body` from dynamics → `DynamicsBody` (the ECS `World` keeps the name). `dynamics` is **not** in the `./headless` subset.
- **`./headless`** — RN-free subset: the 14 headless packages (`math`, `events`, `core`, `ecs`, `render`, `input`, `physics`, `audio`, `assets`, `scene`, `animation`, `particles`, `tilemap`, `debug`) plus `createGame`/`GameConfig`/`GameInstance` and tier2-wiring. No `@flare-engine/react`, no `@flare-engine/postfx`. Safe for web-only, Node, and test consumers. `import { World, GameLoop, createGame } from '@flare-engine/engine/headless'`

Tier-2 wiring API: `createTier2Wiring(options)` glues optional `AchievementsProvider` / `LeaderboardsProvider` / `AnalyticsProvider` instances to a Tier2 event source via declarative `Tier2Rule[]` rules — `AchievementRule`, `AnalyticsRule`, `LeaderboardRule`. Used by games to record events without each scene knowing which providers are active.

---

## Layer 2.5: Persistence (OSS-launch addition)

### `@flare-engine/storage` (< 4KB gzip)

Typed, versioned key/value persistence for save games and app settings. Pluggable adapters (MMKV on native, IndexedDB on web, in-memory for tests).

| API                                   | Description                                                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StorageAdapter`                      | Async interface: `get(key) → string \| null`, `set(key, value)`, `delete(key)`, `keys() → string[]`, `clear()`. All values are strings — callers serialize to JSON. |
| `createMemoryAdapter()`               | In-memory adapter. Lost on process exit. Use for tests, SSR, reduced-persistence modes.                                                                             |
| `createMmkvAdapter(mmkv)`             | Wraps a `react-native-mmkv` `MMKV` instance supplied by the caller. Sync under the hood; promises resolve immediately. `MMKVLike` interface keeps the package free of a hard peer dep at typecheck time. |
| `createIndexedDbAdapter(dbName?, storeName?)` | Wraps `globalThis.indexedDB`. Lazily opens the database on first use; connection is kept open for the adapter's lifetime.                                   |
| `s`                                   | Tiny Zod-ish runtime schema: `s.string()`, `s.number()`, `s.boolean()`, `s.literal(v)`, `s.optional(inner)`, `s.array(item)`, `s.object(shape)`, `s.union(...)`. Each returns `Schema<T>` with `parse(u)` (throws) and `safeParse(u)` (`{ ok, value } \| { ok: false, error }`). `Infer<S>` extracts `T`. |
| `Migration`                           | `{ version: number; migrate: (old: unknown) => unknown }`. Forward-only; each step lifts data from `version - 1` to `version`.                                      |
| `runMigrations(data, from, to, migrations)` | Applies every step whose version is in `(from, to]`, in ascending version order. Throws on backward / duplicate / non-integer versions.                       |
| `MigrationStep`                       | `{ from: number; to: number; migrate: (old: unknown) => unknown }`. Linear-step variant used by `defineMigrationChain`.                                             |
| `defineMigrationChain(steps)`         | Convenience wrapper: takes a contiguous array of `MigrationStep` (each `to === next.from`) and produces a `Migration[]` consumable by `runMigrations`. Throws on gaps. See [docs/recipes/save-migrations.md](../recipes/save-migrations.md). |
| `createStorage({ adapter, schema, version, migrations? })` | Returns a `Storage<T>` with: low-level `get/set/delete`, `saveSlot(name, data)`, `loadSlot(name) → T \| null` (runs migrations then schema; **throws** on a malformed envelope or a migration failure, e.g. a stored version newer than `version` — see `createDocumentStore.load` for the deliberately different `DocumentStore` behavior), `deleteSlot(name)`, `listSlots() → string[]`, `exportJSON()`, `importJSON(json)` (clears existing keys first). Slots are stored under `slot:<name>`; version envelope is `{ version, data }`. |
| `createDocumentStore({ adapter, key, version, migrations?, parse, onFirstRun? })` | Single-document versioned store. Inverse of `createStorage`'s N-slot model: one in-memory doc under a caller-supplied `key`. `parse(raw) → T` is the caller-supplied lenient parser (expected to handle `undefined` on first run; must not throw). `onFirstRun(doc) → T` is called on first run (absent key) or a fallback below — return value is saved and returned by `load()`. `load() → Promise<T>` never throws. It migrates the stored data forward then calls `parse`. On unparseable JSON or a non-envelope shape, it falls back to `parse(undefined)` → `onFirstRun` **and persists that fallback**, same as first run. On a migration failure (the stored version is newer than `version`, or a migration throws), it returns the same fallback for that call only **without persisting** — the stored document is left untouched so a build that can read it recovers the original data. This is a deliberate divergence from `createStorage.loadSlot`, which throws in the equivalent case; the two stores are not unified here. `get() → T` throws if `load()` has not been called. `save(doc) → Promise<void>`. `exportJSON() → string` (same `{ version, data }` envelope as `createStorage`). `importJSON(json) → Promise<T>` always persists its result, including a fallback — unlike `load()`, the caller supplied this payload directly. |
| `san` | Lenient sanitizer namespace. Combinators: `san.string(fallback)` — returns input if string, else fallback; `san.number(fallback)` — returns input if finite number, else fallback; `san.boolean(fallback)`; `san.literal(options, fallback)` — returns input if member of options, else fallback; `san.object(shape)` — applies each field sanitizer independently, drops unknown keys, returns all-defaults for non-object input; `san.array(item)` — transforms every element via item, returns `[]` for non-array; `san.arrayOf(guard)` — drops elements failing the type guard, returns `[]` for non-array; `san.clamped(fallback, min, max)` — returns fallback for non-finite input, else clamps; `san.pipe(sanitizer, transform)` — chains a sanitizer with a post-process transform. All combinators return a `Sanitizer<T> = (input: unknown) => T`. Never throw. |
| `Sanitizer<T>` | Type: `(input: unknown) => T`. A lenient parser that always returns `T`. |

**Implementation notes:**

- All adapter ops are async so the same API works against sync (MMKV) and async (IndexedDB) backends.
- `createMmkvAdapter` takes the MMKV instance as an argument — the package does not import `react-native-mmkv` itself, keeping it bun-testable and avoiding a native peer dep at the `@flare-engine/storage` layer.
- The schema validator covers primitives + object/array/optional/literal/union. Full Zod parity (refinements, transforms, effects) is out of scope; save data is simple enough.
- `createDocumentStore.parse` is intentionally not a `Schema<T>` — it is caller-owned lenient parsing (no throw contract), pairing with `san.*` combinators. `createStorage` uses `Schema<T>` (strict-throw path).
- `san.*` is the field-drop / lenient-fallback counterpart to `s.*`. Use `s.*` when the doc must be valid or rejected; use `san.*` when migrating real persisted data that may be partial or stale.

---

### `@flare-engine/errors` (< 2KB raw)

React error boundary + structured crash payloads for the OSS launch reliability substrate.

| API                                                       | Description                                                                                                                                                                   |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CrashPayload`                                            | `{ message, name, stack: string \| null, timestamp, context: Record<string, unknown> }`. Stable, JSON-safe shape for transports and bug reporters (`stack`/`context` are always present — `stack` is `null` when unavailable, `context` defaults to `{}`).                          |
| `createCrashPayload(err, context?)`                       | Normalizes any thrown value (`Error`, string, unknown) into a `CrashPayload`. Merges the optional `context` record for scene/level/user metadata.                             |
| `CrashTransport`                                          | `{ report(payload): void \| Promise<void> }`. Pluggable sink — Sentry, console, HTTP, etc.                                                                                    |
| `createNoopTransport()` / `createConsoleTransport()`      | Built-in transports for dev and tests (neither takes arguments).                                                                                                              |
| `createSentryTransport({ dsn?, environment?, release?, sampleRate?, enabled? })` | Lazy-loaded `@sentry/react-native` transport. Returns noop if `dsn` is missing or `enabled === false`. Imports the SDK on first capture; degrades to noop on import failure. `@sentry/react-native` is an **optional peer dependency** — never bundled. |
| `composeTransports(...transports)`                        | Fan-out helper. Returns a `CrashTransport` whose `report` calls every child sequentially; per-child failure is caught + logged but never aborts the chain. Empty input → valid noop transport. |
| `ErrorBoundary`                                           | React class component. Props: `fallback: (payload: CrashPayload, reset: () => void) => ReactNode`, `onError?(error: unknown, payload: CrashPayload)`, `transport?: CrashTransport`, `context?: Record<string, unknown>`. Catches render-time errors, calls `transport?.report(payload)`, renders fallback with a `reset()` that clears state. |
| `installGlobalErrorCapture(target, options?)`             | Routes uncaught errors and unhandled rejections into a `CrashTransport` — the crashes `ErrorBoundary` cannot see (update loop, async, asset load). `target: GlobalErrorTarget` is structural (`addEventListener?` / `removeEventListener?` for web `error` + `unhandledrejection`, `ErrorUtils?` for React Native), so `globalThis` covers both platforms and a test passes a fake. `options: { transport?, bufferSize? = 20, context? }`. Returns `GlobalCaptureHandle { uninstall(), setTransport(t), buffered }`. |
| `createClientTransport(client)`                           | Transport over an injected browser error client — `client: ErrorClientLike { captureException(error, hint?) }`. The web counterpart to `createSentryTransport`, which is native-only. Rebuilds the payload into an `Error` (preserving `name` and the original `stack`) because such clients group by it, and passes `{ extra: context }` as the hint. |

**Implementation notes:**

- React is a **peer dependency** — the package declares `react >= 19`; it is never bundled (peer deps are externalized by the `tsdown` build).
- Component is a class (required for `componentDidCatch` / `getDerivedStateFromError`). All other exports are plain functions.
- Tests instantiate the class directly and stub `setState`; no DOM/JSDOM required.
- `installGlobalErrorCapture` **chains** the previous React Native `ErrorUtils` handler rather than replacing it — that handler shows the dev red box and terminates the process on a fatal, so replacing it would turn a visible crash into a silent one. `uninstall()` restores it.
- The pre-transport ring buffer exists because a reporter is usually initialised *after* boot, and boot is when the interesting crashes happen. It is bounded (oldest dropped) so a crash loop cannot grow memory; `bufferSize: 0` disables it.
- Handlers never rethrow: a transport that throws is caught and logged, because the handler runs inside the platform's own crash path and throwing there would replace the real error with ours.

---

### `@flare-engine/testing` (< 4KB raw)

Deterministic test helpers for ECS games. Pure dev-time package — never bundled into apps.

| API                                                  | Description                                                                                                                                                                                   |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createFakeClock()`                                  | Deterministic `requestFrame` / `cancelFrame` replacement. `advance(seconds)` advances time by **seconds** and fires every pending callback once (throws on negative input). `reset()` clears queued frames and elapsed time.                                    |
| `createTestWorld(opts?)`                             | Wires a `World` + `GameLoop` + fake clock together. Options: `{ fixedDt?, maxDt? }`. Returns `{ world, loop, clock, step(dt), stepFrames(n, dt) }` — call `step` / `stepFrames` in tests instead of `loop.start()`. |
| `MockInputManager` / `createMockInputManager()`      | Extends `@flare-engine/input` `InputManager` with `press(x, y, id = 0)`, `move(x, y, id = 0)`, `release(x, y, id = 0)`, `tap(x, y, id = 0)` (press→release) for scripted pointer sequences. `createMockInputManager()` is the factory. No native bridges.        |
| `serializeScene(world, components)`                  | Snapshots every entity's matching component data into a stable JSON-ish object. Stable key order enables diffing.                                                                             |
| `snapshotsEqual(a, b)`                               | Deep equality for two scene snapshots. Useful for regression tests that record a known-good state.                                                                                            |
| `createBenchSession(opts?)` | `opts: { seed?: number }` (default seed = 1). Saves `Math.random`, installs a `SeededRNG(seed)`-backed replacement. Returns `BenchSession { rng, setFlag, getFlag, done, whenDone, end }`. `done()` resolves `whenDone` (idempotent — second call is a no-op, never rejects). `end()` restores `Math.random` (idempotent). Flags stored in a plain `Record<string, boolean>`; `getFlag` returns `false` if unset. **Do not nest sessions.** |
| `defineSnapshot<S>(schema)` | `schema: SnapshotSchema` — `{ [key: string]: SnapshotProjector }` where `SnapshotProjector = { query: readonly ComponentDef<unknown>[], project(world, id): unknown }`. Returns a `(world: World) => { [K in keyof S]: readonly unknown[] }` snapshot function. For each key: queries matching entity ids, sorts ids for call-to-call stability, maps `project(world, id)`. Acceptable to allocate one array per key per call — not a hot path. |

**Implementation notes:**

- Depends on `@flare-engine/core`, `@flare-engine/ecs`, `@flare-engine/input`, `@flare-engine/math` (all `workspace:*`, all externalized by the build — never inlined).
- `createFakeClock` returns functions compatible with `GameLoop`'s `tick` / `cancelTick` hooks — no monkey-patching required.
- Reverse usage: `@flare-engine/core` tests may import from `@flare-engine/testing` as a dev-only consumer (turbo's package graph remains acyclic — testing → core runtime, core → testing devDep).
- `createBenchSession` is the backbone for deterministic bench scenarios and the planned PT agent-QA epic (Tier-1 headless `GameSnapshot` + critic workflow).

---

## Layer 3.5: UI Kit (OSS-launch addition)

### `@flare-engine/ui` (< 6KB gzip target)

Themed UI primitives + focus navigation + flex-like layout resolver for HUDs, menus, and modals. React Native peer dep only — no Skia dep, so menus render through the platform view tree.

| API                                                             | Description                                                                                                                                                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Theme` (`darkTheme`, `lightTheme`)                             | Design tokens: `colors`, `spacing` (xs…xl), `radii`, `typography` (sizeXs…sizeXl, optional fontFamily / fontFamilyMono).                                                                                |
| `ThemeProvider` / `useTheme()`                                  | React context to inject a theme into the subtree. `useTheme()` always returns a theme (`darkTheme` by default).                                                                                        |
| `createFocusManager()` / `FocusManager`                         | Pure logic. `register(node) → dispose`, `unregister`, `focus(id)`, `blur`, `next` / `prev`, `activate` (fires focused node's `onActivate`), `getFocused`, `getOrder`, `subscribe(listener) → dispose`.  |
| `FocusProvider` / `useFocusManager()`                           | Supplies a shared `FocusManager` through context and re-renders consumers on every focus change.                                                                                                       |
| `createFocusKeyboardDriver(manager, keys, opts?)`               | Poll-based keyboard driver. `keys` is structural `{ wasPressed(code): boolean }` — no `@flare-engine/input` dep; `createKeyboard()` is assignable. Defaults: `next` = ArrowDown/ArrowRight/Tab, `prev` = ArrowUp/ArrowLeft, `activate` = Enter/Space. Call `driver.update()` once per frame; drives the reactive `FocusManager` path. |
| `resolveLayout(container, children)`                            | Pure flex-like resolver. Inputs: `{ width, height, direction: 'row' \| 'column', gap?, padding?, justifyContent?, alignItems? }` + per-child `{ basis?, grow?, crossSize? }`. Returns `LayoutRect[]`. |
| `Panel`                                                         | Themed container. Variants: `surface` \| `elevated`. Padding + radius tokens.                                                                                                                          |
| `Label`                                                         | Themed `<Text>`. Variants: `xs…xl`. Tones: `default`, `muted`, `accent`, `danger`, `success`, `warning`. Optional `mono`. Truncation: `numberOfLines`, `ellipsizeMode` (typed from `TextProps['ellipsizeMode']`), `adjustsFontSizeToFit`, `minimumFontScale` — forwarded straight to RN `Text`; omitting any prop preserves existing behaviour. |
| `Button`                                                        | Focusable, themed button. Variants: `primary`, `secondary`, `ghost`, `danger`. Auto-registers with `FocusManager` when present; draws a focus ring on focus. `tabIndex` controls traversal order.      |
| `ProgressBar`                                                   | 0..1 bar. Clamps NaN / out-of-range values. Theme-driven track + fill, overridable.                                                                                                                    |
| `HUDBar`                                                        | Labeled `ProgressBar` for HP / MP / XP. Color by `kind` (`hp` → danger, `mp` → accent, `xp` → success, `custom`). Optional numeric readout.                                                            |
| `List`                                                          | Row or column stack with consistent gap (theme default or explicit).                                                                                                                                   |
| `Modal`                                                         | Absolute-positioned overlay with backdrop and centered `Panel`. Dismiss via `onBackdropPress` (omit for non-dismissable).                                                                              |

**Implementation notes:**

- React + React Native are **peer deps**; the package itself only ships theme tokens, focus logic, layout math, and thin view wrappers.
- `FocusManager` is the single source of truth for keyboard / gamepad navigation. `createFocusKeyboardDriver` ships the keyboard driver (arrows/Tab/Enter/Space); gamepad wiring lands in stage 11.4 without any UI-kit changes.
- `resolveLayout` is pure and allocation-light (one output array); useful for Skia-rendered HUD that needs deterministic pixel positions outside the React Native flex engine.
- Component tests use a hand-rolled React/RN mock (see `tests/primitives.test.ts` pattern); all component props are exercised. The heavy-logic modules (`theme`, `focus`, `layout`) are also fully unit-tested.
- All `style` props are typed `StyleProp<ViewStyle>` (or `StyleProp<TextStyle>` on `Label`), so callers may pass an array, `null`, or a plain object — the same convention as every RN primitive.
- Pan Tvardowski menus + HUD consume `@flare-engine/ui` end-to-end (M9.1).

---

### `@flare-engine/input` — gamepad + remap (stage 11.4 extension)

Extends the existing input package with poll-based gamepad state, a platform-agnostic source, and a persistent remap table. Touch/pointer APIs are unchanged.

| API                                                              | Description                                                                                                                                                                       |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GamepadButton` / `GamepadAxis`                                  | W3C Standard Gamepad constants (A..Home, LeftX..RightY).                                                                                                                          |
| `GamepadState` / `GamepadSnapshot`                               | Poll-time state (`connected`, `buttons[]` with `pressed` / `value` / `justPressed` / `justReleased`, `axes[]`, `timestamp`) vs raw snapshot (just values, no edges).    |
| `createGamepadState(index?, buttons?, axes?)`                    | Allocates a fresh state with zeroed buttons and axes.                                                                                                                             |
| `updateGamepadFromSnapshot(state, snapshot, deadZone?)`          | Applies a snapshot in place; recomputes `justPressed` / `justReleased`; zeroes axes inside the dead zone and rescales beyond; handles disconnect (`null` snapshot).     |
| `resetGamepadFrame(state)` / `isButtonDown` / `wasButtonPressed` / `wasButtonReleased` / `getAxis` | Per-frame edge reset + convenience accessors.                                                                    |
| `GamepadSource` / `createWebGamepadSource(nav?)`                 | Platform abstraction: `poll() → (GamepadSnapshot \| null)[]`. Web source wraps `navigator.getGamepads`; native adapters inject their own source. No native peer dep in-package.  |
| `RemapTable` / `createIdentityRemap` / `applyRemap`              | Pure remap table (`buttons: number[]`, `axes: {index,invert,scale}[]`). `applyRemap(snapshot, table)` returns a logical-ordered snapshot.                                        |
| `saveRemap(store, key, table)` / `loadRemap(store, key)`         | Persistence against the `RemapStore` interface (matches `@flare-engine/storage.StorageAdapter`; declared locally to avoid a hard cross-layer dep).                                |
| `InputManager.gamepad(index)` / `setGamepadDeadZone` / `setGamepadRemap` / `pollGamepads(source)` | New manager surface: lazily allocates per-slot state, applies remap then dead zone, resets per-frame edges in `update()`.            |

**Implementation notes:**

- Dead zones rescale `[deadZone, 1] → [0, 1]` so inputs remain smooth past the threshold.
- `GamepadSource` is the seam for the native backend — ship `createWebGamepadSource` now; `react-native-gamepad` adapter lands alongside the demo wiring.
- `RemapStore` is intentionally a two-method subset of `StorageAdapter`; consumers pass their already-constructed storage adapter.

---

### `@flare-engine/input` — keyboard (OSS-M1a)

Adds buffered keyboard state with per-frame edge flags, a platform-neutral injection API, and an action binding resolver.

| API | Description |
| --- | --- |
| `KeyboardState` / `createKeyboard()` | Per-code buffered state: `isDown`, `wasPressed`, `wasReleased` edge flags. `keyDown(code)` / `keyUp(code)` are the **platform-neutral injection points** — web feeds them via `attachKeyboardListeners`; mobile/RN feeds them from a hardware-keyboard native module or an on-screen source. OS auto-repeat is de-edged by `pressButton`'s `if(!isPressed)` guard. |
| `attachKeyboardListeners(kb, target)` | Web turnkey adapter. `target` is structural `{ addEventListener, removeEventListener }` — no DOM-types dep; pass `window` on web. Registers `keydown`, `keyup`, and `blur` handlers; `blur` calls `kb.clear()` (stuck-key guard). Returns a detach fn. Does NOT call `preventDefault` — real game loops attach their own page-level listener for that. |
| `KeyBindings` | `Readonly<Record<string, readonly string[]>>`. Action → `KeyboardEvent.code` array map. Multiple codes OR-reduce (any bound key triggers the action). |
| `isActionDown` / `wasActionPressed` / `wasActionReleased` | Action resolvers over a `KeyBindings` map. `wasActionReleased` fires only when the last held bound key lifts (any bound key still held → false). These are the keyboard analog of gamepad navigation; `applyRemap` / `RemapTable` remain gamepad-only. |
| `InputManager.keyboard` | `readonly KeyboardState` — `update()` calls `kb.reset()` automatically each frame. |

**Implementation notes:**

- Edge buffering reuses `VirtualButtonState` + `pressButton` / `releaseButton` / `resetButtonFrame` per code slot. Slots are lazy-allocated on first `keyDown`; subsequent calls are zero-alloc.
- `clear()` calls `releaseButton` over all slots (no-op for unheld keys via the `if(isPressed)` guard) — mirrors the gamepad-disconnect path so consumers see keys go up on blur.
- Key binding is a caller-owned `KeyBindings` object; `applyRemap` / `RemapTable` remain gamepad-only — the two surfaces are intentionally separate.

---

## Layer 3.5: Post-processing (OSS-launch addition)

### `@flare-engine/postfx` (< 8KB raw)

Composable Skia RuntimeEffect pipeline: vignette, bloom, CRT, chromatic aberration, grayscale flash. The runtime compiles SkSL on first use and short-circuits to a passthrough on devices without `RuntimeEffect` support.

| API                                                                            | Description                                                                                                                                                            |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EffectKind`                                                                   | Union: `'vignette' \| 'grayscale-flash' \| 'chromatic-aberration' \| 'crt' \| 'bloom' \| 'god-rays' \| 'color-grading-lut'`.                                           |
| `createVignette` / `createGrayscaleFlash` / `createChromaticAberration` / `createCrt` / `createBloom` / `createGodRays` | Factory helpers returning an `Effect` (id, enabled, typed uniforms). Sensible defaults per effect. `createGodRays` defaults: `lightX=0.5`, `lightY=0.1`, `color=[1,0.95,0.8]`, `intensity=0.6`, `decay=0.96`, `density=0.5`, `weight=0.4`, `samples=48`. `createVignette` accepts optional `color?: readonly [number, number, number]` (default `[0,0,0]`) — the RGB hue the dark zone fades toward; `[0,0,0]` is pure black (backward-compatible). |
| `createColorGradingLut(id, uniforms)` → `Effect<'color-grading-lut'>`         | Factory for the LUT color-grading effect. `id` leads and is required, matching the other `create*` factories — `uniforms` cannot default because `lut` is mandatory, so `id` carries no default (Biome `useDefaultParameterLast`). `uniforms.lut` (required) is a 4096×64 RGBA `SkImageLike` — a 64³ LUT encoded as a horizontal B-tile strip. `uniforms.intensity` defaults to `1.0`. First effect to consume the Convention-A child-texture path added in #118. Helper: `createNeutralLutBytes()` returns identity LUT bytes; host wraps them via `Skia.MakeImage`. |
| `createNeutralLutBytes()` → `Uint8Array`                                       | Pure-TS helper (no Skia dep). Returns `4096 * 64 * 4` RGBA bytes forming the identity 64³ LUT strip. Pass to `Skia.MakeImage` to get a passthrough `lut` for `createColorGradingLut`. |
| `EffectChain`                                                                  | Ordered pipeline: `add` / `insert` / `remove` / `move` / `get` / `setEnabled` / `setUniforms` (kind-checked) / `clear` / `enabled()` iterator. Duplicate ids throw.    |
| `createPostFxController(options)` → `PostFxController`                        | High-level controller that owns an `EffectChain` + `PostFxRuntime` and adds game-common conveniences. `options.effects` — ordered `Effect[]` seeded into the chain; `options.skia` — optional Skia module; `options.flash` — optional `{ id, decay? }` hit-flash binding. Methods: `triggerHitFlash()` spikes the flash to 1; `triggerTimed(effectId, decayMs)` enables a named effect immediately and auto-disables it after `decayMs` ms of accumulated `update(dt)` time — uniforms are restored to the pre-trigger snapshot on expiry, re-triggering before expiry resets the countdown, no-op when `effectId` absent from chain; `update(dt)` advances the flash decay and all timed-trigger countdowns; `buildPass(w, h)` delegates to `runtime.buildPass`; `setMotionScale(k)` forwards to `EffectChain.setGlobalIntensity`. The two timed-trigger Maps (`timedRemaining`, `timedRestore`) are allocated once at construction — no hot-path allocation. |
| `createPostFxRuntime(skia)`                                                    | Compiles shaders against a Skia-like module: `compile(kind)` (cached), `packUniforms(effect, w, h)` (per-kind Float32Array), `buildPass(chain, w, h) → CompiledPass[]`, `apply(canvas, chain, source, w, h)` (compositor, see below). |
| `runtime.apply(canvas, chain, source, width, height): void`                   | Compositor hot path. For each enabled pass: `pass.shader.makeShader(uniforms, [source, ...pass.children])` → `paint.setShader(...)` → `canvas.drawImageRect(source, srcRect, dstRect, paint)`. No-ops when `supported === false`, `source === null`, chain has 0 enabled effects, or the injected Skia module has no `Paint` factory. Compositor paint allocated lazily once and reused (zero-alloc). Convention-A threading: `source` is always `children[0]`; any extra sampler children (e.g. LUT from #122) follow as `children[1+]`. |
| `CompiledPass`                                                                 | `{ id, kind, shader, uniforms, children }` — what the renderer consumes per-effect per-frame. See Convention A below.             |
| `SkImageLike`                                                                  | Structural stub for a Skia image handle (`{ readonly _skImageBrand?: never }`). No Skia import required; renderers assign real `SkImage` values to `children`.          |
| `SkiaPaintLike`                                                                | Structural stub for a Skia paint handle: `{ setShader(shader: unknown): void }`. Declared in `@flare-engine/postfx` so the compositor hot path is testable without a GPU. |
| `SkiaCanvasLike`                                                               | Structural stub for a Skia canvas handle: `{ drawImageRect(image, src, dst, paint): void }`. Used as the `canvas` argument to `runtime.apply`. |
| `SkRectLike`                                                                   | Structural stub: `{ x, y, width, height }`. Used by `SkiaCanvasLike.drawImageRect`.                                               |
| `VIGNETTE_SKSL` / `GRAYSCALE_FLASH_SKSL` / `CHROMATIC_ABERRATION_SKSL` / `CRT_SKSL` / `BLOOM_SKSL` / `GOD_RAYS_SKSL` / `COLOR_GRADING_LUT_SKSL` | Raw shader sources, exported for advanced consumers.                                                          |
| **Weather PostFx Effects** | `createWeatherRain(id?, uniforms?) → Effect`, `createWeatherSunShaft(id?, uniforms?) → Effect`, `createWeatherDarkVignette(id?, uniforms?) → Effect`, `createWeatherClouds(id?, uniforms?) → Effect`. EffectKind values: `weather-rain \| weather-sun-shaft \| weather-dark-vignette \| weather-clouds`. All consume `uniform shader src` and layer over the scene. Packed uniforms: rain=[resW,resH,intensity,direction,scrollOffsetY,color.r,color.g,color.b,density,streakLen] (**10 floats**; color defaults `[1,1,1]`; density default `0.5`; streakLen default `0.15`); sun-shaft=[resW,resH,intensity,direction]; dark-vignette=[resW,resH,intensity]; clouds=[resW,resH,intensity,scrollOffsetX,direction]. `WeatherRainUniforms` has optional `color?: readonly [number,number,number]` (default `[1,1,1]`), optional `density?: number` (default `0.5`, fraction of columns carrying a drop), optional `streakLen?: number` (default `0.15`, lit fraction of each repeat period). `scrollOffsetY` is a **normalized fall phase in [0,1)** — caller increments by `speed * dt / screenHeight` and wraps with `fract` each tick. SKSL exports: `WEATHER_RAIN_SKSL`, `WEATHER_SUN_SHAFT_SKSL`, `WEATHER_DARK_VIGNETTE_SKSL`, `WEATHER_CLOUDS_SKSL`. Rain model: aspect-corrected UV rotated by `direction`; column sawtooth `fract(fallAxis * tiling - scrollOffsetY + phase)` produces falling streaks (not whole-column blink); hash-based dropout keeps `density` fraction of columns active; 2 parallax layers (near: COLS=45/tiling=6/brightness=1.0; far: COLS=85/tiling=11/brightness=0.5) combined with `max`; thin per-column xMask; alpha-over `mix` blend (not additive). No refraction tap. `COMPOSITE_SKSL` composite pass adds `uniform float3 weatherColor` (default `[1,1,1]`) at packed indices [19,20,21] plus `weatherDensity` [22] and `weatherStreakLen` [23] (**24 floats total**); `CompositeUniforms` has `weatherColor`, `weatherDensity`, `weatherStreakLen`. `weatherScrollY` [18] is a normalized [0,1) fall phase (same contract as standalone). |

**Implementation notes:**

- Skia is an **optional peer dependency** (`@shopify/react-native-skia >=2.0.0`). Runtime uses an injected `SkiaPostFxModuleLike` so the orchestration is fully testable without a GPU.
- `supported` reports whether `Skia.RuntimeEffect.Make` exists; callers fall through to a no-op pipeline when unsupported (explicit fallback path).
- Uniform layouts are per-kind Float32Arrays (see `packUniforms`); resolution is passed via `(width, height)` for shaders that need it.
- `runtime.apply` is the compositor entry point (added #161). The injected `SkiaPostFxModuleLike` gains an optional `Paint?(): SkiaPaintLike` factory; when absent `apply` is a no-op (backwards-compatible with all existing consumers of `buildPass`).
- Actual pixel composition can be done via `runtime.apply`; `buildPass` remains available for renderers that prefer manual control.
- `GOD_RAYS_SKSL` is a single-pass volumetric light scattering shader (GPU Gems 3, Ch. 13). SkSL requires loop counts to be compile-time constants, so the shader declares `const int MAX_SAMPLES = 64` and uses an `if (float(i) >= u_samples) break` guard inside the loop — this keeps the shader compilable while allowing runtime-configurable sample counts (1–64, clamped at pack time).

**Convention A — `CompiledPass.children`:**
`children` holds *extra* sampler children only, excluding the implicit `src` scene texture. The renderer binds `src` itself as `children[0]` at draw time. For most built-in effects (which declare only `src`) `children` is always the frozen `EMPTY_CHILDREN` sentinel — a single allocation shared across every pass, keeping `buildPass` zero-alloc on the hot path. `color-grading-lut` is the first effect that populates `children`: it sets `children[0]` to the caller-supplied `lut` image so the renderer can bind it as the second `uniform shader` slot.


---

### `@flare-engine/localization` (< 7KB raw)

**Responsibility.** Localized string tables, locale negotiation, ICU-style plural + interpolation, hot-reload of tables in dev.

| API | Description |
| --- | --- |
| `LocalizationManager` | Owns active locale + tables. `t(key, values?)` renders a message; falls through from active → fallback → raw key. |
| `setLocale(code)` / `negotiateLocale(requested[])` | Direct set or best-match pick against available locales. |
| `setTable(locale, table)` | Replace a locale's flat `Record<string, string>` in place. Emits `onChange` when the active locale is targeted — enables hot-reload. |
| `onChange: Signal<LocaleCode>` | Fires when the active locale changes or its table is replaced. |
| `formatMessage(tpl, values, locale)` | Stateless renderer supporting `{var}` interpolation and `{count, plural, =0 {...} one {# x} other {# xs}}`. `#` = numeric value. |
| `resolveLocale(requested, available, fallback)` | Case-insensitive BCP-47 matcher: exact → language-only → fallback → first available. |
| `pluralCategory(locale, n)` | CLDR-inspired classifier for `en`, `pl`, `ru`, `fr`, `ar`, `ja/ko/zh`, etc. Unknown locales fall back to English rules. |
| `formatTimestamp(ts, locale, options?)` | Format a Unix timestamp (milliseconds) using `Intl.DateTimeFormat`. Returns `options.fallback` (default `''`) for `ts <= 0` or on any `Intl` error (unsupported locale, constrained runtime). `options.dateStyle` defaults to `'short'`. `options.timeStyle` defaults to `'short'` when `options` is omitted; omit `timeStyle` from the options object to get a date-only result. Never throws. Safe on Bun (V8), React Native Hermes (≥ 0.70), and web. |
| `FormatTimestampOptions` | Type: `{ dateStyle?: 'full' \| 'long' \| 'medium' \| 'short'; timeStyle?: 'full' \| 'long' \| 'medium' \| 'short'; fallback?: string }`. |

**Implementation notes:**

- Single hard dep: `@flare-engine/events` (`Signal`).
- Plural parser handles top-level branches only — nested `{…, plural, …}` is not supported (not needed for our message catalogue).
- Malformed placeholders emit the remainder literally instead of throwing — safer during locale hot-reload.
- `formatTimestamp` produces locale-formatted date/time strings — it does not introduce translatable message keys. No changes to string tables or `keys.ts`.

---

### `@flare-engine/deep-links` (< 6KB raw)

**Responsibility.** URL → scene+params routing with pluggable platform sources (web history, native `Linking`, in-memory for tests).

| API | Description |
| --- | --- |
| `DeepLinkRouter` | `.register(pattern, scene)` / `.registerAll(defs[])`. Supports literal segments, `:param` captures, and a trailing `*` wildcard that binds the rest into `params.rest`. First-match wins. |
| `.match(url): DeepLinkMatch \| null` | Parses scheme/host/path/query and runs it through the registered routes. Path params override query params of the same name. |
| `DeepLinkManager` | Wires a `DeepLinkSource` to a router. `start()` / `stop()` manage the subscription; `handle(url)` runs a URL manually. `onMatch` / `onUnmatched` signals. `current` holds the last match. |
| `createMemorySource(initial?)` | Test + notification-bridge source with `push(url)`. |
| `createWebSource(window)` | Bridges `popstate` + `location.href`. Exposes `notify(url)` for programmatic `history.pushState` calls. |
| `createNativeSource(linking)` | Wraps an RN-`Linking`-shaped module (`getInitialURL` + `addEventListener('url', ...)`). |
| `parseUrl(url)` | Stateless parser: returns `{ scheme, host, segments, query } \| null`. Percent-decodes; strips fragments; `+` → space in query. |

**Implementation notes:**

- No RN/DOM imports — platform types are local interfaces (`WebWindowLike`, `LinkingLike`). Host apps wire real globals.
- Parser is intentionally minimal (no username/password, no validation of scheme). Good enough for `scheme://host/path?query`.

---

### `@flare-engine/share` (< 5KB raw)

**Responsibility.** Cross-platform screenshot capture (Skia `makeImageSnapshot`) + share-sheet orchestration with pluggable transports.

| API | Description |
| --- | --- |
| `captureScreenshot(source, options?): Screenshot \| null` | `source.makeImageSnapshot()` → `SkiaImageLike`. Tries `encodeToBytes` first, falls back to `encodeToBase64`. Returns `{ bytes, base64, format, width, height }` with both encodings always populated. |
| `ImageFormat` / `CaptureOptions` | `'png'` (default) or `'jpeg'`; JPEG `quality` defaults to 90. |
| `bytesToBase64` / `base64ToBytes` | Platform-agnostic binary-safe codecs used internally and exported for host apps. |
| `ShareManager` | `.register(transport)` then `.share(payload)`. Picks the first transport whose `canShare(payload)` returns true. Returns `{ dispatched, via: 'web-share' \| 'web-clipboard' \| 'native' \| 'noop' }`. |
| `createWebShareTransport(navigator, File?)` | Bridges `navigator.share` (with optional `File` ctor for attaching screenshots via `files: [...]`). |
| `createWebClipboardTransport(navigator)` | Fallback that writes `message + url` to `navigator.clipboard`. |
| `createNativeShareTransport(rnShare)` | Wraps an RN `Share`-shaped module; inspects `action` to report dispatched vs dismissed. |

**Implementation notes:**

- Zero hard deps — Skia, RN, and the DOM are all structural `*Like` interfaces declared locally.
- `ShareManager` is the public entry point; transports are stateless and composable. Cascade order is registration order.

---

### `@flare-engine/a11y` (< 2KB raw, light)

**Responsibility.** Central accessibility state. Consumed by `animation`, `postfx`, and `ui` to dampen or neutralize motion/contrast/scale per user preference. Full screen-reader pass deferred post-launch.

| API | Description |
| --- | --- |
| `A11yManager` | Owns `{ reducedMotion, contrast: 'normal' \| 'high', uiScale }`. Mutators: `setReducedMotion`, `setContrast`, `setUiScale`, `update(patch)`. `onChange` fires only on real diffs. |
| `settings` | Read-only snapshot — replaced (not mutated) on every change, so equality checks work. |
| `motionScale({reducedMotion}, base=1)` | Returns `0` under reduced motion, else `base`. Drop-in multiplier for camera shake / tween intensity. |
| `dampenedMotion({reducedMotion}, base, factor=0.2)` | Softens but preserves the effect (good for subtle chromatic aberration, vignette pulse). |
| `pickContrast({contrast}, normal, high)` | Token picker for UI color choices. |
| `contrastRatio(fg, bg)` | WCAG 2.x contrast ratio between two `Color` values. Order-independent; range [1, 21]. Delegates to `Color.contrastRatio`. |
| `wcagLevel(ratio, largeText?)` | Classify a contrast ratio: normal text — `ratio >= 7.0` → `'AAA'`, `>= 4.5` → `'AA'`, else `'fail'`; large text (≥ 18pt normal / ≥ 14pt bold, `largeText = true`) — `>= 4.5` → `'AAA'`, `>= 3.0` → `'AA'`, else `'fail'`. Thresholds are inclusive (WCAG "at least"). |
| `deltaE(a, b)` | OKLab Euclidean distance (ΔE) between two `Color` values. Delegates to `Color.deltaEOk`. Rule of thumb: < 0.05 = imperceptibly similar; > 0.1 = distinguishable. |
| `isDistinguishable(a, b, threshold?)` | Returns true when `deltaE(a, b) >= threshold` (default 0.1). The threshold is a design-level constant — tune per visual layer. |
| `auditColors(fg, bg, options?)` | Convenience composite: returns `AuditResult { contrastRatio, wcagLevel, deltaE, distinguishable }`. Options: `{ largeText?, deltaEThreshold? }`. Never throws. |
| `WcagLevel` | Type: `'fail' \| 'AA' \| 'AAA'`. |
| `AuditResult` | Type: `{ contrastRatio: number; wcagLevel: WcagLevel; deltaE: number; distinguishable: boolean }`. |
| `AuditOptions` | Type: `{ largeText?: boolean; deltaEThreshold?: number }`. |

**Implementation notes:**

- No platform wiring; hosts bridge OS prefs (`AccessibilityInfo.isReduceMotionEnabled`, `prefers-reduced-motion`) by calling `update()` on startup.
- Deps: `@flare-engine/events` (`Signal`) + `@flare-engine/math` (`Color`).
- `audit.ts` delegates all math to `Color.contrastRatio` and `Color.deltaEOk` — no new math, no Skia dep. ΔE is OKLab (not CIE76/CIE94) because `math.Color` already implements OKLab and it is perceptually uniform.

---

## Layer 5: Tooling (OSS-launch addition)

Node-only developer tools. Not shipped to device; excluded from device bundle size budgets. Sizes below are raw install footprint (unpacked `npm pack`).

---

### `@flare-engine/cli` (< 15KB raw, Node-only)

**Responsibility.** Pure Node dev tool exposing three commands that preprocess art/map assets and scaffold new apps. Also exports its command bodies as async functions so CI, tests, and integrations can call them programmatically without shelling out.

| API | Description |
| --- | --- |
| `flare pack-atlas <input> [--out <dir>] [--padding N] [--max-size N] [--format png\|webp]` | Sprite folder → TexturePacker-compatible JSON + atlas PNG consumable by `@flare-engine/assets`. Default `--padding 2`, `--max-size 2048`, `--format png`. |
| `flare tiled-to-flare <tmj> [--out <file>] [--no-embed-tilesets]` | Tiled `.tmj` → Tiled-shaped JSON accepted directly by `@flare-engine/tilemap`'s `parseTiled` — a pass-through of the original layer/tileset objects (`type`, `properties`, tileset `tiles[]`, object `rotation`, layer `offsetx`/`offsety` all survive), flattening group layers and dropping image layers. Embeds external tilesets by default; `--no-embed-tilesets` keeps the Tiled `source` reference instead, which `parseTiled` rejects — that output is for pipelines that resolve external tilesets themselves. |
| `flare new <name> [--template blank\|topdown\|shmup] [--package-manager bun\|npm\|pnpm]` | Thin alias that spawns `create-flare-app` with the same args. Present so `flare` is a single discoverable entrypoint. |
| `packAtlas(opts: AtlasPackerOptions): Promise<AtlasResult>` | Programmatic form of `pack-atlas`. Returns `{ jsonPath, imagePath, frames, width, height }`. |
| `convertTiled(opts: TiledConvertOptions): Promise<TiledResult>` | Programmatic form of `tiled-to-flare`. Returns `{ outPath, layers, tilesets, map }` — `layers`/`tilesets`/`map` are Tiled-shaped (`TiledLayer`, `TiledTileset`, `TiledMap`), not a separate published format. |
| `AtlasPackerOptions` / `TiledConvertOptions` | Exported TS types mirroring the CLI flags. |
| `TiledMap` / `TiledLayer` (`TiledTileLayer` \| `TiledObjectLayer`) / `TiledTileset` / `TiledObject` / `TiledTile` / `TiledProperty` | Exported TS types for `TiledResult`'s Tiled-shaped output. |

**Implementation notes:**

- Node 20+, `sharp` for image work, `commander` for arg parsing. No React Native peer dep, no runtime Flare deps.
- `bin` entry in `package.json` exposes `flare`. Commands dispatch on first positional.
- Integration tests write into tmp dirs (`node:fs/promises` + `os.tmpdir()`) and assert on produced files.
- Excluded from the gzip-size CI job (tooling, not runtime). Tracked by install-tarball size instead.

---

### `create-flare-app` (< 30KB raw, Node-only, standalone npm package)

**Responsibility.** One-shot scaffolder invoked via `npm create flare-app@latest <name>`. Produces a runnable Expo + Flare app with a minimal scene + HUD in under 5 minutes on a clean machine (build-plan §11.8 "Done when"). Named without the `@flare-engine/` scope because `npm create <x>` resolves to the unscoped `create-<x>` package by npm convention.

| API | Description |
| --- | --- |
| `create-flare-app <name> [--template blank\|topdown\|shmup] [--package-manager bun\|npm\|pnpm] [--skip-install]` | Copies the selected template into `<name>/`, rewrites `package.json` name, runs the detected package manager's install unless `--skip-install`. |
| Template `blank` | Empty scene, single sprite, `GameView` wired via `@flare-engine/react`. Smallest starting point. |
| Template `topdown` | Player with analog joystick movement, tilemap + tile-collision + camera follow. Exercises `tilemap` + `physics` + `input` + `ecs`. |
| Template `shmup` | Auto-fire player, enemy spawner, HUD score — minimum vertical-slice shmup. Exercises `particles` + `audio` + `scene`. For the full-scope showcase, see [Pan Tvardowski](https://github.com/grzott/Pan-Tvardowski). |
| `TemplateManifest` | Exported type: `{ id, displayName, description, engines, postInstall? }`. Declared per template so contributor-authored templates can plug in identically. |

**Implementation notes:**

- Lives outside `packages/@flare-engine/*` as `packages/create-flare-app` to satisfy npm's `npm create` convention.
- Templates ship inside this package as `templates/<id>/`. Copy is a plain recursive FS copy with a small set of token replacements (`__APP_NAME__`, `__FLARE_VERSION__`).
- Package-manager detection: explicit `--package-manager` > `npm_config_user_agent` > fallback `bun`.
- `flare new` in `@flare-engine/cli` shells out to this package's binary; the two CLIs never import each other.
- CI smoke test creates one app per template and runs `bun install && bun run typecheck` on each; failure blocks release.

---

### `@flare-engine/devtools` (< 8KB gzip, tree-shaken in prod)

**Responsibility.** 0.1.0 partial slice per build-plan §11.10: entity inspector, time scrub, pause/step. Web surface is a floating panel; native surface is a minimal HUD overlay. Zero overhead when the provider is not mounted — mirrors the tree-shake pattern from `@flare-engine/debug`. Full devtools parity (network inspector, profiler flamegraph, asset inspector) deferred post-launch.

| API | Description |
| --- | --- |
| `DevtoolsProvider` | React context. Subscribes to a `World` + `GameLoop`, owns the snapshot ring buffer, exposes controls via context. Props: `{ world, loop, config? }`. |
| `<DevtoolsPanel />` | Web-only full panel. Entity tree, component inspector, time controls. No-op on native. |
| `<DevtoolsHUD />` | Native-only compact overlay. Tap entity → inspector sheet. Pause/step/scrub buttons. No-op on web. |
| `useEntityInspector()` | Hook returning `{ selected, select(entity), components }`. Reads from World; never mutates. |
| `useTimeScrub()` / `TimeScrubber` | Hook + imperative controller. `.rewind(frames)` restores a snapshot from the ring buffer; `.resume()` clears the scrub state. |
| `createSnapshotRingBuffer(size, source)` | Pre-allocated ring buffer of snapshots. `source` is `World.serialize` by default, or a user-supplied callback for consumers without ecs integration. |
| `DevtoolsConfig` | `{ ringSize?: number = 120, captureInterval?: number = 1, enabledOnNative?: boolean = true }`. |
| `isDevMode()` | Returns `true` when the Metro/bundler `__DEV__` constant is defined and truthy. Safe to call anywhere — uses `typeof __DEV__` (no reference error on undeclared identifier). **Note:** `isDevMode()` is NOT constant-folded by Metro like a bare `__DEV__` reference; use bare `__DEV__` where dead-code elimination matters. Use `isDevMode()` where you need a callable function (e.g. passing to a config object, conditional import guard, test stub). |

**Implementation notes:**

- Peer deps: `react` (`>=19`), `react-native` (`>=0.79`). Hard deps: `@flare-engine/core`, `@flare-engine/ecs` only.
- Tree-shaken via `__DEV__` guard in the package entry so production bundles drop the whole module when providers aren't mounted.
- Ring buffer pre-allocates snapshot objects at construction and reuses them in place — no per-frame allocation.
- Snapshot source is pluggable: defaults to `World.serialize()` if available, falls back to user callback. API may firm up post-launch.
- Tests: logic unit tests (ring buffer wrap/rewind, snapshot diff), plus one React Testing Library smoke test on `DevtoolsPanel`.
- `isDevMode` uses `declare const __DEV__: boolean | undefined` so TypeScript accepts the global without `@ts-ignore`. The `declare` is file-scoped (not ambient-global) — callers on other runtimes (Vite, Jest) set `globalThis.__DEV__` instead.

---

## Layer 6: Platform Integrations (Tier-2)

Each package ships the provider interface + a default `Noop*Provider` + a React context + a `use*()` hook + payload types. Each package now **also** ships a local/in-memory provider (plus a storage/console variant where useful) so games can test and develop against real semantics without a platform SDK. **Concrete PLATFORM adapters** (Game Center, Google Play Games, Steam, PostHog, Amplitude, Segment, Firebase, App Store StoreKit, Google Play Billing) are **post-launch** — consumers wire their own adapter at the app boundary until then. IAP is the exception: it additionally ships a concrete RevenueCat adapter today (`@flare-engine/iap-revenuecat`).

---

### `@flare-engine/leaderboards` (< 1KB raw)

**Responsibility.** Leaderboard submission + query interface, plus an in-memory provider for tests and dev. Consumer-supplied adapter at 0.1.0; platform adapters (Game Center, Google Play Games, Steam) are post-launch.

| API | Description |
| --- | --- |
| `LeaderboardsProvider` | Interface: `submitScore(id, score, meta?)`, `getTopN(id, n)`, `getPlayerRank(id)`. All async, return typed promises. |
| `NoopLeaderboardsProvider` | Default export. Returns empty arrays / `null` rank. Resolves submissions silently. |
| `createMemoryLeaderboards(opts?)` | In-memory `LeaderboardsProvider` for tests/dev. Submissions record under a single local player (`opts.playerId` default `'local'` / `opts.displayName` default `'Player'`); `opts.seed` pre-populates competitor rows per board. `submitScore` keeps the local player's **best** (max) score — a strictly higher score replaces score + meta, a lower-or-equal one is ignored. Ranking is DESCENDING by score, ties broken by ascending insertion order, with sequential 1-based ranks (no shared ranks). `getTopN` returns up to `n` entries (`n <= 0` or unknown board → `[]`); `getPlayerRank` returns the local player's rank or `null` when absent. |
| `SeedScore` / `MemoryLeaderboardsOptions` | `SeedScore`: `{ playerId, displayName, score, meta? }` — a pre-seeded competitor row. `MemoryLeaderboardsOptions`: `{ playerId?, displayName?, seed? }` where `seed` is `Readonly<Record<LeaderboardId, readonly SeedScore[]>>`. `createMemoryLeaderboards` returns a plain `LeaderboardsProvider` — no separate `MemoryLeaderboards` type. |
| `LeaderboardsContext` / `useLeaderboards()` | React context + hook. `useLeaderboards()` returns the provider or throws if unmounted. |
| `ScoreEntry` / `LeaderboardId` | Payload + ID types. `ScoreEntry`: `{ playerId, displayName, score, rank, meta? }`. |

**Implementation notes:**

- No runtime deps beyond `@flare-engine/events`. React peer dep only for the context + hook.
- The in-memory board grows unbounded (no eviction) — it exists for tests and local dev, not production leaderboard storage.
- Interface is intentionally minimal — pagination, time-window filters, and friends-only queries land alongside concrete platform adapters post-launch.

---

### `@flare-engine/achievements` (< 1KB raw)

**Responsibility.** Achievement unlock + query interface, plus in-memory and storage-backed providers. Consumer-supplied adapter at 0.1.0; platform adapters (Game Center, Google Play Games, Steam) are post-launch.

| API | Description |
| --- | --- |
| `AchievementsProvider` | Interface: `unlock(id, progress?)`, `getState(id)`, `getAll()`. All async. Partial progress (0–1) supported; adapters clamp and persist. |
| `NoopAchievementsProvider` | Default export. Returns `{ unlocked: false, progress: 0 }` for any id. |
| `createMemoryAchievements(opts?)` | In-memory `AchievementsProvider`. Contract: progress is clamped to `[0, 1]` and **monotonic** — a requested value `<=` the stored value is ignored (never decreases; non-finite → `0`). `unlock(id)` with no progress = full unlock (target `1`). Unlock **latches**: reaching `1` sets `unlocked: true` and stamps `unlockedAt` once via the injected `now` (default `() => Date.now()`); re-unlocking is a no-op that keeps the original `unlockedAt`. `getState` returns `{ id, unlocked: false, progress: 0 }` for untracked ids; `getAll` returns tracked states in insertion order. |
| `createStorageAchievements(store, opts?)` | Same contract as the memory provider, persisted through a structural `AchievementsStore`. Hydrates lazily from `store.get(key)` on first call (JSON array of `AchievementState`; parse error or non-array → empty; default key `'flare.achievements'`), persists via `store.set` after every mutation, and serializes writes through a single chained tail promise so concurrent unlocks can't lose an update. |
| `AchievementsStore` | Structural storage injection: `{ get(key): Promise<string \| null>; set(key, value): Promise<void> }`. |
| `MemoryAchievementsOptions` / `StorageAchievementsOptions` | `MemoryAchievementsOptions`: `{ now? }`. `StorageAchievementsOptions extends MemoryAchievementsOptions`: adds `{ key? }` (storage key, default `'flare.achievements'`). |
| `AchievementsContext` / `useAchievements()` | React context + hook. |
| `AchievementId` / `AchievementState` | Payload types. `AchievementState`: `{ id, unlocked, progress, unlockedAt? }`. |

**Implementation notes:**

- No runtime deps beyond `@flare-engine/events`. React peer dep only.
- `unlock()` is idempotent by contract — the memory/storage providers enforce this via the monotonic + latch rules; the interface does not enforce it at the type level.
- `AchievementsStore` is structural injection — the storage provider adds no dependency and works with any `{ get, set }` (AsyncStorage, MMKV wrapper, `localStorage` shim, etc.).

---

### `@flare-engine/iap` (< 1KB raw)

**Responsibility.** In-app purchase interface. A concrete RevenueCat adapter ships today (`@flare-engine/iap-revenuecat`, below); App Store StoreKit and Google Play Billing adapters are post-launch.

| API | Description |
| --- | --- |
| `IAPProvider` | Interface: `getProducts(ids[])`, `purchase(id)`, `restore()`, `onTransaction(cb)`. Purchase + restore return `Promise<PurchaseResult>`. `onTransaction` returns an unsubscribe function. |
| `NoopIAPProvider` | Default export. `getProducts` → `[]`, `purchase` → `{ status: 'cancelled' }`, `restore` → `[]`, `onTransaction` → no-op unsubscribe. |
| `IAPContext` / `useIAP()` | React context + hook. |
| `Product` / `Transaction` / `PurchaseResult` | Payload types. `PurchaseResult`: `{ status: 'purchased'\|'cancelled'\|'failed', transaction?, error? }`. |
| `ContentSpec` | `{ requiresEntitlement?: string }`. Minimal shape for paywalled content (zones, levels, cosmetics, DLC). |
| `canAccessContent(spec, entitlements)` | Pure boolean gate. Returns `true` when `spec.requiresEntitlement` is absent or `entitlements.isEntitled(spec.requiresEntitlement)` resolves true. |
| `ProductCatalog` / `CatalogEntry` / `EntitlementKey` | Catalog binding: each `CatalogEntry` is `{ productId, entitlements: EntitlementKey[] }`. The catalog is a `Map<ProductId, CatalogEntry>` returned from `createProductCatalog(entries)`. |
| `createProductCatalog(entries)` / `getCatalogEntry(catalog, id)` / `getGrantsForProduct(catalog, id)` | Pure helpers. `getGrantsForProduct` returns the entitlement-key list a successful purchase would grant. |
| `EntitlementStore` / `createEntitlementStore(catalog, options?)` | Reactive set of granted `EntitlementKey`s bound to a `ProductCatalog` at construction. Methods: `isEntitled(key)` (zero-alloc hot path), `grant(key)`, `grantProduct(productId)` (grants every key the catalog maps to `productId`; unknown products are ignored), `revoke(key)`, `snapshot()` → a fresh sorted `readonly EntitlementKey[]`, `restoreOnBoot(provider)` → `Promise<void>` (calls `provider.restore()` and grants purchased results), `attachProvider(provider)` → `Unsubscribe` (auto-grants streamed transactions). `onChange: Signal<void>` fires on grant/revoke. `EntitlementStoreOptions` = `{ initial?: readonly EntitlementKey[] }` for hydration from save. |

**Implementation notes:**

- No runtime deps beyond `@flare-engine/events`. React peer dep only.
- Receipt validation is adapter-local — the interface does not expose receipt bytes at 0.1.0; may extend post-launch.
- `Product.priceMicros` is in **micros** — millionths of one unit of `currency` (e.g. $0.99 → `990000`); may be `null` when the store doesn't report a numeric price.
- The package ships **more than the bare interface**: catalog binding (`ProductCatalog` + helpers), entitlement reactivity (`EntitlementStore`), and content gating (`ContentSpec` + `canAccessContent`) are all part of the 0.1.0 surface so games can wire paywalls without writing the same plumbing per app.

---

### `@flare-engine/iap-revenuecat` (< 4 KB raw, RevenueCat adapter)

**Responsibility.** Concrete `IAPProvider` implementation wrapping `react-native-purchases`. The app passes API keys (iOS + Android) and an optional `appUserId`; the package handles SDK configuration, `getProducts`, `purchase`, `restore`, and customer-info listener subscription. The SDK is loaded via lazy `await import()` so the package is safe to include in builds that run on platforms without the native module installed (e.g., web bundles).

| API | Description |
| --- | --- |
| `createRevenueCatProvider(config)` | Factory. Returns an `IAPProvider` backed by RevenueCat. Lazily configures the SDK on first call to `getProducts` or `purchase`. |
| `RevenueCatConfig` | Config type: `{ apiKeyIos, apiKeyAndroid, appUserId? }`. |
| `RevenueCatPurchasesModule` | Minimal interface for the `react-native-purchases` SDK surface the adapter uses. Declared here so the package does not hard-depend on the SDK's own type package. |

**Implementation notes:**

- Peer dep: `react-native-purchases >=8`. Does not list it as a hard dep — keeps the package safe to install in web-only projects.
- Lazy `await import('react-native-purchases')` pattern: SDK is never in the synchronous module graph.
- No-throw contract on `purchase` and `restore` — all paths return a `PurchaseResult` (status `'purchased' | 'cancelled' | 'failed'`) rather than rejecting.
- Fully mock-testable via `bun:test` `mock.module('react-native-purchases', ...)` without any native module.

---

### `@flare-engine/ui-shop` (< 6 KB raw, smart shop primitives)

**Responsibility.** Reusable React Native shop UI primitives. Three components: `ShopScreen` (smart, fetches products + tracks entitlements), `PaywallModal` (single-product soft-dismissible modal), and `RestorePurchasesButton` (one-tap restore + entitlement re-grant). Apps pass catalog data and localized copy via props; the engine handles the purchase loop, loading states, error banners, and entitlement reactivity. No i18n framework dependency — all text goes through a host-supplied `LocalizeFn`.

| API | Description |
| --- | --- |
| `<ShopScreen>` | Smart component. Reads `IAPContext` via `useIAP()`. Fetches products on mount; splits them into owned / available sections based on `EntitlementStore`. Calls `entitlementStore.grantProduct(id)` on confirmed purchase. |
| `ShopScreenProps` | `{ catalog, entitlementStore, copy, strings, localize, onPurchase?, onError? }`. |
| `<PaywallModal>` | Soft-dismissible single-product modal. `visible` owned by parent — modal never hides itself except on successful purchase. Calls `entitlementStore.grantProduct(productId)` + `onPurchased` + `onDismiss` on success. |
| `PaywallModalProps` | `{ visible, productId, entitlementStore, strings, localize, onDismiss, onPurchased?, onError? }`. |
| `<RestorePurchasesButton>` | Calls `provider.restore()` and `entitlementStore.grantProduct` for each purchased result. Shows success / empty / error banner inline. |
| `RestorePurchasesButtonProps` | `{ entitlementStore, strings, localize, onComplete?, onError? }`. |
| `ShopItemCopy` | Per-product copy bag: `{ titleKey, descriptionKey, ctaKey, ownedLabelKey }`. Keys passed to `localize`. |
| `ShopPanelStrings` | Panel-level string keys: `headingKey`, `emptyKey`, `loadingKey`, `errorKey`, `ownedSectionKey`, `availableSectionKey`. |
| `PaywallStrings` | `{ headingKey, bodyKey, ctaKey, dismissKey, loadingKey, errorKey }`. |
| `RestoreStrings` | `{ ctaKey, loadingKey, successKey, emptyKey, errorKey }`. |
| `LocalizeFn` | `(key: string) => string`. Host supplies the translation lookup; engine never imports an i18n library. |

**Implementation notes:**

- Deps: `@flare-engine/iap` (interface + catalog + entitlements), `@flare-engine/ui` (Panel / Button / Label / Modal primitives), `@flare-engine/events` (Signal via EntitlementStore.onChange).
- Peer deps: `react >=19`, `react-native >=0.79`.
- `EntitlementStore.onChange` subscription drives re-render after purchase; no manual `getProducts` refresh is needed.
- Localizer-as-prop pattern keeps all text in the app layer — engine emits zero strings.
- `PaywallModal` does not toggle `visible` itself. Parent-owns-visibility avoids double-close races with navigation stacks.

---

### `@flare-engine/analytics` (< 1KB raw)

**Responsibility.** Event tracking interface, plus in-memory and console providers. Consumer-supplied adapter at 0.1.0; platform adapters (PostHog, Amplitude, Segment, Firebase Analytics) are post-launch.

| API | Description |
| --- | --- |
| `AnalyticsProvider` | Interface: `track(event, props?)`, `identify(userId, traits?)`, `screen(name, props?)`, `flush()`. All return `Promise<void>`. |
| `NoopAnalyticsProvider` | Default export. Resolves immediately; retains nothing. |
| `createMemoryAnalytics(opts?)` | In-memory provider backed by a bounded ring buffer. Records the matching `AnalyticsEvent` for each call (drop-oldest once length exceeds `capacity = Math.max(1, opts.capacity ?? 256)`); timestamps from injected `now` (default `() => Date.now()`). Returns `MemoryAnalytics` — an `AnalyticsProvider` plus `getEvents(): readonly AnalyticsEvent[]` (defensive copy, oldest → newest) and `clear()`. `flush()` is a no-op. |
| `createConsoleAnalytics(opts?)` | Provider that builds the same `AnalyticsEvent` and logs it via the injected `log` (default `console.log`) as `log('[analytics]', event)`. `flush()` is a no-op. |
| `MemoryAnalyticsOptions` / `ConsoleAnalyticsOptions` | `MemoryAnalyticsOptions`: `{ capacity?, now? }`. `ConsoleAnalyticsOptions`: `{ log?, now? }`. |
| `AnalyticsContext` / `useAnalytics()` | React context + hook. |
| `AnalyticsEvent` / `AnalyticsContext` (type) | Payload types. `AnalyticsEvent` is a discriminated union on `type`: `{ type: 'track', name, props?, timestamp } \| { type: 'identify', userId, traits?, timestamp } \| { type: 'screen', name, props?, timestamp }`. `props`/`traits` are omitted (absent, not stored as explicit `undefined`) when the arg is not supplied. |

**Implementation notes:**

- No runtime deps beyond `@flare-engine/events`. React peer dep only.
- The in-memory ring buffer is for tests and dev capture; `getEvents()` returns a copy so callers can't mutate the internal buffer.
- Batching, sampling, and offline queueing are adapter concerns — the interface is deliberately thin so any analytics SDK can back it.

---

### `@flare-engine/haptics` (< 2KB raw, interface + injected providers)

**Responsibility.** Tactile-feedback interface for weapon / impact / bomb feel, with concrete providers wired at the app boundary via **injection** — no `expo-haptics` or `react-native` dependency (the same adapter pattern as `@flare-engine/iap-revenuecat`). Ships an Expo Haptics adapter, a Web Vibration adapter, and no-op fallbacks.

| API | Description |
| --- | --- |
| `HapticsProvider` | Interface: `impact(style?)`, `notification(type?)`, `selection()` (all `Promise<void>`), plus an enabled gate `isEnabled()` / `setEnabled(enabled)`. Cue methods mirror the iOS `UIFeedbackGenerator` family so any platform SDK can back it. |
| `createExpoHapticsProvider(expo)` | Provider over an injected `expo-haptics` module — the structural `ExpoHapticsModule` shape `{ impactAsync, notificationAsync, selectionAsync }`. Maps `impact`/`notification`/`selection` onto expo's calls, forwarding the cue kind (expo's string-enum values equal `HapticImpactStyle` / `HapticNotificationType`); an omitted kind forwards `undefined` so expo applies its own default. Starts enabled. |
| `createWebVibrationProvider(vibrate?)` | Provider over structural `navigator.vibrate` (`WebVibrate = (pattern: number \| number[]) => boolean`). Impact scales the buzz with intensity, each notification category has its own pulse pattern, selection is a short tick. Absent `vibrate` → returns the inert `NoopHapticsProvider`, so `isEnabled()` stays `false` and no feature-detect is needed. Otherwise starts enabled. |
| `NoopHapticsProvider` | Immutable default. Cues resolve immediately and fire nothing; `isEnabled()` returns `false` and `setEnabled` is inert by design (hard "off" default + the `HapticsContext` default value). |
| `createNoopHapticsProvider(enabled?)` | Stateful no-op: cues never fire, but `setEnabled` / `isEnabled` track real state so a consumer's haptics toggle is unit-testable without a native backend. Each call is an independent instance; defaults to disabled. |
| `HapticsContext` / `useHaptics()` | React context (defaults to `NoopHapticsProvider`) + hook. |
| `HapticImpactStyle` / `HapticNotificationType` | Payload types. `HapticImpactStyle`: `'light' \| 'medium' \| 'heavy' \| 'soft' \| 'rigid'`. `HapticNotificationType`: `'success' \| 'warning' \| 'error'`. |
| `ExpoHapticsModule` / `WebVibrate` | Structural injection types for the two adapters (declared here so the package depends on neither SDK). |

**Implementation notes:**

- No runtime deps. React peer dep only for the context + hook; the providers are framework-agnostic.
- Providers are built on one internal gate helper, so a custom backend (native `Vibration`, a Core Haptics bridge) forwards its cues and never re-implements the enabled logic.
- The enabled gate lets the user's haptics setting and the reduced-motion gate (`@flare-engine/a11y`) live in one place instead of at every call site — when disabled, cue methods are no-ops.

---

## Layer 2: Shapes (procedural primitives)

### `@flare-engine/shapes` (< 4KB gzip)

Procedural 2D shape primitives for Skia — a `ShapeSpec` vocabulary of 12 named atomic shapes plus an SVG `path` escape hatch, composable for shape-first game prototyping (compose ships / enemies / pickups from primitives, swap in sprite art once mechanics lock). Zero runtime deps; `@shopify/react-native-skia` is an **optional, type-only peer** (`import type` only — never in the runtime bundle), so the package also runs on web/CanvasKit where the injected `Skia` handle is CanvasKit's.

| API | Description |
| --- | --- |
| `ShapeSpec` (union) | Discriminated on `kind`: `circle`, `rect`, `triangle`, `ngon`, `star`, `ring`, `polyline`, `gradient-rect`, `arc`, `annulus`, `trapezoid`, `path`, `ship`. Every member extends `BaseSpec` = `{ fill?, stroke?, strokeWidth?, ox?, oy?, rot?, glow? }` — colors are 32-bit ARGB ints, `ox`/`oy` are local offsets, `rot` is local radians, and `glow` is `'friendly'` (safe-green rim) or `'hazard'` (orange double-stroke). |
| `PathSpec` | `{ kind: 'path', d: string, boundsR: number }` — `d` is an SVG path-data string parsed by `Skia.Path.MakeFromSVGString` (Figma / Inkscape syntax). A malformed `d` is silently skipped (no throw). `boundsR` is the required bounding-radius hint for atlas tile sizing. |
| `ShipSpec` / `SquareSpec` | Composite: `{ kind: 'ship', hull: ShapeSpec, weapons: readonly RectSpec[], engine: SquareSpec }`. `SquareSpec` (`{ kind: 'square', size }`) is used **only** as `ShipSpec.engine`, not as a flat `ShapeSpec` member. (Generalizing the `ship`/`hull` vocabulary to a genre-neutral surface is a post-launch API item, not a docs edit.) |
| `drawShape(Skia, canvas, paint, spec, x, y, rot)` | Dispatcher. Draws `spec` at `(x + spec.ox, y + spec.oy)` rotated by `rot + spec.rot`, reusing the caller-owned `paint`; emits the glow ring (when `spec.glow` is set) behind the body. Allocation-free per call except where Skia itself allocates path objects. |
| `argbTo(out: Float32Array, argb: number)` | Unpacks a 32-bit ARGB int into a length-4 `Float32Array` `[r, g, b, a]` (0–1) for Skia paints — zero-alloc into the caller's buffer. |
| `friendlyGlowArgb()` / `hazardGlowArgb()` | The two glow ARGB constants (`#6FA66B` @ α≈0.25; `#E84B2A` @ α≈0.6). |
| `applyFriendlyGlow(canvas, paint, cx, cy, r)` / `applyHazardGlow(…)` | Draw the glow rings directly — used internally by `drawShape`, exported for custom compositing. |
| `singleShapeRadius(spec)` / `shapeBoundsRadius(specs)` | Bounding-radius helpers — `singleShapeRadius` for one spec (glow sizing + atlas tiles), `shapeBoundsRadius` for the max over a `readonly ShapeSpec[]` composite; the latter adds a stroke-width margin where a stroke is actually painted and the full extent of a `glow` ring (+5.5 friendly, +2.25 hazard) on top of the base `+2`, so an atlas tile sized from it fully contains what `drawShape` paints. |

**Implementation notes:**

- Pure data + free functions — no classes. A `ShapeSpec` is a plain object; `drawShape` is the only Skia-touching entry point and receives the `Skia` module + `canvas` + `paint` by injection.
- Adding a new named primitive touches four places by design: the `ShapeSpec` union, a `draw.ts` branch, a `bounds.ts` branch, and tests. Arbitrary one-off shapes need no new primitive — use `{ kind: 'path', d, boundsR }`.
- No atlas / packing export — the package draws immediately; atlas tile sizing is left to the consumer via the bounds helpers.

---

## Layer 2: Simulation (continuous-time dynamics)

### `@flare-engine/simulation`

Continuous-time physical dynamics: n-body gravity with Plummer softening, velocity-Verlet / leapfrog integrators, wave-packet ripple pools, a diffuse/decay scalar field, and Jones-model agent stigmergy. Zero DOM imports — allocation-free hot paths. Depends on `@flare-engine/math` (deterministic `SeededRNG` for the agent model); n-body / integrators / ripples remain dep-free.

#### N-body

| API | Description |
| --- | --- |
| `createNBodySystem(capacity)` | Returns `NBodySystem` backed by pre-allocated SoA Float32Arrays (zero alloc after construction). |
| `NBodySystem` | Interface: `capacity`, `count`, `px/py/vx/vy/mass/tag: Float32Array` (SoA state). Methods: `add(x,y,vx,vy,m,tag?)→index\|-1`, `step(dt,g,softening,gr?,rs?)`, `totalEnergy(g,softening,gr?,rs?)`, `centerOfMass(out)`, `translate(dx,dy)`, `absorb(into,victim)`, `closestPair(out)`, `maxMass()`. |
| `ClosestPair` | `{ i: number; j: number; sep: number }` — out-param for `closestPair`. |

`step` uses velocity-Verlet with Plummer softening (`∝ 1/(r²+ε²)^{3/2}`). Pass `gr>0` for a post-Newtonian 1/r⁴ precession pull on bodies i≥1 toward body 0 (rosette orbits); `rs` is the GR length scale. `totalEnergy` includes the conservative GR potential so energy-bounded tests remain honest when `gr>0`. `absorb` is momentum- and mass-conserving inelastic coalescence with swap-remove (zero alloc). `primed` caches a(t) across steps — adding a body invalidates the cache.

#### Integrators

| API | Description |
| --- | --- |
| `AccelFn` | `(count, px, py, vx, vy, ax, ay) => void` — fills `ax[i]/ay[i]` for i in [0,count). Caller owns all arrays. |
| `leapfrogInto(count, px, py, vx, vy, dt, accel, ax, ay)` | Kick-drift-kick leapfrog (velocity-Verlet-equivalent). Symplectic → bounded energy for conservative forces. Evals `accel` TWICE per step. `ax/ay` are caller scratch. Zero-alloc. |
| `verletStep(count, px, py, vx, vy, dt, accel, ax, ay, axPrev, ayPrev)` | Velocity-Verlet with cached a(t). On entry `ax/ay` hold a(t); on return they hold a(t+dt) for chaining. ONE accel eval per step. `axPrev/ayPrev` are caller scratch. Zero-alloc. |

`leapfrogInto` is self-contained (no external a(t) cache). `verletStep` is the scheme used internally by `NBodySystem.step` — callers prime `ax/ay` once before the first step then chain calls.

#### Wave-packet pool

| API | Description |
| --- | --- |
| `createRipplePool(capacity)` | Returns `RipplePool` backed by pre-allocated Fixed arrays (zero alloc after construction). |
| `RipplePool` | Interface: `capacity`, `count`. Methods: `emit(x,y,now,amp,speed,wavelength,life)`, `heightAt(x,y,now)→number`, `prune(now)`, `clear()`. |

Each wavefront is an analytic Gaussian-enveloped wave packet (not a raw PDE): unconditionally stable, controllable bandwidth, exact spatial localization. `heightAt` sums contributions from all live fronts; `prune` retires fronts whose `age > life × 5`. `emit` overwrites the oldest slot when all capacity slots are active (never overflows). Spreading attenuation ≈ 1/√r via `ATTEN=320` px scale.

#### Scalar field

| API | Description |
| --- | --- |
| `createScalarField(width, height, cell, edge?)` | Returns `ScalarField` backed by two ping-pong `Float32Array`s (zero alloc after construction). `edge` = `'toroidal'` (default, wrapping — tiling fields) or `'clamp'` (edge-clamped — bounded playfields). |
| `ScalarField` | `w/h/cols/rows/cell`; `sample(x,y)` bilinear; `gradient(x,y,out)` central-difference ∇; `deposit(x,y,amount)` additive splat; `erode(x,y,radiusPx,mul)` radial multiply; `step(diffuseRate,decayRate,maxVal)`; `meanValue(stride)`; `maxValue(stride)`; `localMean(x,y,radiusPx)`; `toRGBA(out,norm,low,mid,hi,knot)`; `resize(w,h)`. |

`step` runs a separable 3×3 box-blur diffuse (ping-pong, lerped by `diffuseRate`) then multiplicative `decayRate`, clamping every cell to `maxVal` (`Infinity` = no clamp — the runaway-source stability guard). Pure diffuse (`decayRate=1`) conserves total mass. `gradient` writes the field slope into `out` — read its negation for chemotaxis / obstacle steering (build a second field as an occupancy map and follow `−gradient`). `toRGBA` packs a palette-binned low→mid→hi→knot ramp with brightness folded into rgb so dim cells add nothing under additive blend.

#### Agent stigmergy

| API | Description |
| --- | --- |
| `createStigmergy(field, config, rng)` | Returns `AgentField`: SoA agents that sense a `ScalarField`, turn (Jones 2010), move + deposit — the engine's first emergent-AI primitive. `rng` is a `SeededRNG` → fully deterministic. |
| `AgentField` | `count`, `px/py/heading: Float32Array` (SoA); `update()` (one sense→rotate→move+wrap→deposit step); `forEachAgent(cb,stride?)`; `resize(w,h)`. |
| `StigmergyConfig` | `{ count, sensorAngle, sensorDist, rotateAngle, stepSize, depositAmount, chaos, onSense?, onMove? }`. `onSense`/`onMove` are typed per-agent hooks for caller-injected chemotaxis / repulsion — keeps nutrient sources + obstacles out of the engine core. |
| `senseAt(field,x,y,heading,offset,dist)` | Read the field at one sensor: `offset` rad off the agent heading, `dist` px ahead. |
| `decideTurn(left,center,right,rand)` | Jones turn decision → `-1 \| 0 \| 1`; `rand ∈ [0,1)` breaks the symmetric "both sides brighter" case. |

Agents are never destroyed (the network is seamless by construction — continuous decay prunes, nothing is reseeded) and wrap or clamp per the field's edge mode. `update()` advances one fixed step (`stepSize` px/step, not px/s); all randomness — initial scatter, `decideTurn` tiebreak, `chaos` heading jitter — routes through the injected `rng` so runs reproduce bit-for-bit.

**2.5D lattice boundary (settled XP7).** The `WarpLattice` in flare-engine-page's spacetime demo is two separable halves. Its **potential-summation half** (`addWells` — sum Plummer-softened point-source potentials into a signed height/force field) is a **`ScalarField` producer** and, if ever lifted, belongs here in `simulation`. Its **perspective project / unproject / pitched-camera half is presentation** and belongs in a **future render-side 2.5D helper** (see [lighting-2-5d.md](lighting-2-5d.md)), never in `simulation`; the starfield lens-deflection map is likewise presentation. Neither half ships in XP7 — no in-engine consumer exists yet; this records the split so a future lift lands in the correct package.

---

## Layer 2: Progression (meta-economy primitives)

### `@flare-engine/progression`

Consolidated meta-progression surface: geometric upgrade tracks, pity-aware weighted drop rolling, prerequisite unlock DAG, tier resolution, and collectible-unlock registry. Pure, zero-alloc on hot paths. Depends on `@flare-engine/math` only; no DOM/Skia/RN imports.

| API | Description |
| --- | --- |
| `createUpgradeTrack(config)` → `UpgradeTrack` | Returns an upgrade track backed by `UpgradeTrackConfig { base, growth, cap }`. Methods: `price(currentLevel)` → `number` — `round(base × growth^level)`, `Infinity` at/above cap; `canBuy(wallet, currentLevel)` — wallet sufficient and below cap; `buy(wallet, currentLevel)` → `UpgradeBuyResult { ok, wallet, level }` — pure spend, deducts price and increments level; `resolveStats<K>(base, deltas, getLevel)` → `Record<K, number>` — folds per-level deltas into a stat record via a caller-supplied level reader (unit-testable without any save dep). |
| `UpgradeTrackConfig` | `{ base: number; growth: number; cap: number }`. |
| `UpgradeBuyResult` | `{ ok: boolean; wallet: number; level: number }`. |
| `createDropTable<K>(entries)` → `DropTable<K>` | Returns a `DropTable` backed by `DropEntry<K>[] = { item: K, weight: number }[]`. The `weightAt` accessor is allocated once in the factory closure; `rollInto` is zero-alloc. |
| `DropTable<K>.rollInto(rollTable01, rollChance01, chancePerRoll, pity, thresholds, isAllowed, out)` | Zero-alloc in-place roll. Algorithm: (1) pity override — first entry whose `pity[item] + 1 >= thresholds[item]` fires unconditionally (gated by `isAllowed`); (2) if no pity fires and `rollChance01 >= chancePerRoll`, result = `'none'`; (3) otherwise `weightedIndexBy` picks from the filtered table — if `isAllowed` filters every entry the pool fizzles to `'none'`. Pity counters reset for the dropped item, advance by 1 for all others. Aliasing `out.pity` against `pity` is safe — all inputs are read before any output is written. |
| `rollDrop<K>(table, rollTable01, rollChance01, chancePerRoll, pity, thresholds, isAllowed?)` → `DropRollOut<K>` | Allocating convenience wrapper around `rollInto`. Use on cold paths and in tests. |
| `DropEntry<K>` | `{ item: K; weight: number }`. |
| `DropPity<K>` | `Record<K, number>` — per-item dry-roll counters. |
| `DropRollOut<K>` | `{ item: K \| 'none'; pity: DropPity<K> }`. |
| `createUnlockDag(nodes)` → `UnlockDag` | Returns a DAG from `DagNode[] = { id, requires: string[] }[]`. Duplicate ids throw. Methods: `isUnlocked(cleared, id)` — true when all `requires` ids are in `cleared`; `frontier(cleared)` — all nodes whose requirements are satisfied but not yet cleared (stable insertion order); `allUnlocked(cleared)` — all nodes satisfiable by `cleared`. Unknown `requires` ids are not validated — a requirement is satisfied iff it is in `cleared`. |
| `DagNode` | `{ id: string; requires: readonly string[] }`. |
| `resolveTier<T>(entries, tally)` → `T \| null` | Returns the tier value of the highest `TierEntry` whose `at` threshold is ≤ `tally`, or `null` when `tally` is below all thresholds. `entries` need not be sorted. |
| `resolveTierIndex<T>(entries, tally)` → `number` | Same logic; returns the 0-based index of the highest satisfied entry, or `-1`. |
| `TierEntry<T>` | `{ at: number; tier: T }`. |
| `createCollectibleRegistry<K>(ids, capstoneId?)` → `CollectibleRegistry<K>` | Immutable unlock-set + capstone. `ids` is the collectible set; `capstoneId` (optional) is auto-unlocked when all ids are collected. Duplicate ids throw. Methods: `unlock(id)` → new registry (idempotent; throws on unknown id; auto-fires capstone on full completion); `partition()` → `{ have: K[], missing: K[] }` (capstone excluded from both lists); `list()` → ids in insertion order. Properties: `all`, `capstoneId`, `unlocked`, `isComplete`, `isCapstone`. |
| `CollectibleRegistry<K>` | Interface (see above). Returned by `createCollectibleRegistry`. |

**Implementation notes:**

- `UpgradeTrack.resolveStats` uses `Math.max(0, Math.floor(getLevel(key)))` so fractional or negative levels clamp cleanly.
- `createDropTable` closes over a single `weightAt` accessor (not re-allocated per roll) and a `currentIsAllowed` binding (reassigned before each `weightedIndexBy` call). Biome `biome-ignore lint/style/noVar` comment guards the hoisted var.
- `resolveTier` / `resolveTierIndex` scan all entries to find the largest satisfied `at` — O(n), no sort required, stable for small tiers (≤10 typical).
- `CollectibleRegistry` is a persistent (copy-on-write) data structure. Each `unlock` call returns a fresh object; the input is never mutated.
- Not barrelled into `@flare-engine/engine` (curated, matches XP6/XP7). Publish owner-gated.

