# Flare Engine — Module API Specifications

> Living document. Update alongside code changes — divergence is a spec bug.

---

## Layer 0: Foundation

### `@flare-engine/math` (< 5KB gzip)

| API                                                           | Description                                                                                                                                          |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Vec2`                                                        | `{x,y}` object. Static methods: `add`, `sub`, `scale`, `normalize`, `dot`, `cross`, `length`, `distance`, `lerp`, `rotate`, `angle`, `clampLength`. `vec2(x,y)` factory. Zero-alloc forms take an `out` param. |
| `Rect`                                                        | AABB. `contains(point)`, `intersects(rect)`, `intersection`, `union`, `expand`, `center`, `fromPoints`                                               |
| `Circle`                                                      | Position + radius. `contains`, `overlaps` with Rect/Circle                                                                                           |
| `Transform2D`                                                 | Position (Vec2) + rotation (radians) + scale (Vec2). `localToWorld()`, `worldToLocal()`                                                              |
| `Mat3`                                                        | 3x3 on Float32Array. `multiply`, `translate`, `rotate`, `scale`, `invert`, `identity`                                                                |
| `Color`                                                       | RGBA. `lerp`, `toHex`, `fromHex`, `toSkColor`                                                                                                        |
| `clamp`, `lerp`, `inverseLerp`, `map`, `degToRad`, `radToDeg`, `approxEquals`, `wrap`, `pingPong`, `smoothStep`, `sign` | Scalar utils                                                                                              |
| `easings`                                                     | 32 functions (quad/cubic/quart/quint/sine/expo/circ/back/elastic/bounce In/Out/InOut + linear, step, springIn/Out/InOut). Tree-shakeable named exports. |
| Random                                                        | `SeededRNG` class. Top-level `randomFloat(min, max)`, `randomInt(min, max)`, `randomVec2InRect(rect)`, `randomPointInCircle(cx, cy, r)`, `shuffle`, `choose` |
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
| `GameLoop`         | `start()`, `stop()`, `pause()`, `resume()`. Signals: `onUpdate(dt)`, `onFixedUpdate(fixedDt)`, `onLateUpdate(dt)`, `onPreRender()`, `onPostRender()` |
| `Clock`            | `elapsed`, `dt`, `fixedDt`, `fps`, `timescale`, `frame`. `schedule(delay, cb)`, `repeat(interval, cb)`                                               |
| `AppLifecycle`     | `onBackground`, `onForeground`, `onMemoryWarning` signals. `background()` / `foreground()` / `memoryWarning()` methods for the host to invoke. Dt capping on resume is owned by `GameLoop.resume()`. |
| `ScreenManager`    | Design resolution, scale modes: `FIT` (letterbox), `FILL` (crop), `STRETCH`. `resize(w, h, pixelRatio?)`, `setSafeAreaInsets(t, r, b, l)`. Exposes `safeArea: Rect`. |
| `CoroutineManager` | Generator-based. `yield number` = wait seconds (scaled time), `yield undefined` = wait 1 frame, `yield Promise` = wait async.                        |
| `Pool<T>`          | `acquire()`, `release(obj)`, `prewarm(count)`. Generic object pool.                                                                                  |

### `@flare-engine/ecs` (< 8KB gzip)

| API                                   | Description                                                                                                                              |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `World`                               | `spawn() → entityId`, `destroy(entityId)`, `add<T>(entityId, def, data?)`, `remove(entityId, def)`, `get<T>(entityId, def)`, `query(...defs) → Query`, `addSystem(fn, priority?)`, `step(dt)`. Max 32 component types per world. |
| `Query`                               | Iterable. `onEntityAdded`, `onEntityRemoved` signals. Archetype bitmask caching.                                                         |
| `defineComponent<T>(name, defaults?)` | Type-safe component factory. Returns `ComponentDef<T>` used by `world.add/get/remove`.                                                  |
| `defineSystem(query, fn)`             | Helper that binds a query to a per-frame update fn. Register with `world.addSystem(sys._worldFn)`.                                       |
| `definePrefab(name, components)`      | Prefab factory function                                                                                                                  |
| `FSM`                                 | Lightweight state machine. `onEnter`, `onExit`, `onUpdate`, transitions.                                                                 |

**Built-in components:** Position, Velocity, Rotation, Scale, Parent (from math types).

**Performance:** Object-per-component storage in a Map per ComponentDef. Archetype bitmask on each entity for O(1) query membership. SoA Float32Array storage is **deferred** — add only if benchmarks show it matters.

---

## Layer 2: System Modules

### `@flare-engine/render` (< 10KB gzip)

| API             | Description                                                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Renderer`      | Manages Skia canvas. `setCanvas(canvas)`, `begin(clearColor?)`, `end()`, `applyCamera(...)`. Tracks `stats.drawCalls`. `canvas` getter throws outside `begin/end`. |
| `SpriteBatch`   | Wraps Skia `<Atlas>`. `draw(image, frame, x, y, w?, h?, effect?)` queues a sprite; `drawRaw(image, sx, sy, sw, sh, dx, dy, dw, dh)` for raw source rects; `flush(drawAtlas, renderer?)` groups commands by `(image, effect)` identity and invokes the callback once per batch. Sharing an effect reference across entities maximizes batch size. |
| `Camera2D`      | `position`, `zoom`, `rotation`, `viewport`, `bounds`, `shake(...)`. Allocating: `worldToScreen`, `screenToWorld`, `getBounds`. Zero-alloc: `worldToScreenInto(x, y, out)`, `screenToWorldInto(x, y, out)`, `getBoundsInto(out)`. `follow(target, opts?)` replaces any previous follow target; use `unfollow()` to stop. |
| `sortByDrawOrder` | In-place insertion sort by `.z`. Optional `length` param to sort only the first N entries (useful for pooled arrays). Mutates input; nearly-sorted frame-to-frame input makes it O(n). |
| BMFont text     | Functional cluster for bitmap text: `parseBMFontJSON(json)` → `BitmapFont`, `measureText(font, str)` → pixel width, `drawText(batch, font, str, x, y, opts?)` queues glyphs through `SpriteBatch`. `getKerning(font, prev, curr)`. Batches with sprites. |
| `RenderSystem`  | `createRenderSystem(world, query, positionDef, spriteDef, batch)` returns a per-frame fn. Queries entities with Position+Sprite, sorts by z, queues into `batch`. **Does not call `batch.flush()`** — the frame owner flushes once per frame across all draw sources. |
| `SpriteEffects` | `tint(color, amount)`, `flash(color, sec)`, `grayscale(amount)`, `outline(color, width)`, `custom(shader, uniforms)`. Effects are **immutable**; `updateEffect(effect, dt)` returns a new effect (or same reference if time-invariant) or `null` on expiry. |
| `SpriteData`    | ECS component type: `{ image, frame, z, width?, height?, effect? }`. `Sprite` is a pre-registered `ComponentDef<SpriteData>` for drop-in use.                |

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

**Tier 2 — planck.js integration: deferred.** `PhysicsWorld`, `RigidBody`, `applyForce`, `applyImpulse` are not implemented. Revisit after Phase 8 benchmarks — only bring it in if AABB proves insufficient.

### `@flare-engine/audio` (< 4KB gzip)

| API            | Description                                                                                |
| -------------- | ------------------------------------------------------------------------------------------ |
| `AudioManager` | `init()`, `suspend()`, `resume()`. Manages AudioContext.                                   |
| `SFXPool`      | Pre-decoded buffers. `play(name, opts?)`. Polyphony management (max N, oldest killed).     |
| `Music`        | `play`, `stop`, `crossfadeTo`. One track at a time, loops by default.                      |
| `createChannels(ctx)` | Factory returning a `Channel` map keyed by `ChannelName` (`master`, `sfx`, `music`). Gains 0.0–1.0. In-memory only — MMKV persistence is deferred. |

Auto-suspends on app background, resumes on foreground.

### `@flare-engine/assets` (< 6KB gzip)

| API            | Description                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------- |
| `AssetManager` | `load(manifest)` → Promise. `get(key)`. `progress` (0-1), `onProgress` signal.               |
| `AssetLoader`  | Function type `(entry) => Promise<unknown>`. Injected by the host (e.g. `@flare-engine/react`).     |
| `Texture`      | Wraps Skia SkImage                                                                           |
| `SpriteSheet`  | Parsed from TexturePacker JSON (hash + array) / Aseprite JSON                                |
| `SpriteFrame`  | `{ name, x, y, w, h }` — one frame in an atlas.                                              |
| `createProceduralAtlas(Skia, frames, opts?)` | Builds an `SkImage` + `SpriteSheet` from `{ name, w, h, color }[]`. Row-packs by `maxWidth`, honors `padding`. Narrow `SkiaAtlasModuleLike` is injected by the caller so `@flare-engine/assets` stays runtime-agnostic. |

Audio buffer types are defined in `@flare-engine/audio` (`AudioBufferLike`), not here.

---

## Layer 3: Feature Modules

### `@flare-engine/scene` (< 4KB gzip)

| API             | Description                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `SceneManager`  | `register(name, factory: () => Scene)`, `go(name, data?)`, `push(name)`, `pop()`                                                              |
| `Scene`         | Interface, not a class. Optional hooks: `onPreload`, `onInit`, `onEnter`, `onUpdate`, `onDraw`, `onExit`, `onDestroy`                         |
| Transitions     | Factory functions: `noneTransition()`, `fadeTransition(duration?)`, `slideTransition(duration?, direction?)`. Each returns a `Transition` with a `kind: 'none' \| 'fade' \| 'slide'` discriminator so renderers apply the right visual effect (alpha vs. translate). |

### `@flare-engine/animation` (< 5KB gzip)

| API                                    | Description                                                                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `createSpriteAnimator(sheet)`          | Returns animator state. `playAnimation(state, name)`, `updateAnimator(state, dt)`. Tick-based.  |
| `tween(from, to, duration, easing?)`   | Returns `Tween` state object. `updateTween(tween, dt)` → value. Chain via `chainTween`.         |
| `spring(config)`                       | `{stiffness, damping, mass, target}`. `updateSpring(spring, dt)` → value.                       |
| `TweenManager`                         | `addTween(mgr, tween)`, `updateTweens(mgr, dt)`. Auto-removes completed.                        |

Animation APIs are functional (state object + free functions), not class-based — consistent with ECS/render style and tree-shakeable.

### `@flare-engine/particles` (< 4KB gzip)

| API               | Description                                                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ParticleEmitter` | Config: rate, lifetime, speed, direction, spread, gravity, start/end color/size/alpha, texture                                                      |
| `ParticlePool`    | Pre-allocated. No GC during gameplay. `acquire()`, `update(dt, gx, gy)`, `getSize(p)`, `getAlpha(p)`, `getColor(p)` (shared buffer), `getColorInto(p, out)` (caller buffer). |

Uses immediate mode (PictureRecorder) at the draw layer — this package owns particle data and lifecycle, not rendering. Target: 200-500 particles at 60fps.

### `@flare-engine/tilemap` (< 8KB gzip)

| API               | Description                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `parseTiled(json)`     | → `TilemapData`. Orthogonal maps, tile/object layers, properties, collision shapes.                   |
| `parseLDtk(json)`      | → `TilemapData`. Levels, tile/entity layers, enums.                                                   |
| `TilemapRenderer`      | Owns its own `SpriteBatch`. `draw(camera, flush)` culls, queues tiles, then calls `flush(this.batch)`. |
| `extractColliders(data)` | → `TileCollider[]`. Extracts solid tiles → collision shapes for physics.                             |

### `@flare-engine/debug` (< 3KB gzip, tree-shaken in prod)

- Collision bounds, entity origins, velocity vectors overlay
- FPS, entity count, draw calls, atlas usage stats
- `createFpsWidget(opts?)` — formatter that consumes a `DebugStats` snapshot and exposes a compact one-line summary (`"60 FPS | 16.7ms | e:42 d:8"`) plus a multi-line breakdown. Rendering-agnostic: hosts draw the strings via Skia `canvas.drawText`, an RN `<Text>` overlay, or anything else.
- Pause, step-frame, slow-motion via `timeScale`
- Entity-inspector (tap to log components) — deferred

---

## Layer 4: Integration

### `@flare-engine/react` (< 10KB gzip)

| API                     | Description                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `<GameView>`            | Root component. Skia Canvas + game loop + input. Props: `config`, `onReady`, `style`, `children`                   |
| `<VirtualJoystick>`     | Overlay RN component                                                                                              |
| `<VirtualButton>`       | Overlay RN component                                                                                              |
| `<LoadingScreen>`       | Full-screen asset-preload overlay. Props: `progress` (0–1, clamped), `message?`, `barColor?`, `trackColor?`, `textColor?`, `style?`. Pure RN View + Text so it works before `<GameView>` mounts its Skia canvas. |
| `useGame()`             | Returns the full `GameContextValue`: `{ world, camera, input, audio, assets, scenes, loop, renderer, batch }`      |
| `useEntity(query)`      | Subscribe to ECS query changes (returns a snapshot array; React re-renders on add/remove)                          |
| `useGameLoop(callback)` | Register a per-frame function on `loop.onUpdate`                                                                  |

### `@flare-engine/engine` (< 2KB gzip)

`createGame(config) → GameInstance` — pure factory. Constructs `World`, `Camera2D`, `Renderer`, `SpriteBatch`, `InputManager`, `AudioManager`, `AssetManager`, `SceneManager`, `GameLoop` and returns them with `start()` / `stop()`. Does **not** own the render loop or Skia canvas lifecycle — those belong to `@flare-engine/react`.

`src/index.ts` also re-exports all 14 lower `@flare-engine/*` packages as a convenience umbrella. This is the one place tree-shaking is deliberately sacrificed for DX — every other package follows the named-export, no-barrel rule.

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
| `createStorage({ adapter, schema, version, migrations? })` | Returns a `Storage<T>` with: low-level `get/set/delete`, `saveSlot(name, data)`, `loadSlot(name) → T \| null` (runs migrations then schema), `deleteSlot(name)`, `listSlots() → string[]`, `exportJSON()`, `importJSON(json)` (clears existing keys first). Slots are stored under `slot:<name>`; version envelope is `{ version, data }`. |

**Implementation notes:**

- All adapter ops are async so the same API works against sync (MMKV) and async (IndexedDB) backends.
- `createMmkvAdapter` takes the MMKV instance as an argument — the package does not import `react-native-mmkv` itself, keeping it bun-testable and avoiding a native peer dep at the `@flare-engine/storage` layer.
- The schema validator covers primitives + object/array/optional/literal/union. Full Zod parity (refinements, transforms, effects) is out of scope; save data is simple enough.

---

### `@flare-engine/errors` (< 2KB raw)

React error boundary + structured crash payloads for the OSS launch reliability substrate.

| API                                                       | Description                                                                                                                                                                   |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CrashPayload`                                            | `{ name, message, stack?, timestamp, context? }`. Stable shape for transports and bug reporters.                                                                              |
| `createCrashPayload(err, context?)`                       | Normalizes any thrown value (`Error`, string, unknown) into a `CrashPayload`. Attaches optional `context` record for scene/level/user metadata.                               |
| `CrashTransport`                                          | `{ send(payload): void \| Promise<void> }`. Pluggable sink — Sentry, console, HTTP, etc.                                                                                      |
| `createNoopTransport()` / `createConsoleTransport(tag?)`  | Built-in transports for dev and tests.                                                                                                                                        |
| `ErrorBoundary`                                           | React class component. Props: `fallback: (err, reset) => ReactNode`, `onError?(payload)`, `transport?`, `context?`. Catches render-time errors, forwards to transport, renders fallback with a `reset()` that clears state. |

**Implementation notes:**

- React is a **peer dependency** — package declares `react >= 18` and lists it as `external` in `tsup.config.ts`.
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

**Implementation notes:**

- Depends on `@flare-engine/core`, `@flare-engine/ecs`, `@flare-engine/input` (all `workspace:*`, all `external` in tsup).
- `createFakeClock` returns functions compatible with `GameLoop`'s `tick` / `cancelTick` hooks — no monkey-patching required.
- Reverse usage: `@flare-engine/core` tests may import from `@flare-engine/testing` as a dev-only consumer (turbo's package graph remains acyclic — testing → core runtime, core → testing devDep).

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
- `apps/demo` menus + HUD port to `@flare-engine/ui` is a separate integration task (stage 11.3 task 4).

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
| `EffectKind`                                                                   | Union: `'vignette' \| 'grayscale-flash' \| 'chromatic-aberration' \| 'crt' \| 'bloom'`.                                                                                |
| `createVignette` / `createGrayscaleFlash` / `createChromaticAberration` / `createCrt` / `createBloom` | Factory helpers returning an `Effect` (id, enabled, typed uniforms). Sensible defaults per effect.                                                |
| `EffectChain`                                                                  | Ordered pipeline: `add` / `insert` / `remove` / `move` / `get` / `setEnabled` / `setUniforms` (kind-checked) / `clear` / `enabled()` iterator. Duplicate ids throw.    |
| `createPostFxRuntime(skia)`                                                    | Compiles shaders against a Skia-like module: `compile(kind)` (cached), `packUniforms(effect, w, h)` (per-kind Float32Array), `buildPass(chain, w, h) → CompiledPass[]`. |
| `CompiledPass`                                                                 | `{ id, kind, shader, uniforms }` — what the renderer consumes per-effect per-frame.                                                                                    |
| `VIGNETTE_SKSL` / `GRAYSCALE_FLASH_SKSL` / `CHROMATIC_ABERRATION_SKSL` / `CRT_SKSL` / `BLOOM_SKSL` | Raw shader sources, exported for advanced consumers.                                                                                      |

**Implementation notes:**

- Skia is a **peer dependency** (`@shopify/react-native-skia`). Runtime uses an injected `SkiaPostFxModuleLike` so the orchestration is fully testable without a GPU.
- `supported` reports whether `Skia.RuntimeEffect.Make` exists; callers fall through to a no-op pipeline when unsupported (explicit fallback path).
- Uniform layouts are per-kind Float32Arrays (see `packUniforms`); resolution is passed via `(width, height)` for shaders that need it.
- Actual pixel composition is the renderer's job — this package owns effect state, uniform packing, and shader caching.

