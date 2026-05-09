# Pan Tvardowski — Performance Baseline

## Targets

| Device tier | Metric | Target |
|---|---|---|
| Galaxy A54 (mid-tier reference) | Cold-start TTI | ≤ 3000 ms |
| Pixel 7 (second-device reference) | Cold-start TTI | ≤ 3000 ms |
| Galaxy A54 | Sustained frame rate | 60 fps stable |
| Pixel 7 | Sustained frame rate | 60 fps stable |
| Entry-level Android | Minimum frame rate | 30 fps floor |
| Any | Resident memory | ≤ 250 MB |

> **iOS / iPhone 12 deferred.** Per session #107 plan (2026-05-09), only Android device measurements are in scope right now. iOS targets are held for a follow-up row in `docs/plans/sessions.md`.

## How to measure

- **Boot trace (in-app)** — `App.tsx` calls `dumpBootTrace()` immediately after `markBootMilestone('first-frame')`. The helper prints one `console.log` line tagged `[boot-trace]` containing `total=<ms>` plus per-step deltas. In a release build this surfaces via the Expo `RNLog` bridge under `logcat` tag `ReactNativeJS`.
- **Android** — Android Studio CPU Profiler (Callstack Sample or System Trace); start recording before app launch, stop after first frame.
- **iOS (deferred)** — Xcode Instruments > Time Profiler with "App Launch" template. Held for a future iOS-smoke session.
- **Hermes timeline** — enable `hermes.enableSampledTraceToFile` in `metro.config.js`, open trace in `chrome://tracing`.

### Cold-start TTI capture recipe (Android, release build)

```bash
# Clear logcat, launch the app via the LAUNCHER intent, grep for the boot-trace line.
adb -s <device-serial> logcat -c
adb -s <device-serial> shell monkey -p com.pantvardowski.app -c android.intent.category.LAUNCHER 1
adb -s <device-serial> logcat -s ReactNativeJS:* | grep "\[boot-trace\]" | head -1
```

Expected line shape:

```
[boot-trace] total=2480.5ms boot-start->providers-mounted=312.4ms providers-mounted->save-loaded=48.7ms save-loaded->audio-ready=210.9ms audio-ready->first-frame=1908.5ms
```

The `total=` field is the cold-start TTI. Run three cold launches per device, take the median.

## Boot trace milestones

| Milestone | Recorded by | Measures |
|---|---|---|
| `boot-start` | `markBootStart()` in `App.tsx` module scope | Module evaluation complete |
| `providers-mounted` | `AppRoot` mount `useEffect` | React tree rendered, all `useMemo` services constructed |
| `save-loaded` | `boot.ts` after `loadSave()` | MMKV read + save-schema migration |
| `audio-ready` | `boot.ts` after `initAudio()` | Audio graph constructed, channels attached |
| `first-frame` | `GameView.onReady` callback | Skia surface up, engine context live |

## Known cost contributors

- **RN bridge init** — JS bundle parse + bridge handshake; largest single cost on cold start.
- **Skia surface creation** — `GameView` waits for the native Skia context before firing `onReady`; varies with GPU driver init time.
- **MMKV first-load** — synchronous file open on the JS thread; negligible on fast flash, visible on slower eMMC.
- **Asset atlas decode** — `loadSpriteAtlas` runs at `bootstrap()` time inside `onReady`; PNG decode cost is proportional to atlas size.
- **react-native-purchases boot** — SDK handshake with the store; runs inside `mountTier2Wiring` and is async, but the SDK's own internal init competes with bridge bandwidth.

## How to read the trace

```ts
import { getBootTrace } from './src/perf/cold-start';

const trace = getBootTrace();
for (let i = 1; i < trace.length; i++) {
  const prev = trace[i - 1];
  const cur = trace[i];
  if (prev && cur) {
    console.log(`${prev.name} → ${cur.name}: ${(cur.t - prev.t).toFixed(1)} ms`);
  }
}
// Example output:
// boot-start → providers-mounted: 312.4 ms
// providers-mounted → first-frame: 1840.2 ms
// first-frame → save-loaded: 48.7 ms
// save-loaded → audio-ready: 210.9 ms
```

## Post-rebrand worst-case (session #75)

### Design targets (frame-budget guards)

| Budget dimension | Limit | Source |
|---|---|---|
| Draw calls (`posQuery.count`) | 920 | `BUDGET_LIMITS.draws` in `src/fx/budget.ts` |
| Particle entities (`lifetimeQuery.count`) | 480 | `BUDGET_LIMITS.particles` in `src/fx/budget.ts` |
| Active post-fx passes | 3 | `BUDGET_LIMITS.postfx` in `src/fx/budget.ts` |

The limits are enforced at runtime via `recordBudget()` (console.warn on breach). The chromatic-aberration effect is registered in the chain with `enabled: false` so it does not consume an active-postfx slot at rest.

### FPS watchdog threshold rationale

The watchdog fires when the 180-frame rolling average drops below **55 fps**. Rationale:

- 60 fps is the stable target on mid-tier devices (Galaxy A54).
- A sustained 55 fps average indicates genuine GPU pressure, not a transient spike.
- The only action on first trigger is disabling the chromatic-aberration pass (the cheapest effect to drop and the only one disabled by default). Vignette, bloom, and grayscale-flash are not dropped automatically.
- The drop is sticky for the scene lifetime; `resetFpsRing()` clears the watchdog flag on each zone enter so the effect can re-enable if conditions improve across zones.

### Real-device measurements

| Device | Cold-start TTI | Sustained fps | Notes |
|---|---|---|---|
| Galaxy A54 | — | — | Pending real-device measurement (session #107, 2026-05-09) |
| Pixel 7 | — | — | Pending real-device measurement (session #107, 2026-05-09) |
| iPhone 12 | — | — | Deferred to future iOS-smoke row (post-Android landing) |

---

## 2026-05-07 — Post ship-anatomy + postfx polish (session #96)

### Design-limit table (5-effect postfx chain)

The chain now contains 5 effects added in sessions #75–#94:

| Effect | Enabled at rest | Enabled in Z8 (Lucyper) |
|---|---|---|
| vignette | yes | yes |
| bloom | yes | yes |
| grayscale-flash | yes (intensity 0) | yes |
| chromatic-aberration | no (trigger-gated) | no |
| crt | no | yes |

Active passes at rest: **3** (vignette + bloom + grayscale-flash). `BUDGET_LIMITS.postfx = 3`.
Maximum active in Z8: **5** (all five). The budget limit reflects the at-rest baseline; Z8 exceeds it by design with CRT on — this is acceptable because Z8 is the final zone and the A54 was measured capable of 5 passes (device run pending).

### New budget dimension: subShapeDraws

Ship entities are pre-baked to atlas frames at boot (hull + weapons + engine). Each frame represents N sub-shapes that were drawn during atlas construction. `BUDGET_LIMITS.subShapeDraws = 240`.

Derivation: 40 concurrent ship entities (enemies + player + boss + miniboss, worst-case Zone 7 gauntlet) × 6 sub-shapes max (Boruta and Lucyper each have hull + 4 weapons + engine = 6). The 40-entity ceiling is generous — a realistic busy frame has ~25 ships alive.

The counter is accumulated in `play.ts` each frame by iterating `shipQuery`, looking up each entity's frame name in `SHIP_SUB_SHAPES`, and calling `recordSubShapeDraws(n)`. The accumulator is drained by `consumeSubShapeDrawCount()` into `BudgetSnapshot.subShapeDraws`. Zero-alloc.

### FPS watchdog update

The watchdog now disables **both** `chromatic-aberration` and `crt` on first trigger (previously only chromatic-ab). Rationale: CRT is a texture-sample pass that adds measurable GPU cost; if the device can't hold 55 fps average it should also be dropped. The second call remains a no-op (sticky flag). Vignette, bloom, and grayscale-flash are not dropped automatically.

### Real-device TTI measurements (session #107, 2026-05-09)

| Device | Cold-start TTI (median of 3) | Sustained fps | Notes |
|---|---|---|---|
| Galaxy A54 | — | — | Captured via `[boot-trace]` adb logcat — see "Cold-start TTI capture recipe" above. Pending session #107 device-run. |
| Pixel 7 | — | — | Captured via `[boot-trace]` adb logcat — see recipe above. Pending session #107 device-run. |
| iPhone 12 | — | — | Deferred to future iOS-smoke row. Will use Xcode Instruments > Time Profiler "App Launch" template. |

Android columns are filled during PT-DeviceSmoke (#107) using the in-app `dumpBootTrace` helper + adb logcat capture. iOS measurement is held for the deferred iOS-smoke row.
