# UI Canvas: plan (2026-11-23)

- **Status:** approved by the owner on 2026-11-23, every decision in §7. Gate 0 round 1 ran on the
  phone the same day: G0-0 and G0-7 passed with fixes, G0-2 done, G0-1's mount half done, E1's cause
  found. The issues in §10 are created after this document lands.
- **Evidence:** [ui-canvas-2026-11-measurements.md](ui-canvas-2026-11-measurements.md). Every speed claim below points at a measured row there, and
  its §2.5 lists what those measurements cannot show.
- **When:** the open Gate 0 items are measurement only, in the spike apps outside the repo, and run
  now in the hand lane. Build work starts after `0.5.0` (UI FX ships there) in the "UI Canvas"
  milestone.
- **Name:** `@flare-engine/ui-canvas` (D2).

---

## 1. What we would build, in one paragraph

A component package whose components are **drawn by Skia on the UI thread**, not built from native
views. Developers write JSX they already know (`<Panel>`, `<Text>`, `<Button>`, `<Grid>`), pass
fast-changing values as shared values fed from signals or game state, and animate every component
with ui-fx: the same presets and chains (`sequence`, `parallel`, `stagger`, `delay`) that animate RN
views and DOM elements. Theme, focus navigation and layout come from `@flare-engine/ui`, so canvas
and native screens share one look and one gamepad focus. A thin layer of invisible native views
gives touch, scrolling physics and screen-reader access, and interactive components give haptic
cues. The ECS feeds game data in; it does not hold the UI.

**Who it is for:** dense, animated, game-like UI: menus, inventories, shops, HUDs, reward screens,
effect-heavy app screens. **Not for:** forms, text input, plain long lists, document-like pages.
Those stay native views (FlashList, Legend List) or DOM, which the measurements show are already fast.

**Where it sits among the UI packages (D15):**

| Package (tier) | Job |
|---|---|
| `ui` (3.5) | Shared base: theme, focus navigation, layout; native-view components for app-style screens (forms, settings, shop) |
| `ui-fx` (4) | Animation for every host: presets, chains, enter / exit / press, reduced motion; RN views and DOM today, canvas through ui-canvas's driver |
| `ui-canvas` (4, new) | Skia-drawn components for dense, animated game UI; uses `ui` and `ui-fx` |
| `a11y` (2.5) | Accessibility settings (reduce motion, contrast) and contrast checks |
| `haptics` (2.5) | Haptic cues |

`ui` cannot import `ui-fx` (3.5 is below 4); its components are animated by wrapping them in ui-fx's
`createFlareComponent` once they forward their host props (E7).

**What the measurements support (Pixel 7, measurements §3.0 and §3):**

| Workload | Native views (presented fps) | Canvas, stock RN-Skia | Canvas with the `TextureView` fix | Status |
|---|---|---|---|---|
| 100 animated elements, 90 Hz | 89.9 (Reanimated) | 44.9 | 89.8; UI thread 6.5 ms per frame | tie |
| 1,000 animated elements, 90 Hz | 18.2-18.4 | 44.9-89.9, varies by run | 89.8; 7.8 ms | canvas 5x |
| 3,000 animated elements, 90 Hz | 6 | 89.9 | 89.9; 9.2 ms | canvas 15x |
| 100 / 1,000 animated, 60 Hz | 59.9 (100) | 30.0 / 29.9 | 59.9 / 59.9 | tie, then canvas |
| 100 HUD labels changing every frame | 72 (React state), 46 (Reanimated text) | 44.9-66 | 89.8 | canvas ahead |
| Open a 1,000-card screen | 497 ms | 88 ms declarative, 75 ms one picture | same | canvas 5-6x; Paragraph and shadow views will narrow it (G0-1, G0-6) |
| Scroll 1,000 plain rows | FlashList: no slow frames, 0 blank | same | - | no gain: keep FlashList |

The canvas's half rate came from RN-Skia's `TextureView` handoff, not from Android (measurements §3.0).
With a small fix the canvas presents at the display rate at 90 and 60 Hz, so **G0-0 passes**, on the
condition that the fix ships (D14).

---

## 2. Approaches considered

### 2.1 Where the UI is drawn

| Option | Measured | Verdict |
|---|---|---|
| **R1. Native views, optimised** (FlashList, Reanimated) | Lists keep up; 300 animated views 66 fps presented, 1,000 at 19, 3,000 at 6 | Keep for lists and forms. Cannot carry dense animation |
| **R2. Canvas from the JS thread through GameView** | JS loop at 45 Hz on its `SurfaceView` (E1); 90 Hz on a `TextureView` with an empty scene, about 53 Hz at 1,000 sprites (7.6 ms of JS work); content follows the JS thread's rate | Rejected as the base |
| **R2b. Canvas recorded on the JS thread, drawn on the UI thread** | 45-71 presented at 1,000 elements; JS work 6.9 ms; slows with JS | Fallback for content only JS can produce |
| **R3. Canvas drawn on the UI thread** (worklets + RN-Skia) | With the fix: 89.8-89.9 presented at 100-3,000 elements at 90 Hz, 59.9 at 60 Hz, unaffected by a blocked JS thread | **Recommended** |

### 2.2 How developers write it

| Option | Measured on Hermes | Verdict |
|---|---|---|
| A. React custom reconciler only | 1,000 nodes: mount 7.9 ms (microbench), 81 ms build in the app; re-render with 10% changed 5.4 ms | Fine for structure, too slow for per-frame values |
| B. Direct ECS calls plus signals | spawn 1.6 ms, update 0.5 ms | Fast, unfamiliar, verbose (Bevy's pain) |
| C. Immediate mode | would pay A's or B's cost every frame | Rejected: Hermes is 10-40x slower than desktop engines; no retained tree for accessibility |
| **D. JSX for structure, shared values / signals for hot values** | structure as A; hot updates 0.15 ms per 100 changes | **Recommended** |

### 2.3 Where UI state lives

| Option | Measured | Verdict |
|---|---|---|
| The game's ECS World | 4.5x slower to create, 3.5x slower to update than plain objects; not readable from worklets | No. The ECS stays the game's data source |
| UI state in the rendering layer's own tree, hot values in shared values | the configuration that produced every UI-thread measurement | **Recommended** |

### 2.4 Which native drawing layer (decided by G0-1)

| Branch | What it is | Evidence | Default |
|---|---|---|---|
| **A. Declarative RN-Skia** | Components render RN-Skia JSX nodes (`Group`, `RoundedRect`, `Paragraph`, `Atlas`); animated props are shared values evaluated on the UI thread | Every UI-thread number in the measurements (`u2`, `u3`) was measured this way. Mount of 1,000 cards: 88 ms, against 75 ms for B's best case (1.17x) | **Start here** |
| B. Own compositor | Own reconciler into a typed-array node store; one packet per change; a worklet draws per-node pictures and atlases | Only pieces measured: per-frame composition of two pictures (`u1`), atlas buffers (`u2`) | Only if G0-1 shows A failing on mount, memory or a realistic scene |

Branch A is far smaller: no reconciler, no node store, no packet transfer and no compositor to
write. RN-Skia already does those, on the UI thread, and is a dependency Flare has. Branch B is the
escape hatch if RN-Skia's tree is too slow to mount or too heavy in memory.

---

## 3. Design (branch A)

### 3.1 Shape

```
   app code                         ui-canvas (JS thread)                       UI thread
 ┌───────────────┐            ┌────────────────────────────────┐          ┌──────────────────────────┐
 │ JSX           │──render───▶│ components emit RN-Skia nodes   │─commit──▶│ RN-Skia scene, drawn on  │
 │ <Panel>,<Grid>│            │ layout + focus from ui, text    │  once    │ the UI thread            │
 └───────────────┘            │ measure + Paragraph cache,      │          │ animated props from      │
 ┌───────────────┐  per frame │ virtualization, hit boxes,      │          │ shared values + ui-fx    │
 │ signals, ECS  │──one write▶│ ui-fx runtime + canvas driver    │          │ closed-form presets      │
 │ bindings      │  (hot)     └────────────────────────────────┘          └──────────────────────────┘
 └───────────────┘                         │ visible interactive nodes                ▲
                                           ▼                                          │ offset, presses
                              ┌────────────────────────────────┐                      │
                              │ shadow layer: invisible native │──────────────────────┘
                              │ views for touch and TalkBack,  │
                              │ ScrollView proxy for fling     │
                              └────────────────────────────────┘
```

- **Structure** changes go through React once and commit an RN-Skia scene.
- **Hot values** (HP, score, timers) go from signals or ECS bindings into shared values, once per
  frame; the UI thread draws them. Measured: 100 labels presented at 85.7-89.9 when fed from JS
  (`SurfaceView`), 89.8 with UI-thread values and the fix.
- **Presentation:** the host owns the `TextureView` fix (D14) until RN-Skia ships one, and never
  uses the `SurfaceView` path for UI (40 ms queue-to-present and a blocked UI thread, measurements §3.0 C).
- **Animation** never touches JS per frame. ui-canvas implements ui-fx's `LiveDriver` and
  `FxTarget` for Skia nodes and plugs them into ui-fx's runtime (D10, D18), which already runs
  enter, exit, press, timelines and reduced motion. Each animating node's pose comes from
  `livePoseAtInto`, a worklet (`packages/ui-fx/src/core/live.ts:290`), mapped to a Skia `Group`
  (4x4 matrix for 3D tilt, opacity, a colour matrix for brightness, a shadow). Snapshot presets
  (shatter, disintegrate, dust) use the node's own recorded picture: no screen capture.
- **Scrolling** uses a native `ScrollView` proxy for platform physics.
- **Touch and accessibility:** invisible native views for visible interactive nodes only; the full
  contract is §3.5. Cost measured in G0-3.
- **Haptics:** interactive components cue through `@flare-engine/haptics` (§3.6).

### 3.2 Package layout

| Entry | Contents | Runs on |
|---|---|---|
| `@flare-engine/ui-canvas/core` | text measure interface and cache (with the OS font scale), virtualization, hit boxes, scroll maths, signals, ECS bindings | anywhere; `bun test` |
| `@flare-engine/ui-canvas` | components, the native host (`<UICanvas>`), shadow layer | React Native |
| `@flare-engine/ui-canvas/web` | the same components on a web host (CanvasKit or DOM, by D3), ARIA mirror | browser |

- **Tier 4**, beside `ui-fx`, `react` and `render-web`. Depends on `ui` (theme, focus navigation,
  layout; D12), `ui-fx` (presets, timelines, runtime; D10, D18), `a11y`, `haptics`, `math`,
  `animation`.
- **Text** needs a measuring callback from the host (Skia Paragraph on native, CanvasKit or DOM on
  the web), so `core` takes a `measureText` interface rather than importing Skia.
- **Not in the `@flare-engine/engine` barrel** (generic names, as ui-fx C17).

### 3.3 Components, first cut

`UICanvas` (host), `View`, `Text` (Paragraph: wrap, ellipsis, custom fonts, rich spans with inline
icons; D9), `Image`, `Panel` (nine-slice), `Button`, `Toggle`, `ProgressBar`, `Counter`, `Grid`
(inventory slots, drag and drop; D11), `Tabs`,
`Dialog`, `Toast`, `Tooltip` (ui-fx placement solver), `Icon`, `Badge`, and a game-styled `List`
for menus. Every component takes ui-fx `enter`, `exit` and `press` (a preset, a timeline or a
registered name) and can be played imperatively through `useFlareFx`, as `FlareView` can (D10).
Interactive components take a `haptic` prop (D17).

### 3.4 Out of v1

Text input and editing, text selection, nested native views inside the canvas, iOS verification
(no device), drawing inside the game's own frame (needs renderer clip and text,
E4).

### 3.5 Accessibility contract (D16)

| Concern | How ui-canvas meets it | Verified by |
|---|---|---|
| Screen readers (TalkBack, VoiceOver) | The shadow layer: one invisible native view per visible interactive node, laid out from the same boxes, with role, label, state, value and actions (activate, increment, dismiss). Non-interactive text joins its container's label. Exiting nodes leave the tree through ui-fx's existing exit handling | G0-3 |
| Reduced motion | ui-fx's runtime: the OS setting and `A11yManager`, the same fallback as on RN views | ui-fx's tests |
| Keyboard and gamepad focus | `ui`'s `FocusManager` with spatial navigation (D12, E7); the focus ring is drawn on the canvas and moves the screen reader's focus too | G0-3 |
| Contrast | Theme tokens from `ui`; `a11y`'s high-contrast setting picks the contrast palette; `auditColors` in tests | unit tests |
| OS text size | Paragraph font sizes multiplied by the OS font scale; a change re-lays out the scene | G0-3 at 200% |
| Rich text | An inline icon carries an accessibility label that joins the surrounding text ("Costs 50 coins") | G0-3 |
| Drag and drop | Accessibility actions on the dragged item and its targets ("pick up", "move to", "drop") are the screen-reader alternative to the gesture | G0-3 |
| Web | DOM host for app screens (native semantics); CanvasKit in-game UI gets an ARIA mirror (D3) | phase 4 |

### 3.6 Haptics (D17)

- **ui-canvas:** `Button`, `Toggle`, `Tabs` and `Grid` cue by default: selection when focus moves,
  a light impact on press, success or error notifications from `Dialog` and `Toast` results. Each
  component takes `haptic={false}` or a cue name; the provider's `setEnabled` switches all cues.
- **ui-fx:** optional cues inside presets and timelines, such as `press({ haptic: 'light' })` or a
  cue entry at a moment of a timeline (shatter's impact). The UI-thread clock schedules the cue on
  JS, where the haptics API lives (E8).
- **ui:** `Button` gives the same press cue (E10).
- **haptics:** merges cues to one per frame, keeping the strongest (E9). Android plays one
  vibration at a time, so two cues in one frame leave only the last; expo-haptics also plays at
  12-27% amplitude on Android (both measured on this Pixel 7, 2026-10-26; HAPTICS-ANDROID-1 tracks
  the strength).
- **Verified with** `adb shell dumpsys vibrator_manager`, not by touch.

---

## 4. Gate 0: measure what is still unknown

Run in the spike app (`ui-fx-spike/uifx-native`) and `uibench-web`, outside the repo. Each item
reports on its issue with numbers, as ui-fx Gate 0 did. **G0-0 decides go or no-go; G0-1 decides the
branch.**

| ID | Question | Pass when | Result, 2026-11-23 |
|---|---|---|---|
| **G0-0** | Do Skia surfaces present at the display rate? Presented frames from SurfaceFlinger for canvas and Reanimated views at 100 / 1,000 / 3,000 elements, at 90 Hz and 60 Hz; then the fix | **Go:** the canvas presents at the display rate (within 5%) at 100 and 1,000 elements. **No-go:** re-scope to the heavy cases | **Passed with a fix.** Stock: 44.9 at 90 Hz, 30.0 at 60 Hz. With the `TextureView` fix: 89.8-89.9 and 59.9, no long frames. Not a frame-rate policy (measurements §3.0) |
| **G0-1** | Branch A vs B on three tests: mount of 1,000 cards with Paragraph text (including rich spans with an inline icon) and layout; memory of that screen; the G0-6 scene's presented fps | A is chosen unless B is at least 1.5x better on mount or presented fps, or A uses over 1.5x B's memory | **Mount, single-line text:** A 88 ms, B's best 75 ms at 1,000 (1.17x); 53 vs 52 ms at 200. Paragraph, memory and G0-6 open |
| G0-2 | Chrome on the Pixel 7: DOM vs CanvasKit for lists, 3,000 animated, HUD, mount | Numbers recorded; D3 decided | **Done** (measurements §4.1): DOM mounts 1.2-2.3x faster and loads nothing; only CanvasKit holds 90 fps at 3,000 animated (React 49). D3 stands |
| G0-3 | Accessibility contract (§3.5): TalkBack reads and activates canvas buttons and grid slots; presses route correctly; gamepad focus moves the screen reader's focus; text at 200% OS font scale; drag of a grid item on the UI thread through the shadow layer, and its accessibility actions; cost of N invisible views on mount | TalkBack works on a 20-button menu and a 200-slot grid; 200% text re-lays out without clipping; a drag follows the finger at the display rate and TalkBack can move an item without it; shadow views add under 20% to mount | Open |
| G0-4 | Memory: a 1,000-card screen, canvas vs RN views | Within 1.5x of RN, or a cache cap is set | Open |
| G0-5 | A low-end Android phone (the Q1 2027 hardware, or a borrowed device) | Informs defaults, not the decision | Open |
| G0-6 | A realistic scene: 200 inventory slots, each a nine-slice panel, an icon, a Paragraph count and a badge; 50 of them animating at once through ui-fx: every live preset including emerge's brightness and shadow, a `stagger` chain, one shatter; presented fps and UI-thread time per animating node | Canvas presents at the display rate; RN-view equivalent measured for comparison. A preset too slow at 50 concurrent gets a documented limit (D10) | Open |
| G0-7 | A HUD and pause menu over a running GameView (transparent canvas on top); E1's cause | Both present at the display rate, or E1's fix is known | **Passed with both fixes** (measurements §3.0 E): GameView on a `TextureView` plus the overlay fix gives overlay 89.8-89.9 and a game loop near 87 Hz. With today's `SurfaceView` GameView the loop stays at 45-48 Hz |

---

## 5. Engine work that stands on its own

| ID | Issue | Why |
|---|---|---|
| E1 | `react`: GameView's loop runs at 45 Hz on a 90 Hz Pixel 7 when `opaque: true` (its docs' recommendation) | Cause traced: the `SurfaceView` buffer queue stays full, the UI thread waits about 8 ms per frame for a buffer, and JS's `requestAnimationFrame` arrives every other vsync. On a `TextureView` the empty scene's loop runs at 90 Hz, but that path floods logcat. The fix picks one: change the recommendation and silence the log, or stop the `SurfaceView` queue from filling (present timestamps). Affects every game on high-refresh Android phones that follows the docs |
| E5 | Upstream: report to RN-Skia, with the traces and the spike patch | `TextureView` canvases drawn from the UI thread present at half rate; `SurfaceView` canvases fill their queue (40 ms latency, blocked UI thread); the `TextureView` path logs an error pair every frame. Posting is outside the repo and needs the owner (D14) |
| E2 | `render`: per-sprite colour and alpha through `drawAtlas` colours | Existing #347; 3,000 fading sprites ran the JS loop at 16 Hz |
| E3 | `render`: batch nine-slice panels into one atlas run | 9 unbatched draws per panel today |
| E4 | `render`: clip, rounded rect and text on the draw surface | Needed only to draw UI inside the game's own frame (later) |
| E6 | `ui-fx`: export the host seam as `@flare-engine/ui-fx/runtime` (`useFlareElement`, `ElementPlatform`, `LiveDriver`, `FxTarget` and their types) | Only `./core` is public today (`packages/ui-fx/src/index.ts:19`); without it ui-canvas would copy enter/exit logic (D18) |
| E7 | `ui`: spatial focus navigation in `FocusManager`; components forward host props (`ref`, `style`, `onLayout`, touch and accessibility props) to their root view | Focus is linear today (`packages/ui/src/focus-manager.ts:2`); `Button` forwards only `style` and `ref` (`packages/ui/src/button.tsx:8-26`), which `createFlareComponent` needs more of (D12, D15) |
| E8 | `ui-fx`: optional haptic cues in presets and timelines | D17; adds `haptics` (tier 2.5) as a dependency |
| E9 | `haptics`: merge cues to one per frame, keeping the strongest | Android plays one vibration at a time (D17) |
| E10 | `ui`: haptic cue on `Button` press | D17 |

E1 is a defect (patch, no ADR); changing GameView's default `opaque` would be a documented contract
change and needs the ADR check first, while changing only the docs' recommendation does not. E2
already has its issue. E3, E4 and E6-E10 are additive (patch). E5 is not repo work.

---

## 6. Phases after Gate 0 (branch A)

| Phase | Work | Done when |
|---|---|---|
| 0. Other packages | E6 `ui-fx/runtime`, E7 `ui` spatial focus and host props, E8-E10 haptics | Released in a patch; a test host drives ui-fx's runtime through `ui-fx/runtime` |
| 1. Core | text measure interface and Paragraph cache (OS font scale), virtualization, hit boxes, scroll maths, signals, ECS bindings; layout and focus come from `ui` | Headless tests pass; Hermes microbench rows recorded |
| 2. Native host | `<UICanvas>` host with the `TextureView` presentation fix (D14), shadow layer (the §3.5 contract), ScrollView proxy, the canvas `LiveDriver` and `FxTarget` for ui-fx's runtime | G0-6's scene rebuilt on the package presents at the display rate at 90 and 60 Hz |
| 3. Components | v1 components with every ui-fx preset and timeline (D10), haptic cues (D17), rich text (D9) and drag and drop in grids and lists (D11) | A menu, an inventory and a HUD built from components only; TalkBack and gamepad pass on all three |
| 4. Web host | per D3: CanvasKit or DOM host, ARIA mirror | Same three screens on the web; G0-2's numbers hold |
| 5. Game integration | `<UICanvas>` over `GameView`, input routing between UI and game, gamepad across UI and game | G0-7's pause menu and HUD present at the display rate |
| 6. Proof and release | pilot screens in Berek and Pan Tvardowski with before/after presented-frame numbers, bench rows, docs, recipes | First publish as Beta (D13) |

Branch B, if G0-1 picks it, adds a reconciler, a node store, a packet format and a worklet
compositor to phases 1 and 2.

---

## 7. Decisions (approved by the owner, 2026-11-23)

| # | Decision | Answer |
|---|---|---|
| D1 | Build the package? | **Yes, after 0.5.0.** The open Gate 0 checks (G0-1's Paragraph and memory, G0-3, G0-6) run first in the hand lane; a failure there narrows the scope rather than stopping it |
| D2 | Name | **`@flare-engine/ui-canvas`**, beside `ui`, `ui-fx` and `ui-shop`. Host component working name `<UICanvas>` |
| D3 | Web scope | **DOM host for app screens, CanvasKit only for in-game and dense animated UI.** G0-2 on the phone: DOM mounts faster and loads nothing; CanvasKit (314 ms, 8 MB) is the only variant at 90 fps with 3,000 animated elements. Plain DOM apps keep `ui-fx/dom` |
| D4 | Hot values | **Reanimated shared values on native**, fed by a small in-house signal in `ui-canvas/core` (signal, computed, effect, batch), benchmarked against `@preact/signals-core` |
| D5 | Pilots | **Berek's inventory and menu, Pan Tvardowski's HUD and reward screen**, in phase 6, with before/after presented-frame numbers |
| D6 | Threading record | **One scope note in ADR-0001** naming ui-fx (its C16) and ui-canvas as UI-thread packages. Additive, no new ADR; ADR files are held paths, so the owner merges it |
| D7 | Schedule | **Gate 0's open items now in the hand lane**; build issues in a new "UI Canvas" milestone after 0.5.0; E1 in "Deferred defects" |
| D8 | E1 | **File now as a p2 defect** with the cause and both fix options; it affects shipped games, not only this package |
| D9 | Text in v1 | **Paragraph with wrapping, ellipsis, custom fonts, fallback, the OS text size, and rich text spans:** inline weight, colour and size, and inline icons through Paragraph placeholders ("Costs 50 [coin]"). An icon's accessibility label joins the text. No selection, no editing |
| D10 | ui-fx presets on the canvas | **Every preset and chain in v1.** Fade, slide, slide along a path, press, emerge (with brightness and shadow), shatter, disintegrate and dust, and `sequence` / `parallel` / `stagger` / `delay` timelines, through a canvas `LiveDriver` and `FxTarget` plugged into ui-fx's runtime (D18). G0-6 measures the costly ones; one too slow at 50 concurrent gets a documented limit, not a cut |
| D11 | Drag and drop | **In v1** for `Grid` and reorderable lists: a UI-thread pan through `react-native-gesture-handler` (an optional peer, needed only for drag), the dragged node drawn above the scene, drop targets from the same hit boxes, haptic cues on pick-up and drop, and accessibility actions as the screen-reader alternative. G0-3 tests it |
| D12 | Where theme, layout and focus live | **In `@flare-engine/ui`**, imported by ui-canvas (3.5 is below 4), not copied. `ui`'s `FocusManager` gains spatial navigation (E7), which `ui`'s own components get too |
| D13 | First publish | **ui-fx's pattern (its D7):** land the package `"private": true`, then flip it public as Beta in a patch release once phase 3 is usable. A new package is additive, so no `minor` and no ADR. The owner first creates the package name and its Trusted Publishing entry, or the publish fails with `ENEEDAUTH` |
| D14 | How the presentation fix ships | **Both.** `<UICanvas>`'s native host applies the fix itself (a small Expo module, C39's pattern) until an RN-Skia release has it. An upstream report goes to RN-Skia with the traces and the spike patch: drafted locally (`rn-skia-upstream-report.md`), the owner approves the text, then it is posted with `gh` |
| D15 | Role of `@flare-engine/ui` | **Keep it as the shared base** (theme, focus, layout) and the native-view kit for app-style screens. `ui-shop` builds on it and Pan Tvardowski uses it in 42 files; it is public, so removal would be breaking. Its components forward host props so ui-fx can animate them (E7). Whether its game-styled components move to canvas versions is decided after ui-canvas's Beta |
| D16 | Accessibility | **The §3.5 contract**, verified by G0-3 before any build issue starts |
| D17 | Haptics | **§3.6:** ui-canvas's interactive components cue by default; ui-fx presets and timelines take optional cues (E8); `ui`'s `Button` cues on press (E10); `haptics` merges cues to one per frame (E9) |
| D18 | ui-fx's host seam | **Export it as `@flare-engine/ui-fx/runtime`** (E6). Additive; ui-canvas and third-party hosts plug in their own driver instead of copying enter/exit logic |

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| The `TextureView` fix behaves differently on other phones, Android versions or RN-Skia releases | Measured on one Pixel 7 only. G0-5 repeats G0-0 on the Q1 2027 hardware; the host checks presented frames in a dev-only probe; upstreaming (E5) puts it under RN-Skia's own tests |
| The fix's redraw pass costs 0.7-1.2 ms per frame on the UI thread | Redraw only after Skia queued a frame, never while idle |
| Accessibility on a canvas is "never finished" (Figma) | The shadow layer is in Gate 0; the package is for dense UI, not documents |
| RN-Skia v3 (#349) changes the API | Branch A touches RN-Skia through components only; keep host code in one module |
| Paragraph costs 67-87 µs per paragraph on Hermes | Cache by text and style; G0-1 and G0-6 measure the real mount |
| Canvas text ignores the OS text size unless scaled by hand | The §3.5 contract; G0-3 tests 200% |
| ui-fx's pose maths per node is unmeasured at scale (the spike used one sine and cosine) | G0-6 times it with 50 concurrent presets |
| Drag fights the `ScrollView` proxy for the same touch | One gesture owner per region: a long-press starts a drag, a plain move scrolls; G0-3 tests it in a scrolling grid |
| Haptics on Android are weak and one cue cancels another | E9 merges cues per frame; HAPTICS-ANDROID-1 for strength; checks read `dumpsys vibrator_manager` |
| Low-end Android unknown | G0-5; defaults set from it |
| Scope creep toward a full UI toolkit | v1 list fixed (§3.3); text input, documents, drag out |

---

## 9. Questions the review raised, and where they landed

| Question | Answer |
|---|---|
| Did the canvas present 90 frames per second? | Stock RN-Skia: not in most runs, about 45. With the `TextureView` fix: 89.8-89.9 at 90 Hz and 59.9 at 60 Hz (measurements §3.0) |
| What draws a real component when it animates? | Unmeasured. G0-6 is a realistic inventory scene; it also feeds G0-1 |
| Plan before G0-1 resolves? | Branch A is the default; G0-1 has numeric criteria to switch to B (§4) |
| What must `Text` do? | D9. Mount numbers with Paragraph come from G0-1 |
| Is the HUD over a game in scope, and is E1 a prerequisite? | G0-7 measures it; phase 5's acceptance depends on it. E1's cause is known (§5) |
| Which ui-fx presets? | D10: all of them, with chains |
| Do we still need `@flare-engine/ui`? | Yes, as the shared base and the native-view kit (D15) |
| Accessibility and haptics? | D16 and D17 |
| Presses and drag on the JS thread? | Presses through the shadow layer; drag in v1 on the UI thread through gesture-handler (D11) |
| Where do layout and focus live? | D12: in `ui`, shared with ui-canvas |
| Release mechanics | D13 |

---

## 10. Issues

Created after this document lands, none labelled `status:ready`: the owner labels each one when it
should start. Results already measured (G0-0, G0-2, G0-7) live in the measurements document, not in
issues. The upstream RN-Skia report is not a repo issue (D14).

**Now, hand lane (milestone "UI Canvas", `type:verification`):**

| # | Title | Labels |
|---|---|---|
| 1 | `ui-canvas: Gate 0 — mount, memory and a realistic scene with every ui-fx preset and rich text (G0-1, G0-4, G0-6)` | size:m |
| 2 | `ui-canvas: Gate 0 — accessibility contract, gamepad focus, text scaling and drag (G0-3)` | size:m |
| 3 | `ui-canvas: Gate 0 — repeat G0-0 and G0-6 on a low-end Android phone (G0-5)` | size:s, status:blocked (waits for the Q1 2027 hardware) |

**Now, milestone "Deferred defects":**

| # | Title | Labels |
|---|---|---|
| 4 | `react: GameView's loop runs at 45 Hz on high-refresh Android with opaque: true (E1)` | type:defect, priority:p2, size:m |

**After 0.5.0, milestone "UI Canvas". Other packages first (patch, additive):**

| # | Title | Labels |
|---|---|---|
| 5 | `ui-fx: export the host seam as @flare-engine/ui-fx/runtime (E6, D18)` | type:feature, size:s |
| 6 | `ui: spatial focus navigation; components forward host props (E7, D12, D15)` | type:feature, size:m |
| 7 | `ui-fx: optional haptic cues in presets and timelines (E8, D17)` | type:feature, size:s |
| 8 | `haptics: merge cues to one per frame (E9, D17)` | type:feature, size:s |
| 9 | `ui: haptic cue on Button press (E10, D17)` | type:feature, size:s |
| 10 | `docs: ADR-0001 scope note for the UI-thread packages, ui-fx and ui-canvas (D6, ui-fx C16)` | type:hygiene, size:s |

**ui-canvas (milestone "UI Canvas", `type:feature`):**

| # | Title | Size | Depends on |
|---|---|---|---|
| 11 | `ui-canvas: design doc and package scaffold` | m | Gate 0 issues 1 and 2 |
| 12 | `ui-canvas/core: text measure and Paragraph cache, rich spans and the OS font scale (D9)` | m | 11 |
| 13 | `ui-canvas/core: virtualization, hit boxes and scroll maths` | m | 11 |
| 14 | `ui-canvas/core: signals and ECS bindings (D4)` | s | 11 |
| 15 | `ui-canvas: native host with the TextureView presentation fix (D14)` | m | 11 |
| 16 | `ui-canvas: shadow layer for touch, scrolling and accessibility (D16)` | l | 6, 15 |
| 17 | `ui-canvas: canvas LiveDriver and FxTarget for every ui-fx preset and timeline (D10)` | m | 5, 15 |
| 18 | `ui-canvas: v1 components with haptic cues (D17)` | l | 12-17, 7, 8 |
| 19 | `ui-canvas: drag and drop in grids and lists (D11)` | m | 16, 18 |
| 20 | `ui-canvas/web: DOM host for app screens, CanvasKit host and ARIA mirror for in-game UI (D3)` | l | 18 |
| 21 | `ui-canvas: GameView integration and input routing` | m | 18, issue 4 |
| 22 | `render: batch nine-slice panels into one atlas run (E3)` | s | - |
| 23 | `ui-canvas: bench rows, docs and recipes` | m | 18 |
| 24 | `release: create the ui-canvas package name and its trusted publisher (D13)` | s, type:owner-action | - |
| 25 | `ui-canvas: first publish as Beta (D13)` | s | 18, 23, 24 |
