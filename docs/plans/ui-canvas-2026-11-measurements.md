# UI Canvas: measurements (2026-11-23)

- **Status:** measured on 2026-11-23 and checked by an independent review the same day. §3.0 is the
  afternoon Gate 0 round, which found why the canvas showed half frame rate and measured a fix.
  §3.6 is the evening G0-3 round: the shadow layer with TalkBack, gamepad focus, 200% text, drag
  and the layer's mount cost. §3.7 is the G0-1, G0-4 and G0-6 round of 2026-11-24: mount with
  Paragraph text, memory, and an inventory scene playing ui-fx presets. The spike scenarios and
  the last round's scripts stay outside the repo, in `ui-fx-spike/uifx-native`. The raw logs and
  traces were kept locally and are no longer available.
- **Question:** can Flare ship the fastest UI components for React Native and the web, usable by
  RN/web developers and by game developers? Is building UI "like a game" (ECS, canvas) the way?
- **Companion:** [ui-canvas-2026-11.md](ui-canvas-2026-11.md), the plan.
- **Rule for this doc:** every number is either measured on 2026-11-23 or 2026-11-24 (with the run
  it came from) or published (with its source). Nothing is estimated. Where a measurement cannot show what it
  seems to show, §2.5 says so.

---

## 1. The answer

1. **The half-rate canvas was a React Native Skia defect, and a small fix removes it.** By default
   RN-Skia backs a transparent canvas with an Android `TextureView`. When the canvas is redrawn from
   the UI thread (Reanimated), its frames reach the screen on only every other vsync: **44.9 fps at
   90 Hz and 30.0 at 60 Hz**, flipping to full rate in some runs at the same load. A system trace
   shows why (§3.0). It is not Android's frame-rate policy: the app already asks for 90 Hz and gets
   it. A 20-line Java change that redraws the `TextureView` on every vsync made the canvas present
   **89.8-89.9 fps at 100, 1,000 and 3,000 elements, also with the JS thread blocked, and 59.9 at
   60 Hz**, with no frame longer than 1.5 vsyncs (SurfaceFlinger's own present timestamps).
2. **The other built-in option, a `SurfaceView`, presents every frame but at a cost.** Its buffer
   queue fills up: frames reach the screen about **40 ms** after Skia queues them (17-30 ms for views
   and the fixed `TextureView`), and the UI thread waits 2-8 ms per frame for a free buffer.
3. **With the fix, the canvas ties native views at 100 elements and wins from there up.** Presented
   fps at 90 Hz: 100 elements, canvas 89.8 and Reanimated 89.9; 1,000, canvas 89.8 against 18;
   3,000, canvas 89.9 against 6. The UI thread's whole frame took 6.5 / 7.8 / 9.2 ms at 100 / 1,000
   / 3,000 elements, of an 11.1 ms budget.
4. **GameView's 45 Hz loop (E1) has the mirror-image cause.** GameView draws into an opaque
   `SurfaceView`; its full queue blocks the UI thread about 8 ms per frame, which delays the JS
   thread's `requestAnimationFrame` to every other vsync. On a `TextureView` the same empty scene
   runs its loop at 90 Hz.
5. **Opening screens is 5-6x faster on a canvas, and declarative RN-Skia is close to the best
   custom path.** 1,000 cards: 497 ms with RN views, **88 ms with declarative RN-Skia**, 75 ms for
   one pre-recorded picture (1.17x). The canvas variants drew single-line text without layout, so
   this is an upper bound on the gain (§2.5). With Paragraph text and layout the gain is 3.9x (§3.7).
6. **Plain scrolling lists are already fast.** FlashList v2, Legend List and a Skia canvas list all
   scrolled 1,000 rows with no slow UI frames and zero blank rows in 128 mid-fling screenshots, even
   with the JS thread blocked a quarter of the time. Only FlatList dropped frames.
7. **Work on the JS thread loses when JS is busy.** Anything whose content is produced on the JS
   thread (React state, JS-recorded pictures, GameView, values fed from game state) slowed to the JS
   thread's rate under load. Only animation driven by a UI-thread clock was immune.
8. **The ECS is not the fastest store for UI.** On Hermes, creating 1,000 UI nodes as ECS entities
   took 1.64 ms against 0.36 ms as plain objects (4.5x), and updating them 0.53 ms against 0.15 ms
   (3.5x). The JS-side World also cannot be read from UI-thread worklets.
9. **React is fine for structure, slow for per-frame values.** On Hermes, a React re-render of
   1,000 nodes with 10% changed cost 5.4 ms; the same change through signals cost 0.15 ms (36x
   less).
10. **On the web, the DOM is good enough for app UI; the canvas wins on heavy animation.** In Chrome
   on the Pixel 7, React DOM mounted 1,000 cards in 64 ms against 76-82 ms for CanvasKit, and
   CanvasKit costs 314 ms and 8 MB to load. With 3,000 animated elements only the canvas held 90 fps
   (React 49, WAAPI 24). The desktop shows the same split.
11. **A layer of invisible native views makes a canvas accessible, if it stays small and comes
   second.** TalkBack read and activated every canvas button and grid slot through the layer, moved
   items through custom actions, followed gamepad focus and crossed a virtualized layer without
   stalling. A drag followed the finger on every frame (89.8-89.9 presented with the fix, 44.9
   without). Mounting a view for every node with the canvas slowed opening a 200-slot grid by
   76-85%; visible nodes only cost 13%, and mounting them one commit later left first paint
   unchanged. Text at 200% needs Android's own size conversion, not a scale factor (§3.6).
12. **With real text and a realistic scene, declarative RN-Skia stays close to the best custom path.**
   - **Mount:** 1,000 cards with wrapping Paragraph text, a rich span with an inline icon and flex
     layout open in 319 ms on the canvas, against 1,252 ms with RN views and 243 ms for one
     recorded picture (1.31x).
   - **Memory:** the canvas screen uses 0.71x the RN views' memory.
   - **A 200-slot inventory with 50 ui-fx presets playing at once** presents 84.4-89.9 at 90 Hz,
     provided opacity and brightness effects stay under about 25 at once. On the canvas each of
     them needs a layer, and 50 fall to 50-75 fps (§3.7).

**Verdict:** on this phone, a UI-thread canvas now **reaches the screen at the display rate, at 90
and 60 Hz, from 100 to 3,000 animated elements**, provided the `TextureView` fix ships (in RN-Skia
upstream, or in the package's own host until then). It ties native views on light screens and beats
them by 5-15x on dense ones, and opens screens about 4x faster with real text and layout. The touch
and screen-reader layer works on TalkBack when it holds visible nodes only and mounts after the
first paint (§3.6). A realistic inventory with 50 ui-fx presets playing reaches the display rate
when no more than about 25 of them change opacity or brightness (§3.7). Still unmeasured: iOS and a
low-end phone. Plain lists and forms should stay native (or DOM); they are already fast.

---

## 2. What was measured, and how

### 2.1 Native (Pixel 7)

- **App:** the existing ui-fx spike app (`ui-fx-spike/uifx-native`, never committed), extended with
  five scenario screens `u1`-`u5` opened by deep link. Release build, Hermes, Legacy Eval (not
  Bundle Mode), arm64.
- **Versions:** React Native 0.88.1, React 19.3.0, Reanimated 4.7.1, worklets 0.13.0, RN-Skia 2.14.0,
  Expo 58, FlashList 2.3.3, Legend List 3.8.0, react-reconciler 0.34.0, @preact/signals-core 1.14.5,
  @flare-engine/* 0.4.15/0.4.16 from the registry.
- **Display held at 90 Hz** (`min_refresh_rate 90.0` in the morning; in the afternoon the app's own
  `preferredDisplayModeId`, which also picks 60 Hz for the 60 Hz runs). One frame = 11.1 ms.
- **Metrics per run:**
  - **UI callback rate:** intervals of a Reanimated frame callback on the UI thread. It shows whether
    the UI thread kept up. It does **not** show whether a new frame reached the screen.
  - **Presented frames, morning runs:** Android's `dumpsys gfxinfo` total over the run (14 s for
    `u2`, 13 s for `u3`), divided by the window. It counts frames the app's window rendered,
    including a `TextureView` canvas. It cannot see a `SurfaceView` (it reports 0).
  - **Presented frames, afternoon runs (§3.0):** SurfaceFlinger's present timestamps for each of the
    app's layers (`dumpsys SurfaceFlinger --latency <layer>`), the window and every `SurfaceView`,
    sampled 2-4 times per run, 63 frames per sample. Gives presented fps, every frame interval, and
    the time from queueing a buffer to its present. It agreed with gfxinfo wherever both apply.
  - **System traces** (`atrace gfx view sched`, 3 s) for the cause and for UI-thread time per frame.
  - **JS frame rate:** intervals of `requestAnimationFrame` on the JS thread. Content produced on JS
    cannot change faster than this.
  - Scenario-specific work timers.
- **JS stall:** `stall=1` blocks the JS thread for 50 ms every 200 ms, standing in for a busy app or
  a game frame.
- **Lists** were flung with real touch input (`adb shell input swipe`, 7 down and 3 up per run, two
  runs per configuration). Blank rows were counted separately from 16 raw screenshots per
  configuration taken mid-fling; the detector was checked by eye.
- Every variant draws the same content; screenshots were compared.

### 2.2 Web

- **Pages:** `ui-fx-spike/uibench-web` (reviewed through its smoke screenshots).
  React 19.3.0, @tanstack/react-virtual 3.14.28, canvaskit-wasm 0.41.1.
- **Desktop lane:** Chromium 159, headed, real GPU (RTX 4070 Ti, D3D11), 120 Hz display, viewport set
  to the Pixel 7 size (412x915 at 2.625). Two repetitions per configuration.
- **Metrics:** rAF intervals; main-thread time per second (CDP `Performance.getMetrics`); compositor
  draw and drop counts from a CDP trace, which catches drops rAF cannot see.
- **Phone lane:** Chrome 157 on the Pixel 7 at 90 Hz, same pages and metrics (§4.1).

### 2.3 JS engines

The authoring microbench (`u5-core.ts`) ran the same code on Hermes (in the release app on the
Pixel 7), JavaScriptCore (Bun 1.3.11) and V8 (Node 22.23.5), 30 repetitions after 5 warm-ups,
median reported. Host instances were plain objects written into an ECS World; nothing was drawn.

### 2.4 What was not measured

- iOS (no device), a low-end Android phone, GPU time on any lane.
- VoiceOver, and TalkBack's spoken output (§3.6 checks where TalkBack's focus lands and what the
  node exposes, not the speech).
- Text input on a canvas (out of scope: forms stay native).
- Input-to-screen latency. §3.0's queue-to-present time is one part of it.
- Measured in the afternoon round, no longer open: presented frames from SurfaceFlinger, a 60 Hz
  mode, declarative RN-Skia mount (with the timer fixed: a marker inside the Skia tree).
- Measured in the evening round (§3.6), no longer open: accessibility and touch through a canvas
  (a shadow layer of native views), gamepad focus, 200% text, drag on the UI thread.
- Measured on 2026-11-24 (§3.7), no longer open: mount with Paragraph text and layout, memory, and
  a realistic mixed scene (plan G0-1, G0-4, G0-6).

### 2.5 Limits of these measurements (from the review)

An independent review of the plan against this data found these limits. They stand.

| Claim it would be tempting to make | What the measurement actually shows |
|---|---|
| "The canvas runs at 90 fps" | Stock RN-Skia: no, about 45 presented in most runs (§3.1, §3.2). With the `TextureView` fix: yes, 89.8-89.9 presented by SurfaceFlinger's count (§3.0) |
| "3,000 elements cost 2.98 ms" | That is the span of the transform worklet only. The whole UI-thread frame, from a trace, was 9.2 ms (p50) at 3,000, 7.8 at 1,000 and 6.5 at 100; the CPU clocks up with load, so these do not add linearly. GPU time was not measured |
| "Real components animate this fast" | Every animated element was the same 40x40 sprite from one atlas, drawn through RN-Skia's declarative `<Atlas>`. No run animated many distinct nodes with text. §3.7 did: 50 inventory slots with Paragraph text, 84.4-89.9 presented, with a limit on layered effects |
| "ui-fx presets run in the worklet at this cost" | The worklet computed one sine and one cosine per element, not ui-fx's pose evaluation. §3.7 timed ui-fx's own `livePoseAtInto`: 2-6 µs per node |
| "Skia text HUD at 90 fps" | Measured with 100 declarative `<Text>` nodes, each with its own derived value; presented about 66 per second at 100 labels |
| "Opening a screen is 5-7x faster" | The canvas variants drew single-line `drawText` at precomputed positions: no layout, no measuring, no Paragraph, no shadow views. The stop marker (second UI frame after commit) does not prove the picture was rasterised, while RN view mounting delays that same marker |
| "A React reconciler mounts 1,000 nodes in 7.9 ms" | True for the microbench with plain host objects. In the app, the reconciler path's build took 81 ms against 41 ms for drawing the same picture directly |
| "Paragraph costs about 40 µs per card" | 40 µs was a rounded rect plus `drawText`. Paragraph text (u1) cost about 67-87 µs per paragraph; §3.7 measured 83 µs to build and lay out one with a rich span |
| "Lists: the canvas list has zero blank rows" | It pre-recorded all 1,000 rows (134-175 ms) and was not virtualized. Screenshots cannot show lag between the native scroll offset and the canvas |
| "GameView is 45 fps" | Its `SurfaceView` presents 90 buffers a second, but its JS loop runs at 45 Hz, so every other frame repeats. Cause found (§3.0) |
| "The fix costs nothing" | It adds the window's redraw pass every frame: 0.7-1.2 ms on the UI thread (p50). The spike redraws even when the canvas is idle; a real fix redraws only after Skia queued a frame |

---

## 3. Native results (Pixel 7, 90 Hz)

### 3.0 What reaches the screen: cause, fix and numbers (afternoon round, G0-0)

**How Android shows an RN-Skia canvas.** RN-Skia 2.14 backs a `<Canvas>` with either a
`TextureView` (drawn into the app's window by the app's own renderer) or a `SurfaceView` (its own
layer, composed by SurfaceFlinger). The default, `"auto"`, picks `SurfaceView` for an `opaque`
canvas and `TextureView` otherwise; `android={{ surfaceType }}` forces one
(`SkiaBaseView.java`, `resolveKind`). Every canvas in the morning runs was a transparent
`TextureView`; GameView is opaque, so it was a `SurfaceView`.

**Why the `TextureView` canvas showed half rate.** A 3 s system trace of 100 animated elements:

1. Reanimated's frame callback runs in the main thread's animation phase, and RN-Skia draws and
   queues the new frame inside it: 270 swaps in 3 s, 90 a second.
2. The window's redraw pass (`traversal`, `TextureView#draw()`), which hands the newest Skia frame
   to the screen, ran only 135 times: 45 a second.
3. A `TextureView` learns of a new frame through a message to the main thread, which runs only after
   that vsync's work. In the frames that do redraw, Skia's new frame replaces one still waiting in
   the queue, and a replaced frame sends no notice (the queue counter stays at 1). With no notice,
   no redraw is scheduled for the next vsync. The pattern locks at every other vsync regardless of
   load; which phase it locks into varies by run, which is why a few runs showed 90.

It is not Android's frame-rate policy: during the runs the window was composed at "90.00 Exact", the
app's per-uid override was 90 Hz and the display's render rate 90.

**The fix tested.** In the spike's copy of RN-Skia, `SkiaTextureView` invalidates itself from a
Choreographer callback every vsync, so each frame's redraw pass picks up the frame Skia just queued
(URL switch `tick=1`). A production fix would invalidate only after a main-thread draw.

**The `SurfaceView` alternative.** Skia's frames go straight to the compositor and every frame is
shown, but 3-4 frames sit in the queue. The main thread then blocks in
`dequeueBuffer → waitForBufferRelease` each frame until the compositor frees a buffer.

**A. Presented fps at 90 Hz** (SurfaceFlinger, 2-4 samples of 63 frames; no frame longer than 1.5
vsyncs unless a range is shown)

| Scenario | Stock `TextureView` | `SurfaceView` | `TextureView` + fix | Reanimated views |
|---|---:|---:|---:|---:|
| 100 animated elements | 44.9 | 89.9 | 89.8 | 89.9 |
| 300 animated elements | 44.9 | - | 89.9 | 64.8-66.3 |
| 1,000 animated elements | 89.9 in one run, 44.9 in another | 89.9 | 89.8 | 18.2-18.4 |
| 3,000 animated elements | 89.9 | 89.9 | 89.9 | 6 (morning run) |
| 1,000, JS blocked 50 of every 200 ms | 44.9 | 89.9 | 89.9 | - |
| HUD, 100 labels, UI-thread values | 44.9 | 89.9 | 89.8 | - |
| HUD, 100 labels, values fed from JS | - | 85.7-89.9 | - | - |
| JS-recorded picture, 1,000 elements | 44.6-44.9 | 51.6-71.4 | - | - |

**B. Presented fps at 60 Hz**

| Scenario | Stock `TextureView` | `SurfaceView` | `TextureView` + fix | Reanimated views |
|---|---:|---:|---:|---:|
| 100 animated elements | 30.0 | - | 59.9 | 59.9 |
| 300 animated elements | - | - | - | 59.9 |
| 1,000 animated elements | 29.9 | 59.9 | 59.9 | - |

**C. Latency and UI-thread time** (90 Hz unless noted; p50)

| Path | Queue to present | Main thread per frame | Of which waiting for a buffer |
|---|---:|---:|---:|
| Reanimated views, 100 | 17.4 ms (60 Hz: 26-33) | - | - |
| Stock `TextureView`, 100 | 21-22 ms, at 45 fps | 5.3 ms | 0 |
| `TextureView` + fix, 100 / 1,000 / 3,000 | 21.5 / 29.5 / 28.3 ms (60 Hz: 35-38) | 6.5 / 7.8 / 9.2 ms | 0 |
| `SurfaceView`, 100 / 1,000 | - / 40.0 ms (60 Hz: 40) | 10.0 / 8.7 ms | 5.9 / 2.1 ms |
| GameView (`SurfaceView`), empty scene | 40.7 ms | 7.4 ms | 7.7 ms |

"Queue to present" runs from the moment a buffer is queued to its present, so it leaves out input
and the work before the queue. The main-thread times include the fix's redraw pass, 0.7-1.2 ms.

**D. GameView (E1)**

| GameView | Its layer presented | JS loop | Loop work per frame (p50) |
|---|---:|---|---:|
| `SurfaceView` (opaque, today's recommendation), 0 sprites | 89.8-89.9 | 45 Hz (rAF p50 22.3 ms) | 0.37 ms |
| `SurfaceView`, 1,000 sprites | 89.9 | 45 Hz | 10.7 ms |
| `TextureView`, 0 sprites | 88.4-89.8 | **90 Hz** (rAF p50 11.1 ms) | 0.33 ms |
| `TextureView`, 1,000 sprites | 45.3-54.1 | about 53 Hz (rAF p50 18.7 ms) | 7.6 ms |

On a `SurfaceView` the layer shows 90 buffers a second but the content changes 45 times: every other
frame repeats. The trace shows the main thread waiting 7.7 ms per frame for a buffer; the JS thread
is woken only after that wait, asks for its next frame after the next vsync has begun, and is served
two vsyncs later. On a `TextureView` GameView draws from JS through a posted redraw, after the vsync's
work, so the notice arrives in time and the loop runs at 90 Hz. At 1,000 sprites the loop's own JS
work (7.6 ms) becomes the limit.

**E. HUD and pause menu over a running GameView (G0-7).** GameView with 300 orbiting sprites;
over it a transparent canvas with 20 HUD labels written from the JS thread every JS frame (the game
case) and 8 menu buttons animating scale, offset and opacity on the UI thread. 3 samples per run.

| GameView backing | Overlay backing | Overlay presented | GameView layer presented | Game loop and HUD writes (JS) |
|---|---|---:|---:|---|
| `SurfaceView` (today's default advice) | stock `TextureView` | 47-54 | 89.9 buffers | about 46 Hz (rAF p50 21.7 ms) |
| `SurfaceView` | `TextureView` + fix | 89.9 | 89.9 buffers | about 48 Hz (20.8 ms) |
| `SurfaceView` | `SurfaceView` on top (`zOrderOnTop`) | 89.9 | 89.9 buffers | 45 Hz (22.0 ms) |
| `TextureView` | stock `TextureView` | 84.4-88.5, 1-4 long frames | same window | about 88 Hz (11.4 ms) |
| **`TextureView`** | **`TextureView` + fix** | **89.8-89.9, none long** | same window | **about 87 Hz (11.5 ms)** |

Queue to present for the last row: 32-34 ms (p50). A screenshot confirmed the labels and the
translucent menu draw over the moving sprites. Reading: the HUD and menu reach the display rate
only with the fix, and the game underneath reaches it only off the `SurfaceView` (E1). With both,
game, HUD values and menu animation all run near 90.

**Log noise.** The `TextureView` path logs the pair `updateTexImage: LegacySurfaceTexture is not
attached!` / `updateAndRelease() failed` on every frame: about 1,600 lines per 10 s canvas run, with
or without the fix, and 8,000 per 15 s GameView run. RN-Skia's own message calls it ignorable; it is
why GameView's docs recommend `opaque: true` today.

**Limits:** one phone (Pixel 7, Android 17), RN-Skia 2.14.0, release build. The fix is a spike patch
to `node_modules`, not a shippable change.

### 3.1 Many animated elements (`u2`, morning runs, stock RN-Skia)

Cards 40x40, each orbiting its home position and pulsing opacity, all at once. Each cell: presented
frames per second (Android's count) / UI callback rate or, for JS-driven content, JS frame rate.

| Elements | Reanimated views | Skia `<Atlas>`, UI-thread worklet | JS-thread picture (`drawAtlas`) | Flare GameView (ECS + SpriteBatch) |
|---:|---|---|---|---|
| 100 | **91** / 90 | **45** / 90 | **46** / 89 | not visible to gfxinfo / JS 45 |
| 300 | **66** / 66, 37% janky | **64** / 90 | **46** / 89 | - / JS 45 |
| 1,000 | **19** / 19, 100% janky | **45** / 90 | **46** / 68 | - / JS 45 |
| 3,000 | **6** / did not finish | **91** / 90 | **42** / 45 | - / JS 44 (16 with per-sprite alpha) |
| 300, JS blocked | **66** / 66 | **46** / 90 | **43** / 70 | - / JS 44 |

UI work per frame in the transform worklet: 0.63 / 1.34 / 2.42 / 2.98 ms. JS work per frame for the
JS-thread picture: 1.50 / 3.21 / 6.89 / 12.2 ms. GameView's JS work was 0.44 ms per frame with zero
sprites and 11.2 ms with 1,000, yet its JS loop ran at 45 Hz throughout.

**Reading:**
- The UI thread has ample capacity for thousands of canvas elements; Reanimated's per-view cost
  collapses past a few hundred.
- What reaches the screen is capped near 45 for the canvas in most runs, and the cap is not load:
  it held at 100 elements and lifted at 3,000. The morning guess was Android's per-surface
  frame-rate policy; the afternoon trace showed it is RN-Skia's `TextureView` handoff instead, and
  a fix lifts it (§3.0).
- Per-sprite alpha in Flare's SpriteBatch splits batches (#347) and collapses at 3,000.

### 3.2 HUD labels changing every frame (`u3`)

Presented frames per second (Android's count), 13 s runs. "Fed from JS" is the game case: values
live on the JS thread and are written into one shared value per frame.

| Labels | React state | Reanimated text (UI clock) | Reanimated text, fed from JS | Skia text (UI clock) | Skia text, fed from JS | JS-thread picture |
|---:|---:|---:|---:|---:|---:|---:|
| 20 | 82 | 91 | 91 | 46 | 46 | 42 |
| 100 | 72 | 46 | 30 | 66 | 46 | 46 |
| 100, JS blocked | 60 | 45 | 30 | 46 | 42 | 43 |

UI callback rates for the same runs: Skia text 90 at every size; Reanimated text 45 at 100 labels;
React state 90 with 14 slow frames at 100 (45 slow frames when JS was blocked).

**Reading:** on what reaches the screen, React state did best at 100 labels (72), the Skia canvas
second (66) and Reanimated text worst (46, 30 fed from JS). The Skia canvas's UI thread had room to
spare; its 45 cap is §3.0's `TextureView` defect, and with the fix the same 100-label HUD presented
89.8 (UI-thread values) and 85.7-89.9 on a `SurfaceView` when fed from JS.

### 3.3 Long list, 1,000 rows, real flings (`u1`)

Row: 56x56 coloured square, title and subtitle, 72 dp.

| List | UI callback p50 / p99 | Slow UI frames per run | Slow UI frames, JS blocked | Blank rows in 16 mid-fling shots (free / blocked) |
|---|---|---:|---:|---|
| FlatList (`getItemLayout`) | 11.1 / 11.3 ms | 4-5 | 17-18 | 0% / 0% |
| FlashList v2 | 11.1 / 11.2 ms | 0 | 0 | 0% / 0% |
| Legend List (`recycleItems`) | 11.1 / 11.2 ms | 0 | 0-1 | 0% / 0% |
| Skia canvas, UI-thread composition (all rows pre-recorded) | 11.1 / 11.2 ms | 0-1 | 0-1 | 0% / 0% |
| Skia canvas, JS-recorded | 11.1 / 11.2 ms | 0 | 0-1; content froze 66 times per 14 s | not measured |

The canvas lists used a native `ScrollView` with an empty spacer as a scroll proxy: real fling
physics, with the canvas drawing whatever is at the offset. Lists only render while moving, so
gfxinfo totals are not comparable here.

**Reading:** for simple rows on this phone, the list is not a bottleneck. FlashList and Legend List
already keep up.

### 3.4 Opening a screen of cards (`u4`)

Time from `setState` to the second UI frame after the commit. 12 repetitions, median. Canvas
variants: one rounded rect and one single-line `drawText` per card at precomputed positions.

| Cards | RN `View` + `Text` | Skia picture from JS | ECS, then picture | React reconciler into ECS, then picture | Signals into ECS, then picture | Declarative RN-Skia |
|---:|---:|---:|---:|---:|---:|---:|
| 200, morning | 235 ms | 50 ms | 55 ms | 62 ms | 52 ms | invalid run |
| 200, afternoon | 229 ms | 52 ms | - | - | - | **53 ms** |
| 1,000, morning | 505 ms | 72 ms | 85 ms | 102 ms | 87 ms | invalid run |
| 1,000, afternoon | 497 ms | 75 ms | 85 ms | 104 ms | 85 ms | **88 ms** |

Declarative RN-Skia: each card a `Group` with a `RoundedRect` and a `Text`, committed by RN-Skia's
own reconciler; the timer stops at a marker component inside the Skia tree. p95 at 1,000: 98 ms.
JS build time at 1,000 cards: picture 41-47 ms, ECS 52-53 ms, signals 59-60 ms, reconciler 79-81 ms.
About 40 µs per card for the plain picture, nearly all of it JSI calls.

**Reading:** a large lead for the canvas, which shrinks once text needs Paragraph layout (about
67-87 µs per paragraph on Hermes, from §3.3's recording cost) and touch needs shadow views. Published
Fabric numbers agree on the RN side (§5). Declarative RN-Skia, the path the plan defaults to, ties
the single pre-recorded picture at 200 cards and is 1.17x slower at 1,000: no reason here to write an
own compositor (plan G0-1).

### 3.5 Authoring cost per 1,000 UI nodes (`u5`, median ms)

| Operation | Hermes (Pixel 7) | JSC (Bun, desktop) | V8 (Node, desktop) |
|---|---:|---:|---:|
| Plain objects: create | 0.36 | 0.04 | 0.07 |
| Plain objects: update all | 0.15 | 0.05 | 0.04 |
| ECS: spawn (3 components) | 1.64 | 0.21 | 0.16 |
| ECS: update all (query walk) | 0.53 | 0.07 | 0.08 |
| ECS: destroy | 1.33 | 0.17 | 0.09 |
| React reconciler: mount | 7.91 | 0.40 | 0.52 |
| React reconciler: update 10% | 5.40 | 0.20 | 0.34 |
| React reconciler: update 100% | 8.25 | 0.37 | 0.58 |
| React reconciler: unmount | 1.74 | 0.16 | 0.13 |
| Signals: create (+ effect into ECS) | 3.78 | 0.27 | 0.25 |
| Signals: update 10% | 0.15 | 0.02 | 0.01 |
| Signals: update 100% | 1.48 | 0.14 | 0.05 |

At 100 nodes Hermes scales linearly (React mount 0.84 ms, update 10% 0.58 ms, signals update 10%
0.016 ms).

**Reading:** Hermes is 10-40x slower than the desktop engines, so desktop numbers mislead. A React
re-render of 1,000 nodes takes half of a 90 Hz frame even when only 10% changed.

### 3.6 Shadow layer, focus, text scaling and drag (`u7`, evening round, G0-3)

**Scene.** A 20-button canvas menu (2 columns, toggles, an adjustable value, a disabled button, rich
text with inline coin and gem icons) and a scrolling 200-slot inventory grid (4 columns), drawn
with declarative RN-Skia, every label a Paragraph, icons through Paragraph placeholders. A native
`ScrollView` proxy on top holds the shadow layer: one invisible `Pressable` per node, laid out from
the same boxes, with role, label, state, value and actions. The `TextureView` fix on (§3.0) unless
noted; 90 Hz. Versions as §2.1, plus `react-native-gesture-handler` 3.3.0 (v3 hook API).

**How it was driven.** TalkBack 17.1.0 on Android 17, through its keyboard shortcuts from a virtual
USB keyboard (`/system/bin/uinput`; TalkBack's key is Meta in its Enhanced keymap). `adb shell
input` events bypass TalkBack on this build: an injected tap pressed the button instead of
exploring it, so they cannot test a screen reader. Drags came from a virtual touchscreen reporting
at 240 Hz, like the panel; `input draganddrop` delivers only about 63 moves a second. What TalkBack
sees was read from each shadow view's `AccessibilityNodeInfo` (class, description, state, actions,
accessibility focus) by a spike helper.

**A. TalkBack**

| Check | Result |
|---|---|
| Node tree | Buttons as `Button`, toggles as `Switch` (checkable, checked), the adjustable value as `SeekBar` with increment and decrement, the locked button disabled, the title a heading. Rich-text labels join the icons' labels: "Buy potion, Costs 50 coins", "Upgrade sword, 120 coins and 2 gems" |
| Menu, 21 × next then click | TalkBack visited all 20 nodes in order; 19 of 19 enabled clicks arrived at the focused node through the accessibility click (no touch coordinates); the disabled node was read and not activated; a changed value was read back |
| Touch, TalkBack off | 19 of 19 taps at node centres pressed the right node; the disabled node got none |
| Grid | Slots read as "Potion, 1, slot 1"; 2 of 2 clicks correct; TalkBack's next-item scrolled the proxy page by page and the canvas followed (TalkBack's box and the drawn slot align in screenshots) |
| Drag alternative | The actions list offered "Pick up"; other slots then offered "Move Potion here" and the held one "Put back". After "Move here" the canvas and the shadow labels swapped and TalkBack stayed on the moved item |
| Virtualized layer, visible rows + 1 (48 nodes mounted) | 60 × next from slot 1 ended on slot 61 |
| Virtualized layer, visible rows only (44 nodes) | 60 × next ended on slot 61; 30 × previous on slot 31. No stall at the window's edge |

**B. Gamepad and keyboard focus.** Spatial navigation ran in JS over the same boxes, with the ring
drawn on the canvas. With TalkBack on, each move tried one way of moving TalkBack's focus to the
node's shadow view (the first key of each run, which lands where TalkBack already was, is left out):

| How the host moves TalkBack | Moves TalkBack followed |
|---|---|
| Native `performAccessibilityAction(ACTION_ACCESSIBILITY_FOCUS)` | 6 of 6 |
| `AccessibilityInfo.sendAccessibilityEvent(ref, 'focus')` | 3 of 3 |
| `sendAccessibilityEvent(ref, 'viewHoverEnter')` | 3 of 3 |
| `ref.focus()` | 0 of 3 |
| No call | 0 of 3 |

With a virtualized layer, a move into unmounted rows worked once the call retried until the node
mounted (15 rows down from the top, TalkBack followed to slot 57). Android's own input focus moves
by itself: the first arrow key after a touch is consumed to leave touch mode and puts input focus
on the first focusable shadow view, and TalkBack's own navigation moves it too. RN has no event for
accessibility focus, so TalkBack's navigation does not move the canvas ring.

**C. Text at 200% OS font scale**

| Screen | Font sizes | Row or cell height (dp) | Nodes wrapped | Clipped | Mid-word breaks |
|---|---|---|---:|---:|---|
| Menu, 100% | as authored | 56-61 | 0 | 0 | 0 |
| Menu, 200% | size × `PixelRatio.getFontScale()` (linear) | 59-154 | 6 | 0 | 3 |
| Menu, 200% | `TypedValue.applyDimension(SP)` (Android's, non-linear on 14+) | 56-146 | 4 | 0 | 1 |
| Grid, 200% | Android's | cells 89 → 108 | 89 of 200 names | 0, none ellipsized | 2 item names; the count overlaps the icon |

The linear factor drew the 22 sp title 52 dp tall against 41 dp with Android's conversion, and the
two-line "Upgrade sword" 70 dp against 64 dp (a native RN `Text` measured 67.8 dp, including its
font padding). Inline icons scale and wrap with the text. Changing the font scale while the app runs
recreates the activity and the scene re-lays out.

**D. Drag on the UI thread.** A long-press (350 ms) pan through gesture-handler over the shadow
layer, in the scrolling grid; the dragged item is drawn on the canvas from shared values.

| Input | Canvas | Moves per second | Frames with a new position | UI frame p50 / p95 / max (ms) | Presented | Queue to present p50 |
|---|---|---:|---|---|---:|---:|
| Touchscreen, 240 Hz | `TextureView` + fix | 86.5 | every frame of the 4 s move (359 of 390 drag frames) | 11.13 / 11.14 / 22.3 | **89.8-89.9**, none long | 18.1-18.3 ms |
| Touchscreen, 240 Hz | stock `TextureView` | 85.8 | 358 of 384 | 11.13 / 11.15 / 33.4 | **44.9** | 18.6 ms |
| `input draganddrop` | `TextureView` + fix | 63.5 | 294 of 415, each move drawn on the next frame | 11.13 / 11.14 / 22.3 | 89.8-89.9 | 19.0-19.6 ms |

Never more than one gesture update per frame: Android resamples the 240 Hz input to one move per
vsync. The unchanged frames are the long-press hold and the pause before release. A fast swipe
scrolled the grid without a drag or a press; a long-press drag after scrolling picked the right
slot and the grid did not scroll during it.

**E. Mount cost of the layer.** u4's method (§3.4): `setState` to the second UI frame after the
commit, p50 / p95 ms, 24 repetitions unless marked ¹ (12). The measure moves in whole frames
(11.1 ms).

| Scene | No layer | `View` layer | `Pressable` layer | `Pressable`, visible rows + 1 | `Pressable`, deferred one commit | Visible rows + 1, deferred |
|---|---|---|---|---|---|---|
| Menu, 20 nodes (all visible), TalkBack off | 63 / 73 | 76 / 94 (+21%) | 85 / 101 (+35%) | as the full layer | first paint 52 / 63; layer ready 74 / 87 | - |
| Grid, 200 slots, TalkBack off | 74-75 / 86-96 | 127 / 138 (+72%)¹ | 130 / 141 (+76%)¹ | 84-85 / 99-102 (**+13%**, 40 nodes) | first paint 63 / 96; layer ready 108 / 141 | first paint 63 / 75; layer ready 96 / 98 |
| Grid, TalkBack on | 75 / 86¹ | 118 / 140 (+57%)¹ | 139 / 152 (+85%)¹ | 84 / 98 (+12%) | - | - |
| Menu, TalkBack on | 54 / 63¹ | - | 74 / 105 (+37%)¹ | - | - | - |

The deferred variants' first paint measured below the no-layer runs although the canvas is the
same; read it as "not slower" (the layer's work between repetitions likely kept the CPU clocked
up).

**Reading:**
- The layer gives TalkBack everything it needs: reading, activation, custom actions, scrolling and
  focus that follows the canvas, with one stock RN call per focus move.
- Its cost is the problem: a view per node mounted with the canvas misses the 20% mount budget at 20
  nodes and badly at 200. Mounting only visible nodes passes at 200; deferring the layer one commit
  keeps first paint at the canvas's own time, at the price of 2-4 frames without touch and
  screen-reader nodes.
- The drag keeps up with a real panel's input on the UI thread, and needs the `TextureView` fix to
  reach the screen at that rate.
- Canvas text must take its sizes from the platform. Multiplying by the font scale overshoots on
  Android 14+, and a fixed-width slot at 200% breaks words unless the layout picks fewer columns.

**Limits:** one phone and one screen reader (TalkBack 17.1.0); TalkBack's speech was not recorded
("reads" means its focus landed on the node, whose text the dump shows). A `View` layer mounts
faster than `Pressable`s, but its TalkBack activation and touch through hit boxes were not tested.
The size conversion and the key forwarding were spike code.

### 3.7 Paragraph mount, memory and a realistic animated scene (`u8`, `u9`, 2026-11-24, G0-1, G0-4, G0-6)

**Setup.** Versions as §2.1. ui-fx was the #538 build: `compileLive`, `livePoseAtInto`, `stagger`,
`generateFracture` and `fragmentPoseInto`. The `TextureView` fix was on unless a row says stock.
The window's `preferredDisplayModeId` held the display at 90 Hz, or at 60 Hz where marked.

**Thermal control.** The first G0-6 runs drifted as the phone warmed on its charger: one
configuration went from 8.67 to 10.14 ms per frame and from 89.9 to 72-87 presented, while
Android's `Thermal Status` stayed 0. Every G0-6 number below comes from a run started after the
phone cooled to a skin temperature under 34 °C and big cores under 55 °C (`dumpsys thermalservice`,
live HAL values). The variants were interleaved, and the main comparison ran in two rounds.

**A. Mount of 1,000 cards with Paragraph text (G0-1).**
- **Each card:** a coloured rounded rect, a 28 dp icon and a bold one-line title (ellipsis). Below
  them, a wrapping body Paragraph of 1-6 lines with a rich span, "Costs **50** [coin] · …": a bold
  coloured number, and an inline icon placed through a Paragraph placeholder.
- **Layout:** `ui`'s `resolveLayout` (`packages/ui/src/layout.ts`), copied into the spike. It is a
  column of rows, two cards per row, each card a row of icon and text, and each row's height comes
  from the measured Paragraph heights.
- **RN views:** the same strings in `View` and `Text`, with nested spans and an inline `Image`,
  laid out by Yoga.
- **Method:** §3.4's: from `setState` to the second UI frame after commit, with the marker inside
  the Skia tree. 12 repetitions after 2 warm-ups, median.

| Cards | RN views | A: declarative RN-Skia | B: one recorded picture | B better by |
|---:|---:|---:|---:|---:|
| 200 | 407 ms | 131 ms | 128 ms | 1.02x |
| 1,000, a builder per Paragraph | 1,254 / 1,252 ms | 375 ms | 289 ms | 1.30x |
| 1,000, one reused builder per style | - | 319 / 319 ms | 243 ms | 1.31x |

**Where A's 319 ms went:**
- building and laying out 2,000 Paragraphs: 166-168 ms, or 83 µs each;
- the flex layout: about 10 ms;
- RN-Skia's reconciler committing about 6,000 nodes: about 114 ms;
- the first draw: about 29 ms.

B spent 31 ms recording instead of committing nodes. RN views committed in 918-929 ms, then took
about 330 ms more to mount 5,010 native views.

**B. Memory of that screen (G0-1, G0-4).**
- **Method:** `dumpsys meminfo` 10 s after mount, 3 samples each, in MB.
- **Two fresh launches** for the empty, A, B and RN rows. They agree within 1 MB, except the empty
  screen: its first launch fell to 121.5 as code pages were reclaimed, and the table shows the
  second.
- **One launch** for the reused-builder and 200-card rows.

| Screen | Total PSS | Native heap | Graphics | Java heap | Views |
|---|---:|---:|---:|---:|---:|
| Empty (same app) | 137.4 | 27.7 | 43.0 | 5.2 | 10 |
| A, 1,000 cards | 285.6-286.4 | 124.9-125.3 | 85.8-86.2 | 5.3-5.4 | 12 |
| A, 1,000 cards, one reused builder | 242.8-250.3 | 97.2-97.6 | 85.8 | 5.4 | 12 |
| A, 200 cards | 213.1 | 55.7 | 86.2 | 5.4 | 12 |
| B, 1,000 cards | 279.2-280.9 | 123.1-123.2 | 86.0-86.6 | 5.4 | 12 |
| RN views, 1,000 cards | 400.7-401.7 | 220.7-221.6 | 61.2 | 38.8 | 5,010 |

- **The canvas's own cost:** 43 MB of graphics memory (EGL and GL mtrack both double), whatever it
  shows. That is its `TextureView` buffers.
- **Paragraph cost:** native heap grows 86.5 KB per card between 200 and 1,000 cards, about 43 KB
  per Paragraph. Reusing one `ParagraphBuilder` per style (`reset()` between Paragraphs) cuts that
  to about 30 KB, and cuts A's mount by 56 ms.
- **B's native heap** is the same as A's. Its Paragraph objects were not disposed after recording,
  so this does not show what a picture alone holds.

**C. The inventory scene (G0-6).**
- **Slots:** 200 in 6 columns, 60.9 dp each. Each slot has a nine-slice panel (`drawImageNine`
  recorded once into a `Picture` that every slot shares), an icon `Image`, a bold count Paragraph,
  and a badge (`Circle` plus Paragraph).
- **Animation:** 50 of the 72 visible slots animate at once, on a loop: enter, hold 0.25 s, exit,
  hold. Each node's pose comes from ui-fx's `livePoseAtInto` in a `useDerivedValue` worklet. The
  mix:
  - 9 fades;
  - 8 slides, from all 4 edges;
  - 8 slides along an SVG path, auto-rotating;
  - 8 presses (scale 0.9, brightness 1.35);
  - 8 live emerges;
  - 8 stagger chains, `stagger(0.08, fade, slide, emerge)` compiled through `liveEntries`;
  - 1 shatter: ui-fx's 40-piece radial glass, posed by `fragmentPoseInto` every frame and drawn as
    `<Vertices>`, textured with the slot's own recorded picture.
- **Pose to Skia:**
  - a `Group` transform (translate, rotate, scale about the slot's centre);
  - opacity and brightness through the group's `layer` paint (opacity and a `ColorMatrix`);
  - emerge's shadow as a gradient `Rect` whose stops follow `shadowEdge`, at opacity
    `shadowOpacity`.

**Found while building it: `Group` opacity does not reach `Picture` or `Paragraph` children** in
RN-Skia 2.14. It is applied to the paint children inherit, and those two ignore paint: a fading
slot faded its icon and badge circle, but not its panel or its count. Correct opacity on such a
node needs a layer.

**How to read the tables.** "Presented" is SurfaceFlinger's count, 3 samples of 63 frames per run.
"UI frame" is the main thread's `Choreographer#doFrame` from `atrace`, 4 s per run.

| Variant, 90 Hz | Presented, round 1 | Presented, round 2 | UI frame p50 / p95 |
|---|---|---|---|
| A, a layer on every animating node | 58.7-64.1 | 60.6-63.3 | 14.0-14.9 / 21-24 ms |
| **A, a layer only on presets that change opacity or brightness** (33 of 50) | 84.4-89.9 | 87.1-89.9 | 8.8 / 10.4-13.2 ms |
| B: static slots in one picture, a worklet records the 50 every frame | 88.5-89.9 | 87.1-89.9 | 8.4-8.5 / 10.0-12.3 ms, including 2.25 ms of recording |
| RN views through ui-fx's `FlareView` with `progress`, 41 animating* | 89.9 | - | 8.0 / 9.5 ms, plus RenderThread 6.7 ms |
| A, no opacity layers (fades drawn wrong) | 89.9 | - | 8.6 / 10.1 ms |
| A, stock `TextureView` | 39.8-43.5 | - | 8.8 ms |

| Variant, 60 Hz | Presented | UI frame p50 |
|---|---:|---:|
| A, a layer only where needed | 58.1-59.9 | 11.6 ms |
| A, a layer on every node | 57.1-59.9 | 12.7 ms |
| B | 58.0-59.9 | 11.0 ms |
| RN views (41*) | 59.9 | 10.1 ms, plus RenderThread 7.2 ms |

\*The RN host has no press without a touch and no shatter, so those 9 slots stood still in the RN
runs.

**D. Each preset alone, 50 at once** (A, 90 Hz)

| Preset | Needs a layer | Presented | UI frame p50 | Pose worklets per frame |
|---|---|---:|---:|---:|
| slide | no | 89.9 | 8.24 ms | 0.17 ms |
| slide along a path | no | 89.9 | 8.26 ms | 0.18 ms |
| slide, forced through a layer | yes | 56.3-68.8 | 13.5 ms | 0.11 ms |
| fade | yes | 66.4-75.4 | 12.5 ms | 0.11 ms |
| press | yes (brightness) | 49.8-56.9 | 14.1 ms | 0.10 ms |
| emerge | yes (brightness) | 50.7-68.8 | 14.1 ms | 0.13 ms |
| stagger chain | yes | 75.3-85.7 | 10.1 ms | 0.18 ms |
| fade, 25 at once | yes | 89.9 | 8.2 ms | 0.08 ms |
| fade, 35 at once | yes | 83.2-89.9 | 8.5 ms | 0.10 ms |
| shatter, 10 at once (40 pieces each) | no | 89.9 | 8.6 ms | 1.6 ms |
| B: fade, 50 at once | only while opacity < 1 | 85.8-89.9 | 8.9 ms | 0.73 ms |

**E. UI-thread time per animating node.**
- **The base:** the same scene with one animating node takes 8.0 ms a frame, because RN-Skia
  redraws the whole canvas (about 1,200 nodes) whenever any value changes.
- **A moving node without a layer** adds about 5 µs (50 slides: 8.24 ms), of which evaluating its
  pose is 2-6 µs.
- **A node with a layer** adds little up to about 25 at once, then the frame falls off a cliff: at
  35 the occasional frame is long, and at 50 a frame takes 12.5-14 ms. The pose worklets did not
  grow; RN-Skia's draw did. The cause is not traced.

**Reading:**
- G0-1 keeps branch A. B's best case was 1.31x better to mount, 1.01x on the scene's presented
  fps, and used 1.02x less memory. Each falls short of the 1.5x that would switch.
- G0-4 passes: the canvas screen uses 0.71x the memory of the RN-view screen. Text is the
  canvas's main cost in both mount time and native memory, so the Paragraph cache matters more
  than the node count.
- G0-6 passes with a documented limit (D10). The canvas reaches the display rate when the driver
  layers only the nodes whose preset changes opacity or brightness: 5 of 6 samples are within 5% at
  90 Hz, and 58.1-59.9 at 60 Hz.
- **The named limit:** fade, press, emerge and timelines containing them. About 25 at once hold the
  display rate on this phone, 35 drop the occasional frame, and 50 fall to 50-75 fps. Slide, slide
  along a path and shatter showed no limit.
- **Fallbacks, unmeasured:**
  1. Layer a node only while its effect plays: enters and exits are short, and this test kept all
     50 playing.
  2. Above a cap, start further layered effects later, or play their reduced-motion fallback.
  3. Draw a fading node from a raster of its own picture: an `Image` with paint alpha needs no
     layer, and shatter already rasterises its slot.

  B's per-frame recording is the measured alternative: it layered a node only while its opacity or
  brightness differed from 1, and held 85.8-89.9 with 50 fades.

**Limits:**
- One phone (Pixel 7, Android 17), and RN-Skia 2.14.0 with a spike patch. GPU time was not
  measured.
- All 50 nodes animated continuously, which is a worst case.
- B is a spike of its best case: no reconciler, no hit testing, and everything recorded every
  frame.
- The mount timer's stop does not prove the frame was rasterised.
- One run froze A's static slots into a single `Picture`. It ran before the cooling protocol, so
  it is left out.
- Results posted on #542.

---

## 4. Web results

### 4.1 Chrome on the Pixel 7 (90 Hz, G0-2)

Chrome 157 on the phone, driven over CDP from the desktop (`node run-android.mjs --reps=2`), the
page served over `adb reverse`. Renderer ANGLE on Mali-G710. Medians of two repetitions; "main
thread" is task time per second of the window; "presented" is the compositor's drawn frames per
second from the CDP trace; "long" counts frames over 1.5 vsyncs. Thermal status 0 before and after.

| Scenario | React / DOM | Canvas (CanvasKit) | Reading |
|---|---|---|---|
| List 1,000 rows, flung | full DOM 194 long frames; `content-visibility` 451; virtualized 16 | 2 long frames | virtualized DOM and canvas both smooth |
| List 10,000 rows | virtualized 21 long; full DOM 195 long, worst 134 ms; `content-visibility` collapsed (1,807 long, 1,166 over 2.5 vsyncs) | 1 long frame | virtualized DOM is enough |
| 1,000 animated | React 90 presented, 709 ms/s; DOM writes 90, 671 ms/s; WAAPI 58 presented | 90 presented, 207 ms/s | canvas 3.4x cheaper on the main thread |
| 3,000 animated | React 49 presented, 998 ms/s (saturated); DOM writes 60; WAAPI 24 | **90 presented, 290 ms/s** | only the canvas holds the display rate |
| 100 HUD labels | React 597, DOM 603 ms/s; all smooth | `drawText` 363 ms/s; Paragraph every frame 673 ms/s | all smooth; cache Paragraphs |
| Mount 200 / 1,000 cards (to 2nd rAF, p50) | React DOM 16.9 / 64.2 ms | 38.5 / 76.1 ms imperative, 42.7 / 82.4 reconciler, 40.2 / 80.5 signals | DOM wins: 2.3x at 200, 1.2x at 1,000 |
| Load | none | CanvasKit 314 ms per load (median of 32) plus fonts 156 ms; 8.08 MB wasm | a real cost for app pages |

**Reading:** on the phone the picture is the desktop's, sharper. The DOM is the right host for app
screens: it mounts faster, needs no 8 MB download and scrolls virtualized lists smoothly. CanvasKit
earns its cost only for dense animation, where it is the only variant at 90 with 3,000 elements and
uses about a third of React's main thread at 1,000. That settles D3 as the plan proposed.

### 4.2 Desktop Chrome (RTX 4070 Ti, 120 Hz)

Medians of two repetitions. "Main thread" is task time per second of the window.

| Scenario | React / DOM | Canvas (CanvasKit) | Notes |
|---|---|---|---|
| List 1,000 rows | dom-full 19, dom-virt 32 ms/s, smooth | 27 ms/s, smooth | all variants smooth |
| List 10,000 rows | dom-virt 35 ms/s, smooth; dom-full 51 ms/s | 28 ms/s, smooth | `content-visibility` collapsed: 566 ms/s, 1,364 slow frames |
| 1,000 animated | React 357, DOM writes 286, WAAPI 570 ms/s | 46 ms/s | all hold 120 fps |
| 3,000 animated | React 998 ms/s, DOM writes 885 ms/s; WAAPI 40 fps (242 compositor drops) | 50 ms/s, 120 fps | canvas is 18-20x cheaper |
| 100 HUD labels | React 94, DOM 100 ms/s | `drawText` 35 ms/s; Paragraph per frame 172 ms/s | all smooth |
| Mount 1,000 cards (sync work) | React DOM 5.0 ms | 12.8 ms imperative, 13.7 ms reconciler, 12.7 ms signals | DOM wins: Paragraph building dominates |
| Load | none | 8.08 MB wasm, 36 ms on localhost | 2.8-3.2 MB gzipped (engine benchmarks) |

**Reading:** on a fast desktop the DOM is fine for app UI and better at mounting text; the canvas
wins by an order of magnitude only when thousands of elements animate.

---

## 5. Published numbers that agree

From a research pass, each with its source; only figures with a stated
method are kept.

- **Fabric mount cost** (RN team, RN 0.72, Pixel 4): 1,500 `View` 258 ms, 5,000 `View` 1,045 ms;
  1,500 `Text` 505 ms, 5,000 `Text` 2,089 ms. About 0.2 ms per View and 0.4 ms per Text. Source:
  reactwg/react-native-new-architecture discussion #123.
- **Reanimated per-frame UI cost** (Expo blog 2026-04, Reanimated 4.3, Moto G8 Plus, release, all
  feature flags): 100 views 11.98 ms, 500 views 39.94 ms per frame with shared values;
  react-native-ease 3.92 / 6.63 ms. Reanimated's performance guide: "animate no more than 100
  components for low-end Android devices and no more than 500 components for iOS" (the fetch tool
  returned the sentence in fragments; the joined wording is reassembled).
- **RN-Skia Atlas:** 10,000 sprites without drops on an iPhone 12 mini; 300 on an OPPO A16 (issue
  #2521, user report). The RN-Skia reconciler rewrite (PR #2919) reported 20-300% faster animation.
- **js-framework-benchmark** (Chrome 158, M4, 2026-11-22; script time to create 1,000 rows):
  vanilla 1.7 ms, Solid 2.6 ms, React 19.2 6.3 ms; 10,000 rows 14.8 / 22.1 / 140.7 ms.
- **Lists:** no published FlashList v2 or Legend List numbers with a device and a method exist.
- **Canvas UI on the web:** Flutter's CanvasKit renderer is 1.5-2.3 MB brotli; skwasm 1.2 MB.
  Flutter's FAQ: "not suitable for static websites with text-rich flow-based content".

---

## 6. Engine findings at HEAD

| Finding | Where | Consequence |
|---|---|---|
| GameView's JS loop runs at 45 Hz on a 90 Hz display even with zero sprites (0.37 ms of JS work per frame) | measured, `u2 flare n=0`; cause traced (§3.0 D) | `opaque: true` puts it on a `SurfaceView` whose full buffer queue blocks the UI thread about 8 ms per frame and delays JS's `requestAnimationFrame` to every other vsync. On a `TextureView` the loop runs at 90 Hz (plan E1) |
| GameView's docs recommend `opaque: true` on Android | `packages/react/src/game-view.tsx:119-144` | The recommendation trades a log flood for a half-rate loop on high-refresh phones; E1 needs a fix that avoids both |
| The draw surface has no clip, no text, no rounded rect, no picture | `packages/render/src/frame-renderer.ts:160-211` | A render hook cannot draw UI (the `u1` GameView variant crashed: `undefined is not a function`) |
| Text is single-line bitmap fonts by `charCodeAt` | `packages/render/src/sprite-font.ts:93-149` | No shaping, wrapping, bidi or fallback |
| Per-sprite alpha splits SpriteBatch runs | #347 | 3,000 fading sprites: JS loop at 16 Hz |
| Nine-slice panels are 9 unbatched `drawImageRect` calls | `packages/render/src/nine-slice.ts:13-16` | 1,000 stretch draws cost 2.43 ms on the Pixel 7 web lane |
| No scroll physics, drag velocity or pan recogniser | `packages/input/src/gestures.ts:46-50` | A native ScrollView proxy sidesteps scrolling; drag needs a gesture library |
| Focus is linear tab order; gamepad "(future)" | `packages/ui/src/focus-manager.ts:2`, `:68-103` | Game UI needs spatial navigation |
| A pure flex resolver exists, "primarily for Skia-rendered HUD / menu layouts" | `packages/ui/src/layout.ts:2-10`, `:68` | Starting point for layout |
| ui-fx's live poses have 11 fields, including 3D rotation, perspective and brightness | `packages/ui-fx/src/core/live.ts:16-28` | An atlas transform covers only 2D and alpha; richer presets need a per-node layer |
| ECS: a Map per component; every add/remove walks every query; 32 types until #173 | `packages/ecs/src/world.ts:6-19`, `:211-221` | Not built for UI-node churn |
| ui-fx's host seam is internal: `useFlareElement`, `ElementPlatform`, `LiveDriver` and `FxTarget` are not exported; `./core` (presets, `sequence` / `parallel` / `stagger` / `delay`, the `livePoseAtInto` worklet) is | `packages/ui-fx/src/index.ts:19`, `runtime/element.ts:35-41`, `:469`, `core/live.ts:290-297`, `core/timeline.ts:77-107` | A canvas host can reuse ui-fx's whole runtime once the seam is public (plan E6, D18) |
| `ui`'s components forward only `style` and `ref`; ui-fx's wrapper needs `onLayout`, touch and accessibility props passed to one host view | `packages/ui/src/button.tsx:8-26`, `packages/ui-fx/src/rn/create-flare-component.tsx:271-273` | `createFlareComponent(Button)` cannot animate them yet (plan E7) |
| `ui` is tier 3.5; `ui-fx` and ui-canvas are tier 4 | `scripts/check-deps-tiers.mjs:72`, `:83` | ui-canvas may import both; `ui` cannot import `ui-fx` |
| No UI package uses `@flare-engine/haptics`; Android plays one vibration at a time and expo-haptics cues at 12-27% amplitude | `ui`, `ui-fx` sources; measured on this Pixel 7 on 2026-10-26 with `dumpsys vibrator_manager` | Plan D17, E9 |
| ADR-0001: everything except the scene handoff on the JS thread | `docs/design/adr-0001-renderer-and-threading.md:41-46` | A UI-thread package needs the scope note ui-fx proposed (C16) |

---

## 7. Prior art, in one table

| System | Approach | What it teaches |
|---|---|---|
| Bevy UI | UI nodes are ECS entities; Taffy layout in a separate tree | Six years in, reactivity is "not yet converged"; 100+ lines per button; virtualization is third-party |
| Unity | DOTS has no UI; the official sample bridges ECS to UI Toolkit | Vendors route around ECS for UI |
| Flutter | Own renderer; semantics tree mirrored into the DOM on web, off by default | Accessibility is a second tree to build and keep in sync |
| Figma, Google Docs | Canvas plus a mirror DOM for assistive tech | "Accessibility work is never really finished" (Figma) |
| Telegram Android | Chat cells drawn on a Canvas in one custom View, with a hand-written accessibility node provider | The win is real, and so is the cost |
| react-native-skia-list | Skia list on the UI thread, worklet render functions | Exists, "not ready for production" |
| egui, Dear ImGui | Immediate mode, list clipper for uniform rows | Great for tools; layout lags a frame; accessibility is thin |

---

## 8. What changed from the first two versions of the recommendation

1. **First audit:** "drop the faster-FlatList-through-ECS premise." Still true: ECS and lists are
   not where the gain is.
2. **First draft of this audit:** "a UI-thread canvas holds 90 fps at 3,000 elements." Corrected by
   the review: that is UI-thread capacity. What reached the screen was about 45 fps in most canvas
   runs, apparently by platform policy.
3. **Morning revision:** the canvas approach is worth pursuing for dense, animated, game-like UI and
   for fast screen opening, **conditional on Skia surfaces presenting at the display rate on
   Android**, which looked like a platform frame-rate policy.
4. **Afternoon (Gate 0 round 1):** the half rate is an RN-Skia `TextureView` defect, not policy. A
   small fix makes the canvas present at 90 and 60 Hz from 100 to 3,000 elements (§3.0), which passes
   G0-0. The same investigation explained GameView's 45 Hz loop (E1). Declarative RN-Skia mounts
   within 1.17x of the best custom path, which keeps branch A.
