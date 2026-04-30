# Flare Engine — Module API Specifications

> Living document. Update alongside code changes — divergence is a spec bug.
>
> Last refreshed against `packages/*/src/index.ts`: **2026-04-28**.

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
- Not used by `apps/pan-tvardowski` (shmup) — verified by integration tests in `packages/pathfinding/tests/`.

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
- Used by `apps/pan-tvardowski` for the inter-zone dialogue card stack and boss banter.

---

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
| `<GameView>`            | Root component. Skia Canvas + game loop + input. Props: `config`, `onReady`, `style`, `children`, `safeArea?`. If `safeArea` is omitted, insets are resolved from `react-native-safe-area-context` (optional peer dep) and fall back to zero. |
| `<VirtualJoystick>`     | Overlay RN component                                                                                              |
| `<VirtualButton>`       | Overlay RN component                                                                                              |
| `<LoadingScreen>`       | Full-screen asset-preload overlay. Props: `progress` (0–1, clamped), `message?`, `barColor?`, `trackColor?`, `textColor?`, `style?`. Pure RN View + Text so it works before `<GameView>` mounts its Skia canvas. |
| `useGame()`             | Returns the full `GameContextValue`: `{ world, camera, input, audio, assets, scenes, loop, renderer, batch }`      |
| `useEntity(query)`      | Subscribe to ECS query changes (returns a snapshot array; React re-renders on add/remove)                          |
| `useGameLoop(callback)` | Register a per-frame function on `loop.onUpdate`                                                                  |
| `useSafeArea()`         | Returns the `SafeArea` insets `{ top, right, bottom, left }` from the nearest `<GameView>`. Throws `'useSafeArea must be used inside a <GameView>'` if called outside one. |
| `SafeArea`              | Type: `{ top: number; right: number; bottom: number; left: number }`. Device safe-area insets in logical pixels. |
| `SafeAreaContext`       | `React.Context<SafeArea \| null>`. Provided by `<GameView>`; `null` outside it. Prefer `useSafeArea()` for direct consumption. |

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
| `createSentryTransport({ dsn?, environment?, release?, sampleRate?, enabled? })` | Lazy-loaded `@sentry/react-native` transport. Returns noop if `dsn` is missing or `enabled === false`. Imports the SDK on first capture; degrades to noop on import failure. `@sentry/react-native` is an **optional peer dependency** — never bundled. |
| `composeTransports(...transports)`                        | Fan-out helper. Returns a `CrashTransport` whose `send` calls every child sequentially; per-child failure is caught + logged but never aborts the chain. Empty input → valid noop transport. |
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
- `apps/pan-tvardowski` menus + HUD consume `@flare-engine/ui` end-to-end (M9.1).

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

**Implementation notes:**

- Single hard dep: `@flare-engine/events` (`Signal`).
- Plural parser handles top-level branches only — nested `{…, plural, …}` is not supported (not needed for our message catalogue).
- Malformed placeholders emit the remainder literally instead of throwing — safer during locale hot-reload.

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

**Implementation notes:**

- No platform wiring; hosts bridge OS prefs (`AccessibilityInfo.isReduceMotionEnabled`, `prefers-reduced-motion`) by calling `update()` on startup.
- Single hard dep: `@flare-engine/events` (`Signal`).

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
| Template `topdown` | Player with 4-direction movement, tilemap + camera follow, one enemy prefab. Exercises `tilemap` + `input` + `ecs`. |
| Template `shmup` | Auto-fire player, enemy spawner, HUD score — minimum vertical-slice shmup. Exercises `particles` + `audio` + `scene`. For the full-scope showcase, see `apps/pan-tvardowski`. |
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

**Implementation notes:**

- Peer deps: `react`, `react-native`. Hard deps: `@flare-engine/events`, `@flare-engine/ecs`, `@flare-engine/core`, `@flare-engine/react`.
- Tree-shaken via `__DEV__` guard in the package entry so production bundles drop the whole module when providers aren't mounted.
- Ring buffer pre-allocates snapshot objects at construction and reuses them in place — no per-frame allocation.
- Snapshot source is pluggable: defaults to `World.serialize()` if available, falls back to user callback. API may firm up in 0.2.0.
- Tests: logic unit tests (ring buffer wrap/rewind, snapshot diff), plus one React Testing Library smoke test on `DevtoolsPanel`.

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

**Responsibility.** Reusable React Native shop UI primitives. Three components: `ShopPanel` (smart, fetches products + tracks entitlements), `PaywallModal` (single-product soft-dismissible modal), and `RestorePurchasesButton` (one-tap restore + entitlement re-grant). Apps pass catalog data and localized copy via props; the engine handles the purchase loop, loading states, error banners, and entitlement reactivity. No i18n framework dependency — all text goes through a host-supplied `LocalizeFn`.

| API | Description |
| --- | --- |
| `<ShopPanel>` | Smart component. Reads `IAPContext` via `useIAP()`. Fetches products on mount; splits them into owned / available sections based on `EntitlementStore`. Calls `entitlementStore.grantProduct(id)` on confirmed purchase. |
| `ShopPanelProps` | `{ catalog, entitlementStore, copy, strings, localize, onPurchase?, onError? }`. |
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
- Peer deps: `react >=18`, `react-native >=0.74`.
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

