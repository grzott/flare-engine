# Package Findings Ledger — 2026-07-02

Per-package detail behind [engine-deep-audit-2026-07.md](engine-deep-audit-2026-07.md). Every bug row was independently re-verified against code (file:line) by a second adversarial agent; "gaps" and "improvements" are the auditors' judgment. Maturity = readiness for a public OSS release: production / solid / stub / interface-only / unproven.

## Maturity map (41 dirs)

| Package | Maturity | LOC | Tests | One-liner |
|---|---|---|---|---|
| math | production | 1,452 | 367 | Excellent tests; missing curves + richer intersection; easing-count drift (32/42/35) |
| events | production | 146 | 27 | Throwing-handler wedge + nested-emit flaw in the engine-wide Signal backbone |
| core | production | 636 | 75 | No interpolation alpha; coroutine cancel skips `finally`; AppLifecycle docstring lies |
| ecs | production | 711 | 80 | Permanent queries (no dispose); cap is process-global not per-world; README example doesn't compile |
| render | production | 2,820 | 170 | Rotation contract bug; no flip/blend/9-slice/cull; frame-renderer tested only from react package |
| render-web | solid | 600 | 30 | Strongest-tested bridge; loader poisons on bad wasmUrl; per-frame buildPass allocs |
| shapes | solid | 810 | 48 | PT vocabulary in public API (ShipSpec, folio comments, hardcoded palette); RN-Skia types force casts |
| postfx | production | 1,443 | 155 | buildPass allocates per frame; PT comments in public surface; README doesn't compile |
| input | production | 920 | 59 | No keyboard at all; Pointer.delta overwrite; phantom gesture-handler peer |
| physics | solid | 749 | 68 | Honest detection-only; no MTV; duplicate-add stale entry; O(n²) broadphase by design |
| audio | production | 449 | 30 | Dead `rate` option; false auto-suspend claim; no decode helper; web path real but invisible |
| assets | production | 593 | 33 | No default loaders (all plumbing caller-supplied); rotated/trimmed atlas frames silently wrong |
| simulation | solid | 945 | 33 | Excellent physics oracles; zero consumers of the published API; `?? 0` guards in O(n²) loops |
| progression | production | 520 | 84 | Strongest tests in features tier; 7-positional rollInto footgun |
| particles | solid | 356 | 27 | Pool cap not enforced (unbounded alloc); point emission only; no render adapter; fixed seed |
| animation | production | 491 | 75 | No delay/repeat/yoyo; "timeline" promised in package.json, none exists; README import fails |
| pathfinding | unproven | 1,009 | 54 | Heap corruption >4096 nodes; phantom documented API; zero consumers, one commit ever |
| scene | production | 404 | 37 | Restart-current-scene reuses destroyed instance; transitions never await onPreload; no pause/resume |
| tilemap | solid | 823 | 41 | Flip GID bits unmasked; LDtk multi-tileset + collision path broken; no parser validation |
| dialogue | solid | 469 | 42 | Silent end on dangling id; cycle = stack overflow; actions can't mutate variables |
| debug | production | 718 | 59 | Perf toolkit is the hidden gem; README documents a nonexistent API and never mentions it |
| devtools | stub | 511 | 17 | Inspector shows 20 entity IDs via a `nextId` cast; hard RN peer blocks pure web; React surface untested |
| testing | production | 338 | 38 | Genuinely useful headless kit; serializeScene leaks N+1 permanent queries per call |
| storage | production | 826 | 101 | importJSON wipes before validating; runMigrations gap-skip contradicts doc; no localStorage adapter |
| errors | solid | 221 | 21 | Render-phase errors only — no global/async capture; Sentry path native-only |
| localization | production | 372 | 44 | Plural rules integer-assuming; t() re-parses per call; no missing-key diagnostics |
| deep-links | solid | 325 | 20 | Scheme-URL host swallow breaks the standard RN shape; no reverse routing |
| share | unproven | 389 | 22 | CONFIRMED broken capture (FORMAT_CODES); native transport drops screenshots; dead ExpoSharingLike export |
| a11y | solid | 270 | 47 | No OS-preference source shipped; no persistence recipe; alias-only attachCamera/attachPostfx |
| haptics | interface-only | 72 | 5 | Zero consumers; README + api-specs promise a 0.2.0 adapter that never shipped |
| ui | solid | 1,195 | 40 | Focus ring never re-renders; no input driver; no Slider/Toggle; 12 typeof-only component tests |
| ui-shop | solid | 402 | 11 | ShopPanel name collision with ui; backdrop dismissable mid-purchase; self-parity tests |
| react | production | 964 | 147 | Per-frame setState churn + RuntimeShader realloc; RN-only (no subpath); dead gesture-handler peer |
| engine | production | 247 | 19 | Barrel RN-only; GameConfig shadowing; "re-exports all packages" is 15 of 40, undocumented curation |
| cli | solid | 585 | 11 | tiled-to-flare default out path ENOENT; `flare new` EINVAL on Windows; `--version` lies (0.0.0) |
| create-flare-app | unproven | 301 | 12 | private:true @ 0.0.0; stamps ^0.0.0; install-step EINVAL on Windows; shmup/blank render black screens |
| leaderboards | interface-only | 61 | 5 | README documents nonexistent methods; stale 0.2.0 adapter promise; no local provider |
| achievements | interface-only | 58 | 5 | Same; unlock/progress semantics ambiguous for adapter authors |
| iap | solid | 277 | 20 | Real EntitlementStore logic; priceMicros doc says cents; no consumable/pending story |
| iap-revenuecat | solid | 239 | 8 | Restore re-grants expired subs; listener unsubscribe never works; tx id is a date |
| analytics | interface-only | 59 | 5 | Dead AnalyticsEvent type; no console/memory provider; stale 0.2.0 promise |

Counts: production 15 · solid 14 · stub 1 · interface-only 4 · unproven 3 (+ create-flare-app dir at 0.0.0). Test totals verified by re-count; audit figures reproduced exactly except audio (30, not 37).

## Verified bugs by package (file:line)

**events** — `signal.ts:39-50`, `emitter.ts:54-71`: no try/finally around emit; throwing handler leaves `iterating=true` so off()/remove() defer indefinitely; nested emit resets the shared flag early. Also: handlers added during emit run in that same emit (live Set iteration); "we iterate a copy" test comment is false; emit docstring claims zero-alloc but `...args` + for..of iterator allocate per call — 5 emits per frame from GameLoop.

**core** — `game-loop.ts:96-120`: interpolation alpha never exposed. `coroutine.ts:54-56,86-91,108`: cancel/clear never call `gen.return()` (finally blocks never run); `instanceof Promise` misses thenables. `app-lifecycle.ts:4-9`: docstring claims RN AppState auto-pause; class is manual-only. `pool.ts`: no double-release guard. `screen.ts:98-127`: designToScreen/screenToDesign allocate per call. Verifier correction: `Clock.repeat` does NOT drift (deficit carried at `clock.ts:94`); only coroutine number-waits drop overshoot.

**ecs** — `world.ts:110-161`: queries only ever pushed, no removal API; every spawn/add/remove iterates all registered queries. `component.ts:20,29-31`: 32-type cap is module-global (README says "per world"; HMR burns slots). README `defineComponent` example fails TS. `Prefab.spawn` declares an `overrides` param the implementation ignores. Documented happy path requires the underscore-internal `sys._worldFn`.

**math** — README says 32 easings, easings.ts header says 42, actual 35. README `rng.float()` example → TS2554 / NaN at runtime (needs args). No curves; intersection boolean-only; Transform2D/Rect always allocate.

**render** — `frame-renderer.ts:120` radians contract vs degree-taking backends (ledger #2); `render-system.ts:145` `null as unknown as SkImageLike` default Sprite; `sprite-batch.ts:192-221` per-frame Batch-bucket + commands[] allocation (only command objects are pooled); `frame-renderer.ts:831-860` postfx pass path allocates at two layers; README example doesn't compile; skia peer required despite zero runtime imports.

**render-web** — `web-surface.ts:39-42`, `web-skia-module.ts:86-89`: rotate forwarded verbatim ("dormant mismatch"), api-specs.md:295 claims the opposite. `loader.ts:8-26,52`: non-OK fetch body used as wasm binary; rejected singleton never cleared → one bad URL poisons the page. `postfx-surface.ts:102,155`: buildPass + Color4f allocate per frame. README: loadCanvasKit() without required wasmUrl; `surface.getCanvas()` doesn't exist.

**shapes** — public `ShipSpec` + `glow:'friendly'|'hazard'` with hardcoded PT palette (`draw.ts:33-39`), "folio XIIIa" comments (`types.ts:159-166`); RN-Skia concrete types force `as never` casts for CanvasKit callers; per-call `Skia.Path.Make()` despite "allocation-free" claim; silent null on malformed SVG; gradient-rect is two solid halves.

**postfx** — `runtime.ts:144,175-229`: fresh Float32Array per pass per frame, no buildPassInto. Controller doc comments cite PT/Phase 11.14/session #196; `triggerTimed` optional on the interface but always implemented; README examples invert the real add/factory signatures; weather speed/direction uniforms are silent no-ops; console.info on first compile unsilenceable.

**input** — no keyboard module anywhere. `pointer.ts:63-68`: delta overwrites same-frame motion (doc says accumulate). pollGamepads + applyRemap allocate per poll. Phantom peer react-native-gesture-handler. README order footgun: pollGamepads() before update() wipes just-computed edges. GestureDetector: dual time sources; per-pinch-frame allocations.

**physics** — `collision-world.ts:77-79` + `spatial-index.ts:27-50`: duplicate add leaves stale broadphase record. Boundary semantics: aabbVsAabb/circleVsCircle strict `<` but aabbVsCircle `<=`. Raycast disconnected from CollisionWorld, allocates per hit. README example wrong signature; also logs `pair.a/pair.b` vs real `entityA/entityB`.

**audio** — `sfx-pool.ts:8`: `rate` declared, never applied, interface lacks playbackRate. README + api-specs.md:140 claim auto-suspend on background; nothing wires it. README example wrong on three counts. No decodeAudioData path. `onended` declared readonly but package's own code casts to assign it.

**assets** — no default loaders (web fetch / RN file) — all plumbing caller-supplied. `Promise.all` load: one failure rejects all, partial cache ambiguous. Rotated/trimmed TexturePacker frames silently mis-render. unload/clear never dispose SkImage. README awaits a sync function. decodeImage module shape matches RN-Skia only; no CanvasKit adapter shipped.

**simulation** — 105 `?? 0` guards incl. the O(n²) inner accumulators (`nbody.ts:85-95`); body-0-is-black-hole convention + palette breakpoints baked in; resize discards contents; zero consumers of the published API (barrel excludes it; page still runs byte-identical local twins pending its D2–D5 rows).

**progression** — `drop-roll.ts:48-56`: rollInto's two adjacent raw 0-1 rolls are swappable with no type error; pity fires unconditionally over the chance gate (documented only in tests); no serialization helpers; no DAG cycle validation; price curve hardwired geometric.

**particles** — cap is prewarm-only: core `pool.ts:23-27` falls through to factory and the emitter checks only `config.maxParticles`, ignoring the ctor arg → unbounded per-frame allocation past prewarm. README/api-specs document a phantom API (speed ranges, packed colors, shared pool, texture field). LCG seed hardwired 1; reset() flips emitting=false and restores neither emission nor determinism. No emitter shapes, no render adapter, class-based in a no-classes repo.

**animation** — README imports easeOutQuad from animation (lives in math) — fails. package.json promises "timeline"; none exists. Chained tweens: standalone chains stall (only TweenManager advances), and chaining drops overshoot dt PLUS one full frame (`tween-manager.ts:33-37`). Hard dep on assets drags the skia peer into headless installs. No delay/repeat/yoyo, no cancel-one.

**pathfinding** — `astar.ts:163`, `jps.ts:117`: heap capacity min(total, 4096), never grows; overflow bubbles NaN over valid entries (worse than no-op). README/api-specs document never-shipped signatures (object args, `result.found`, flat cells, JPS weighted-cost fallback — JPS ignores costs). A* blocks corner-cutting, JPS permits it. findPath allocates 4 full-grid arrays + per-node objects per call. One commit ever, zero consumers.

**scene** — `scene-manager.ts:215`: transition path fire-and-forgets async onPreload (onInit/onEnter run before assets). `scene-manager.ts:57` + destroy path: go(currentScene) reuses the destroyed instance with its stale World — "restart scene" accumulates state. push/pop lack transitions and pause/resume semantics; README shows a 3-arg go() that doesn't exist.

**tilemap** — no `gid & 0x1FFFFFFF` mask anywhere: flipped tiles resolve the wrong (last) tileset and lose solid flags. LDtk: all tiles forced into first tileset's GID space, flip flags ignored, IntGrid never populates solidTiles → extractColliders returns [] for LDtk. parseTiled blind-casts JSON; base64/infinite/external-tsx fail silently. extractColliders: no rect merging. Dead exported type TileData. README constructor wrong.

**dialogue** — `runner.ts:93-96`: missing node id → silent end(). `runner.ts:164-180`: branch/action recursion, no visit cap → cycle = RangeError. VariableBag fixed at start(); no serialization for save/resume. README examples 100% nonexistent signatures.

**debug** — README documents an API that doesn't exist and omits the real selling points (perf recorder/frame budget/boot trace). package.json claims the "entity inspector" that lives in devtools. DebugOverlay + FpsWidget allocate per frame (commands, ~7 strings).

**devtools** — `hooks.ts:26`: `(world as unknown as {nextId})` cast; comment promises an iterator "may land in 0.2.0" (never did). Inspector = first 20 entity IDs, no component data. Hard react-native peer + module-scope RN imports in the "web-only" panel (Platform guard runs after the import throws). step() inert unless host polls consumeStep() — undocumented. README props wrong.

**testing** — `scene-snapshot.ts:25-31`: N+1 permanent world.query per serializeScene call (leak per ledger #18); redundant ALL query. Two overlapping snapshot APIs, zero guidance. benchSession silently patches global Math.random. package.json homepage points at github.com/grzott/engine (wrong repo). README snippet fails under noUncheckedIndexedAccess.

**storage** — `storage.ts:132`: importJSON clears before validating entries → invalid payload wipes storage. `migrations.ts:13-42`: doc claims throws-on-gap; code silently skips (only defineMigrationChain enforces). Dead `__flare_version` writes nothing reads. No localStorage adapter. README: `migrate: (old: any)` in a repo that bans `any`; claims a react-native-mmkv peer the manifest doesn't declare. Verifier correction: input does NOT consume storage (comment only) — PT is storage's sole production proof.

**errors** — only React render-phase capture; no unhandledrejection/onerror/ErrorUtils wiring (grep-confirmed zero). Sentry transport hardwired to @sentry/react-native (no web path); init at first report loses early crashes. README `createConsoleTransport('crash')` — takes no args.

**localization** — README constructor example wrong. No `{`/`}` escaping (ICU quoting unsupported, no diagnostic). Plural rules misclassify fractions/negatives in pl/ru. t() silently returns the key on miss — no dev warning; t() re-parses/allocates per call (per-frame HUD trap).

**deep-links** — `parse.ts:23-34`: first token after `://` eaten as host → `myapp://zone/4` never matches `/zone/:id` (standard RN Linking shape); README itself demonstrates the broken pattern plus a wrong 2-arg constructor. No buildUrl reverse routing.

**share** — `capture.ts:41`: FORMAT_CODES {png:3, jpeg:2} vs RN-Skia ImageFormat {JPEG=3, PNG=4, WEBP=6} — png silently emits JPEG bytes; jpeg passes kICO (likely null). Native transport silently drops payload.screenshot (image share is web-only despite the pitch). ScreenshotTarget dimensions decorative. Dead ExpoSharingLike export. README payload field wrong. `bytes as unknown as BlobPart` casts; hardcoded 'screenshot.png' in canShare even for jpeg.

**a11y** — no OS-preference source shipped (matchMedia/AccessibilityInfo left to every consumer); no persistence recipe; attachCamera/attachPostfx are literal aliases of attach (`bridge.ts:55-56`); no color-blindness distinguishability check.

**haptics** — README:3,29,33 + api-specs.md:797 promise @flare-engine/haptics-expo "at 0.2.0"; repo is 0.2.1, no such package, zero consumers repo-wide. Noop setEnabled inert / isEnabled always false — consumer toggle code untestable against the default.

**ui** — `focus-provider.tsx:16-25` + `button.tsx:46`: focus changes never re-render (stable context value + unchanged children refs; Button reads focus unsubscribed) — the ring is likely visually dead. No keyboard/gamepad/input driver exists anywhere; navigation linear-only. No Slider/Toggle/TextInput/scroll list. primitives.test.ts = 12 typeof checks. README Button example uses children; API requires `label` prop.

**ui-shop** — `PaywallModal.tsx:71`: backdrop dismisses mid-purchase (only Buttons gated). ShopPanel name collides with ui's different ShopPanel. Mount-once fetch, no retry/refetch. Tests re-implement logic in test bodies (self-parity).

**react** — `game-view.tsx:177-237`: setPicture+setPasses per frame, fresh arrays defeat bailout, RuntimeShader elements + 4 inline handlers + style array re-created per render. Module-scope RN imports block web/headless for even the pure hooks; no subpath. Dead required peer react-native-gesture-handler. GameView config silently mount-only. README: nonexistent `designResolution`; VirtualJoystick `onChange` (real: `onStateChange`).

**engine** — `index.ts:32`: `export * from '@flare-engine/react'` makes the barrel RN-only (PT scripts crashed on it twice). `index.ts:2` explicit GameConfig shadows react's GameView GameConfig with no TS error. peerDeps omit react-native-safe-area-context (required at module scope via react) while listing never-imported gesture-handler. Description says "re-exports all packages"; it's 15 of 40, curation undocumented. Verifier correction: `designResolution` appears only in engine/react READMEs, NOT in api-specs.

**cli** — `tiled-to-flare.ts:164-167`: default out path embeds an absolute path inside join() → ENOENT without -o (all tests pass -o). `cli.ts:93-98`: spawn('npx.cmd', shell:false) → EINVAL on Node ≥20.12 Windows (CVE-2024-27980 fix); targets the unpublished create-flare-app name (squattable). `cli.ts:36`: hardcoded .version('0.0.0'). README `--embed-tilesets` doesn't exist (only `--no-embed-tilesets`); programmatic snippet uses wrong option names.

**create-flare-app** — `cli.ts:31-36` + `scaffold.ts:149`: flareVersion never passed → templates stamp ^0.0.0 (in the shipped dist too). private:true @ 0.0.0. `scaffold.ts:96-104`: install-step spawn `${pm}.cmd` shell:false → same Windows EINVAL. Templates: shmup spawns Position-only entities (nothing paints; bullets leak, alloc-in-update in the starter); blank's "single sprite" absent; safe-area-context missing from deps; exact heavy pins (skia 2.4.18/RN 0.83.4/expo 55) will rot; template `.gitignore` will be stripped by npm packlist; topdown is the one honest template (real Tiled→collider wire, behavioral tests) but ships the repo's only shipped-to-users `as unknown as` cast (App.tsx:58). Negative token-replacement tests assert the wrong syntax (vacuous).

**leaderboards / achievements / analytics** — interface+Noop+context (~60 LOC each). All three READMEs: "Stub-only at 0.1.0; adapters land at 0.2.0" at v0.2.1; leaderboards documents nonexistent submit/fetch; achievements documents nonexistent setProgress; analytics exports a dead AnalyticsEvent type. All link .claude/skills + the private PT repo. No local/dev providers.

**iap** — real logic, best of tier-2. priceMicros JSDoc says "cents" while name + RevenueCat adapter use micros. No consumable pattern (grants:[] product = silent no-op), no 'pending' PurchaseResult status (iOS ask-to-buy must misreport as failed), persistence recipe undocumented.

**iap-revenuecat** — `provider.ts:41`: restore maps entitlements.all (includes expired) → re-grants lapsed subs; local SDK type doesn't even model `.active` (fix needs a type change). `provider.ts:155-180`: onTransaction emits only entitlements[0] per update AND unsubscribe never works (listener nulled synchronously before the async add completes — unconditional leak, not just a race). purchase() tx id = originalPurchaseDate string. getProducts/restore swallow all errors into [].

## Cross-cutting findings

1. **README examples fail to compile in ~24 of 41 packages** (verified per group: 3/4 foundation, 3/4 rendering, 3/4 systems, 2/5 features-a, 6/6 features-b, 4/7 platform, 3/4 ui-integration, 3/7 tooling). Every README's relative api-specs link 404s on npm; every install line fails until the access flip. One compile-every-snippet day fixes the whole class.
2. **Peer-dependency policy is inconsistent:** skia required-but-unused in render/shapes/assets (drags RN into web installs — bit the page repo); dead gesture-handler peers in input/react/engine; missing safe-area-context peer in engine; audio's react-native-audio-api and storage's README-claimed mmkv peer both phantom.
3. **Zero-alloc discipline is strong in cold paths, violated at the hottest seams:** Signal.emit rest-args (5×/frame), SpriteBatch bucket allocs, postfx buildPass, react per-frame JSX, gamepad polling, DebugOverlay/FpsWidget, localization t(). One "hot-path allocation" arc would close most of it.
4. **The missing ecs primitives (query.dispose + entity iterator) cause three independent hacks** (serializeScene leak, devtools nextId cast, per-frame-query landmine documented in memory). Fix at the root.
5. **PT vocabulary leaks in public surfaces** (shapes ShipSpec/palette/folio comments; postfx PT/session comments) — violates the repo's own agnostic rule.
6. **Silent-failure culture in content pipelines** (tilemap blind casts, dialogue silent end, scene go() no-op on unknown name, share/revenuecat error swallowing): fine for a solo owner, hostile to OSS users; add dev-mode validation as a policy.
7. **Class vs factory convention split** (Layer-3-era classes vs newer factories) and two ShopPanels / two GameConfigs — decide and document before the API freezes at public flip.
8. **Test realness is genuinely high repo-wide** (known-answer oracles, bit-sweeps, behavioral suites) with two exceptions: ui (typeof shells) and ui-shop (self-parity). The gate's blind spots are doc drift and fakes-vs-real-enum constants (the share bug class) — a per-package "contract test against the real dependency's enums" pattern would close the latter.

## Consumer-repo signals (fresh)

**Pan-Tvardowski** (clean, pushed, e0f35f5): carried by engine(64)/ecs(51)/math(39) imports at ^0.2.1; rolls its own particle/FX stack while declaring-but-never-importing particles and tilemap (dead deps); phantom deps debug + input (used, undeclared); keep-locals that are engine API bugs in disguise (imperative integrate, drop-pity shape, multi-track resolveStats, capstone fallback, test-safe __DEV__, RN-native-driver hooks); haptics named in PT docs as "the one true engine gap". A 159 MB APK sits untracked at repo root.

**flare-engine-page**: NOT deployed; hero demos runtime-import 6 packages at 0.2.1 but simulation/render-web remain declared-not-imported (local byte-identical twins; D2–D5 rows); the render/assets required-skia-peer bug pulled RN-Skia 2.6.9 + native tree into this web-only site; "October 2026" in 7+ strings; typedoc gated off; guides link the private repo; Lighthouse 98–100 already; PT showcase placeholders, no Berek entry.

**grzott-portfolio**: zero engine code runs (confirmed again — no deps, no lockfile hits, no CDN); the imitation is `apps/web/src/lib/dynamics/` (556 lines, 5 files, DOM-free rigid-body core written as a deliberate lift donor) + collapse glue; the engine-attribution copy needs updating to match reality; as of 2026-07-02 the owner's v3 work made the bake seedable → the byte-identical-bake migration gate is implementable; donor needs a zero-alloc pass before any lift; seed.sql copy also needs updating to match reality.
