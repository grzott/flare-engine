# Flare Engine — Module API Specifications

> Living document. Update alongside code changes — divergence is a spec bug.
>
> Last refreshed against `packages/*/src/index.ts`: **2026-07-01**.

---

## Layer 0: Foundation

### `@flare-engine/math` (< 5KB gzip)

| API                                                           | Description                                                                                                                                          |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Vec2`                                                        | `{x,y}` object. Static methods: `add`, `sub`, `scale`, `normalize`, `normalizeOut(dx, dy, speed, out)`, `dot`, `cross`, `length`, `distance`, `lerp`, `rotate`, `angle`, `clampLength`, `turnVelocityToward(vx, vy, dx, dy, maxStep, out)`. `vec2(x,y)` factory. Zero-alloc forms take an `out` param. `normalizeOut` takes scalar components (not a Vec2) so callers avoid a temporary in hot paths. `turnVelocityToward` is zero-alloc homing steer (mandatory `out`): rotates velocity toward direction by at most `maxStep` radians, preserving speed. |
| `Rect`                                                        | AABB. `contains(point)`, `intersects(rect)`, `intersection`, `union`, `expand`, `center`, `fromPoints`                                               |
| `Circle`                                                      | Position + radius. `contains`, `overlaps` with Rect/Circle                                                                                           |
| `Transform2D`                                                 | Position (Vec2) + rotation (radians) + scale (Vec2). `localToWorld()`, `worldToLocal()`                                                              |
| `Mat3`                                                        | 3x3 on Float32Array. `multiply`, `translate`, `rotate`, `scale`, `invert`, `identity`                                                                |
| `Color`                                                       | RGBA. `lerp`, `toHex`, `fromHex`, `toSkColor`, `multiply`, `create`. OKLab/OKLCH: `toOklab`, `fromOklab`, `toOklch`, `fromOklch` (operates in linear sRGB; `fromOklab`/`fromOklch` clamp out-of-gamut results — round-trip exact only in-gamut). WCAG: `relativeLuminance`, `contrastRatio`. Distance: `deltaEOk`, `deltaEOkLab`. Types: `Oklab`, `Oklch`. |
| `clamp`, `lerp`, `inverseLerp`, `map`, `degToRad`, `radToDeg`, `approxEquals`, `wrap`, `pingPong`, `smoothStep`, `sign`, `angleDelta(a, b)`, `rotateTowards(cur, target, maxStep)` | Scalar utils. `angleDelta` returns shortest signed delta `a - b` wrapped to `[-π, π]` (branch form — exact ±π pass through unwrapped). `rotateTowards` rotates angle `cur` toward `target` by at most `maxStep` radians. Both are byte-identical to hand-rolled homing math. |
| `easings`                                                     | 32 functions (quad/cubic/quart/quint/sine/expo/circ/back/elastic/bounce In/Out/InOut + linear, step, springIn/Out/InOut). Tree-shakeable named exports. |
| Random                                                        | `SeededRNG` class. Top-level `randomFloat(min, max)`, `randomInt(min, max)`, `randomVec2InRect(rect)`, `randomPointInCircle(cx, cy, r)`, `shuffle`, `choose`. Weighted: `weightedIndex(weights, roll01)` — cumulative-walk index from weight array; `weightedIndexBy<T>(items, weight, roll01)` — cumulative-walk index via accessor; `weightedPick<T>(items, weight, roll01)` — returns the item (allocating wrapper). Hash/seeded: `hashU32(seed)` — lowbias32 avalanche finalizer (decorrelates adjacent seeds); `seededIndex(seed, count)` — stateless deterministic index in `[0, count)`. All `roll01` inputs expected in `[0, 1)`. |
| Reward                                                        | Timed-window + capped-bonus scoring math. `cappedBonus(pay, frac, capFrac)` — `floor(pay × min(frac, capFrac))`, 0 for non-positive pay. `advanceWindowedStreak(prev, elapsed, lastT, windowSec)` — increments streak if within window, resets to 1 on gap (`lastT < 0` = no prior event). `windowExpired(elapsed, lastT, windowSec)` — true when window was open and has since lapsed. `remainingInWindow(awarded, capPerWindow)` — non-negative slots remaining in a rate-cap window. All pure, zero-alloc. |
| Intersection                                                  | `pointInRect`, `pointInCircle`, `rectVsRect`, `rectVsCircle`, `circleVsCircle`, `lineVsRect`, `lineVsCircle`, `rayVsRect`                            |

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
| `CoroutineManager` | Generator-based. `yield number` = wait seconds (scaled time), `yield undefined` = wait 1 frame, `yield Promise` = wait async.                        |
| `Pool<T>`          | `acquire()`, `release(obj)`, `prewarm(count)`. Generic object pool. Optional `capacity` ctor option (via `PoolOptions`) — enforced ONLY by `tryAcquire(): T \| null` (returns null at cap, zero allocation); `acquire()` is always uncapped. Dev-mode double-release guard (throws when `__DEV__` is true). `live` getter = currently out-of-pool count. |

**Physics interpolation.** Read `loop.alpha` in an `onPreRender` callback to lerp between the previous and current physics positions for smooth visuals at any display refresh rate. `alpha` is 0 when the loop was not constructed with a `fixedDt` option.

### `@flare-engine/ecs` (< 8KB gzip)

| API                                   | Description                                                                                                                              |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `World`                               | `spawn() → entityId`, `destroy(entityId)`, `add<T>(entityId, def, data?)`, `remove(entityId, def)`, `get<T>(entityId, def)`, `query(...defs) → Query`, `addSystem(fn, priority?)`, `step(dt)`. Max 32 component types per world. |
| `Query`                               | Iterable. `onEntityAdded`, `onEntityRemoved` signals. Archetype bitmask caching.                                                         |
| `defineComponent<T>(name, defaults?)` | Type-safe component factory. Returns `ComponentDef<T>` used by `world.add/get/remove`.                                                  |
| `defineSystem(query, fn)`             | Helper that binds a query to a per-frame update fn. Register with `world.addSystem(sys._worldFn)`.                                       |
| `definePrefab(name, components)`      | Prefab factory function                                                                                                                  |
| `FSM`                                 | Lightweight state machine. `onEnter`, `onExit`, `onUpdate`, transitions.                                                                 |
| `createMovementSystem(world)` | Integrates `Position` by `Velocity * dt`. Zero-alloc. |
| `createLifetimeSystem(world, onExpire)` | Decrements `Lifetime.remaining`; calls `onExpire(id, world)` (deferred, after read loop) when `remaining <= 0`. Destroy/pool policy is caller-owned. Zero-alloc steady state (grow-only scratch). |
| `createBoundsCullSystem(world, bounds, onCull)` | Culls entities whose `Position` falls outside `CullBounds`. Reads `bounds` live each frame (mutate to follow camera). Calls `onCull(id, world)` deferred. `CullBounds = { minX, minY, maxX, maxY }`. |
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
| `Renderer`      | Manages Skia canvas. `setCanvas(canvas)`, `begin(clearColor?)`, `end()`, `applyCamera(...)`. Tracks `stats.drawCalls`. `canvas` getter throws outside `begin/end`. |
| `SpriteBatch`   | Wraps Skia `<Atlas>`. `draw(image, frame, x, y, w?, h?, effect?, anchorX?, anchorY?, alpha?, rotation?, stretch?)` queues a sprite; `drawRaw(image, sx, sy, sw, sh, dx, dy, dw, dh, effect?, anchorX?, anchorY?, alpha?, rotation?, stretch?)` for raw source rects; `flush(drawAtlas, renderer?)` groups maximal **consecutive runs** by `(image, effect, alpha, stretch)` key and invokes `drawAtlas` once per run — **z-order is preserved** (no global merge across interleaved keys). Consecutive sprites sharing all four key fields merge into a single draw call; interleaved keys produce separate calls in insertion order. `stretch` is part of the key so stretched sprites never merge with regular sprites. `alpha` defaults to `1`; values in `[0, 1]`. `rotation` (radians, CW, default `0`) rotates the sprite about its anchor point via the RSXform similarity transform — uniform scale only; non-uniform scale combined with rotation, one-axis mirrors (negative-determinant transforms such as flipX without flipY), and any combination of these are not expressible via a single RSXform. `stretch` (default `false`) — opt-in non-uniform scale via `drawImageRect`; see `SpriteData.stretch` for semantics and caveat on rotation. |
| `Camera2D`      | `position`, `zoom`, `rotation`, `viewport`, `bounds`, `shake(intensity, duration)`, `shakePerlin(intensity, duration)` — Perlin/FBM-noise shake, overwrites any in-flight shakePerlin. Both `shake` and `shakePerlin` offsets are summed in `effectiveX`/`effectiveY` and respect `motionScale`. Allocating: `worldToScreen`, `screenToWorld`, `getBounds`. Zero-alloc: `worldToScreenInto(x, y, out)`, `screenToWorldInto(x, y, out)`, `getBoundsInto(out)`. `follow(target, opts?)` replaces any previous follow target; use `unfollow()` to stop. |
| `sortByDrawOrder` | In-place insertion sort by `.z`. Optional `length` param to sort only the first N entries (useful for pooled arrays). Mutates input; nearly-sorted frame-to-frame input makes it O(n). |
| BMFont text     | Functional cluster for bitmap text: `parseBMFontJSON(json)` → `BitmapFont`, `measureText(font, str)` → pixel width, `drawText(batch, font, str, x, y, opts?)` queues glyphs through `SpriteBatch`. `getKerning(font, prev, curr)`. Batches with sprites. |
| `RenderSystem`  | `createRenderSystem(world, query, positionDef, spriteDef, batch)` returns a per-frame fn. Queries entities with Position+Sprite, sorts by z, queues into `batch`. **Does not call `batch.flush()`** — the frame owner flushes once per frame across all draw sources. |
| `SpriteEffects` | `tint(color, amount)`, `flash(color, sec)`, `grayscale(amount)`, `outline(color, width)`, `custom(shader, uniforms)`, `water(color, foamColor, waveSpeed, waveAmplitude)`, `fog(color, density?, speed?, scale?)`, `fire({ color, tipColor, speed?, intensity? })`, `dropShadow({ color, offsetX?, offsetY?, blur? })`. Effects are **immutable**; `updateEffect(effect, dt)` returns a new effect (or same reference if time-invariant) or `null` on expiry. `WaterEffect` carries `{ type:'water', color, foamColor, waveSpeed, waveAmplitude }` — time-invariant; time is passed via `beginFrame(w, h, time)`. SkSL source exported as `WATER_SKSL`. `FogEffect` carries `{ type:'fog', color, density, speed, scale }` — time-invariant; 4-octave FBM noise animates each frame. SkSL source exported as `FOG_SKSL`. `FireEffect` carries `{ type:'fire', color, tipColor, speed=1.0, intensity=0.8 }` — time-invariant; value-noise FBM flame rises upward each frame. SkSL source exported as `FIRE_SKSL`. `DropShadowEffect` carries `{ type:'drop-shadow', offsetX, offsetY, blur, color }` — time-invariant (`color.a` is the shadow opacity); applied via Skia `ImageFilter.MakeDropShadow` on a reused paint so the sprite and its offset/blurred/tinted shadow draw in one pass; requires `Skia.ImageFilter` (falls back to the unfiltered sprite when absent — CPU/test surfaces). Added to `AnySpriteEffect`. All time-varying effects are compiled lazily and cached by `@flare-engine/react` skia-bridge. |
| Zone BG Effects | Six procedural-silhouette sprite effects for zone backgrounds. All are time-invariant (callers update `scrollOffsetY` each frame from Skia-bridge time); `updateEffect` returns the same reference. Factories: `roofsCity({ skyColor, roofColor, scrollOffsetY?, density?=6 })` — AABB hash-field rooftop skyline, SkSL `ROOFS_CITY_SKSL`; `forestCanopy({ skyColor, leafColor, scrollOffsetY?, density?=5 })` — value-noise tree line, SkSL `FOREST_CANOPY_SKSL`; `riverWave({ waterColor, foamColor, scrollOffsetY?, waveScale?=2 })` — 1D height-field wave with foam crests, SkSL `RIVER_WAVE_SKSL`; `moonCrater({ moonColor, craterColor, scrollOffsetY?, craterCount?=4 })` — polar-SDF craters, SkSL `MOON_CRATER_SKSL`; `caveInterior({ caveColor, glowColor, scrollOffsetY?, stalactiteCount?=8 })` — stalactite silhouettes hanging from top edge, SkSL `CAVE_INTERIOR_SKSL`; `mountainHills({ skyColor, hillColor, scrollOffsetY?, ridgeScale?=1.5 })` — FBM height-field ridge, SkSL `MOUNTAIN_HILLS_SKSL`. Types: `RoofsCityEffect`, `ForestCanopyEffect`, `RiverWaveEffect`, `MoonCraterEffect`, `CaveInteriorEffect`, `MountainHillsEffect`. All six added to `AnySpriteEffect` union. Bridge wiring (`applyZoneBg`) is the caller's responsibility via `custom(compiledShader, uniforms)` or a dedicated `@flare-engine/react` extension. |
| `SpriteData`    | ECS component type: `{ image, frame, z, width?, height?, effect?, anchor?, alpha?, rotation?, stretch? }`. `alpha` is a mutable per-instance multiplier in `[0, 1]`, default `1`. Write directly: `sprite.alpha = 0.5`. `rotation` is in radians, CW (Skia Y-down convention), default `0`; rotation is applied about the sprite's anchor point. `stretch` (default `false`) — when `true`, the sprite is drawn via `canvas.drawImageRect(image, srcRect, dstRect, paint)` so `width` and `height` are honored **independently** (non-uniform scale): a 256×256 source fills an arbitrary W×H destination rect. Stretched sprites are NOT batched with regular sprites (each is an independent `drawImageRect` call). `alpha` and `anchor` are fully honored in stretch mode; **rotation is unsupported in stretch mode** (combine only with `rotation = 0` or omitted). The render system threads `stretch` to `SpriteBatch.draw()` — no allocation. `Sprite` is a pre-registered `ComponentDef<SpriteData>` for drop-in use. |

**Rendering modes:** Retained (Atlas) for game entities, Immediate (Picture) for particles/effects. Compose in the same Canvas.

### `@flare-engine/input` (< 6KB gzip)

| API               | Description                                                                       |
| ----------------- | --------------------------------------------------------------------------------- |
| `InputManager`    | `pointer` (primary touch), `touches[]`, `update()` per frame.                     |
| `Pointer`         | `position: Vec2`, `isDown`, `justPressed`, `justReleased`, `delta: Vec2`          |
| `GestureDetector` | Signals: `onTap`, `onSwipe`, `onPinch`, `onLongPress`.                            |
| `VirtualJoystick` | Data functions only: `createJoystickState`, `updateJoystick`, `releaseJoystick`. `deadZone`, `maxRadius`, `direction: Vec2`, `magnitude`. RN component lives in `@flare-engine/react`. |
| `VirtualButton`   | Data functions only: `createButtonState`, `pressButton`, `releaseButton`. `isPressed`, `justPressed`, `justReleased`. RN component lives in `@flare-engine/react`. |

Polling model + signals. Screen-space coords; use `camera.screenToWorldInto()` for world coords. Virtual controls render as RN Views overlaid on the Skia canvas.

### `@flare-engine/physics` (< 4KB AABB)

**Tier 1 — Built-in AABB (implemented):**

| API                                         | Description                                                                                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `CollisionWorld`                            | `add(entity, shape, x, y, isTrigger?, layer?, mask?)`, `setPosition(entity, x, y)`, `remove(entity)`, `step()`, `clear()`                    |
| `Shape`                                     | `AABB(w, h)`, `CircleShape(r)`. `shapeBounds(shape, x, y)` (allocating) and `shapeBoundsInto(shape, x, y, out)` (zero-alloc).                |
| `createCollider`                            | Helper that returns a `Collider` data object: `{ shape, isTrigger, layer, mask }`.                                                           |
| Signals                                     | `onCollisionStart`, `onCollisionEnd`, `onTriggerEnter`, `onTriggerExit`. Enter/exit events allocate a fresh `CollisionPair` so listeners may retain the reference safely. |
| `raycast(ox, oy, dx, dy, maxDist, targets)` | Closest hit against `RaycastTarget[]`. Returns `RaycastHit \| null`. Scalar inputs; caller pre-filters the candidate list — no internal broadphase. |
| `RaycastTarget`                             | `{ entity, shape, x, y }`                                                                                                                    |
| `RaycastHit`                                | `{ entity, distance, point: Vec2, normal: Vec2 }`                                                                                            |
| `SpatialIndex<V>`                           | Brute-force broadphase tuned for <1000 dynamic entities. `insert`, `remove`, `update`, `query(bounds, outBuf)`. **Not an rbush wrapper** — write a grid/quadtree sibling module if you need more scale. |
| `SolidGrid` / `SolidTile`                   | `SolidTile` is a structural `{ row, col }` input — `TileCollider[]` from `@flare-engine/tilemap` is assignable with no tilemap import. `SolidGrid` carries `{ width, height, tileSize, solid: Set<number> }`. |
| `buildSolidGrid(width, height, tileSize, tiles)` | Builds a `SolidGrid` from a `readonly SolidTile[]`. Call once per map load; reuse across frames. |
| `isBlockedAABB(grid, x, y, halfW, halfH)`   | Returns `true` when the AABB centered at `(x, y)` with half-extents `(halfW, halfH)` overlaps a solid tile or leaves the map. Half-open EDGE = 1e-4: a box whose max edge lands exactly on a tile boundary does NOT count as overlapping that tile. |
| `moveAndSlideInto(grid, x, y, dx, dy, halfW, halfH, out)` | Axis-separated slide: attempts `dx` then `dy` independently; a blocked axis is dropped so diagonal input slides along walls. The dy-check uses the already-updated x. Zero-alloc — writes result into `out: Vec2` and returns it. |

**Tier 2 — planck.js integration: deferred.** `PhysicsWorld`, `RigidBody`, `applyForce`, `applyImpulse` are not implemented. Revisit after Phase 8 benchmarks — only bring it in if AABB proves insufficient.

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
| `AssetManager` | `load(manifest)` → Promise. `get(key)`. `progress` (0-1), `onProgress` signal.               |
| `AssetLoader`  | Function type `(entry) => Promise<unknown>`. Injected by the host (e.g. `@flare-engine/react`).     |
| `Texture`      | Wraps Skia SkImage                                                                           |
| `SpriteSheet`  | Parsed from TexturePacker JSON (hash + array) / Aseprite JSON                                |
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
| `SceneManager`  | `register(name, factory: () => Scene)`, `go(name, data?)`, `push(name)`, `pop()`                                                              |
| `Scene`         | Interface, not a class. Optional hooks: `onPreload`, `onInit`, `onEnter`, `onUpdate`, `onDraw`, `onExit`, `onDestroy`                         |
| Transitions     | Factory functions: `noneTransition()`, `fadeTransition(duration?, easing?)`, `slideTransition(duration?, direction?, easing?)`. Each returns a `Transition` with a `kind: 'none' \| 'fade' \| 'slide'` discriminator so renderers apply the right visual effect (alpha vs. translate). The optional `easing?: EasingFn` parameter (imported from `@flare-engine/math`) maps raw linear progress to an eased value; defaults to identity (linear). `state.progress` always holds the eased value. |

### `@flare-engine/animation` (< 5KB gzip)

| API                                    | Description                                                                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `createSpriteAnimator(sheet)`          | Returns animator state. `playAnimation(state, name)`, `updateAnimator(state, dt)`. Tick-based.  |
| `tween(from, to, duration, easing?)`   | Returns `Tween` state object. `updateTween(tween, dt)` → value. Chain via `chainTween`.         |
| `spring(config)`                       | `{stiffness, damping, mass, target}`. `updateSpring(spring, dt)` → value.                       |
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
| `ParticlePool`    | Pre-allocated. No GC during gameplay. `acquire()`, `tryAcquire(): Particle \| null` (returns null at cap), `update(dt, gx, gy)`, `getSize(p)`, `getAlpha(p)`, `getColor(p)` (shared buffer), `getColorInto(p, out)` (caller buffer). |

Uses immediate mode (PictureRecorder) at the draw layer — this package owns particle data and lifecycle, not rendering. Target: 200-500 particles at 60fps.

### `@flare-engine/tilemap` (< 8KB gzip)

| API               | Description                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `parseTiled(json)`     | → `TilemapData`. Orthogonal maps, tile/object layers, properties, collision shapes.                   |
| `parseLDtk(json)`      | → `TilemapData`. Levels, tile/entity layers, enums.                                                   |
| `TilemapRenderer`      | Owns its own `SpriteBatch`. `draw(camera, flush)` culls, queues tiles into `this.batch`, then calls `flush(this.batch)` — delegates to `drawInto`. `drawInto(camera, batch)` queues visible tiles into the caller-owned `batch` without flushing — zero-alloc, enables single-flush z-ordering (tiles under sprites). |
| `extractColliders(data)` | → `TileCollider[]`. Extracts solid tiles → collision shapes for physics.                             |

### `@flare-engine/pathfinding` (< 8KB gzip)

Grid pathfinding (A\*), Jump-Point Search optimization for uniform-cost grids, and a navmesh fallback for non-grid maps. No external deps beyond `@flare-engine/math`.

| API | Description |
| --- | --- |
| `Grid` / `GridConfig` / `createGrid(config)` | Walkability + cost grid. `inBounds(grid, x, y)`, `isWalkable(grid, x, y)`, `getCost(grid, x, y)`, `setWalkable(grid, x, y, v)`, `setCost(grid, x, y, n)`. |
| `findPath(grid, start, goal, opts?)` | A\* over `Grid`. Returns `PathResult { found, cells, cost }`. `PathOptions` selects `manhattanDistance` / `octileDistance` / `chebyshevDistance` / `euclideanDistance` heuristics + diagonal toggle. |
| `findPathJPS(grid, start, goal, opts?)` | Jump-Point Search variant — typically 5–10× faster than A\* on uniform open grids; falls back to A\*-equivalent moves when costs vary. `JpsOptions`. |
| `NavMesh` / `NavMeshPolygon` / `Portal` / `createNavMesh(polygons, portals)` | Convex-polygon navmesh built from explicit polygon + portal lists. `findPolygonAt(mesh, x, y)`, `findNavMeshPath(mesh, fromXY, toXY) → NavMeshPathResult`. Used for non-grid bosses, large open zones. |

**Implementation notes:**

- Pure-data API: grids and navmeshes are plain objects, no classes. Heuristics are exported as named functions for tree-shake.
- Path output is a flat `cells: number[]` packed `[x0, y0, x1, y1, ...]` for zero-alloc consumption by ECS systems.
- Not used by Pan Tvardowski (shmup) — verified by integration tests in `packages/pathfinding/tests/`.

---

### `@flare-engine/dialogue` (< 5KB gzip)

Branching dialogue graphs with conditions, actions, variable interpolation, and a typewriter text-reveal helper. No rendering — pair with `@flare-engine/ui` (`DialoguePanel`) on the view side.

| API | Description |
| --- | --- |
| `DialogueGraph` / `DialogueNode` (union) | A graph is a `Map<NodeId, DialogueNode>` plus a `start: NodeId`. Node kinds: `LineNode` (speaker + text), `ChoiceNode` (player picks an `ChoiceOption`), `BranchNode` (predicate-driven `BranchArm[]`), `ActionNode` (fires a side effect via `ActionHandler`), `EndNode`. |
| `createDialogueGraph(start, nodes)` / `getNode(graph, id)` | Builders + lookup. |
| `DialogueRunner` / `createDialogueRunner(graph, opts)` | Stateful runner. Options: `{ onLine, onChoice, onEnd, conditions: ConditionResolver, actions: ActionHandler, variables: VariableBag }`. Runner emits `DialogueLineEvent` / `DialogueChoiceEvent` to the host. `DialogueRunnerState` is the serializable position. |
| `interpolate(text, variables)` | Interpolates `{var}` tokens against a `VariableBag` (`Record<string, string \| number \| boolean>`). |
| `createTextReveal(text, opts?)` / `updateTextReveal(state, dt)` / `completeTextReveal(state)` / `resetTextReveal(state)` | Typewriter state machine — `TextRevealState` exposes `visible: string`, `done: boolean`. `TextRevealOptions` covers `cps` (chars/sec), `instantOnSkip`. |

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

| API                     | Description                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `<GameView>`            | Root component. Skia Canvas + game loop + input. Props: `config`, `onReady`, `style`, `children`, `safeArea?`. If `safeArea` is omitted, insets are resolved from `react-native-safe-area-context` (optional peer dep) and fall back to zero. `GameConfig.onRenderPostFx` is typed as `PostFxRenderHook` (receives `bridge` as 3rd arg). |
| `<VirtualJoystick>`     | Overlay RN component. Props: `config?` (`VirtualJoystickConfig`), `onStateChange?`, `style?`. Skin slots: `base?: React.ReactNode` — replaces the default base-circle View (the outer View retains all touch responders; when absent, the translucent background is applied as well); `thumb?: React.ReactNode` — replaces the default knob View and inherits the drag-offset transform wrapper. Both slots default to the built-in appearance when absent (backward-compatible). The outer container always applies `alignItems:'center'` / `justifyContent:'center'` regardless of whether `base` is set — this is what anchors the `thumb` wrapper at the pad centre. Only the translucent background (`rgba(255,255,255,0.2)`) is suppressed when `base` is provided. Consumer contract: a passed-in skin node must carry its own explicit width/height — the transform wrapper around `thumb` is zero-size. `pointerEvents="none"` is applied by the engine to both slots; the consumer must not set it on the passed-in node. |
| `<VirtualButton>`       | Overlay RN component                                                                                              |
| `<LoadingScreen>`       | Full-screen asset-preload overlay. Props: `progress` (0–1, clamped), `message?`, `barColor?`, `trackColor?`, `textColor?`, `style?`. Pure RN View + Text so it works before `<GameView>` mounts its Skia canvas. |
| `useGame()`             | Returns the full `GameContextValue`: `{ world, camera, input, audio, assets, scenes, loop, renderer, batch }`      |
| `useEntity(query)`      | Subscribe to ECS query changes (returns a snapshot array; React re-renders on add/remove)                          |
| `useGameLoop(callback)` | Register a per-frame function on `loop.onUpdate`                                                                  |
| `useSafeArea()`         | Returns the `SafeArea` insets `{ top, right, bottom, left }` from the nearest `<GameView>`. Throws `'useSafeArea must be used inside a <GameView>'` if called outside one. |
| `SafeArea`              | Type: `{ top: number; right: number; bottom: number; left: number }`. Device safe-area insets in logical pixels. |
| `SafeAreaContext`       | `React.Context<SafeArea \| null>`. Provided by `<GameView>`; `null` outside it. Prefer `useSafeArea()` for direct consumption. |
| `PostFxRenderHook`      | `(ctx: GameContextValue, canvas: unknown, bridge: SkiaFrameRenderer \| null) => void`. Callback type for `GameConfig.onRenderPostFx`. The `bridge` arg exposes `setPostFxBinding(runtime, chain)` so the hook can register the runtime and chain for the current frame. `bridge` is `null` only on future non-Skia render paths. |
| `RenderHook`            | `(ctx: GameContextValue, canvas: unknown) => void`. Callback type for `GameConfig.onRenderBackground`. |
| `SkiaFrameRenderer`     | Interface returned by `createSkiaFrameRenderer`. Methods: `beginFrame(w, h, time?)`, `drawAtlas(image, commands)`, `setPostFxBinding(runtime, chain)`, `buildPostFxPasses(runtime, chain, w, h): readonly PostFxPassDescriptor[]`, `endFrame(): SkPicture \| null`. `buildPostFxPasses` maps each `CompiledPassLike` from `runtime.buildPass` to a `PostFxPassDescriptor` keyed by SkSL uniform name for use with JSX `<RuntimeShader>`. Returns an empty array when the runtime is null, unsupported, has no `buildPass`, or the chain has no enabled effects. |
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
| `loadCanvasKit(wasmUrl, onProgress?)` | Singleton loader. Reads wasm binary from `wasmUrl` (absolute URL or filesystem path). Falls back to `node:fs/promises` when `fetch` is absent (Node/Bun test environments). Calls `onProgress(1)` immediately if already loading/complete. Returns `Promise<CanvasKit>`. |
| `createWebSkiaModule(kit)` | Returns a `FrameRendererModule` backed by CanvasKit. Adapter differences handled internally: `drawAtlas` flattens `RectLike[]`/`RSXformLike[]` to grow-only `Float32Array` scratch buffers (zero-alloc steady state); `rotate` takes degrees (the `CanvasLike`/`DrawSurfaceLike` contract) and forwards verbatim to CanvasKit — `render`'s camera seam converts radians → degrees once; `ColorFilter.MakeBlend` maps numeric mode literals to CK `BlendMode` enum entries; `RSXform` objects carry `scos/ssin/tx/ty` readable fields. Pass to `createFrameRenderer` from `@flare-engine/render`. |
| `createWebFrameRenderer(kit)` | `createWebFrameRenderer(kit: CanvasKit): FrameRenderer`. The web/CanvasKit analog of `@flare-engine/react`'s `createSkiaFrameRenderer` — a thin composition `createFrameRenderer(createWebSkiaModule(kit))` (from `@flare-engine/render`), so the frame-renderer body stays backend-neutral and shared with native. Presentation (replaying `endFrame()` onto a CK surface + flushing) is the consumer's job — pair with `createWebSurface` or `createPostFxSurface`. |
| `createWebSurface(kit, canvas)` | Returns `CanvasLike \| null`. Creates a WebGL-backed CanvasKit surface for the given `<canvas>` element and wraps its canvas as `CanvasLike`. Returns `null` when WebGL is unavailable. Unpacks packed-ARGB `clear(color: number)` to Float32Array for CK. Pass to `Renderer.setCanvas()`. |
| `PostFxSurface` | Interface: `width`, `height`, `sceneCanvas()`, `onscreenCanvas()`, `clear(bgRgb)`, `fadeTrail(bgRgb, alpha)`, `composite(globalIntensity)`, `flush()`, `resize(w, h)`, `dispose()`. |
| `createPostFxSurface(kit, canvas, chain)` | **Bridge piece.** Returns `PostFxSurface \| null`. Creates a pair of offscreen surfaces (scene + ping-pong) plus a WebGL onscreen surface, and runs the caller-supplied `@flare-engine/postfx` `EffectChain` at composite time. Pass a new empty `EffectChain()` for a passthrough surface. |

**Typical web setup:**
```ts
const kit = await loadCanvasKit('/assets/canvaskit.wasm');
const mod = createWebSkiaModule(kit);
const renderer = createFrameRenderer(mod);   // from @flare-engine/render
renderer.beginFrame(width, height, time);
// … draw sprites …
const pic = renderer.endFrame();
// replay pic onto a CK surface via drawPicture
```

### `@flare-engine/engine` (< 2KB gzip)

`createGame(config) → GameInstance` — pure factory. Constructs `World`, `Camera2D`, `Renderer`, `SpriteBatch`, `InputManager`, `AudioManager`, `AssetManager`, `SceneManager`, `GameLoop` and returns them with `start()` / `stop()`. Does **not** own the render loop or Skia canvas lifecycle — those belong to `@flare-engine/react`.

`src/index.ts` also re-exports all 15 lower `@flare-engine/*` packages (`math`, `events`, `core`, `ecs`, `render`, `input`, `physics`, `audio`, `assets`, `scene`, `animation`, `particles`, `tilemap`, `debug`, `react`) as a convenience umbrella. This is the one place tree-shaking is deliberately sacrificed for DX — every other package follows the named-export, no-barrel rule.

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
| `createStorage({ adapter, schema, version, migrations? })` | Returns a `Storage<T>` with: low-level `get/set/delete`, `saveSlot(name, data)`, `loadSlot(name) → T \| null` (runs migrations then schema), `deleteSlot(name)`, `listSlots() → string[]`, `exportJSON()`, `importJSON(json)` (clears existing keys first). Slots are stored under `slot:<name>`; version envelope is `{ version, data }`. |
| `createDocumentStore({ adapter, key, version, migrations?, parse, onFirstRun? })` | Single-document versioned store. Inverse of `createStorage`'s N-slot model: one in-memory doc under a caller-supplied `key`. `parse(raw) → T` is the caller-supplied lenient parser (expected to handle `undefined` on first run; must not throw). `onFirstRun(doc) → T` is called on first run (absent key) or silent corrupt-data fallback — return value is saved and returned by `load()`. `load() → Promise<T>` migrates forward then calls `parse`; silent fallback to `parse(undefined)` → `onFirstRun` on unparseable/malformed data. `get() → T` throws if `load()` has not been called. `save(doc) → Promise<void>`. `exportJSON() → string` (same `{ version, data }` envelope as `createStorage`). `importJSON(json) → Promise<T>`. |
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
| `CrashPayload`                                            | `{ name, message, stack?, timestamp, context? }`. Stable shape for transports and bug reporters.                                                                              |
| `createCrashPayload(err, context?)`                       | Normalizes any thrown value (`Error`, string, unknown) into a `CrashPayload`. Attaches optional `context` record for scene/level/user metadata.                               |
| `CrashTransport`                                          | `{ send(payload): void \| Promise<void> }`. Pluggable sink — Sentry, console, HTTP, etc.                                                                                      |
| `createNoopTransport()` / `createConsoleTransport(tag?)`  | Built-in transports for dev and tests.                                                                                                                                        |
| `createSentryTransport({ dsn?, environment?, release?, sampleRate?, enabled? })` | Lazy-loaded `@sentry/react-native` transport. Returns noop if `dsn` is missing or `enabled === false`. Imports the SDK on first capture; degrades to noop on import failure. `@sentry/react-native` is an **optional peer dependency** — never bundled. |
| `composeTransports(...transports)`                        | Fan-out helper. Returns a `CrashTransport` whose `send` calls every child sequentially; per-child failure is caught + logged but never aborts the chain. Empty input → valid noop transport. |
| `ErrorBoundary`                                           | React class component. Props: `fallback: (err, reset) => ReactNode`, `onError?(payload)`, `transport?`, `context?`. Catches render-time errors, forwards to transport, renders fallback with a `reset()` that clears state. |

**Implementation notes:**

- React is a **peer dependency** — package declares `react >= 19` and lists it as `external` in `tsup.config.ts`.
- Component is a class (required for `componentDidCatch` / `getDerivedStateFromError`). All other exports are plain functions.
- Tests instantiate the class directly and stub `setState`; no DOM/JSDOM required.

---

### `@flare-engine/testing` (< 4KB raw)

Deterministic test helpers for ECS games. Pure dev-time package — never bundled into apps.

| API                                                  | Description                                                                                                                                                                                   |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createFakeClock()`                                  | Deterministic `requestFrame` / `cancelFrame` replacement. `advance(ms)` fires pending callbacks in order. `reset()` clears queued frames and elapsed time.                                    |
| `createTestWorld(opts?)`                             | Wires a `World` + `GameLoop` + fake clock together. Options: `{ fixedDt?, maxDt? }`. Returns `{ world, loop, clock, step(dt), stepFrames(n, dt) }` — call `step` / `stepFrames` in tests instead of `loop.start()`. |
| `MockInputManager`                                   | Extends `@flare-engine/input` `InputManager` with `press(id, x, y)`, `move(id, x, y)`, `release(id)`, `tap(x, y)` for scripted pointer sequences. No native bridges.                           |
| `serializeScene(world, components)`                  | Snapshots every entity's matching component data into a stable JSON-ish object. Stable key order enables diffing.                                                                             |
| `snapshotsEqual(a, b)`                               | Deep equality for two scene snapshots. Useful for regression tests that record a known-good state.                                                                                            |
| `createBenchSession(opts?)` | `opts: { seed?: number }` (default seed = 1). Saves `Math.random`, installs a `SeededRNG(seed)`-backed replacement. Returns `BenchSession { rng, setFlag, getFlag, done, whenDone, end }`. `done()` resolves `whenDone` (idempotent — second call is a no-op, never rejects). `end()` restores `Math.random` (idempotent). Flags stored in a plain `Record<string, boolean>`; `getFlag` returns `false` if unset. **Do not nest sessions.** |
| `defineSnapshot<S>(schema)` | `schema: SnapshotSchema` — `{ [key: string]: SnapshotProjector }` where `SnapshotProjector = { query: readonly ComponentDef<unknown>[], project(world, id): unknown }`. Returns a `(world: World) => { [K in keyof S]: readonly unknown[] }` snapshot function. For each key: queries matching entity ids, sorts ids for call-to-call stability, maps `project(world, id)`. Acceptable to allocate one array per key per call — not a hot path. |

**Implementation notes:**

- Depends on `@flare-engine/core`, `@flare-engine/ecs`, `@flare-engine/input`, `@flare-engine/math` (all `workspace:*`, all `external` in tsup).
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
| `resolveLayout(container, children)`                            | Pure flex-like resolver. Inputs: `{ width, height, direction: 'row' \| 'column', gap?, padding?, justifyContent?, alignItems? }` + per-child `{ basis?, grow?, crossSize? }`. Returns `LayoutRect[]`. |
| `Panel`                                                         | Themed container. Variants: `surface` \| `elevated`. Padding + radius tokens.                                                                                                                          |
| `Label`                                                         | Themed `<Text>`. Variants: `xs…xl`. Tones: `default`, `muted`, `accent`, `danger`, `success`, `warning`. Optional `mono`.                                                                              |
| `Button`                                                        | Focusable, themed button. Variants: `primary`, `secondary`, `ghost`, `danger`. Auto-registers with `FocusManager` when present; draws a focus ring on focus. `tabIndex` controls traversal order.      |
| `ProgressBar`                                                   | 0..1 bar. Clamps NaN / out-of-range values. Theme-driven track + fill, overridable.                                                                                                                    |
| `HUDBar`                                                        | Labeled `ProgressBar` for HP / MP / XP. Color by `kind` (`hp` → danger, `mp` → accent, `xp` → success, `custom`). Optional numeric readout.                                                            |
| `List`                                                          | Row or column stack with consistent gap (theme default or explicit).                                                                                                                                   |
| `Modal`                                                         | Absolute-positioned overlay with backdrop and centered `Panel`. Dismiss via `onBackdropPress` (omit for non-dismissable).                                                                              |

**Implementation notes:**

- React + React Native are **peer deps**; the package itself only ships theme tokens, focus logic, layout math, and thin view wrappers.
- `FocusManager` is the single source of truth for keyboard / gamepad navigation. Drivers (keyboard listener, gamepad dpad) just call `next` / `prev` / `activate`. Gamepad wiring lands in stage 11.4 without any UI-kit changes.
- `resolveLayout` is pure and allocation-light (one output array); useful for Skia-rendered HUD that needs deterministic pixel positions outside the React Native flex engine.
- Component tests are thin (export-check) because bun-test has no RN runtime; the heavy-logic modules (`theme`, `focus`, `layout`) are fully unit-tested.
- Pan Tvardowski menus + HUD consume `@flare-engine/ui` end-to-end (M9.1).

---

### `@flare-engine/input` — gamepad + remap (stage 11.4 extension)

Extends the existing input package with poll-based gamepad state, a platform-agnostic source, and a persistent remap table. Touch/pointer APIs are unchanged.

| API                                                              | Description                                                                                                                                                                       |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GamepadButton` / `GamepadAxis`                                  | W3C Standard Gamepad constants (A..Home, LeftX..RightY).                                                                                                                          |
| `GamepadState` / `GamepadSnapshot`                               | Poll-time state (`connected`, `buttons[]` with `pressed` / `value` / `pressedThisFrame` / `releasedThisFrame`, `axes[]`, `timestamp`) vs raw snapshot (just values, no edges).    |
| `createGamepadState(index?, buttons?, axes?)`                    | Allocates a fresh state with zeroed buttons and axes.                                                                                                                             |
| `updateGamepadFromSnapshot(state, snapshot, deadZone?)`          | Applies a snapshot in place; recomputes `pressedThisFrame` / `releasedThisFrame`; zeroes axes inside the dead zone and rescales beyond; handles disconnect (`null` snapshot).     |
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
| **Weather PostFx Effects** | `createWeatherRain(id?, uniforms?) → Effect`, `createWeatherSunShaft(id?, uniforms?) → Effect`, `createWeatherDarkVignette(id?, uniforms?) → Effect`, `createWeatherClouds(id?, uniforms?) → Effect`. EffectKind values: `weather-rain \| weather-sun-shaft \| weather-dark-vignette \| weather-clouds`. All consume `uniform shader src` and layer over the scene. Packed uniforms: rain=[resW,resH,intensity,direction,scrollOffsetY,color.r,color.g,color.b,density,streakLen] (**10 floats**; color defaults `[1,1,1]`; density default `0.5`; streakLen default `0.15`); sun-shaft=[resW,resH,intensity,direction]; dark-vignette=[resW,resH,intensity]; clouds=[resW,resH,intensity,scrollOffsetX]. `WeatherRainUniforms` has optional `color?: readonly [number,number,number]` (default `[1,1,1]`), optional `density?: number` (default `0.5`, fraction of columns carrying a drop), optional `streakLen?: number` (default `0.15`, lit fraction of each repeat period). `scrollOffsetY` is a **normalized fall phase in [0,1)** — caller increments by `speed * dt / screenHeight` and wraps with `fract` each tick. SKSL exports: `WEATHER_RAIN_SKSL`, `WEATHER_SUN_SHAFT_SKSL`, `WEATHER_DARK_VIGNETTE_SKSL`, `WEATHER_CLOUDS_SKSL`. Rain model: aspect-corrected UV rotated by `direction`; column sawtooth `fract(fallAxis * tiling - scrollOffsetY + phase)` produces falling streaks (not whole-column blink); hash-based dropout keeps `density` fraction of columns active; 2 parallax layers (near: COLS=45/tiling=6/brightness=1.0; far: COLS=85/tiling=11/brightness=0.5) combined with `max`; thin per-column xMask; alpha-over `mix` blend (not additive). No refraction tap. `COMPOSITE_SKSL` composite pass adds `uniform float3 weatherColor` (default `[1,1,1]`) at packed indices [19,20,21] plus `weatherDensity` [22] and `weatherStreakLen` [23] (**24 floats total**); `CompositeUniforms` has `weatherColor`, `weatherDensity`, `weatherStreakLen`. `weatherScrollY` [18] is a normalized [0,1) fall phase (same contract as standalone). |

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

**Responsibility.** Central accessibility state. Consumed by `animation`, `postfx`, and `ui` to dampen or neutralize motion/contrast/scale per user preference. Full screen-reader pass deferred to 0.3.0.

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
| `flare tiled-to-flare <tmj> [--out <file>] [--embed-tilesets]` | Tiled `.tmj` → normalized runtime JSON consumed by `@flare-engine/tilemap`. Flattens object layers, resolves external tilesets, drops editor-only metadata. |
| `flare new <name> [--template blank\|topdown\|shmup] [--package-manager bun\|npm\|pnpm]` | Thin alias that spawns `create-flare-app` with the same args. Present so `flare` is a single discoverable entrypoint. |
| `packAtlas(opts: AtlasPackerOptions): Promise<AtlasResult>` | Programmatic form of `pack-atlas`. Returns `{ jsonPath, imagePath, frames, width, height }`. |
| `convertTiled(opts: TiledConvertOptions): Promise<TiledResult>` | Programmatic form of `tiled-to-flare`. Returns `{ outPath, layers, tilesets }`. |
| `AtlasPackerOptions` / `TiledConvertOptions` | Exported TS types mirroring the CLI flags. |

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

**Responsibility.** 0.1.0 partial slice per build-plan §11.10: entity inspector, time scrub, pause/step. Web surface is a floating panel; native surface is a minimal HUD overlay. Zero overhead when the provider is not mounted — mirrors the tree-shake pattern from `@flare-engine/debug`. Full devtools parity (network inspector, profiler flamegraph, asset inspector) deferred to 0.2.0.

| API | Description |
| --- | --- |
| `DevtoolsProvider` | React context. Subscribes to a `World` + `GameLoop`, owns the snapshot ring buffer, exposes controls via context. Props: `{ world, loop, config? }`. |
| `<DevtoolsPanel />` | Web-only full panel. Entity tree, component inspector, time controls. No-op on native. |
| `<DevtoolsHUD />` | Native-only compact overlay. Tap entity → inspector sheet. Pause/step/scrub buttons. No-op on web. |
| `useEntityInspector()` | Hook returning `{ selected, select(entity), components }`. Reads from World; never mutates. |
| `useTimeScrub()` / `TimeScrubber` | Hook + imperative controller. `.rewind(frames)` restores a snapshot from the ring buffer; `.resume()` clears the scrub state. |
| `createSnapshotRingBuffer(size, source)` | Pre-allocated ring buffer of snapshots. `source` is `World.serialize` by default, or a user-supplied callback for consumers without ecs integration. |
| `pause()` / `step()` / `resume()` | Imperative controls on the provider context. Also wired to HUD/panel buttons. |
| `DevtoolsConfig` | `{ ringSize?: number = 120, captureInterval?: number = 1, enabledOnNative?: boolean = true }`. |
| `isDevMode()` | Returns `true` when the Metro/bundler `__DEV__` constant is defined and truthy. Safe to call anywhere — uses `typeof __DEV__` (no reference error on undeclared identifier). **Note:** `isDevMode()` is NOT constant-folded by Metro like a bare `__DEV__` reference; use bare `__DEV__` where dead-code elimination matters. Use `isDevMode()` where you need a callable function (e.g. passing to a config object, conditional import guard, test stub). |

**Implementation notes:**

- Peer deps: `react`, `react-native`. Hard deps: `@flare-engine/events`, `@flare-engine/ecs`, `@flare-engine/core`, `@flare-engine/react`.
- Tree-shaken via `__DEV__` guard in the package entry so production bundles drop the whole module when providers aren't mounted.
- Ring buffer pre-allocates snapshot objects at construction and reuses them in place — no per-frame allocation.
- Snapshot source is pluggable: defaults to `World.serialize()` if available, falls back to user callback. API may firm up in 0.2.0.
- Tests: logic unit tests (ring buffer wrap/rewind, snapshot diff), plus one React Testing Library smoke test on `DevtoolsPanel`.
- `isDevMode` uses `declare const __DEV__: boolean | undefined` so TypeScript accepts the global without `@ts-ignore`. The `declare` is file-scoped (not ambient-global) — callers on other runtimes (Vite, Jest) set `globalThis.__DEV__` instead.

---

## Layer 6: Platform Integrations (Tier-2 stubs, 0.1.0 interface-only)

Each package ships the provider interface + a default `Noop*Provider` + a React context + a `use*()` hook + payload types. **No concrete platform adapters at 0.1.0** — consumers wire their own adapter at the app boundary. Concrete providers land in 0.2.0 per the roadmap tables below.

---

### `@flare-engine/leaderboards` (< 1KB raw, interface-only)

**Responsibility.** Leaderboard submission + query interface. Consumer-supplied adapter at 0.1.0; 0.2.0 roadmap: Game Center, Google Play Games, Steam.

| API | Description |
| --- | --- |
| `LeaderboardsProvider` | Interface: `submitScore(id, score, meta?)`, `getTopN(id, n)`, `getPlayerRank(id)`. All async, return typed promises. |
| `NoopLeaderboardsProvider` | Default export. Returns empty arrays / `null` rank. Resolves submissions silently. |
| `LeaderboardsContext` / `useLeaderboards()` | React context + hook. `useLeaderboards()` returns the provider or throws if unmounted. |
| `ScoreEntry` / `LeaderboardId` | Payload + ID types. `ScoreEntry`: `{ playerId, displayName, score, rank, meta? }`. |

**Implementation notes:**

- No runtime deps beyond `@flare-engine/events`. React peer dep only for the context + hook.
- Interface is intentionally minimal — pagination, time-window filters, and friends-only queries land in 0.2.0 alongside concrete providers.

---

### `@flare-engine/achievements` (< 1KB raw, interface-only)

**Responsibility.** Achievement unlock + query interface. Consumer-supplied adapter at 0.1.0; 0.2.0 roadmap: Game Center, Google Play Games, Steam.

| API | Description |
| --- | --- |
| `AchievementsProvider` | Interface: `unlock(id, progress?)`, `getState(id)`, `getAll()`. All async. Partial progress (0–1) supported; adapters clamp and persist. |
| `NoopAchievementsProvider` | Default export. Returns `{ unlocked: false, progress: 0 }` for any id. |
| `AchievementsContext` / `useAchievements()` | React context + hook. |
| `AchievementId` / `AchievementState` | Payload types. `AchievementState`: `{ id, unlocked, progress, unlockedAt? }`. |

**Implementation notes:**

- No runtime deps beyond `@flare-engine/events`. React peer dep only.
- `unlock()` is idempotent by contract — adapters must dedupe; the interface does not enforce this at the type level.

---

### `@flare-engine/iap` (< 1KB raw, interface-only)

**Responsibility.** In-app purchase interface. Consumer-supplied adapter at 0.1.0; 0.2.0 roadmap: RevenueCat, App Store StoreKit, Google Play Billing.

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
| `EntitlementStore` / `createEntitlementStore(opts?)` | Reactive set of granted `EntitlementKey`s with `grant(key)`, `grantProduct(catalog, productId)`, `revoke(key)`, `isEntitled(key)`, `list()`, and an `onChange: Signal<EntitlementKey[]>`. `EntitlementStoreOptions` accepts an `initial` snapshot for hydration from save. |

**Implementation notes:**

- No runtime deps beyond `@flare-engine/events`. React peer dep only.
- Receipt validation is adapter-local — the interface does not expose receipt bytes at 0.1.0. May extend in 0.2.0.
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
| `<PaywallModal>` | Soft-dismissible single-product modal. `visible` owned by parent — modal never hides itself except on successful purchase. Calls `entitlementStore.grant(entitlementKey)` + `onPurchased` + `onDismiss` on success. |
| `PaywallModalProps` | `{ visible, productId, entitlementKey, entitlementStore, strings, localize, onDismiss, onPurchased?, onError? }`. |
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

### `@flare-engine/analytics` (< 1KB raw, interface-only)

**Responsibility.** Event tracking interface. Consumer-supplied adapter at 0.1.0; 0.2.0 roadmap: PostHog, Amplitude, Segment, Firebase Analytics.

| API | Description |
| --- | --- |
| `AnalyticsProvider` | Interface: `track(event, props?)`, `identify(userId, traits?)`, `screen(name, props?)`, `flush()`. All return `Promise<void>`. |
| `NoopAnalyticsProvider` | Default export. Resolves immediately; retains nothing. |
| `AnalyticsContext` / `useAnalytics()` | React context + hook. |
| `AnalyticsEvent` / `AnalyticsContext` (type) | Payload types. `AnalyticsEvent`: `{ name, props?, timestamp }`. |

**Implementation notes:**

- No runtime deps beyond `@flare-engine/events`. React peer dep only.
- Batching, sampling, and offline queueing are adapter concerns — the interface is deliberately thin so any analytics SDK can back it.

---

### `@flare-engine/haptics` (< 1KB raw, interface-only)

**Responsibility.** Tactile-feedback interface for weapon / impact / bomb feel. Consumer-supplied adapter at 0.1.0; 0.2.0 roadmap: a concrete `@flare-engine/haptics-expo` adapter wrapping Expo Haptics.

| API | Description |
| --- | --- |
| `HapticsProvider` | Interface: `impact(style?)`, `notification(type?)`, `selection()` (all `Promise<void>`), plus an enabled gate `isEnabled()` / `setEnabled(enabled)`. Cue methods mirror the iOS `UIFeedbackGenerator` family so any platform SDK can back it. |
| `NoopHapticsProvider` | Default export. Cues resolve immediately and fire nothing; `isEnabled()` returns `false` (no backend) and `setEnabled` is inert. |
| `HapticsContext` / `useHaptics()` | React context + hook. |
| `HapticImpactStyle` / `HapticNotificationType` | Payload types. `HapticImpactStyle`: `'light' \| 'medium' \| 'heavy' \| 'soft' \| 'rigid'`. `HapticNotificationType`: `'success' \| 'warning' \| 'error'`. |

**Implementation notes:**

- No runtime deps. React peer dep only for the context + hook.
- The enabled gate lets the user's haptics setting and the reduced-motion gate (`@flare-engine/a11y`) live in one place instead of at every call site — when disabled, cue methods are no-ops.

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
- Not barrelled into `@flare-engine/engine` (curated, matches XP6/XP7). Initial 0.2.0 lockstep release, publish owner-gated.

